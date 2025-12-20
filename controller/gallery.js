const db = require("../model/data");
const slugify = require("slugify");
const config = require("../config");

// Kullanıcı galeri sayfası
exports.listPublic = async (req, res, next) => {
    try {
        const base = config.baseUrl.replace(/\/$/,"");
        const [rows] = await db.execute(
            `SELECT f.id, f.photo_url, f.photo_path, f.note AS title, f.created_at, u.name AS owner
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             WHERE f.photo_path IS NOT NULL
             ORDER BY f.created_at DESC
             LIMIT 50`
        );
        const items = rows.map(r=>({
            ...r,
            image_path: r.photo_url || (r.photo_path ? `${base}/${r.photo_path}` : null)
        }));
        res.render("user/gallery", {
            title: "Galeri",
            contentTitle: "Galeri",
            items,
        });
    } catch (err) {
        next(err);
    }
};

exports.viewOne = async (req, res, next) => {
    try {
        const base = config.baseUrl.replace(/\/$/,"");
        const slug = req.params.slug || "";
        const id = parseInt(slug.split("-")[0], 10);
        const [[item]] = await db.execute(
            `SELECT f.*, f.photo_url, f.photo_path, u.name AS owner 
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             WHERE f.id=?`,
            [id]
        );
        if (!item) return next("Bulunamadı");
        const [others] = await db.execute(
            `SELECT id, photo_url, photo_path, note AS title FROM feed_logs 
             WHERE photo_path IS NOT NULL 
             ORDER BY created_at DESC LIMIT 6`
        );
        res.render("user/gallery-view", {
            title: item.title || "Galeri",
            contentTitle: item.title || "Galeri",
            item:{...item, image_path:item.photo_url || (item.photo_path ? `${base}/${item.photo_path}`:null)},
            others:others.map(o=>({...o, image_path:o.photo_url || (o.photo_path?`${base}/${o.photo_path}`:null)})),
            slugify,
        });
    } catch (err) {
        next(err);
    }
};

// API: son 50 foto
exports.apiList = async (req, res, next) => {
    try {
        const base = config.baseUrl.replace(/\/$/,"");
        const [rows] = await db.execute(
            `SELECT f.id, f.photo_url, f.photo_path, f.note AS title, f.lat, f.lng, f.created_at, u.name AS owner 
             FROM feed_logs f
             LEFT JOIN users u ON u.userid=f.user_id
             WHERE f.photo_path IS NOT NULL
             ORDER BY f.created_at DESC
             LIMIT 50`
        );
        const mapped = rows.map(r=>({
            ...r,
            image_path: r.photo_url || (r.photo_path ? `${base}/${r.photo_path}` : null)
        }));
        res.json(mapped);
    } catch (err) {
        next(err);
    }
};
