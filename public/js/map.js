document.addEventListener("DOMContentLoaded", () => {
    const mapEl = document.getElementById("map");
    if (!mapEl || typeof L === "undefined") return;

    const isAuth = document.body.dataset.isAuth === "true";

    // Online kullanici sayisi
    if (typeof io === "function") {
        const socket = io();
        socket.on("online-count", ({ online }) => {
            const el = document.getElementById("onlineUsers");
            if (el) el.innerText = online;
        });
    }

    // Ozet bilgiyi guncelle
    fetch("/api/metrics/summary")
        .then((r) => r.json())
        .then((d) => {
            const totalFeeds = document.getElementById("totalFeeds");
            const activePoints = document.getElementById("activePoints");
            const todayFeeds = document.getElementById("todayFeeds");
            const onlineUsers = document.getElementById("onlineUsers");
            if (totalFeeds) totalFeeds.innerText = d.totalFeeds;
            if (activePoints) activePoints.innerText = d.activePoints;
            if (todayFeeds) todayFeeds.innerText = d.todayFeeds;
            if (onlineUsers) onlineUsers.innerText = d.online;
        })
        .catch(() => {});

    // Leaflet harita
    const map = L.map("map").setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    let markers = [];
    let statusByKey = {};
    let heatLayer = L.layerGroup();

    // Status bilgisi & heatmap
    fetch("/api/feeds/points-summary?days=30")
        .then((r) => r.json())
        .then((rows) => {
            rows.forEach((r) => {
                const key = `${r.lat},${r.lng}`;
                statusByKey[key] = r.status;
            });
            rows.forEach((r) => {
                const intensity = Math.min(1 + r.feed_count / 5, 5);
                const circle = L.circle([r.lat, r.lng], {
                    radius: 200 * intensity,
                    color: "red",
                    opacity: 0.4,
                    fillOpacity: 0.15,
                });
                heatLayer.addLayer(circle);
            });
        });

    // Marker ciz
    fetch("/api/feeds")
        .then((r) => r.json())
        .then((feeds) => {
            feeds.forEach((feed) => {
                if (!feed.lat || !feed.lng) return;
                const popupParts = [];
                if (feed.photo_path) {
                    popupParts.push(
                        `<img src="/${feed.photo_path}" style="max-width:180px; display:block; margin-bottom:8px;">`
                    );
                }
                popupParts.push(`<strong>${feed.name || "Kullanici"}</strong>`);
                popupParts.push(
                    `<div>${dayjs(feed.created_at).format("DD.MM.YYYY HH:mm")}</div>`
                );
                if (feed.note) popupParts.push(`<div>${feed.note}</div>`);
                popupParts.push(
                    `<div>Yorum: ${feed.comment_count || 0} / Begeni: ${feed.like_count || 0}</div>`
                );
                popupParts.push(
                    `<a href="/feeds/${feed.id}" class="btn btn-sm btn-outline-primary mt-1">Detay</a>`
                );
                if (isAuth) {
                    popupParts.push(
                        `<button class="btn btn-sm btn-outline-secondary mt-1 fav-btn" data-lat="${feed.lat}" data-lng="${feed.lng}">Favori</button>`
                    );
                }
                const key = `${Number(feed.lat).toFixed(4)},${Number(feed.lng).toFixed(4)}`;
                const status = statusByKey[key] || "normal";
                const marker = L.marker([feed.lat, feed.lng], { status });
                marker.bindPopup(popupParts.join("<br>"));
                marker.addTo(map);
                markers.push(marker);
            });
            attachFavHandlers();
        })
        .catch(() => {});

    // Konumumu bul
    const locateBtn = document.getElementById("locateBtn");
    if (locateBtn) {
        locateBtn.addEventListener("click", () => {
            if (!navigator.geolocation) return alert("Tarayici konum destegi yok");
            locateBtn.disabled = true;
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    map.setView([latitude, longitude], 14);
                    L.marker([latitude, longitude]).addTo(map).bindPopup("Konumum").openPopup();
                    locateBtn.disabled = false;
                },
                () => {
                    alert("Konum alinamadi");
                    locateBtn.disabled = false;
                }
            );
        });
    }

    // Filtreler
    const filters = document.querySelectorAll(".filter-status");
    filters.forEach((f) => f.addEventListener("change", applyFilters));
    function applyFilters() {
        const active = Array.from(filters)
            .filter((f) => f.checked)
            .map((f) => f.value);
        markers.forEach((m) => {
            const status = m.options.status || "normal";
            if (active.includes(status)) {
                m.addTo(map);
            } else {
                map.removeLayer(m);
            }
        });
    }

    // Heatmap toggle
    const toggleHeatmap = document.getElementById("toggleHeatmap");
    if (toggleHeatmap) {
        toggleHeatmap.addEventListener("click", () => {
            if (map.hasLayer(heatLayer)) {
                map.removeLayer(heatLayer);
            } else {
                heatLayer.addTo(map);
            }
        });
    }

    // Favori ekle
    function attachFavHandlers() {
        document.querySelectorAll(".fav-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const lat = btn.getAttribute("data-lat");
                const lng = btn.getAttribute("data-lng");
                fetch("/api/favorites", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lat, lng }),
                })
                    .then((r) => r.json())
                    .then(() => {
                        btn.innerText = "Eklendi";
                        btn.disabled = true;
                    })
                    .catch(() => {});
            });
        });
    }

    // Haftalik leaderboard
    fetch("/api/leaderboard/weekly")
        .then((r) => r.json())
        .then((list) => {
            const ul = document.getElementById("weeklyTop");
            if (!ul) return;
            ul.innerHTML = "";
            list.slice(0, 5).forEach((item, idx) => {
                const li = document.createElement("li");
                li.className = "list-group-item d-flex justify-content-between";
                li.innerHTML = `<span>${idx + 1}. ${item.name}</span><span>${item.points}</span>`;
                ul.appendChild(li);
            });
            if (list.length === 0) {
                ul.innerHTML = '<li class="list-group-item">Veri yok</li>';
            }
        })
        .catch(() => {
            const ul = document.getElementById("weeklyTop");
            if (ul) ul.innerHTML = '<li class="list-group-item">Yuklenemedi</li>';
        });
});
