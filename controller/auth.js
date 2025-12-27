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
    const email=(req.body.email||"").trim().toLowerCase();
    const password=req.body.password||"";

    // const user=authData.find(x=>x.email==req.body.email);
    const user=await db.execute("SELECT * FROM users WHERE email=?",[email]); //liste içinde liste döner
    console.log(user);
     if (user[0].length==0)  {
        req.session.message={text:"Email hatalı",class:"warning"}
        //console.log("mesaj1=",req.session.message);
        return res.redirect("login");
    }

    console.log(user[0][0].password);

    if (await bcrypt.compare(password,user[0][0].password)){ //şifre uyuşuyorsa
        req.session.isAuth=1;
        req.session.fullname=user[0][0].name;
        req.session.userid=user[0][0].userid;
        const requestedRole = req.body.role === "admin" ? "admin" : "user";// Kullanıcı rolü
        try{
            const [roles]=await db.execute(`
                SELECT r.name FROM roles r
                INNER JOIN user_roles ur ON ur.roleid=r.roleid
                WHERE ur.userid=? LIMIT 1
            `,[user[0][0].userid]);
            const rawRole = roles[0]?.name || "kullanici";
            if (rawRole === "admin" || rawRole === "moderator") {
                req.session.role = rawRole;
            } else if (rawRole === "koordinator") {
                req.session.role = "admin";
            } else {
                req.session.role = "user";
            }
        }catch(e){
            req.session.role="user";
        }
        if (!req.session.role) {
            req.session.role = "user";
        }
        if (req.session.role === "user") {
            try {
                const [roleRows] = await db.execute("SELECT roleid FROM roles WHERE name='user' LIMIT 1");
                let roleId = roleRows[0]?.roleid;
                if (!roleId) {
                    const [altRows] = await db.execute("SELECT roleid FROM roles WHERE name='kullanici' LIMIT 1");
                    roleId = altRows[0]?.roleid;
                }
                if (roleId) {
                    await db.execute("INSERT IGNORE INTO user_roles (userid, roleid) VALUES (?,?)", [req.session.userid, roleId]);
                }
            } catch (e) {}
        }
        if (requestedRole === "admin" && req.session.role !== "admin" && req.session.role !== "moderator") {
            req.session.isAuth = 0;
            req.session.role = undefined;
            req.session.message = { text: "Admin yetkisi yok", class: "warning" };
            return res.redirect("login");
        }//Kullanıcı beni hatırla seçeneğini seçmişse cookie oluştur
        if (req.body.cbhatirla=="1"){ 
            res.cookie("email",email);
            res.cookie("password",password);
        }
        else{ //kullanıcı daha önce beni hatırla seçeneğini seçmişse ancak daha sonra checkbox işaretini kaldırmışsa cookieleri sil
            if (req.cookies.email!=undefined & req.cookies.password!=undefined) { //
                res.clearCookie("email");
                res.clearCookie("password"); 
            }
        }
        const redirectUrl = (req.session.role === "admin" || req.session.role === "moderator") ? (req.query.url || "/admin") : "/";
        return req.session.save(() => res.redirect(redirectUrl));
    }
    
    //şifre uyuşmuyorsa
    req.session.message={text:"Şifre hatalı",class:"warning"};
    res.redirect("login");
}

exports.getRegister=(req,res,next)=>{
    const message=req.session.message;
    delete req.session.message;
    res.render("auth/register",{
        title:"Register",
        contentTitle:"Register",
        message:message
    });
}

exports.postRegister=async(req,res,next)=>{
    const name=(req.body.name||"").trim();
    const surname=(req.body.surname||"").trim();
    const email=(req.body.email||"").trim().toLowerCase();
    const password=req.body.password||"";
    const passwordConfirm=req.body.passwordConfirm||"";

    if (!name || !email || !password){
        req.session.message={text:"Zorunlu alanlar eksik",class:"warning"};
        return res.redirect("register");
    }
    if (passwordConfirm && passwordConfirm !== password){
        req.session.message={text:"Sifreler uyusmuyor",class:"warning"};
        return res.redirect("register");
    }

    const [existing]=await db.execute("SELECT userid FROM users WHERE email=?",[email]);
    if (existing.length>0){
        req.session.message={text:"Email zaten kayitli",class:"warning"};
        return res.redirect("register");
    }

    const hashed=await bcrypt.hash(password,10);
    const [insertRes]=await db.execute(
        "INSERT INTO users (name, surname, email, password) VALUES (?,?,?,?)",
        [name, surname, email, hashed]
    );

    const userId=insertRes.insertId;
    if (userId){
        let roleId=null;
        const [roleRows]=await db.execute("SELECT roleid FROM roles WHERE name='user' LIMIT 1");
        roleId=roleRows[0]?.roleid;
        if (!roleId){
            const [altRows]=await db.execute("SELECT roleid FROM roles WHERE name='kullanici' LIMIT 1");
            roleId=altRows[0]?.roleid;
        }
        if (roleId){
            await db.execute("INSERT IGNORE INTO user_roles (userid, roleid) VALUES (?,?)",[userId, roleId]);
        }
    }

    req.session.message={text:"Kayit basarili. Giris yapabilirsiniz.",class:"success"};
    return res.redirect("login");
}

    exports.signout=async(req,res)=>{
        await req.session.destroy(); //session temizle
        res.redirect("/auth/login"); //ana sayfaya git
    }







