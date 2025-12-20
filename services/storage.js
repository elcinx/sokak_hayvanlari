const path = require("path");
const fs = require("fs");
const config = require("../config");
let cloudinary;
if (config.storageDriver === "cloudinary") {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET){
        console.error("Cloudinary seçili ama CLOUDINARY_* değişkenleri eksik");
        process.exit(1);
    }
    cloudinary = require("cloudinary").v2;
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

const localSave = async (file) => {
    const storageKey = path.join("uploads", file.filename).replace(/\\/g,"/");
    const base = config.baseUrl.replace(/\/$/,"");
    const url = `${base}/${storageKey}`;
    return { url, key: storageKey };
};

const localDelete = async (key) => {
    if (!key) return;
    // key should be "uploads/filename"
    const abs = path.isAbsolute(key) ? key : path.join(config.uploadDir, key.replace(/^uploads[\\/]/,""));
    if (abs.startsWith(config.uploadDir) && fs.existsSync(abs)){
        fs.unlinkSync(abs);
    }
};

const cloudSave = async (file) => {
    const res = await cloudinary.uploader.upload(file.path, { folder:"feeds" });
    return { url: res.secure_url || res.url, key: res.public_id };
};

const cloudDelete = async (key) => {
    if (!key) return;
    await cloudinary.uploader.destroy(key, { invalidate:true });
};

exports.saveImage = async (file) => {
    if (!file) return { url:null, key:null };
    if (config.storageDriver === "cloudinary") {
        return cloudSave(file);
    }
    return localSave(file);
};

exports.deleteImage = async (key) => {
    if (!key) return;
    if (config.storageDriver === "cloudinary") {
        return cloudDelete(key);
    }
    return localDelete(key);
};
