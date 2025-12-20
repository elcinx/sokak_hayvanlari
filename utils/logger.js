module.exports = {
    error:(req, err, context)=>{
        const ts = new Date().toISOString();
        const user = req?.session?.userid || "anon";
        const route = req?.originalUrl || req?.url || "";
        const rid = req?.id || "-";
        console.error(`[${ts}] [${context}] rid=${rid} user=${user} route=${route} error=${err && err.message}`);
    }
};
