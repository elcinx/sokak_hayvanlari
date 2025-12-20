const db = require("../model/data");
const points = require("../services/points");
const badges = require("../services/badges");

exports.weekly = async (req, res, next) => {
    try {
        const [rows] = await db.execute(
            `SELECT u.name, u.userid,
                COALESCE(SUM(p.points),0) AS points
             FROM points_ledger p
             INNER JOIN users u ON u.userid=p.user_id
             WHERE p.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             GROUP BY u.userid, u.name
             ORDER BY points DESC
             LIMIT 10`
        );
        res.json(rows);
    } catch (err) { next(err); }
};

exports.monthly = async (req, res, next) => {
    try {
        const [rows] = await db.execute(
            `SELECT u.name, u.userid,
                COALESCE(SUM(p.points),0) AS points
             FROM points_ledger p
             INNER JOIN users u ON u.userid=p.user_id
             WHERE MONTH(p.created_at)=MONTH(CURDATE()) AND YEAR(p.created_at)=YEAR(CURDATE())
             GROUP BY u.userid, u.name
             ORDER BY points DESC
             LIMIT 10`
        );
        res.json(rows);
    } catch (err) { next(err); }
};

exports.meBadges = async (req, res, next) => {
    try {
        const rows = await badges.userBadges(req.session.userid);
        res.json(rows);
    } catch (err) { next(err); }
};

exports.mePoints = async (req, res, next) => {
    try {
        const total = await points.totalPoints(req.session.userid);
        const [rows] = await db.execute(
            `SELECT * FROM points_ledger 
             WHERE user_id=? 
             ORDER BY created_at DESC
             LIMIT 20`,
            [req.session.userid]
        );
        res.json({ total, ledger: rows });
    } catch (err) { next(err); }
};

// Admin badge list
exports.adminListBadges = async (req, res, next) => {
    try {
        const [rows] = await db.execute("SELECT * FROM badges");
        res.render("admin/badges", {
            title:"Rozetler",
            contentTitle:"Rozetler",
            badges: rows,
            recent: []
        });
    } catch (err) { next(err); }
};
