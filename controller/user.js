const db = require("../model/data");

const sampleAnnouncements = [
    {
        id: 1,
        slug: "resim-1",
        title: "Sahilde Sokak Hayvanlarý Ýçin Mama Daðýtýmý Gerçekleþtirildi",
        description: "Yerel gönüllüler sahil bölgesinde sokak hayvanlarýna mama desteði saðladý.",
        category: "Etkinlik",
        publish_at: "20 Aralýk 2024",
        image: "/static/img/3.jpg",
        fullContent: "Þehrimizin sahil hattýnda yaþayan sokak hayvanlarý için gönüllü ekibimiz mama daðýtýmý gerçekleþtirdi. Soðuk kýþ günlerinde onlarýn beslenmesini desteklemek amacýyla düzenlenen etkinlikte hem mama verildi hem de saðlýk kontrolleri yapýldý.\n\nBu tarz etkinliklerin devam etmesi için halkýmýzdan mama desteði ve gönüllü katýlým bekliyoruz."
    },
    {
        id: 2,
        slug: "resim-2",
        title: "Kýþ Yaklaþýyor: Sokak Dostlarýmýz Ýçin Battaniye ve Mama Kampanyasý",
        description: "Soðuk hava koþullarýnda hayvanlarýn beslenmesi ve barýnmasý için ortak destek kampanyasý baþladý.",
        category: "Kampanya",
        publish_at: "18 Aralýk 2024",
        image: "/static/img/4.jpg",
        fullContent: "Kar yaðýþýnýn yoðunlaþtýðý bu dönemlerde sokakta yaþam mücadelesi veren dostlarýmýz için yeni bir yardým kampanyasý baþlattýk. Mama, su kabý, battaniye ve küçük kulübeler yaparak destek olabilirsiniz.\n\nKampanya kapsamýnda toplanan yardým malzemeleri belirlenen noktalara ekiplerimiz tarafýndan ulaþtýrýlacaktýr."
    },
    {
        id: 3,
        slug: "resim-3",
        title: "Mahalle Besleme Noktalarý Güncellendi – Gönüllüler Aranýyor",
        description: "Yeni besleme noktalarý oluþturuldu, düzenli kontrol için gönüllüler bekleniyor.",
        category: "Çaðrý",
        publish_at: "15 Aralýk 2024",
        image: "/static/img/5.jpg",
        fullContent: "Þehrimizde belirli bölgelere yeni mama-su kaplarý yerleþtirildi. Ancak düzenli besleme ve temizlik için gönüllülere ihtiyacýmýz var. Her gün 10-15 dakikanýzý ayýrarak bir canýn hayatýna dokunabilirsiniz.\n\nKatýlmak isteyenler iletiþim bölümünden baþvuru yapabilir."
    },
    {
        id: 4,
        slug: "resim-4",
        title: "Toplu Besleme Etkinliði Baþarýyla Tamamlandý",
        description: "Gönüllülerle birlikte onlarca sokak köpeðine mama ulaþtýrýldý.",
        category: "Baþarý",
        publish_at: "12 Aralýk 2024",
        image: "/static/img/2.jpg",
        fullContent: "Bu hafta düzenlediðimiz toplu mama destek etkinliðinde yüzlerce dostumuza mama ulaþtýrdýk. Besleme noktalarý gezilerek mama kaplarý dolduruldu, su tazelendi ve yaralý hayvanlar tespit edildi.\n\nDestek veren herkese teþekkür ederiz. Yeni etkinlik tarihleri yakýnda paylaþýlacaktýr."
    }
];

exports.userHome = async (req, res, next) => {
    try {
        const [announcements] = await db.execute("SELECT * FROM announcements WHERE is_active=1 ORDER BY publish_at DESC LIMIT 10");
        const [[totalFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs");
        const [[activePoints]] = await db.execute("SELECT COUNT(DISTINCT CONCAT(lat, ',', lng)) AS c FROM feed_logs");
        const [[todayFeeds]] = await db.execute("SELECT COUNT(*) AS c FROM feed_logs WHERE DATE(created_at)=CURDATE()");
        const [galleryRaw] = await db.execute(
            `SELECT id, photo_url, note AS title FROM feed_logs 
             WHERE photo_url IS NOT NULL ORDER BY created_at DESC LIMIT 6`
        );
        const gallery = galleryRaw.map(g=>({
            ...g,
            image_path: g.photo_url || null
        }));
        const [[totalVisits]] = await db.execute("SELECT COUNT(*) AS c FROM visit_logs");
        const [[todayVisits]] = await db.execute("SELECT COUNT(*) AS c FROM visit_logs WHERE DATE(visited_at)=CURDATE()");
        const slugify = require("slugify");
        res.render("user/index", {
            title: "Ana sayfa",
            contentTitle: "Ana sayfa",
            data: announcements,
            summary: {
                totalFeeds: totalFeeds?.c || 0,
                activePoints: activePoints?.c || 0,
                todayFeeds: todayFeeds?.c || 0,
                totalVisits: totalVisits?.c || 0,
                todayVisits: todayVisits?.c || 0,
            },
            gallery,
            slugify,
        });
    } catch (err) {
        return next(err);
    }
};

exports.viewAnc = async (req, res, next) => {
    try {
        const slug = req.params.slug;
        let selected = null;
        let allData = [];
        try {
            const [selectedData] = await db.execute("SELECT * FROM announcements WHERE slug=?", [slug]);
            selected = selectedData[0] || null;
            const [allRows] = await db.execute("SELECT * FROM announcements WHERE is_active=1 ORDER BY publish_at DESC");
            allData = allRows || [];
        } catch (dbErr) {
            selected = null;
            allData = [];
        }

        if (!selected) {
            selected = sampleAnnouncements.find(a => a.slug === slug || String(a.id) === String(slug));
        }
        if (!selected) return next("Bulunamadi");
        if (!allData || allData.length === 0) {
            allData = sampleAnnouncements;
        }
        res.render("user/view-announcement", {
            title: selected.title,
            contentTitle: selected.title,
            viewData: selected,
            data: allData,
        });
    } catch (err) {
        return next(err);
    }
};

exports.listAnnouncements = async (req, res, next) => {
    try {
        // Database baglantisi yoksa sample data kullan
        let allData = [];
        try {
            [allData] = await db.execute("SELECT * FROM announcements WHERE is_active=1 ORDER BY publish_at DESC");
            if (!allData || allData.length === 0) {
                allData = sampleAnnouncements;
            }
        } catch (dbErr) {
            // Database hatasi olursa sample data
            allData = sampleAnnouncements;
        }

        res.render("user/announcements", {
            title: "Duyurular",
            contentTitle: "Duyurular",
            data: allData,
        });
    } catch (err) {
        next(err);
    }
};
