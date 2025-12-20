const db = require("../model/data");
const slugify = require("slugify");

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
    const isActive = body.isActive ? true : false;
    try {
        await db.execute(
            "INSERT INTO announcements (title, exp, is_active, created_by, slug, category, publish_at) VALUES (?,?,?,?,?,?,?)",
            [
                body.title,
                body.explain,
                isActive,
                req.session.userid,
                slugify(body.title || "", { lower: true, strict: true }),
                body.category || null,
                body.publish_at || new Date(),
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
        await db.execute(
            "UPDATE announcements SET title=?, exp=?, is_active=?, created_by=?, slug=?, category=?, publish_at=? WHERE noticeid=?",
            [
                req.body.title,
                req.body.explain,
                isActive,
                req.body.user,
                slugify(req.body.title || "", { lower: true, strict: true }),
                req.body.category || null,
                req.body.publish_at || new Date(),
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
