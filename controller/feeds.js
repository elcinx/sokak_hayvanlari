const db = require("../model/data");
const badgeService = require("../services/badges");
const points = require("../services/points");
const logger = require("../utils/logger");
const storage = require("../services/storage");
const config = require("../config");

const validateLatLng = (lat, lng) => {
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    if (Number.isNaN(la) || Number.isNaN(ln)) return false;
    if (la < -90 || la > 90) return false;
    if (ln < -180 || ln > 180) return false;
    return { lat: la, lng: ln };
};

// POST /api/feeds
exports.create = async (req, res, next) => {
    try {
        const { lat, lng, note } = req.body;
        const parsed = validateLatLng(lat, lng);
        if (!parsed) return res.status(400).json({ error: "lat/lng geçersiz aralıkta" });
        if (note && note.length > 300) {
            return res.status(400).json({ error: "Not 300 karakteri geçemez" });
        }
        let photoUrl=null, photoKey=null, photoPath=null;
        if (req.file){
            const saved = await storage.saveImage(req.file);
            photoUrl = saved.url;
            photoKey = saved.key;
            // local için geriye dönük path
            photoPath = saved.key.startsWith("uploads") ? saved.key : null;
        }
        const [result] = await db.execute(
            "INSERT INTO feed_logs (user_id, photo_path, photo_url, photo_key, lat, lng, note, points) VALUES (?,?,?,?,?,?,?,10)",
            [req.session.userid, photoPath, photoUrl, photoKey, parsed.lat, parsed.lng, note || null]
        );
        const feedId = result.insertId;
        await points.addEntry(req.session.userid, "feed", feedId, 10);
        await badgeService.checkAndAssignBadges(req.session.userid);
        return res.json({ ok: true });
    } catch (err) {
        logger.error(req, err, "create_feed");
        next(err);
    }
};

// GET /api/feeds
exports.list = async (req, res, next) => {
    try {
        const [rows] = await db.execute(
            `SELECT f.*, u.name,
                (SELECT COUNT(*) FROM feed_comments fc WHERE fc.feed_id=f.id AND fc.is_deleted=0) AS comment_count,
                (SELECT COUNT(*) FROM feed_likes fl WHERE fl.feed_id=f.id) AS like_count
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             WHERE f.created_at >= (NOW() - INTERVAL 30 DAY)
             ORDER BY f.created_at DESC`
        );
        const base = config.baseUrl.replace(/\/$/,"");
        const mapped = rows.map(r=>{
            const url = r.photo_url || (r.photo_path ? `${base}/${r.photo_path}` : null);
            return {...r, photo_url:url};
        });
        res.json(mapped);
    } catch (err) {
        next(err);
    }
};

// GET /api/feeds/:id/comments
exports.listComments = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit || "20", 10);
        const offset = parseInt(req.query.offset || "0", 10);
        const [rows] = await db.execute(
            `SELECT fc.*, u.name 
             FROM feed_comments fc
             INNER JOIN users u ON u.userid=fc.user_id
             WHERE fc.feed_id=? AND fc.is_deleted=0
             ORDER BY fc.created_at DESC
             LIMIT ? OFFSET ?`,
            [req.params.id, limit, offset]
        );
        res.json(rows);
    } catch (err) {
        logger.error(req, err, "list_comments");
        next(err);
    }
};

// POST /api/feeds/:id/comments
exports.addComment = async (req, res, next) => {
    try {
        const content = (req.body.content || "").trim();
        if (content.length < 3 || content.length > 500) {
            return res.status(400).json({ error: "Yorum 3-500 karakter arası olmalı" });
        }
        // TODO: rate limit uygulanabilir.
        await db.execute(
            "INSERT INTO feed_comments (feed_id, user_id, content) VALUES (?,?,?)",
            [req.params.id, req.session.userid, content]
        );
        res.json({ ok: true });
    } catch (err) {
        logger.error(req, err, "add_comment");
        next(err);
    }
};

// POST /api/feeds/:id/like (toggle)
exports.toggleLike = async (req, res, next) => {
    try {
        const feedId = req.params.id;
        const userId = req.session.userid;
        const [[row]] = await db.execute("SELECT id FROM feed_likes WHERE feed_id=? AND user_id=?", [feedId, userId]);
        if (row) {
            await db.execute("DELETE FROM feed_likes WHERE id=?", [row.id]);
            return res.json({ liked:false });
        } else {
            await db.execute("INSERT INTO feed_likes (feed_id, user_id) VALUES (?,?)", [feedId, userId]);
            return res.json({ liked:true });
        }
    } catch (err) {
        logger.error(req, err, "toggle_like");
        next(err);
    }
};

