module.exports=(req,res,next)=>{
    res.locals.fullname=req.session.fullname;
    res.locals.role=req.session.role;
    next();
}
