const db = require("../model/data");
const badgeService = require("../services/badges");
const points = require("../services/points");
const logger = require("../utils/logger");
const storage = require("../services/storage");
const config = require("../config");

const toPointKey = (lat, lng) => `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;

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
        if (!parsed || (parsed.lat === 0 && parsed.lng === 0)) {
            return res.status(400).json({ error: "Konum zorunlu" });
        }
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
            `SELECT f.id, f.lat, f.lng, f.note, f.created_at, f.photo_url, f.photo_path,
                u.name AS user_name,
                (SELECT COUNT(*) FROM feed_comments fc WHERE fc.feed_id=f.id AND fc.is_deleted=0) AS comments_count,
                (SELECT COUNT(*) FROM feed_likes fl WHERE fl.feed_id=f.id) AS likes_count
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             WHERE f.created_at >= (NOW() - INTERVAL 30 DAY)
             ORDER BY f.created_at DESC`
        );
        const [pointRows] = await db.execute(
            `SELECT pts.lat_r, pts.lng_r,
                    MAX(f.created_at) AS last_feed_at,
                    SUM(CASE WHEN f.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS feed_count_7d
             FROM (
                SELECT DISTINCT ROUND(lat,4) AS lat_r, ROUND(lng,4) AS lng_r
                FROM feed_logs
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             ) AS pts
             INNER JOIN feed_logs f
                ON ROUND(f.lat,4)=pts.lat_r AND ROUND(f.lng,4)=pts.lng_r
             GROUP BY pts.lat_r, pts.lng_r`
        );
        const pointStats = {};
        pointRows.forEach((p) => {
            const key = `${Number(p.lat_r).toFixed(4)},${Number(p.lng_r).toFixed(4)}`;
            pointStats[key] = {
                last_feed_at: p.last_feed_at,
                feed_count_7d: Number(p.feed_count_7d || 0),
            };
        });

        const base = config.baseUrl.replace(/\/$/, "");
        const now = Date.now();
        const mapped = rows.map((r) => {
            const url = r.photo_url || (r.photo_path ? `${base}/${r.photo_path}` : null);
            const point_key = toPointKey(r.lat, r.lng);
            const stats = pointStats[point_key];
            const createdAt = new Date(r.created_at);
            let status = "normal";
            const hoursSince = (now - createdAt.getTime()) / (1000 * 60 * 60);
            if (hoursSince <= 48) {
                status = "new";
            } else if (stats && now - new Date(stats.last_feed_at).getTime() >= 7 * 24 * 60 * 60 * 1000) {
                status = "critical";
            } else if (stats && stats.feed_count_7d >= 3) {
                status = "steady";
            }
            return {
                id: r.id,
                lat: Number(r.lat),
                lng: Number(r.lng),
                note: r.note || null,
                created_at: r.created_at,
                user_name: r.user_name || "Kullanici",
                photo_url: url,
                comments_count: Number(r.comments_count || 0),
                likes_count: Number(r.likes_count || 0),
                point_key,
                status,
            };
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
            `SELECT ROUND(lat,4) AS lat, ROUND(lng,4) AS lng, COUNT(*) AS intensity
             FROM feed_logs
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY ROUND(lat,4), ROUND(lng,4)
             ORDER BY intensity DESC
             LIMIT 1000`,
            [days]
        );
        const mapped = rows.map((r) => ({
            lat: Number(r.lat),
            lng: Number(r.lng),
            intensity: Number(r.intensity || 0),
        }));
        res.json(mapped);
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
