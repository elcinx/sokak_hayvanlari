const db = require("../model/data");
const metrics = require("./metrics");
const logger = require("../utils/logger");
const config = require("../config");
const storage = require("../services/storage");

exports.dashboard = async (req, res, next) => {
    try {
        const [[totalFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs");
        const [[todayFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs WHERE DATE(created_at)=CURDATE()");
        const [[activePoints]] = await db.execute("SELECT COUNT(DISTINCT CONCAT(ROUND(lat,4), ',', ROUND(lng,4))) AS c FROM feed_logs");
        const online = metrics.getOnlineCount();

        const [weekly] = await db.execute(
            `SELECT u.name, COALESCE(SUM(p.points),0) AS points
             FROM points_ledger p
             INNER JOIN users u ON u.userid=p.user_id
             WHERE p.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             GROUP BY u.userid, u.name
             ORDER BY points DESC
             LIMIT 5`
        );

        const base = require("../config").baseUrl.replace(/\/$/,"");
        const [feeds] = await db.execute(
            `SELECT f.*, u.name,
                (SELECT COUNT(*) FROM feed_comments fc WHERE fc.feed_id=f.id AND fc.is_deleted=0) AS comment_count,
                (SELECT COUNT(*) FROM feed_likes fl WHERE fl.feed_id=f.id) AS like_count
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             ORDER BY f.created_at DESC
             LIMIT 10`
        );
        const feedsMapped = feeds.map(f=>({
            ...f,
            photo_url: f.photo_url || (f.photo_path ? `${base}/${f.photo_path}` : null)
        }));

        res.render("admin/dashboard", {
            title: "Admin Dashboard",
            contentTitle: "Dashboard",
            stats: {
                totalFeeds: totalFeeds?.c || 0,
                todayFeeds: todayFeeds?.c || 0,
                activePoints: activePoints?.c || 0,
                online
            },
            weekly,
            feeds: feedsMapped
        });
    } catch (err) {
        logger.error(req, err, "admin_dashboard");
        next(err);
    }
};

exports.feedList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const limit = 20;
        const offset = (page - 1) * limit;
        const base = require("../config").baseUrl.replace(/\/$/,"");
        const [feeds] = await db.execute(
            `SELECT f.*, u.name,
                (SELECT COUNT(*) FROM feed_comments fc WHERE fc.feed_id=f.id AND fc.is_deleted=0) AS comment_count,
                (SELECT COUNT(*) FROM feed_likes fl WHERE fl.feed_id=f.id) AS like_count
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             ORDER BY f.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        const [[count]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs");
        const totalPages = Math.ceil((count?.c || 0)/limit);
        const feedsMapped = feeds.map(f=>({
            ...f,
            photo_url: f.photo_url || (f.photo_path ? `${base}/${f.photo_path}` : null)
        }));

        res.render("admin/feeds", {
            title:"Feed Yönetimi",
            contentTitle:"Feed Yönetimi",
            feeds: feedsMapped,
            page,
            totalPages
        });
    } catch (err) {
        logger.error(req, err, "admin_feed_list");
        next(err);
    }
};

exports.commentsList = async (req, res, next) => {
    try {
        const [rows] = await db.execute(
            `SELECT fc.*, u.name, f.id AS feed_id
             FROM feed_comments fc
             INNER JOIN users u ON u.userid=fc.user_id
             INNER JOIN feed_logs f ON f.id=fc.feed_id
             ORDER BY fc.created_at DESC
             LIMIT 50`
        );
        res.render("admin/comments", {
            title:"Yorum Moderasyonu",
            contentTitle:"Yorum Moderasyonu",
            comments: rows
        });
    } catch (err) {
        logger.error(req, err, "admin_comments_list");
        next(err);
    }
};

exports.galleryList = async (req, res, next) => {
    try {
        const base = config.baseUrl.replace(/\/$/,"");
        const [rows] = await db.execute(
            `SELECT f.id, f.photo_url, f.photo_path, f.note AS title, f.created_at, u.name AS owner
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             WHERE f.photo_path IS NOT NULL OR f.photo_url IS NOT NULL
             ORDER BY f.created_at DESC
             LIMIT 50`
        );
        const items = rows.map(r=>({
            ...r,
            image_url: (r.photo_url && (r.photo_url.startsWith("http://") || r.photo_url.startsWith("https://"))) ? r.photo_url : null,
            url: (r.photo_url && (r.photo_url.startsWith("http://") || r.photo_url.startsWith("https://"))) ? r.photo_url : null
        }));
        res.render("admin/gallery-list", {
            title:"Galeri Yönetimi",
            contentTitle:"Galeri Yönetimi",
            items,
            csrfToken: req.csrfToken()
        });
    } catch (err) {
        logger.error(req, err, "admin_gallery_list");
        next(err);
    }
};

exports.galleryAddForm = (req, res) => {
    res.render("admin/gallery-add", {
        title:"Galeri Yönetimi",
        contentTitle:"Resim Yükle",
        csrfToken: req.csrfToken()
    });
};

exports.galleryAddCreate = async (req, res, next) => {
    try {
        const title = (req.body.title || "").trim();
        if (!req.file) {
            return res.status(400).send("Resim yüklenmedi");
        }
        const saved = await storage.saveImage(req.file);
        const photoUrl = saved.url;
        const photoKey = saved.key;
        const photoPath = saved.key.startsWith("uploads") ? saved.key : null;
        await db.execute(
            "INSERT INTO feed_logs (user_id, photo_path, photo_url, photo_key, lat, lng, note, points) VALUES (?,?,?,?,?,?,?,0)",
            [req.session.userid, photoPath, photoUrl, photoKey, 0, 0, title || null]
        );
        return res.redirect("/admin/gallery/list");
    } catch (err) {
        logger.error(req, err, "admin_gallery_add");
        next(err);
    }
};

exports.galleryDelete = async (req, res, next) => {
    try {
        const galleryId = req.params.id;
        const [[row]] = await db.execute("SELECT photo_key, photo_path FROM feed_logs WHERE id=?", [galleryId]);
        if (row && (row.photo_key || row.photo_path)) {
            await storage.deleteImage(row.photo_key || row.photo_path);
        }
        await db.execute("DELETE FROM feed_logs WHERE id=?", [galleryId]);
        return res.redirect("/admin/gallery/list");
    } catch (err) {
        logger.error(req, err, "admin_gallery_delete");
        next(err);
    }
};

exports.deleteComment = async (req, res, next) => {
    try {
        await db.execute("UPDATE feed_comments SET is_deleted=1 WHERE id=?", [req.params.id]);
        res.redirect("/admin/comments");
    } catch (err) {
        logger.error(req, err, "admin_delete_comment");
        next(err);
    }
};

exports.badgesPage = async (req, res, next) => {
    try {
        const [badges] = await db.execute(
            `SELECT b.*, COUNT(ub.id) AS user_count
             FROM badges b
             LEFT JOIN user_badges ub ON ub.badge_id=b.id
             GROUP BY b.id`
        );
        const [recent] = await db.execute(
            `SELECT ub.*, b.name AS badge_name, u.name AS user_name
             FROM user_badges ub
             INNER JOIN badges b ON b.id=ub.badge_id
             INNER JOIN users u ON u.userid=ub.user_id
             ORDER BY ub.earned_at DESC
             LIMIT 20`
        );
        res.render("admin/badges", {
            title:"Rozetler",
            contentTitle:"Rozetler",
            badges,
            recent
        });
    } catch (err) {
        logger.error(req, err, "admin_badges");
        next(err);
    }
};
