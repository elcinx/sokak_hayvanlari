const express = require("express");
const router = express.Router();
const feedsController = require("../controller/feeds");
const requireAuth = require("../middleware/requireAuth");
const upload = require("../middleware/upload");
const rateLimit = require("../middleware/rateLimit");

// Alias endpoints for legacy frontend compatibility
router.get("/points", feedsController.list);
router.post(
    "/points",
    requireAuth,
    rateLimit({ windowMs: 60_000, max: 3, keyGenerator: (req) => `points:${req.session.userid || req.ip}` }),
    upload.fields([{ name: "photo", maxCount: 1 }, { name: "file", maxCount: 1 }]),
    feedsController.create
);

module.exports = router;
