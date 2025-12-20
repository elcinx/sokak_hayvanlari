const bcrypt = require("bcrypt");
const db = require("../model/data");
const dayjs = require("dayjs");

const hash = (pwd) => bcrypt.hash(pwd, 10);

async function seed() {
    // Kullanıcılar
    const users = [
        {name:"Admin", surname:"User", email:"admin@test.com", password:await hash("123456")},
        {name:"Koordinator", surname:"User", email:"koord@test.com", password:await hash("123456")},
        {name:"Ali", surname:"Yilmaz", email:"ali@test.com", password:await hash("123456")},
        {name:"Ayse", surname:"Kara", email:"ayse@test.com", password:await hash("123456")},
        {name:"Mehmet", surname:"Demir", email:"mehmet@test.com", password:await hash("123456")},
    ];
    for (const u of users){
        await db.execute("INSERT IGNORE INTO users (name,surname,email,password) VALUES (?,?,?,?)",[u.name,u.surname,u.email,u.password]);
    }
    const [[admin]] = await db.execute("SELECT userid FROM users WHERE email=?",[users[0].email]);
    const [[koord]] = await db.execute("SELECT userid FROM users WHERE email=?",[users[1].email]);
    const [normals] = await db.execute("SELECT userid FROM users WHERE email IN (?,?,?)",[users[2].email,users[3].email,users[4].email]);
    const [roles] = await db.execute("SELECT roleid,name FROM roles");
    const roleMap = Object.fromEntries(roles.map(r=>[r.name,r.roleid]));
    if (admin) await db.execute("INSERT IGNORE INTO user_roles (userid,roleid) VALUES (?,?)",[admin.userid,roleMap.admin]);
    if (koord) await db.execute("INSERT IGNORE INTO user_roles (userid,roleid) VALUES (?,?)",[koord.userid,roleMap.koordinator]);
    for (const n of normals){
        if (n?.userid) await db.execute("INSERT IGNORE INTO user_roles (userid,roleid) VALUES (?,?)",[n.userid,roleMap.kullanici]);
    }

    // Duyurular
    const now = dayjs();
    for (let i=1;i<=10;i++){
        await db.execute(
            "INSERT IGNORE INTO announcements (title,exp,is_active,created_by,slug,category,publish_at) VALUES (?,?,?,?,?,?,?)",
            [
                `Duyuru ${i}`,
                `<p>Duyuru ${i} açıklaması</p>`,
                1,
                admin?.userid || null,
                `duyuru-${i}`,
                i%2===0?"Genel":"Etkinlik",
                now.subtract(i,"day").toDate()
            ]
        );
    }

    // Feedler
    const userIds = [admin?.userid, koord?.userid, ...(normals.map(n=>n.userid))].filter(Boolean);
    const feeds = [];
    for (let i=0;i<25;i++){
        const uid = userIds[i % userIds.length];
        feeds.push([
            uid,
            null,
            null,
            null,
            41.0 + Math.random(),
            29.0 + Math.random(),
            `Not ${i}`,
            10,
            now.subtract(i,"day").toDate()
        ]);
    }
    for (const f of feeds){
        await db.execute(
            "INSERT INTO feed_logs (user_id, photo_path, photo_url, photo_key, lat, lng, note, points, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            f
        );
    }
    const [allFeeds] = await db.execute("SELECT id,user_id FROM feed_logs ORDER BY id DESC LIMIT 25");

    // Yorumlar
    let commentCount=0;
    for (const feed of allFeeds){
        const content = `Yorum ${commentCount+1}`;
        const uid = userIds[(commentCount)%userIds.length];
        await db.execute("INSERT INTO feed_comments (feed_id,user_id,content,created_at) VALUES (?,?,?,?)",
            [feed.id, uid, content, now.subtract(commentCount,"hour").toDate()]);
        commentCount++;
        if (commentCount>=40) break;
    }

    // Beğeniler
    let likeCount=0;
    for (const feed of allFeeds){
        const uid = userIds[likeCount % userIds.length];
        await db.execute("INSERT IGNORE INTO feed_likes (feed_id,user_id,created_at) VALUES (?,?,?)",
            [feed.id, uid, now.subtract(likeCount,"hour").toDate()]);
        likeCount++;
        if (likeCount>=60) break;
    }

    // Favoriler
    for (let i=0;i<10;i++){
        await db.execute(
            "INSERT IGNORE INTO user_favorites (user_id, lat, lng) VALUES (?,?,?)",
            [userIds[i%userIds.length], 41.0 + Math.random(), 29.0 + Math.random()]
        );
    }
}

module.exports = seed;
