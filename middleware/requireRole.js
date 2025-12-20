module.exports = (...allowedRoles) => {
    return (req, res, next) => {
        // Role bilgisi session içinde taşınıyor
        const role = req.session.role;
        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).send("Yetkisiz erişim");
        }
        next();
    };
};
