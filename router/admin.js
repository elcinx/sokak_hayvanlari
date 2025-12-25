const express=require("express");
const router=express.Router();
//const data=require("../model/data");
const adminController=require("../controller/admin.js");
const requireAuth=require("../middleware/requireAuth");
const csrf=require("../middleware/csrf"); 
const csurf = require("csurf");
const requireRole = require("../middleware/requireRole");
const adminPanel = require("../controller/adminPanel");
const feedsController = require("../controller/feeds");
const leaderboard = require("../controller/leaderboard");
const upload = require("../middleware/upload");
const csrfProtection = csurf();

router.get("/",requireAuth,requireRole("admin","moderator"),csrf,adminController.adminList);
router.get("/dashboard",requireAuth,requireRole("admin"),csrf,adminPanel.dashboard);
router.get("/gallery",requireAuth,requireRole("admin","moderator"),(req,res)=>res.redirect("/admin/gallery/list"));
router.get("/gallery/list",requireAuth,requireRole("admin","moderator"),csrfProtection,adminPanel.galleryList);
router.get("/gallery/add",requireAuth,requireRole("admin","moderator"),csrfProtection,adminPanel.galleryAddForm);
router.post("/gallery/add",requireAuth,requireRole("admin","moderator"),upload.single("image"),csrfProtection,adminPanel.galleryAddCreate);
router.post("/gallery/delete/:id",requireAuth,requireRole("admin","moderator"),csrfProtection,adminPanel.galleryDelete);
router.get("/feeds",requireAuth,requireRole("admin"),csrf,adminPanel.feedList);
router.get("/feeds/delete/:id", requireAuth, requireRole("admin"), feedsController.deleteFeed);
router.get("/comments",requireAuth,requireRole("admin"),csrf,adminPanel.commentsList);
router.get("/comments/delete/:id",requireAuth,requireRole("admin"),adminPanel.deleteComment);
router.get("/badges", requireAuth, requireRole("admin"), csrf, leaderboard.adminListBadges);

router.get("/add/anc",requireAuth,requireRole("admin","moderator"),csrf,adminController.adminGetAddAnc)
router.post("/add/anc",requireAuth,requireRole("admin","moderator"),adminController.adminPostAddAnc)

router.get("/edit/anc/:id",requireAuth,requireRole("admin","moderator"),csrf,adminController.adminGetEditAnc);
router.post("/edit/anc/:id",requireAuth,requireRole("admin","moderator"),adminController.adminPostEditAnc);

router.get("/delete/anc/:id",requireAuth,requireRole("admin"),adminController.get_deleteAnc);

router.post("/delete/anc",requireAuth,requireRole("admin"),adminController.post_deleteAnc);

module.exports=router;
