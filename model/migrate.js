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

    // Seed announcements if empty
    const announcementsSeed = [
            {
                title: "Sahilde Sokak Hayvanlar\u0131 \u0130\u00e7in Mama Da\u011f\u0131t\u0131m\u0131 Ger\u00e7ekle\u015ftirildi",
                exp: "Yerel g\u00f6n\u00fcll\u00fcler sahil b\u00f6lgesinde sokak hayvanlar\u0131na mama deste\u011fi sa\u011flad\u0131.\\n\\n\u015eehrimizin sahil hatt\u0131nda ya\u015fayan sokak hayvanlar\u0131 i\u00e7in g\u00f6n\u00fcll\u00fc ekibimiz mama da\u011f\u0131t\u0131m\u0131 ger\u00e7ekle\u015ftirdi. So\u011fuk k\u0131\u015f g\u00fcnlerinde onlar\u0131n beslenmesini desteklemek amac\u0131yla d\u00fczenlenen etkinlikte hem mama verildi hem de sa\u011fl\u0131k kontrolleri yap\u0131ld\u0131.\\n\\nBu tarz etkinliklerin devam etmesi i\u00e7in halk\u0131m\u0131zdan mama deste\u011fi ve g\u00f6n\u00fcll\u00fc kat\u0131l\u0131m bekliyoruz.",
                slug: "resim-1",
                category: "Etkinlik",
                publish_at: "2024-12-20 00:00:00"
            },
            {
                title: "K\u0131\u015f Yakla\u015f\u0131yor: Sokak Dostlar\u0131m\u0131z \u0130\u00e7in Battaniye ve Mama Kampanyas\u0131",
                exp: "So\u011fuk hava ko\u015fullar\u0131nda hayvanlar\u0131n beslenmesi ve bar\u0131nmas\u0131 i\u00e7in ortak destek kampanyas\u0131 ba\u015flad\u0131.\\n\\nKar ya\u011f\u0131\u015f\u0131n\u0131n yo\u011funla\u015ft\u0131\u011f\u0131 bu d\u00f6nemlerde sokakta ya\u015fam m\u00fccadelesi veren dostlar\u0131m\u0131z i\u00e7in yeni bir yard\u0131m kampanyas\u0131 ba\u015flatt\u0131k. Mama, su kab\u0131, battaniye ve k\u00fc\u00e7\u00fck kul\u00fcbeler yaparak destek olabilirsiniz.\\n\\nKampanya kapsam\u0131nda toplanan yard\u0131m malzemeleri belirlenen noktalara ekiplerimiz taraf\u0131ndan ula\u015ft\u0131r\u0131lacakt\u0131r.",
                slug: "resim-2",
                category: "Kampanya",
                publish_at: "2024-12-18 00:00:00"
            },
            {
                title: "Mahalle Besleme Noktalar\u0131 G\u00fcncellendi - G\u00f6n\u00fcll\u00fcler Aran\u0131yor",
                exp: "Yeni besleme noktalar\u0131 olu\u015fturuldu, d\u00fczenli kontrol i\u00e7in g\u00f6n\u00fcll\u00fcler bekleniyor.\\n\\n\u015eehrimizde belirli b\u00f6lgelere yeni mama-su kaplar\u0131 yerle\u015ftirildi. Ancak d\u00fczenli besleme ve temizlik i\u00e7in g\u00f6n\u00fcll\u00fclere ihtiyac\u0131m\u0131z var. Her g\u00fcn 10-15 dakikan\u0131z\u0131 ay\u0131rarak bir can\u0131n hayat\u0131na dokunabilirsiniz.\\n\\nKat\u0131lmak isteyenler ileti\u015fim b\u00f6l\u00fcm\u00fcnden ba\u015fvuru yapabilir.",
                slug: "resim-3",
                category: "Cagri",
                publish_at: "2024-12-15 00:00:00"
            },
            {
                title: "Toplu Besleme Etkinli\u011fi Ba\u015far\u0131yla Tamamland\u0131",
                exp: "G\u00f6n\u00fcll\u00fclerle birlikte onlarca sokak k\u00f6pe\u011fine mama ula\u015ft\u0131r\u0131ld\u0131.\\n\\nBu hafta d\u00fczenledi\u011fimiz toplu mama destek etkinli\u011finde y\u00fczlerce dostumuza mama ula\u015ft\u0131rd\u0131k. Besleme noktalar\u0131 gezilerek mama kaplar\u0131 dolduruldu, su tazelendi ve yaral\u0131 hayvanlar tespit edildi.\\n\\nDestek veren herkese te\u015fekk\u00fcr ederiz. Yeni etkinlik tarihleri yak\u0131nda payla\u015f\u0131lacakt\u0131r.",
                slug: "resim-4",
                category: "Basari",
                publish_at: "2024-12-12 00:00:00"
            }
    ];
    for (const a of announcementsSeed) {
        await db.execute(
            `INSERT INTO announcements (title, exp, slug, category, publish_at, is_active)
             VALUES (?,?,?,?,?,1)
             ON DUPLICATE KEY UPDATE
                title=VALUES(title),
                exp=VALUES(exp),
                category=VALUES(category),
                publish_at=VALUES(publish_at),
                is_active=1`,
            [a.title, a.exp, a.slug, a.category, a.publish_at]
        );
    }
    // Remove placeholder announcements like "Duyuru 1..10" if they exist
    await db.execute(
        "DELETE FROM announcements WHERE title REGEXP '^Duyuru [0-9]+' OR title REGEXP '^ONEMLI Duyuru [0-9]+'"
    );
    await db.execute(
        "DELETE FROM announcements WHERE title IN ('ONEMLI Duyuru 1', 'ÖNEMLI Duyuru 1', 'ÖNEMLİ Duyuru 1')"
    );

    // Remove Black Sea (Karadeniz) sea-area feed points
    await db.execute(
        "DELETE FROM feed_logs WHERE lat > 41.0 AND lat < 43.0 AND lng > 27.0 AND lng < 41.0"
    );

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
