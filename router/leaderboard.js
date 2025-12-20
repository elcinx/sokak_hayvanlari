const express = require("express");
const router = express.Router();
const leaderboard = require("../controller/leaderboard");
const isAuth = require("../middleware/isAuth");
const requireRole = require("../middleware/requireRole");
const csrf = require("../middleware/csrf");

router.get("/api/leaderboard/weekly", leaderboard.weekly);
router.get("/api/leaderboard/monthly", leaderboard.monthly);

router.get("/api/me/badges", isAuth, leaderboard.meBadges);
router.get("/api/me/points", isAuth, leaderboard.mePoints);

router.get("/admin/badges", isAuth, requireRole("admin","koordinator"), csrf, leaderboard.adminListBadges);

module.exports = router;
