const crypto = require("crypto");
const db = require("../model/data");
const config = require("../config");

const hashValue = (value) => {
    return crypto.createHash("sha256").update(value).digest("hex");
};

module.exports = async (req, res, next) => {
    try {
        const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";
        const ua = req.headers["user-agent"] || "";
        const salt = config.sessionSecret || "visitor";
        const ipHash = hashValue(`${ip}:${salt}`);
        // Remove UA dependency: count only unique IP per day
        const [[last]] = await db.execute(
            "SELECT visited_at FROM visit_logs WHERE ip_hash=? AND DATE(visited_at)=CURDATE() LIMIT 1",
            [ipHash]
        );
        if (last && last.visited_at) {
            req.visitLogged = false;
            return next();
        }

        await db.execute(
            "INSERT INTO visit_logs (ip_hash, ua_hash, visited_at) VALUES (?,?,NOW())",
            [ipHash, hashValue(`${ua}:${salt}`)]
        );
        req.visitLogged = true;
        next();
    } catch (err) {
        next(err);
    }
};
