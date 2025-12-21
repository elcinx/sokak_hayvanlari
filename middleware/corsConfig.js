const cors = require("cors");
const config = require("../config");

const isProd = config.nodeEnv === "production";
const allowlist = config.corsAllowlist;

const corsOptions = isProd
    ? {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowlist.includes(origin)) return callback(null, true);
            const err = new Error("CORS_BLOCKED");
            err.origin = origin;
            return callback(err);
        },
        credentials: true
    }
    : { origin: true, credentials: true };

const baseCors = cors(corsOptions);

module.exports = (req, res, next) => {
    baseCors(req, res, (err) => {
        if (err && err.message === "CORS_BLOCKED") {
            const origin = err.origin || req.headers.origin || "-";
            const host = req.headers.host || "-";
            const path = req.originalUrl || "-";
            console.error(`[CORS] blocked origin=${origin} host=${host} path=${path} allowlist=${allowlist.join(",")}`);
            return res.status(403).json({ error: "CORS not allowed" });
        }
        next(err);
    });
};
