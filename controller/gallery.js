const db = require("../model/data");
const slugify = require("slugify");
const config = require("../config");

// Kullanıcı galeri sayfası
exports.listPublic = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const limit = 12;
        const offset = (page - 1) * limit;
        const [rows] = await db.execute(
            `SELECT f.id, f.photo_url, f.note AS title, f.created_at, u.name AS owner
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             WHERE f.photo_url IS NOT NULL
             ORDER BY f.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        const [[count]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs WHERE photo_url IS NOT NULL");
        const totalPages = Math.max(1, Math.ceil((count?.c || 0) / limit));
        const items = rows.map(r=>({
            ...r,
            image_path: r.photo_url
        }));
        res.render("user/gallery", {
            title: "Galeri",
            contentTitle: "Galeri",
            items,
            page,
            totalPages,
        });
    } catch (err) {
        next(err);
    }
};

exports.viewOne = async (req, res, next) => {
    try {
        const slug = req.params.slug || "";
        const id = parseInt(slug.split("-")[0], 10);
        const [[item]] = await db.execute(
            `SELECT f.*, f.photo_url, u.name AS owner 
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             WHERE f.id=?`,
            [id]
        );
        if (!item) return next("Bulunamadı");
        const [others] = await db.execute(
            `SELECT id, photo_url, note AS title FROM feed_logs 
             WHERE photo_url IS NOT NULL 
             ORDER BY created_at DESC LIMIT 6`
        );
        res.render("user/gallery-view", {
            title: item.title || "Galeri",
            contentTitle: item.title || "Galeri",
            item:{...item, image_path:item.photo_url || null},
            others:others.map(o=>({...o, image_path:o.photo_url || null})),
            slugify,
        });
    } catch (err) {
        next(err);
    }
};

// API: son 50 foto
exports.apiList = async (req, res, next) => {
    try {
        const [rows] = await db.execute(
            `SELECT f.id, f.photo_url, f.note AS title, f.lat, f.lng, f.created_at, u.name AS owner 
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             WHERE f.photo_url IS NOT NULL
             ORDER BY f.created_at DESC
             LIMIT 50`
        );
        const mapped = rows.map(r=>({
            ...r,
            image_path: r.photo_url || null
        }));
        res.json(mapped);
    } catch (err) {
        next(err);
    }
};
