const db = require("../model/data");

exports.userHome = async (req, res, next) => {
    try {
        const [announcements] = await db.execute("SELECT * FROM announcements WHERE is_active=1 ORDER BY publish_at DESC LIMIT 10");
        const [[totalFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs");
        const [[activePoints]] = await db.execute("SELECT COUNT(DISTINCT CONCAT(lat, ',', lng)) AS c FROM feed_logs");
        const [[todayFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs WHERE DATE(created_at)=CURDATE()");
        const base = require("../config").baseUrl.replace(/\/$/,"");
        const [galleryRaw] = await db.execute(
            `SELECT id, photo_url, photo_path, note AS title FROM feed_logs 
             WHERE photo_path IS NOT NULL ORDER BY created_at DESC LIMIT 6`
        );
        const gallery = galleryRaw.map(g=>({
            ...g,
            image_path: g.photo_url || (g.photo_path ? `${base}/${g.photo_path}`:null)
        }));
        res.render("user/index", {
            title: "Ana sayfa",
            contentTitle: "Ana sayfa",
            data: announcements,
            summary: {
                totalFeeds: totalFeeds?.c || 0,
                activePoints: activePoints?.c || 0,
                todayFeeds: todayFeeds?.c || 0,
            },
            gallery,
        });
    } catch (err) {
        return next(err);
    }
};

exports.viewAnc = async (req, res, next) => {
    try {
        const slug = req.params.slug;
        const [selectedData] = await db.execute("SELECT * FROM announcements WHERE slug=?", [slug]);
        if (!selectedData[0]) return next("Bulunamadı");
        const [allData] = await db.execute("SELECT * FROM announcements WHERE is_active=1 ORDER BY publish_at DESC");
        res.render("user/view-announcement", {
            title: selectedData[0].title,
            contentTitle: selectedData[0].title,
            viewData: selectedData[0],
            data: allData,
        });
    } catch (err) {
        return next(err);
    }
};

exports.listAnnouncements = async (req, res, next) => {
    try {
        const [allData] = await db.execute("SELECT * FROM announcements WHERE is_active=1 ORDER BY publish_at DESC");
        res.render("user/announcements", {
            title: "Duyurular",
            contentTitle: "Duyurular",
            data: allData,
        });
    } catch (err) {
        next(err);
    }
};
