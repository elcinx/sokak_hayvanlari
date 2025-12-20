const mysql=require("mysql2");
const config = require("../config");
const logger = require("../utils/logger");

// Fail-fast prod wrong host
if (config.nodeEnv === "production" && ["localhost","127.0.0.1"].includes(config.db.host)) {
    console.error("[DB] Production ortamında localhost DB_HOST kullanılamaz. Railway/Render internal host'u girin.");
    process.exit(1);
}

let connection;
try{
    connection = mysql.createConnection({
        host: config.db.host,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        port: config.db.port,
        ssl: config.db.ssl
    });
}catch(err){
    logger.error({originalUrl:"db-init", session:{}}, err, "db_init");
    console.error("[DB] Connection failed: check DB_HOST/PORT (Railway uses internal host, not localhost)");
    process.exit(1);
}

console.log(`[DB] Connecting host=${config.db.host} port=${config.db.port} db=${config.db.database}`);
connection.connect((err)=>{
  if (err){
    logger.error({originalUrl:"db-connect", session:{}}, err, "db_connect");
    console.error("[DB] Connection failed: check DB_HOST/PORT (Railway uses internal host, not localhost)");
    process.exit(1);
  }
  console.log("[DB] Connected");
});

module.exports=connection.promise();
