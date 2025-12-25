const express = require("express");
const router = express.Router();
const leaderboard = require("../controller/leaderboard");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const csrf = require("../middleware/csrf");

router.get("/api/leaderboard/weekly", leaderboard.weekly);
router.get("/api/leaderboard/monthly", leaderboard.monthly);

router.get("/api/me/badges", requireAuth, leaderboard.meBadges);
router.get("/api/me/points", requireAuth, leaderboard.mePoints);


module.exports = router;
