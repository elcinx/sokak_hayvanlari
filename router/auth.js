const express=require("express");
const router=express.Router();
const authController=require("../controller/auth");
const csrf=require("../middleware/csrf"); 


router.get("/login",csrf,authController.getLogin);
router.post("/login",authController.postLogin);
router.get("/register",csrf,authController.getRegister);
router.post("/register",authController.postRegister);

router.get("/signout",authController.signout);

module.exports=router;
