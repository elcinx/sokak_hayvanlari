const express=require("express");
const router=express.Router();
//const data=require("../model/data");
const adminController=require("../controller/admin.js");
const isAuth=require("../middleware/isAuth");
const csrf=require("../middleware/csrf"); 
const csurf = require("csurf");
const requireRole = require("../middleware/requireRole");
const adminPanel = require("../controller/adminPanel");
const feedsController = require("../controller/feeds");
const leaderboard = require("../controller/leaderboard");
const upload = require("../middleware/upload");
const csrfProtection = csurf();

router.get("/",isAuth,requireRole("admin","koordinator"),csrf,adminController.adminList);
router.get("/dashboard",isAuth,requireRole("admin","koordinator"),csrf,adminPanel.dashboard);
router.get("/gallery",isAuth,requireRole("admin","koordinator"),(req,res)=>res.redirect("/admin/gallery/list"));
router.get("/gallery/list",isAuth,requireRole("admin","koordinator"),csrf,adminPanel.galleryList);
router.get("/gallery/add",isAuth,requireRole("admin","koordinator"),csrfProtection,adminPanel.galleryAddForm);
router.post("/gallery/add",isAuth,requireRole("admin","koordinator"),upload.single("image"),csrfProtection,adminPanel.galleryAddCreate);
router.get("/feeds",isAuth,requireRole("admin","koordinator"),csrf,adminPanel.feedList);
router.get("/feeds/delete/:id", isAuth, requireRole("admin","koordinator"), feedsController.deleteFeed);
router.get("/comments",isAuth,requireRole("admin","koordinator"),csrf,adminPanel.commentsList);
router.get("/comments/delete/:id",isAuth,requireRole("admin","koordinator"),adminPanel.deleteComment);
router.get("/badges", isAuth, requireRole("admin","koordinator"), csrf, leaderboard.adminListBadges);

router.get("/add/anc",isAuth,requireRole("admin","koordinator"),csrf,adminController.adminGetAddAnc)
router.post("/add/anc",isAuth,requireRole("admin","koordinator"),adminController.adminPostAddAnc)

router.get("/edit/anc/:id",isAuth,requireRole("admin","koordinator"),csrf,adminController.adminGetEditAnc);
router.post("/edit/anc/:id",isAuth,requireRole("admin","koordinator"),adminController.adminPostEditAnc);

router.get("/delete/anc/:id",isAuth,requireRole("admin"),adminController.get_deleteAnc);

router.post("/delete/anc",isAuth,requireRole("admin"),adminController.post_deleteAnc);

module.exports=router;
