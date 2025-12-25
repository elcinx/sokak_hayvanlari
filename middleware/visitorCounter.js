const crypto = require("crypto");
const db = require("../model/data");
const config = require("../config");

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const hashValue = (value) => {
    return crypto.createHash("sha256").update(value).digest("hex");
};

module.exports = async (req, res, next) => {
    try {
        const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";
        const ua = req.headers["user-agent"] || "";
        const salt = config.sessionSecret || "visitor";
        const ipHash = hashValue(`${ip}:${salt}`);
        const uaHash = hashValue(`${ua}:${salt}`);

        const [[last]] = await db.execute(
            "SELECT visited_at FROM visit_logs WHERE ip_hash=? AND ua_hash=? ORDER BY visited_at DESC LIMIT 1",
            [ipHash, uaHash]
        );
        if (last && last.visited_at) {
            const lastTime = new Date(last.visited_at).getTime();
            if (Date.now() - lastTime < TWO_HOURS_MS) {
                req.visitLogged = false;
                return next();
            }
        }

        await db.execute(
            "INSERT INTO visit_logs (ip_hash, ua_hash, visited_at) VALUES (?,?,NOW())",
            [ipHash, uaHash]
        );
        req.visitLogged = true;
        next();
    } catch (err) {
        next(err);
    }
};
