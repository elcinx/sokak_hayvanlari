const express=require("express");
const router=express.Router();
//const data=require("../model/data");
const adminController=require("../controller/admin.js");
const isAuth=require("../middleware/isAuth");
const csrf=require("../middleware/csrf"); 
const requireRole = require("../middleware/requireRole");
const adminPanel = require("../controller/adminPanel");

router.get("/admin",isAuth,requireRole("admin","koordinator"),csrf,adminController.adminList);
router.get("/admin/dashboard",isAuth,requireRole("admin","koordinator"),csrf,adminPanel.dashboard);
router.get("/admin/feeds",isAuth,requireRole("admin","koordinator"),csrf,adminPanel.feedList);
router.get("/admin/comments",isAuth,requireRole("admin","koordinator"),csrf,adminPanel.commentsList);
router.get("/admin/comments/delete/:id",isAuth,requireRole("admin","koordinator"),adminPanel.deleteComment);

router.get("/admin/add/anc",isAuth,requireRole("admin","koordinator"),csrf,adminController.adminGetAddAnc)
router.post("/admin/add/anc",isAuth,requireRole("admin","koordinator"),adminController.adminPostAddAnc)

router.get("/admin/edit/anc/:id",isAuth,requireRole("admin","koordinator"),csrf,adminController.adminGetEditAnc);
router.post("/admin/edit/anc/:id",isAuth,requireRole("admin","koordinator"),adminController.adminPostEditAnc);

router.get("/admin/delete/anc/:id",isAuth,requireRole("admin"),adminController.get_deleteAnc);

router.post("/admin/delete/anc",isAuth,requireRole("admin"),adminController.post_deleteAnc);

module.exports=router;
