const express=require("express");
const router=express.Router();
const controllerUser=require("../controller/user");

router.get("/",controllerUser.userHome);
router.get("/announcements", controllerUser.listAnnouncements);
router.get("/announcements/:slug",controllerUser.viewAnc);

module.exports=router;
