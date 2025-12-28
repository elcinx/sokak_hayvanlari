const db = require("../model/data");
const points = require("../services/points");
const badges = require("../services/badges");

exports.weekly = async (req, res, next) => {
    try {
        const [rows] = await db.execute(
            `SELECT u.name, u.userid, p.points,
                    COALESCE(b.badges, '') AS badges
             FROM (
                SELECT user_id, COALESCE(SUM(points),0) AS points
                FROM points_ledger
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                GROUP BY user_id
             ) p
             INNER JOIN users u ON u.userid=p.user_id
             LEFT JOIN (
                SELECT ub.user_id,
                       GROUP_CONCAT(DISTINCT b.name ORDER BY b.name SEPARATOR ', ') AS badges
                FROM user_badges ub
                INNER JOIN badges b ON b.id=ub.badge_id AND b.is_active=1
                GROUP BY ub.user_id
             ) b ON b.user_id=u.userid
             ORDER BY p.points DESC
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
