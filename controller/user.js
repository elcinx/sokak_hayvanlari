const db = require("../model/data");

const sampleAnnouncements = [
    {
        "id": 1,
        "slug": "resim-1",
        "title": "Sahilde Sokak Hayvanlar\u0131 \u0130\u00e7in Mama Da\u011f\u0131t\u0131m\u0131 Ger\u00e7ekle\u015ftirildi",
        "description": "Yerel g\u00f6n\u00fcll\u00fcler sahil b\u00f6lgesinde sokak hayvanlar\u0131na mama deste\u011fi sa\u011flad\u0131.",
        "category": "Etkinlik",
        "publish_at": "20 Aral\u0131k 2024",
        "image": "/static/img/3.jpg",
        "fullContent": "\u015eehrimizin sahil hatt\u0131nda ya\u015fayan sokak hayvanlar\u0131 i\u00e7in g\u00f6n\u00fcll\u00fc ekibimiz mama da\u011f\u0131t\u0131m\u0131 ger\u00e7ekle\u015ftirdi. So\u011fuk k\u0131\u015f g\u00fcnlerinde onlar\u0131n beslenmesini desteklemek amac\u0131yla d\u00fczenlenen etkinlikte hem mama verildi hem de sa\u011fl\u0131k kontrolleri yap\u0131ld\u0131.\n\nBu tarz etkinliklerin devam etmesi i\u00e7in halk\u0131m\u0131zdan mama deste\u011fi ve g\u00f6n\u00fcll\u00fc kat\u0131l\u0131m bekliyoruz."
    },
    {
        "id": 2,
        "slug": "resim-2",
        "title": "K\u0131\u015f Yakla\u015f\u0131yor: Sokak Dostlar\u0131m\u0131z \u0130\u00e7in Battaniye ve Mama Kampanyas\u0131",
        "description": "So\u011fuk hava ko\u015fullar\u0131nda hayvanlar\u0131n beslenmesi ve bar\u0131nmas\u0131 i\u00e7in ortak destek kampanyas\u0131 ba\u015flad\u0131.",
        "category": "Kampanya",
        "publish_at": "18 Aral\u0131k 2024",
        "image": "/static/img/4.jpg",
        "fullContent": "Kar ya\u011f\u0131\u015f\u0131n\u0131n yo\u011funla\u015ft\u0131\u011f\u0131 bu d\u00f6nemlerde sokakta ya\u015fam m\u00fccadelesi veren dostlar\u0131m\u0131z i\u00e7in yeni bir yard\u0131m kampanyas\u0131 ba\u015flatt\u0131k. Mama, su kab\u0131, battaniye ve k\u00fc\u00e7\u00fck kul\u00fcbeler yaparak destek olabilirsiniz.\n\nKampanya kapsam\u0131nda toplanan yard\u0131m malzemeleri belirlenen noktalara ekiplerimiz taraf\u0131ndan ula\u015ft\u0131r\u0131lacakt\u0131r."
    },
    {
        "id": 3,
        "slug": "resim-3",
        "title": "Mahalle Besleme Noktalar\u0131 G\u00fcncellendi - G\u00f6n\u00fcll\u00fcler Aran\u0131yor",
        "description": "Yeni besleme noktalar\u0131 olu\u015fturuldu, d\u00fczenli kontrol i\u00e7in g\u00f6n\u00fcll\u00fcler bekleniyor.",
        "category": "\u00c7a\u011fr\u0131",
        "publish_at": "15 Aral\u0131k 2024",
        "image": "/static/img/5.jpg",
        "fullContent": "\u015eehrimizde belirli b\u00f6lgelere yeni mama-su kaplar\u0131 yerle\u015ftirildi. Ancak d\u00fczenli besleme ve temizlik i\u00e7in g\u00f6n\u00fcll\u00fclere ihtiyac\u0131m\u0131z var. Her g\u00fcn 10-15 dakikan\u0131z\u0131 ay\u0131rarak bir can\u0131n hayat\u0131na dokunabilirsiniz.\n\nKat\u0131lmak isteyenler ileti\u015fim b\u00f6l\u00fcm\u00fcnden ba\u015fvuru yapabilir."
    },
    {
        "id": 4,
        "slug": "resim-4",
        "title": "Toplu Besleme Etkinli\u011fi Ba\u015far\u0131yla Tamamland\u0131",
        "description": "G\u00f6n\u00fcll\u00fclerle birlikte onlarca sokak k\u00f6pe\u011fine mama ula\u015ft\u0131r\u0131ld\u0131.",
        "category": "Ba\u015far\u0131",
        "publish_at": "12 Aral\u0131k 2024",
        "image": "/static/img/2.jpg",
        "fullContent": "Bu hafta d\u00fczenledi\u011fimiz toplu mama destek etkinli\u011finde y\u00fczlerce dostumuza mama ula\u015ft\u0131rd\u0131k. Besleme noktalar\u0131 gezilerek mama kaplar\u0131 dolduruldu, su tazelendi ve yaral\u0131 hayvanlar tespit edildi.\n\nDestek veren herkese te\u015fekk\u00fcr ederiz. Yeni etkinlik tarihleri yak\u0131nda payla\u015f\u0131lacakt\u0131r."
    }
];



exports.userHome = async (req, res, next) => {
    try {
        const [announcements] = await db.execute("SELECT * FROM announcements WHERE is_active=1 ORDER BY publish_at DESC LIMIT 10");
        const announcementsList = announcements && announcements.length ? announcements : sampleAnnouncements;
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
            data: announcementsList,
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

