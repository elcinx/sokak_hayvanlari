const express = require("express");
const router = express.Router();
const feedsController = require("../controller/feeds");
const requireAuth = require("../middleware/requireAuth");
const upload = require("../middleware/upload");
const csrf = require("../middleware/csrf");
const rateLimit = require("../middleware/rateLimit");
const requireRole = require("../middleware/requireRole");

router.post(
    "/api/feeds",
    requireAuth,
    rateLimit({ windowMs: 60_000, max: 3, keyGenerator:(req)=>`feed:${req.session.userid||req.ip}` }),
    upload.single("photo"),
    feedsController.create
);
router.get("/api/feeds", feedsController.list);
router.get("/api/heatmap", feedsController.heatmap);
router.get("/api/feeds/heatmap", feedsController.heatmap);
router.get("/api/feeds/points-summary", feedsController.pointsSummary);
router.get("/api/feeds/:id/comments", feedsController.listComments);
router.post(
    "/api/feeds/:id/comments",
    requireAuth,
    rateLimit({ windowMs: 60_000, max: 5, keyGenerator:(req)=>`comment:${req.session.userid||req.ip}` }),
    feedsController.addComment
);
router.post(
    "/api/feeds/:id/like",
    requireAuth,
    rateLimit({ windowMs: 10_000, max: 10, keyGenerator:(req)=>`like:${req.session.userid||req.ip}` }),
    feedsController.toggleLike
);
router.get("/api/feeds/:id/likes", feedsController.likesInfo);

router.post("/api/favorites", requireAuth, feedsController.addFavorite);
router.delete("/api/favorites", requireAuth, feedsController.deleteFavorite);
router.get("/api/favorites", requireAuth, feedsController.listFavorites);

// Sayfa
router.get("/feeds/:id", csrf, feedsController.view);

module.exports = router;
