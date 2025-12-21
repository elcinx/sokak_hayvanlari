const bcrypt = require("bcrypt");
const db = require("../model/data");

module.exports = async () => {
    if (process.env.ADMIN_BOOTSTRAP !== "true") return;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || "Admin";
    if (!email || !password) {
        console.error("[BOOTSTRAP] ADMIN_EMAIL veya ADMIN_PASSWORD eksik. Çıkılıyor.");
        process.exit(1);
    }

    // admin rolü var mı kontrol et, yoksa oluştur
    const [roleRows] = await db.execute("SELECT roleid FROM roles WHERE name='admin'");
    let adminRoleId = roleRows[0]?.roleid;
    if (!adminRoleId) {
        const [res] = await db.execute("INSERT INTO roles (name) VALUES ('admin')");
        adminRoleId = res.insertId;
    }

    // kullanıcı var mı
    const [users] = await db.execute("SELECT userid FROM users WHERE email=?", [email]);
    let userId = users[0]?.userid;
    if (!userId) {
        const hashed = await bcrypt.hash(password, 10);
        const [res] = await db.execute(
            "INSERT INTO users (name, surname, email, password) VALUES (?,?,?,?)",
            [name, "", email, hashed]
        );
        userId = res.insertId;
        console.log("[BOOTSTRAP] admin created");
    } else {
        console.log("[BOOTSTRAP] admin already exists");
    }

    // role assign
    if (userId && adminRoleId) {
        await db.execute(
            "INSERT IGNORE INTO user_roles (userid, roleid) VALUES (?, ?)",
            [userId, adminRoleId]
        );
    }
};
