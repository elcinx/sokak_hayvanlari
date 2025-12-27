const db = require("../model/data");
const preferredSlugs = ["resim-1", "resim-2", "resim-3", "resim-4"];

const orderAnnouncements = (items) => {
    if (!Array.isArray(items)) return [];
    const bySlug = new Map(items.map((item) => [item.slug, item]));
    const ordered = [];
    preferredSlugs.forEach((slug) => {
        if (bySlug.has(slug)) ordered.push(bySlug.get(slug));
    });
    items.forEach((item) => {
        if (!preferredSlugs.includes(item.slug)) ordered.push(item);
    });
    return ordered;
};






exports.userHome = async (req, res, next) => {
    try {
        const [announcements] = await db.execute("SELECT * FROM announcements WHERE is_active=1 ORDER BY publish_at DESC LIMIT 10");
        const orderedAnnouncements = orderAnnouncements(announcements);
        const [[totalFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs");
        const [[activePoints]] = await db.execute("SELECT COUNT(DISTINCT CONCAT(ROUND(lat,4), ',', ROUND(lng,4))) AS c FROM feed_logs");
        const [[todayFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs WHERE DATE(created_at)=CURDATE()");
        const [galleryRaw] = await db.execute(
            `SELECT id, photo_url, note AS title FROM feed_logs 
             WHERE photo_url IS NOT NULL ORDER BY created_at DESC LIMIT 6`
        );
        const gallery = galleryRaw.map(g=>({
            ...g,
            image_path: g.photo_url || null
        }));
        const [[totalVisits]] = await db.execute("SELECT COUNT(*) AS c FROM visit_logs");
        const [[todayVisits]] = await db.execute("SELECT COUNT(*) AS c FROM visit_logs WHERE DATE(visited_at)=CURDATE()");
        const slugify = require("slugify");
        res.render("user/index", {
            title: "Ana sayfa",
            contentTitle: "Ana sayfa",
            data: orderedAnnouncements,
            summary: {
                totalFeeds: totalFeeds?.c || 0,
                activePoints: activePoints?.c || 0,
                todayFeeds: todayFeeds?.c || 0,
                totalVisits: totalVisits?.c || 0,
                todayVisits: todayVisits?.c || 0,
            },
            gallery,
            slugify,
        });
    } catch (err) {
        return next(err);
    }
};

exports.viewAnc = async (req, res, next) => {
    try {
        const slug = req.params.slug;
        const [selectedData] = await db.execute("SELECT * FROM announcements WHERE slug=?", [slug]);
        if (!selectedData[0]) return next("Bulunamadi");
        let [allData] = await db.execute("SELECT * FROM announcements WHERE is_active=1 ORDER BY publish_at DESC");
        allData = orderAnnouncements(allData);
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
        // Database baglantisi yoksa sample data kullan
        let allData = [];
        try {
            [allData] = await db.execute("SELECT * FROM announcements WHERE is_active=1 ORDER BY publish_at DESC");
            allData = orderAnnouncements(allData);
        } catch (dbErr) {
            allData = [];
        }

        res.render("user/announcements", {
            title: "Duyurular",
            contentTitle: "Duyurular",
            data: allData,
        });
    } catch (err) {
        next(err);
    }
};

