const db = require("./data");

async function ensureTables() {
    // Users (other tables reference this)
    await db.execute(`
        CREATE TABLE IF NOT EXISTS users (
            userid INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100),
            surname VARCHAR(100),
            email VARCHAR(100) UNIQUE,
            password VARCHAR(255)
        )
    `);

    // Roles
    await db.execute(`
        CREATE TABLE IF NOT EXISTS roles (
            roleid INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL
        )
    `);

    // User - Role mapping
    await db.execute(`
        CREATE TABLE IF NOT EXISTS user_roles (
            userid INT NOT NULL,
            roleid INT NOT NULL,
            PRIMARY KEY (userid, roleid),
            FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE,
            FOREIGN KEY (roleid) REFERENCES roles(roleid) ON DELETE CASCADE
        )
    `);

    // Announcements
    await db.execute(`
        CREATE TABLE IF NOT EXISTS announcements (
            noticeid INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            exp TEXT,
            slug VARCHAR(255) UNIQUE,
            category VARCHAR(100),
            publish_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            created_by INT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(userid) ON DELETE SET NULL
        )
    `);

    // Gallery items
    await db.execute(`
        CREATE TABLE IF NOT EXISTS gallery_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            image_path VARCHAR(255) NOT NULL,
            created_by INT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(userid) ON DELETE SET NULL
        )
    `);

    // Feed logs
    await db.execute(`
        CREATE TABLE IF NOT EXISTS feed_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            photo_path VARCHAR(255),
            photo_url VARCHAR(500),
            photo_key VARCHAR(255),
            lat DECIMAL(10,6) NOT NULL,
            lng DECIMAL(10,6) NOT NULL,
            note TEXT,
            points INT DEFAULT 10,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(userid) ON DELETE CASCADE
        )
    `);
    try { await db.execute("ALTER TABLE feed_logs ADD COLUMN photo_url VARCHAR(500)"); } catch(e){}
    try { await db.execute("ALTER TABLE feed_logs ADD COLUMN photo_key VARCHAR(255)"); } catch(e){}

    // Comments
    await db.execute(`
        CREATE TABLE IF NOT EXISTS feed_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            feed_id INT NOT NULL,
            user_id INT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) DEFAULT 0,
            FOREIGN KEY (feed_id) REFERENCES feed_logs(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(userid) ON DELETE CASCADE
        )
    `);

    // Likes
    await db.execute(`
        CREATE TABLE IF NOT EXISTS feed_likes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            feed_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(feed_id, user_id),
            FOREIGN KEY (feed_id) REFERENCES feed_logs(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(userid) ON DELETE CASCADE
        )
    `);

    // Favorites
    await db.execute(`
        CREATE TABLE IF NOT EXISTS user_favorites (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            lat DECIMAL(10,6) NOT NULL,
            lng DECIMAL(10,6) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, lat, lng),
            FOREIGN KEY (user_id) REFERENCES users(userid) ON DELETE CASCADE
        )
    `);

    // Points ledger
    await db.execute(`
        CREATE TABLE IF NOT EXISTS points_ledger (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            source_type ENUM('feed','badge','admin') NOT NULL,
            source_id INT,
            points INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(userid) ON DELETE CASCADE
        )
    `);

    // Badges
    await db.execute(`
        CREATE TABLE IF NOT EXISTS badges (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            icon VARCHAR(255),
            is_active TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // User badges
    await db.execute(`
        CREATE TABLE IF NOT EXISTS user_badges (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            badge_id INT NOT NULL,
            earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, badge_id),
            FOREIGN KEY (user_id) REFERENCES users(userid) ON DELETE CASCADE,
            FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
        )
    `);

    // Leaderboard cache (optional)
    await db.execute(`
        CREATE TABLE IF NOT EXISTS leaderboard_cache (
            id INT AUTO_INCREMENT PRIMARY KEY,
            period ENUM('weekly','monthly') NOT NULL,
            period_key VARCHAR(20) NOT NULL,
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            payload_json JSON,
            UNIQUE(period, period_key)
        )
    `);

    // Visit logs
    await db.execute(`
        CREATE TABLE IF NOT EXISTS visit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip_hash VARCHAR(128) NOT NULL,
            ua_hash VARCHAR(128) NOT NULL,
            visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX (ip_hash),
            INDEX (visited_at)
        )
    `);

    // Seed default roles
    await db.execute("INSERT IGNORE INTO roles (name) VALUES (?), (?), (?)", ["admin", "moderator", "user"]);
    await db.execute("INSERT IGNORE INTO roles (name) VALUES (?), (?)", ["koordinator", "kullanici"]);

    // Make first user admin if none
    const [userRoleCount] = await db.execute("SELECT COUNT(*) AS c FROM user_roles");
    if (userRoleCount[0].c === 0) {
        const [users] = await db.execute("SELECT userid FROM users ORDER BY userid ASC LIMIT 1");
        if (users.length > 0) {
            const [adminRole] = await db.execute("SELECT roleid FROM roles WHERE name='admin'");
            if (adminRole.length>0) {
                await db.execute("INSERT IGNORE INTO user_roles (userid, roleid) VALUES (?, ?)", [users[0].userid, adminRole[0].roleid]);
            }
        }
    }

    // Default badges
    const badgesSeed = [
        { code:"ISTIKRARLI", name:"İstikrarlı Besleyici", description:"Son 7 gün her gün en az 1 besleme", icon:null },
        { code:"KESIFCI", name:"Keşifçi", description:"10 farklı lokasyonda besleme", icon:null },
        { code:"KIS_KAHRAMANI", name:"Kış Kahramanı", description:"Aralık-Ocak-Şubat aylarında 20 besleme", icon:null }
    ];
    for (const b of badgesSeed){
        await db.execute(
            "INSERT IGNORE INTO badges (code, name, description, icon, is_active) VALUES (?,?,?,?,1)",
            [b.code, b.name, b.description, b.icon]
        );
    }
}

module.exports = ensureTables;
