module.exports=(req,res,next)=>{
    if (!req.session.isAuth){ //kullanıcı giriş yapmamışsa
        //herhangi bir url'den yetkisiz giriş yapılmaya çalışılırsa giriş sayfasına o url'de göreliyor ve giriş yapıldıktan sonra
        //bu url'ye yönlendirme yapılacaktır.   
        return res.redirect("/auth/login?url="+req.originalUrl); 
    }

    next(); //giriş yapmışsa routerdaki ikinci middleware'i çalıştır.
}