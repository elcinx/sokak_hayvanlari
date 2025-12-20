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
        const [[activePoints]] = await db.execute("SELECT COUNT(DISTINCT CONCAT(lat, ',', lng)) AS c FROM feed_logs");
        const [[todayFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs WHERE DATE(created_at)=CURDATE()");
        res.json({
            totalFeeds: totalFeeds?.c || 0,
            activePoints: activePoints?.c || 0,
            todayFeeds: todayFeeds?.c || 0,
            online: onlineCount(),
        });
    } catch (err) {
        next(err);
    }
};

exports.online = (req, res) => {
    res.json({ online: onlineCount() });
};

exports.sitemap = async (req, res, next) => {
    try {
        const base = `${req.protocol}://${req.get("host")}`;
        const [ann] = await db.execute("SELECT slug FROM announcements WHERE is_active=1 AND slug IS NOT NULL");
        const urls = [
            `${base}/`,
            `${base}/gallery`,
            `${base}/announcements`,
            ...ann.map((a) => `${base}/announcements/${a.slug}`),
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
