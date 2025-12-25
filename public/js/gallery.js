document.addEventListener("DOMContentLoaded", () => {
    const modalImg = document.getElementById("galleryModalImage");
    const modalTitle = document.getElementById("galleryModalTitle");
    const modalMeta = document.getElementById("galleryModalMeta");
    if (!modalImg || !modalTitle || !modalMeta) return;

    document.querySelectorAll(".gallery-open").forEach((btn) => {
        btn.addEventListener("click", () => {
            const src = btn.getAttribute("data-src") || "";
            const title = btn.getAttribute("data-title") || "Gorsel";
            const owner = btn.getAttribute("data-owner") || "";
            const date = btn.getAttribute("data-date") || "";
            modalImg.src = src;
            modalImg.alt = title;
            modalTitle.textContent = title;
            const metaParts = [];
            if (owner) metaParts.push(owner);
            if (date) metaParts.push(date);
            modalMeta.textContent = metaParts.join(" • ");
        });
    });
});
