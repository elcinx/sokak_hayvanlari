const db = require("../model/data");
const slugify = require("slugify");

const buildUniqueSlug = async (title, excludeId = null) => {
    const base = slugify(title || "", { lower: true, strict: true }) || "duyuru";
    const like = `${base}%`;
    const params = excludeId ? [like, excludeId] : [like];
    const where = excludeId ? "WHERE slug LIKE ? AND noticeid<>?" : "WHERE slug LIKE ?";
    const [rows] = await db.execute(`SELECT slug FROM announcements ${where}`, params);
    const existing = rows.map((r) => r.slug);
    if (!existing.includes(base)) {
        return base;
    }
    let max = 1;
    existing.forEach((s) => {
        const match = s.match(new RegExp(`^${base}-(\\d+)$`));
        if (match) {
            const n = parseInt(match[1], 10);
            if (n > max) max = n;
        }
    });
    return `${base}-${max + 1}`;
};

exports.adminList = async (req, res) => {
    const [rows] = await db.execute(`
        SELECT a.*, u.name 
        FROM announcements a 
        LEFT JOIN users u ON a.created_by=u.userid
        ORDER BY a.created_at DESC
    `);
    res.render("admin/list-anc", { title: "Duyuru Listele", contentTitle: "Duyuru Listesi", data: rows });
};

exports.adminGetAddAnc = (req, res) => {
    res.render("admin/add-anc", { title: "Admin Duyuru Ekle", contentTitle: "Duyuru Ekle" });
};

exports.adminPostAddAnc = async (req, res, next) => {
    const body = req.body;
    const isActive = body.isActive === "0" ? false : true;
    try {
        const slug = await buildUniqueSlug(body.title || "");
        let imageUrl = null;
        let imageKey = null;
        if (req.file) {
            const storage = require("../services/storage");
            const saved = await storage.saveImage(req.file);
            imageUrl = saved.url;
            imageKey = saved.key;
        }
        await db.execute(
            "INSERT INTO announcements (title, exp, is_active, created_by, slug, category, publish_at, image_url, image_key) VALUES (?,?,?,?,?,?,?,?,?)",
            [
                body.title,
                body.explain,
                isActive,
                req.session.userid,
                slug,
                body.category || null,
                body.publish_at || new Date(),
                imageUrl,
                imageKey,
            ]
        );
    } catch (err) {
        return next(err);
    }
    res.redirect("/admin");
};

exports.adminGetEditAnc = async (req, res, next) => {
    try {
        const [selected] = await db.execute("SELECT * FROM announcements WHERE noticeid=?", [req.params.id]);
        const [users] = await db.execute("SELECT * FROM users");
        res.render("admin/edit-anc", { title: "Duyuru Düzeltme", contentTitle: "Duyuru Güncelle", oldData: selected[0], users });
    } catch (err) {
        return next(err);
    }
};

exports.adminPostEditAnc = async (req, res, next) => {
    const isActive = req.body.isActive ? true : false;
    try {
        const slug = await buildUniqueSlug(req.body.title || "", req.body.noticeid);
        let imageUrl = null;
        let imageKey = null;
        if (req.file) {
            const storage = require("../services/storage");
            const saved = await storage.saveImage(req.file);
            imageUrl = saved.url;
            imageKey = saved.key;
        }
        await db.execute(
            "UPDATE announcements SET title=?, exp=?, is_active=?, created_by=?, slug=?, category=?, publish_at=?, image_url=COALESCE(?, image_url), image_key=COALESCE(?, image_key) WHERE noticeid=?",
            [
                req.body.title,
                req.body.explain,
                isActive,
                req.body.user,
                slug,
                req.body.category || null,
                req.body.publish_at || new Date(),
                imageUrl,
                imageKey,
                req.body.noticeid,
            ]
        );
    } catch (err) {
        return next(err);
    }
    res.redirect("/admin");
};

exports.get_deleteAnc = async (req, res, next) => {
    try {
        await db.execute("DELETE FROM announcements WHERE noticeid=?", [req.params.id]);
    } catch (err) {
        return next(err);
    }
    res.redirect("/admin");
};

exports.post_deleteAnc = async (req, res, next) => {
    try {
        await db.execute("DELETE FROM announcements WHERE noticeid=?", [req.body.ancid]);
    } catch (err) {
        return next(err);
    }
    res.redirect("/admin");
};
