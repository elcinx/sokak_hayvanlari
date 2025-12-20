// Basit in-memory rate limiter. Prod ortamı için dağıtık cache (Redis vb.) TODO.
const buckets = new Map();

function rateLimit({ windowMs, max, keyGenerator }) {
    return (req, res, next) => {
        const now = Date.now();
        const key = keyGenerator ? keyGenerator(req) : req.ip;
        if (!key) return next();
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = [];
            buckets.set(key, bucket);
        }
        // Eski kayıtları temizle
        while (bucket.length && now - bucket[0] > windowMs) {
            bucket.shift();
        }
        if (bucket.length >= max) {
            const retryAfter = Math.ceil((windowMs - (now - bucket[0]))/1000);
            res.setHeader("Retry-After", retryAfter);
            return res.status(429).json({ message: "Rate limit aşıldı, lütfen bekleyin", retryAfter });
        }
        bucket.push(now);
        next();
    };
}

module.exports = rateLimit;
