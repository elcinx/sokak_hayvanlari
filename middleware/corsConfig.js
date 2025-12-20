const cors = require("cors");
const config = require("../config");

const isProd = config.nodeEnv === "production";

const allowlist = config.corsAllowlist;

const corsMiddleware = isProd
    ? cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowlist.includes(origin)) return callback(null, true);
            return callback(new Error("CORS not allowed"), false);
        },
        credentials: true
    })
    : cors({ origin: true, credentials: true });

module.exports = corsMiddleware;
