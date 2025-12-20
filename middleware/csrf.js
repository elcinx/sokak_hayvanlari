//her get controller fonksiyonundan ejs sayfasına parametre göndermek yerine
//csrfToken local olarak tanımlanıyor ve her ejs'den erişilebilir hale geliyor.
//Böylece her get controller'dan parametre olarak göndermeye gerek kalmıyor.
//Ancak bu miidleware bütün istekler için çalıştırılmayacak
//Bu nedenle routes dsoayalarında sadece form bulunan get istekleri için çağrılmalıdır.
module.exports=(req,res,next)=>{
    res.locals.csrfToken=req.csrfToken();
    next();
}