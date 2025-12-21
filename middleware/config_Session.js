const session = require('express-session');
const config = require("../config");

const isProd = config.nodeEnv === "production";

const configSession=session({
    secret: config.sessionSecret,
    resave:false,
    saveUninitialized:false,
    proxy:true,
    cookie:{
        maxAge:1000*60*60*1,
        httpOnly:true,
        sameSite:"lax",
        secure:isProd
    }
});

module.exports=configSession;
