const db = require("../model/data");

// Socket.IO online count referansı için
let onlineCount = () => 0;
exports.setOnlineCountRef = (getCountFn) => {
    onlineCount = getCountFn;
};

exports.getOnlineCount = () => {
    return typeof onlineCount === "function" ? onlineCount() : 0;
};

exports.summary = async (req, res, next) => {
    try {
        const [[totalFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs");
        const [[activePoints]] = await db.execute(
            // Nokta sayısını daha doğru hesaplamak için koordinatları 4 ondalık basamağa yuvarla
            "SELECT COUNT(*) AS c FROM (SELECT 1 FROM feed_logs GROUP BY ROUND(lat,4), ROUND(lng,4)) t"
        );
        const [[todayFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs WHERE DATE(created_at)=CURDATE()");
        const [[totalVisits]] = await db.execute("SELECT COUNT(*) AS c FROM visit_logs");
        const [[todayVisits]] = await db.execute(
            "SELECT COUNT(*) AS c FROM visit_logs WHERE DATE(CONVERT_TZ(visited_at,'+00:00','+03:00'))=CURDATE()"
        );
        const [[totalGallery]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs WHERE photo_url IS NOT NULL");
        const [[totalAnnouncements]] = await db.execute("SELECT COUNT(*) AS c FROM announcements WHERE is_active=1");
        res.json({
            totalFeeds: totalFeeds?.c || 0,
            activePoints: activePoints?.c || 0,
            todayFeeds: todayFeeds?.c || 0,
            totalVisits: totalVisits?.c || 0,
            todayVisits: todayVisits?.c || 0,
            totalGallery: totalGallery?.c || 0,
            totalAnnouncements: totalAnnouncements?.c || 0,
            online: onlineCount(),
        });
    } catch (err) {
        next(err);
    }
};

exports.visit = (req, res) => {
    res.json({ ok: true, logged: req.visitLogged === true });
};

exports.online = (req, res) => {
    res.json({ online: onlineCount() });
};

exports.sitemap = async (req, res, next) => {
    try {
        const slugify = require("slugify");
        const publicRoutes = require("../config/publicRoutes");
        const base = `${req.protocol}://${req.get("host")}`;
        const [ann] = await db.execute("SELECT slug FROM announcements WHERE is_active=1 AND slug IS NOT NULL");
        const [gallery] = await db.execute(
            "SELECT id, note AS title FROM feed_logs WHERE photo_url IS NOT NULL ORDER BY created_at DESC"
        );
        const urls = [
            ...publicRoutes.map((p) => `${base}${p}`),
            ...ann.map((a) => `${base}/announcements/${a.slug}`),
            ...gallery.map((g) => `${base}/gallery/${g.id}-${slugify(g.title || '', { lower:true, strict:true })}`),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;
        res.header("Content-Type", "application/xml");
        res.send(xml);
    } catch (err) {
        next(err);
    }
};
