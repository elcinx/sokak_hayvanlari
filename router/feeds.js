const express = require("express");
const router = express.Router();
const feedsController = require("../controller/feeds");
const isAuth = require("../middleware/isAuth");
const upload = require("../middleware/upload");
const csrf = require("../middleware/csrf");
const rateLimit = require("../middleware/rateLimit");
const requireRole = require("../middleware/requireRole");

router.post(
    "/api/feeds",
    isAuth,
    rateLimit({ windowMs: 60_000, max: 3, keyGenerator:(req)=>`feed:${req.session.userid||req.ip}` }),
    upload.single("photo"),
    feedsController.create
);
router.get("/api/feeds", feedsController.list);
router.get("/api/feeds/heatmap", feedsController.heatmap);
router.get("/api/feeds/points-summary", feedsController.pointsSummary);
router.get("/api/feeds/:id/comments", feedsController.listComments);
router.post(
    "/api/feeds/:id/comments",
    isAuth,
    rateLimit({ windowMs: 60_000, max: 5, keyGenerator:(req)=>`comment:${req.session.userid||req.ip}` }),
    feedsController.addComment
);
router.post(
    "/api/feeds/:id/like",
    isAuth,
    rateLimit({ windowMs: 10_000, max: 10, keyGenerator:(req)=>`like:${req.session.userid||req.ip}` }),
    feedsController.toggleLike
);
router.get("/api/feeds/:id/likes", feedsController.likesInfo);

router.post("/api/favorites", isAuth, feedsController.addFavorite);
router.delete("/api/favorites", isAuth, feedsController.deleteFavorite);
router.get("/api/favorites", isAuth, feedsController.listFavorites);

// Sayfa
router.get("/feeds/:id", csrf, feedsController.view);
router.get("/admin/feeds/delete/:id", isAuth, requireRole("admin","koordinator"), feedsController.deleteFeed);

module.exports = router;
