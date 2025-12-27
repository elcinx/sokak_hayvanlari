const db = require("../model/data");

const sampleAnnouncements = [
    {
        id: 1,
        slug: "resim-1",
        title: "Sahilde Sokak Hayvanları İçin Mama Dağıtımı Gerçekleştirildi",
        description: "Yerel gönüllüler sahil bölgesinde sokak hayvanlarına mama desteği sağladı.",
        category: "Etkinlik",
        publish_at: "20 Aralık 2024",
        image: "/static/img/3.jpg",
        fullContent: "Şehrimizin sahil hattında yaşayan sokak hayvanları için gönüllü ekibimiz mama dağıtımı gerçekleştirdi. Soğuk kış günlerinde onların beslenmesini desteklemek amacıyla düzenlenen etkinlikte hem mama verildi hem de sağlık kontrolleri yapıldı.

Bu tarz etkinliklerin devam etmesi için halkımızdan mama desteği ve gönüllü katılım bekliyoruz."
    },
    {
        id: 2,
        slug: "resim-2",
        title: "Kış Yaklaşıyor: Sokak Dostlarımız İçin Battaniye ve Mama Kampanyası",
        description: "Soğuk hava koşullarında hayvanların beslenmesi ve barınması için ortak destek kampanyası başladı.",
        category: "Kampanya",
        publish_at: "18 Aralık 2024",
        image: "/static/img/4.jpg",
        fullContent: "Kar yağışının yoğunlaştığı bu dönemlerde sokakta yaşam mücadelesi veren dostlarımız için yeni bir yardım kampanyası başlattık. Mama, su kabı, battaniye ve küçük kulübeler yaparak destek olabilirsiniz.

Kampanya kapsamında toplanan yardım malzemeleri belirlenen noktalara ekiplerimiz tarafından ulaştırılacaktır."
    },
    {
        id: 3,
        slug: "resim-3",
        title: "Mahalle Besleme Noktaları Güncellendi - Gönüllüler Aranıyor",
        description: "Yeni besleme noktaları oluşturuldu, düzenli kontrol için gönüllüler bekleniyor.",
        category: "Çağrı",
        publish_at: "15 Aralık 2024",
        image: "/static/img/5.jpg",
        fullContent: "Şehrimizde belirli bölgelere yeni mama-su kapları yerleştirildi. Ancak düzenli besleme ve temizlik için gönüllülere ihtiyacımız var. Her gün 10-15 dakikanızı ayırarak bir canın hayatına dokunabilirsiniz.

Katılmak isteyenler iletişim bölümünden başvuru yapabilir."
    },
    {
        id: 4,
        slug: "resim-4",
        title: "Toplu Besleme Etkinliği Başarıyla Tamamlandı",
        description: "Gönüllülerle birlikte onlarca sokak köpeğine mama ulaştırıldı.",
        category: "Başarı",
        publish_at: "12 Aralık 2024",
        image: "/static/img/2.jpg",
        fullContent: "Bu hafta düzenlediğimiz toplu mama destek etkinliğinde yüzlerce dostumuza mama ulaştırdık. Besleme noktaları gezilerek mama kapları dolduruldu, su tazelendi ve yaralı hayvanlar tespit edildi.

Destek veren herkese teşekkür ederiz. Yeni etkinlik tarihleri yakında paylaşılacaktır."
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

