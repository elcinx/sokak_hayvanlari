require("dotenv").config();

const required = ["PORT","DB_HOST","DB_USER","DB_PASS","DB_NAME","SESSION_SECRET","BASE_URL","NODE_ENV","UPLOAD_DIR","STORAGE_DRIVER"];
const pkg = require("./package.json");

const missing = required.filter((k)=>!process.env[k]);
if (missing.length){
    console.error(`Eksik ortam değişkenleri: ${missing.join(", ")}`);
    process.exit(1);
}

const env = {
    port: parseInt(process.env.PORT,10) || 3000,
    db:{
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT || "3306",10),
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized:false } : undefined
    },
    sessionSecret: process.env.SESSION_SECRET,
    baseUrl: process.env.BASE_URL,
    nodeEnv: process.env.NODE_ENV || "development",
    uploadDir: process.env.UPLOAD_DIR,
    corsAllowlist: (process.env.CORS_ALLOWLIST || "").split(",").map(s=>s.trim()).filter(Boolean),
    storageDriver: process.env.STORAGE_DRIVER || "local",
    appVersion: pkg.version || "0.0.0",
    seedEnabled: process.env.SEED_ENABLED === "true"
};

module.exports = env;
