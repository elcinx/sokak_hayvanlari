const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const helmet = require("helmet");
const corsMiddleware = require("./middleware/corsConfig");
const config = require("./config");
const logger = require("./utils/logger");
const seedDev = require("./seed/devSeed");

const app = express();
const ensureTables = require("./model/migrate");
const metricsController = require("./controller/metrics");

app.use("/static", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.isAbsolute(config.uploadDir) ? config.uploadDir : path.join(__dirname, config.uploadDir)));

const bodyParser = require("body-parser");
const configSession = require("./middleware/config_Session");
const cookieParser = require("cookie-parser");
const locals = require("./middleware/locals");
const csurf = require("csurf");
const { v4: uuid } = require("uuid");

app.set("view engine", "ejs");

app.use(helmet());
app.use(corsMiddleware);

app.use((req,res,next)=>{
    req.id = uuid();
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(configSession);
app.use(cookieParser());
const csrfProtection = csurf();
app.use((req,res,next)=>{
    if (req.path.startsWith("/api/")) return next();
    return csrfProtection(req,res,next);
});
app.use(locals);

const adminRouter = require("./router/admin.js");
const userRouter = require("./router/user.js");
const authRouter = require("./router/auth.js");
const metricsRouter = require("./router/metrics.js");
const galleryRouter = require("./router/gallery.js");
const feedsRouter = require("./router/feeds.js");
const leaderboardRouter = require("./router/leaderboard.js");

app.use(adminRouter);
app.use("/user", userRouter);
app.use("/auth", authRouter);
app.use(metricsRouter);
app.use(galleryRouter);
app.use(feedsRouter);
app.use(leaderboardRouter);

if (config.nodeEnv !== "production") {
    app.get("/demo", (req,res)=> {
        res.render("demo", { title:"2 Dakikada Demo", contentTitle:"Demo Akışı" });
    });
}

// Healthcheck
app.get("/health", async (req,res)=>{
    try{
        const db = require("./model/data");
        await db.execute("SELECT 1");
        return res.json({
            status:"ok",
            db:true,
            app_version:config.appVersion,
            storage_driver: config.storageDriver,
            db_name: config.db.database
        });
    }catch(err){
        logger.error(req, err, "health");
        return res.status(503).json({
            status:"degraded",
            db:"down",
            app_version:config.appVersion,
            storage_driver: config.storageDriver,
            db_name: config.db.database
        });
    }
});

app.use((req,res,next)=>{
    if (req.path.startsWith("/api/")){
        return res.status(404).json({error:"Not found"});
    }
    res.status(404).render("errors/404",{title:"Sayfa bulunamadı"});
});

app.use((err, req, res, next) => {
    logger.error(req, err, "global_error");
    if (req.path && req.path.startsWith("/api/")){
        return res.status(500).json({error:"Sunucu hatası"});
    }
    res.status(500).render("errors/500",{title:"Hata", message:err?.message||"Sunucu hatası"});
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const broadcastOnline = () => {
    io.emit("online-count", { online: io.engine.clientsCount });
};
metricsController.setOnlineCountRef(() => io.engine.clientsCount);
io.on("connection", (socket) => {
    broadcastOnline();
    socket.on("disconnect", broadcastOnline);
});

ensureTables()
    .then(() => {
        if (config.seedEnabled && config.nodeEnv !== "production") {
            seedDev().catch(err=>logger.error({originalUrl:"seed",session:{}}, err, "seed_dev"));
        }
        server.listen(config.port, () => {
            console.log(`Server running on ${config.port}...`);
        });
    })
    .catch((err) => {
        console.error("Migration error:", err);
        server.listen(config.port, () => console.log(`Server running on ${config.port} (migration failed)!`));
    });
