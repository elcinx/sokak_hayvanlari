const isAuth = require("./isAuth");

module.exports = (req, res, next) => {
    return isAuth(req, res, next);
};
