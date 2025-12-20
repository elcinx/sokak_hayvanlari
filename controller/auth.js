// const authData=require("../model/authdata");
const session = require("express-session");
const bcrypt = require('bcrypt');
const db=require("../model/data");

exports.getLogin=(req,res,next)=>{
    //kullanıcı beni hatırla demişse kayıtlı cookie bilgileri elde ediliyor.
    const email=req.cookies.email;
    const password=req.cookies.password;
    console.log(email);
    console.log(password);
    const message=req.session.message;
    console.log("mesaj",message);
    delete req.session.message;//sadece message session silinir. destroy tümünü siler.
    
        res.render("auth/login",{
                                    title:"Login",
                                    contentTitle:"Login",
                                    message:message,
                                    authinfo:{email:email,password:password},
                                    //csrfToken:req.csrfToken()
                                });
}

exports.postLogin=async(req,res,next)=>{
    console.log(req.body);

    // const user=authData.find(x=>x.email==req.body.email);
    const user=await db.execute("SELECT * FROM users WHERE email=?",[req.body.email]); //liste içinde liste döner
    console.log(user);
     if (user[0].length==0)  {
        req.session.message={text:"Email hatalı",class:"warning"}
        //console.log("mesaj1=",req.session.message);
        return res.redirect("login");
    }

    console.log(user[0][0].password);

    if (await bcrypt.compare(req.body.password,user[0][0].password)){ //şifre uyuşuyorsa
        req.session.isAuth=1;
        req.session.fullname=user[0][0].name;
        req.session.userid=user[0][0].userid;
        // Kullanıcı rolü
        try{
            const [roles]=await db.execute(`
                SELECT r.name FROM roles r
                INNER JOIN user_roles ur ON ur.roleid=r.roleid
                WHERE ur.userid=? LIMIT 1
            `,[user[0][0].userid]);
            req.session.role=roles[0]?.name || "kullanici";
        }catch(e){
            req.session.role="kullanici";
        }
        //Kullanıcı beni hatırla seçeneğini seçmişse cookie oluştur
        if (req.body.cbhatirla=="1"){ 
            res.cookie("email",req.body.email);
            res.cookie("password",req.body.password);
        }
        else{ //kullanıcı daha önce beni hatırla seçeneğini seçmişse ancak daha sonra checkbox işaretini kaldırmışsa cookieleri sil
            if (req.cookies.email!=undefined & req.cookies.password!=undefined) { //
                res.clearCookie("email");
                res.clearCookie("password"); 
            }
        }
        const url=req.query.url || "/admin"; //req.query.url varsa onu yoksa "/admin/list/anc" url olarak kabul et.
        return res.redirect(url);
    }
    
    //şifre uyuşmuyorsa
    req.session.message={text:"Şifre hatalı",class:"warning"};
    res.redirect("login");
}

    exports.signout=async(req,res)=>{
        await req.session.destroy(); //session temizle
        res.redirect("/auth/login"); //ana sayfaya git
    }
