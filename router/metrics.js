const express = require("express");
const router = express.Router();
const metrics = require("../controller/metrics");

router.get("/api/metrics/summary", metrics.summary);
router.get("/api/metrics/online", metrics.online);
router.get("/sitemap.xml", metrics.sitemap);

module.exports = router;
