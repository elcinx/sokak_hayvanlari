const db = require("../model/data");

exports.addEntry = async (userId, sourceType, sourceId, points) => {
    await db.execute(
        "INSERT INTO points_ledger (user_id, source_type, source_id, points) VALUES (?,?,?,?)",
        [userId, sourceType, sourceId || null, points]
    );
};

exports.totalPoints = async (userId) => {
    const [[row]] = await db.execute("SELECT COALESCE(SUM(points),0) AS total FROM points_ledger WHERE user_id=?", [userId]);
    return row?.total || 0;
};
