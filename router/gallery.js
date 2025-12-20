const express = require("express");
const router = express.Router();
const galleryController = require("../controller/gallery");

router.get("/gallery", galleryController.listPublic);
router.get("/gallery/:slug", galleryController.viewOne);
router.get("/api/gallery", galleryController.apiList);

module.exports = router;
