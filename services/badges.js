const db = require("../model/data");
const points = require("./points");

const bonusPoints = 50;

const getBadgeByCode = async (code) => {
    const [[badge]] = await db.execute("SELECT * FROM badges WHERE code=? AND is_active=1", [code]);
    return badge;
};

const hasBadge = async (userId, badgeId) => {
    const [[row]] = await db.execute("SELECT 1 FROM user_badges WHERE user_id=? AND badge_id=?", [userId, badgeId]);
    return !!row;
};

const awardBadge = async (userId, badge) => {
    if (!badge) return;
    await db.execute("INSERT IGNORE INTO user_badges (user_id, badge_id) VALUES (?,?)", [userId, badge.id]);
    await points.addEntry(userId, "badge", badge.id, bonusPoints);
};

const checkIstikrarlı = async (userId) => {
    const [[row]] = await db.execute(
        `SELECT COUNT(DISTINCT DATE(created_at)) AS c
         FROM feed_logs
         WHERE user_id=? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
        [userId]
    );
    return row?.c >= 7;
};

const checkKesifci = async (userId) => {
    const [[row]] = await db.execute(
        `SELECT COUNT(DISTINCT CONCAT(ROUND(lat,4), ',', ROUND(lng,4))) AS c
         FROM feed_logs WHERE user_id=?`,
        [userId]
    );
    return row?.c >= 10;
};

const checkKisKahramani = async (userId) => {
    const [[row]] = await db.execute(
        `SELECT COUNT(*) AS c
         FROM feed_logs
         WHERE user_id=? 
           AND MONTH(created_at) IN (12,1,2)
           AND created_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`,
        [userId]
    );
    return row?.c >= 20;
};

exports.checkAndAssignBadges = async (userId) => {
    const badges = {
        ISTIKRARLI: await getBadgeByCode("ISTIKRARLI"),
        KESIFCI: await getBadgeByCode("KESIFCI"),
        KIS_KAHRAMANI: await getBadgeByCode("KIS_KAHRAMANI"),
    };

    if (badges.ISTIKRARLI) {
        const ok = await checkIstikrarlı(userId);
        if (ok && !(await hasBadge(userId, badges.ISTIKRARLI.id))) {
            await awardBadge(userId, badges.ISTIKRARLI);
        }
    }

    if (badges.KESIFCI) {
        const ok = await checkKesifci(userId);
        if (ok && !(await hasBadge(userId, badges.KESIFCI.id))) {
            await awardBadge(userId, badges.KESIFCI);
        }
    }

    if (badges.KIS_KAHRAMANI) {
        const ok = await checkKisKahramani(userId);
        if (ok && !(await hasBadge(userId, badges.KIS_KAHRAMANI.id))) {
            await awardBadge(userId, badges.KIS_KAHRAMANI);
        }
    }
};

exports.listBadges = async () => {
    const [rows] = await db.execute("SELECT * FROM badges WHERE is_active=1");
    return rows;
};

exports.userBadges = async (userId) => {
    const [rows] = await db.execute(
        `SELECT b.* , ub.earned_at 
         FROM user_badges ub
         INNER JOIN badges b ON b.id=ub.badge_id
         WHERE ub.user_id=?`,
        [userId]
    );
    return rows;
};
