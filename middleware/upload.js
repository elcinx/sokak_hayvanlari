const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuid } = require("uuid");
const config = require("../config");

const uploadDir = path.isAbsolute(config.uploadDir) ? config.uploadDir : path.join(__dirname, "..", config.uploadDir);
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const extByMime = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = extByMime[file.mimetype] || path.extname(file.originalname).toLowerCase() || ".jpg";
        cb(null, uuid() + ext);
    },
});

const allowedTypes = ["image/jpeg","image/png","image/webp","image/gif"];

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Sadece resim dosyaları (jpg, png, webp, gif) yüklenebilir"));
        }
        cb(null, true);
    },
});

module.exports = upload;