// GET /api/feeds/:id/likes
exports.likesInfo = async (req, res, next) => {
    try {
        const [[count]] = await db.execute("SELECT COUNT(*) AS c FROM feed_likes WHERE feed_id=?", [req.params.id]);
        let likedByMe=false;
        if (req.session && req.session.userid){
            const [[row]] = await db.execute("SELECT 1 FROM feed_likes WHERE feed_id=? AND user_id=?", [req.params.id, req.session.userid]);
            likedByMe=!!row;
        }
        res.json({ count: count?.c || 0, likedByMe });
    } catch (err) {
        logger.error(req, err, "likes_info");
        next(err);
    }
};

// Feed detay sayfası için
exports.view = async (req, res, next) => {
    try {
        const feedId = req.params.id;
        const [[feed]] = await db.execute(
            `SELECT f.*, u.name 
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             WHERE f.id=?`,
            [feedId]
        );
        if (!feed) return next("Bulunamadı");
        const [comments] = await db.execute(
            `SELECT fc.*, u.name 
             FROM feed_comments fc
             INNER JOIN users u ON u.userid=fc.user_id
             WHERE fc.feed_id=? AND fc.is_deleted=0
             ORDER BY fc.created_at DESC
             LIMIT 20`,
            [feedId]
        );
        res.render("user/feed-detail", {
            title: feed.note || "Besleme Kaydı",
            contentTitle: "Besleme",
            feed: {
                ...feed,
                photo_url: feed.photo_url || (feed.photo_path ? `${config.baseUrl.replace(/\/$/,"")}/${feed.photo_path}` : null)
            },
            comments,
        });
    } catch (err) {
        logger.error(req, err, "view_feed");
        next(err);
    }
};

// Heatmap: lat/lng count
exports.heatmap = async (req, res, next) => {
    try {
        const days = parseInt(req.query.days || "30", 10);
        const [rows] = await db.execute(
            `SELECT ROUND(lat,3) AS lat, ROUND(lng,3) AS lng, COUNT(*) AS count
             FROM feed_logs
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY ROUND(lat,3), ROUND(lng,3)`,
            [days]
        );
        res.json(rows);
    } catch (err) {
        logger.error(req, err, "heatmap");
        next(err);
    }
};

// Nokta özeti
exports.pointsSummary = async (req, res, next) => {
    try {
        const days = parseInt(req.query.days || "30", 10);
        const [rows] = await db.execute(
            `SELECT 
                ROUND(lat,4) AS lat,
                ROUND(lng,4) AS lng,
                COUNT(*) AS feed_count,
                MIN(created_at) AS first_seen,
                MAX(created_at) AS last_feed_at
             FROM feed_logs
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY ROUND(lat,4), ROUND(lng,4)`,
            [days]
        );
        const now = new Date();
        const data = rows.map(r=>{
            const last = new Date(r.last_feed_at);
            const first = new Date(r.first_seen);
            let status="normal";
            if (now - last > 3*24*60*60*1000) status="critical";
            else if (now - first < 7*24*60*60*1000) status="new";
            else if (r.feed_count >=5) status="steady";
            return {...r,status};
        });
        res.json(data);
    } catch (err) {
        logger.error(req, err, "points_summary");
        next(err);
    }
};

// Favoriler
exports.addFavorite = async (req, res, next) => {
    try {
        const { lat, lng } = req.body;
        const parsed = validateLatLng(lat, lng);
        if (!parsed) return res.status(400).json({ error:"lat/lng geçersiz" });
        await db.execute(
            "INSERT IGNORE INTO user_favorites (user_id, lat, lng) VALUES (?,?,?)",
            [req.session.userid, parsed.lat, parsed.lng]
        );
        res.json({ ok:true });
    } catch (err) { logger.error(req, err, "add_favorite"); next(err); }
};

exports.deleteFavorite = async (req, res, next) => {
    try {
        const { lat, lng } = req.body;
        const parsed = validateLatLng(lat, lng);
        if (!parsed) return res.status(400).json({ error:"lat/lng geçersiz" });
        await db.execute(
            "DELETE FROM user_favorites WHERE user_id=? AND lat=? AND lng=?",
            [req.session.userid, parsed.lat, parsed.lng]
        );
        res.json({ ok:true });
    } catch (err) { logger.error(req, err, "delete_favorite"); next(err); }
};

exports.listFavorites = async (req, res, next) => {
    try {
        const [rows] = await db.execute(
            "SELECT * FROM user_favorites WHERE user_id=? ORDER BY created_at DESC",
            [req.session.userid]
        );
        res.json(rows);
    } catch (err) { logger.error(req, err, "list_favorites"); next(err); }
};

// Admin feed silme (dosya temizliği)
exports.deleteFeed = async (req, res, next) => {
    try {
        const feedId = req.params.id;
        const [[row]] = await db.execute("SELECT photo_key, photo_path FROM feed_logs WHERE id=?", [feedId]);
        await db.execute("DELETE FROM feed_logs WHERE id=?", [feedId]);
        if (row && (row.photo_key || row.photo_path)) {
            await storage.deleteImage(row.photo_key || row.photo_path);
        }
        res.redirect("/admin/feeds");
    } catch (err) {
        logger.error(req, err, "delete_feed");
        next(err);
    }
};
