if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const helmet = require("helmet");
const corsMiddleware = require("./middleware/corsConfig");
const config = require("./config");
const { getStorageDriver } = require("./services/storage");
const logger = require("./utils/logger");
const seedDev = require("./seed/devSeed");

const app = express();
const ensureTables = require("./model/migrate");
const metricsController = require("./controller/metrics");
const bootstrapAdmin = require("./services/bootstrapAdmin");

app.use("/static", express.static(path.join(__dirname, "public")));
app.use("/js", express.static(path.join(__dirname, "public", "js")));
app.use("/uploads", express.static(path.isAbsolute(config.uploadDir) ? config.uploadDir : path.join(__dirname, config.uploadDir)));

const bodyParser = require("body-parser");
const configSession = require("./middleware/config_Session");
const cookieParser = require("cookie-parser");
const locals = require("./middleware/locals");
const csurf = require("csurf");
const { v4: uuid } = require("uuid");

app.set("view engine", "ejs");
app.set("trust proxy", 1);

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "https://unpkg.com",
                "https://cdn.jsdelivr.net",
                "https://cdn.ckeditor.com",
                "https://ajax.googleapis.com"
            ],
            styleSrc: ["'self'", "https://unpkg.com", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
            imgSrc: ["'self'", "https://res.cloudinary.com", "data:", "https:"],
            fontSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"]
        }
    }
}));

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
    const method = req.method || "";
    if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
        const ct = req.headers["content-type"] || "";
        if (ct.startsWith("multipart/form-data")) return next();
    }
    return csrfProtection(req,res,next);
});
app.use(locals);

const authRouter = require("./router/auth.js");
const metricsRouter = require("./router/metrics.js");
const galleryRouter = require("./router/gallery.js");
const feedsRouter = require("./router/feeds.js");
const leaderboardRouter = require("./router/leaderboard.js");
const adminRouter = require("./router/admin.js");
const userRouter = require("./router/user.js");
const apiRouter = require("./router/api.js");

// CORS only for API
app.use("/api", corsMiddleware);

app.use("/api", apiRouter);
app.use("/auth", authRouter);
app.use(metricsRouter);
app.use(galleryRouter);
app.use(feedsRouter);
app.use(leaderboardRouter);
app.use("/admin", adminRouter);
app.use("/user", userRouter); // legacy prefix
app.use("/", userRouter); // root site pages

if (config.nodeEnv !== "production") {
    app.get("/demo", (req,res)=> {
        res.render("demo", { title:"2 Dakikada Demo", contentTitle:"Demo Akışı" });
    });
    // Debug route list
    app.get("/routes", (req,res)=>{
        const routes = [];
        app._router.stack.forEach((m)=>{
            if (m.route && m.route.path){
                routes.push({path:m.route.path, methods:Object.keys(m.route.methods)});
            } else if (m.name === 'router' && m.handle.stack){
                m.handle.stack.forEach((s)=>{
                    if (s.route){
                        routes.push({path:s.route.path, methods:Object.keys(s.route.methods)});
                    }
                });
            }
        });
        res.json(routes);
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
            storage_driver: getStorageDriver(),
            storage_driver_env: process.env.STORAGE_DRIVER || null,
            cloudinary_url_set: !!process.env.CLOUDINARY_URL,
            cloudinary_keys_set: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
            db_name: config.db.database
        });
    }catch(err){
        logger.error(req, err, "health");
        return res.status(503).json({
            status:"degraded",
            db:"down",
            app_version:config.appVersion,
            storage_driver: getStorageDriver(),
            storage_driver_env: process.env.STORAGE_DRIVER || null,
            cloudinary_url_set: !!process.env.CLOUDINARY_URL,
            cloudinary_keys_set: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
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
    if (err && err.code === "EBADCSRFTOKEN") {
        if (req.path && req.path.startsWith("/api/")) {
            return res.status(403).json({ error: "CSRF doğrulaması başarısız" });
        }
        return res.status(403).render("errors/403", { title: "Güvenlik Hatası" });
    }
    next(err);
});

app.use((err, req, res, next) => {
    logger.error(req, err, "global_error");
    if (req.path && req.path.startsWith("/api/")){
        return res.status(500).json({error:"Sunucu hatası"});
    }
    res.status(500).render("errors/500",{title:"Hata", message:err?.message||"Sunucu hatası"});
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.corsAllowlist.length ? config.corsAllowlist : "*" } });
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
        return bootstrapAdmin();
    })
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
