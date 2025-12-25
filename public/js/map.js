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

    // Visitor log (cooldown)
    fetch("/api/metrics/visit", { method: "POST" }).catch(() => {});

    // Ozet bilgiyi guncelle
    fetch("/api/metrics/summary")
        .then((r) => r.json())
        .then((d) => {
            const totalFeeds = document.getElementById("totalFeeds");
            const activePoints = document.getElementById("activePoints");
            const todayFeeds = document.getElementById("todayFeeds");
            const onlineUsers = document.getElementById("onlineUsers");
            const totalVisits = document.getElementById("totalVisits");
            const todayVisits = document.getElementById("todayVisits");
            if (totalFeeds) totalFeeds.innerText = d.totalFeeds;
            if (activePoints) activePoints.innerText = d.activePoints;
            if (todayFeeds) todayFeeds.innerText = d.todayFeeds;
            if (onlineUsers) onlineUsers.innerText = d.online;
            if (totalVisits) totalVisits.innerText = d.totalVisits;
            if (todayVisits) todayVisits.innerText = d.todayVisits;
        })
        .catch(() => {});

    // Leaflet harita
    const map = L.map("map").setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    let feedMarkers = [];
    let feedsLayer = L.layerGroup().addTo(map);
    let heatLayer = null;
    let selectedLat = null;
    let selectedLng = null;
    let selectedMarker = null;

    const openFeedFormBtn = document.getElementById("openFeedForm");
    const feedModalEl = document.getElementById("feedModal");
    const feedForm = document.getElementById("feedForm");
    const feedCoords = document.getElementById("feedCoords");
    const feedNote = document.getElementById("feedNote");
    const feedPhoto = document.getElementById("feedPhoto");
    const feedFormError = document.getElementById("feedFormError");
    const cancelFeedForm = document.getElementById("cancelFeedForm");

    loadFeeds({ fitBounds: true });

    // Konumumu bul
    const locateBtn = document.getElementById("locateBtn");
    if (locateBtn) {
        locateBtn.addEventListener("click", () => {
            if (!navigator.geolocation) return alert("Tarayici konum destegi yok");
            locateBtn.disabled = true;
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    map.setView([latitude, longitude], 15);
                    setSelectedLocation(latitude, longitude, true);
                    locateBtn.disabled = false;
                },
                () => {
                    const needsHttps = window.location.protocol !== "https:" && window.location.hostname !== "localhost";
                    const suffix = needsHttps ? " HTTPS gerekli olabilir." : "";
                    alert(`Konum izni verilmedi / Konum alınamadı.${suffix}`);
                    locateBtn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
        feedMarkers.forEach((m) => {
            const status = m.options.status || "normal";
            if (active.includes(status)) {
                feedsLayer.addLayer(m);
            } else {
                feedsLayer.removeLayer(m);
            }
        });
    }

    // Heatmap toggle
    const toggleHeatmap = document.getElementById("toggleHeatmap");
    if (toggleHeatmap) {
        toggleHeatmap.addEventListener("click", () => {
            if (typeof L.heatLayer !== "function") return;
            if (heatLayer && map.hasLayer(heatLayer)) {
                map.removeLayer(heatLayer);
                return;
            }
            if (!heatLayer) {
                fetch("/api/heatmap?days=30")
                    .then((r) => r.json())
                    .then((rows) => {
                        const points = rows.map((r) => [r.lat, r.lng, r.intensity]);
                        heatLayer = L.heatLayer(points, { radius: 25, blur: 18, maxZoom: 17 });
                        heatLayer.addTo(map);
                    })
                    .catch(() => {});
                return;
            }
            heatLayer.addTo(map);
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

    function formatDate(value) {
        if (typeof dayjs === "function") {
            return dayjs(value).format("DD.MM.YYYY HH:mm");
        }
        try {
            return new Date(value).toLocaleString();
        } catch (err) {
            return "";
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    async function loadFeeds(options = {}) {
        const { fitBounds = false } = options;
        try {
            const r = await fetch("/api/feeds");
            const feeds = await r.json();
            renderFeeds(feeds, { fitBounds });
        } catch (err) {}
    }

    function addFeedMarker(feed) {
        const lat = Number(feed.lat);
        const lng = Number(feed.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (lat === 0 && lng === 0) return null;
        const img = feed.photo_url
            ? `<img src="${feed.photo_url}" style="width:100%;max-width:220px;border-radius:8px;margin-top:6px" />`
            : "";
        const note = escapeHtml(feed.note || "");
        const user = escapeHtml(feed.user_name || "");
        const created = formatDate(feed.created_at);
        const popup = `<b>${note}</b><br/><small>${user}</small><br/><small>${created}</small>${img}`;
        const marker = L.marker([lat, lng], { status: feed.status || "normal" });
        marker.bindPopup(popup);
        marker.addTo(feedsLayer);
        feedMarkers.push(marker);
        return marker;
    }

    function renderFeeds(feeds, options = {}) {
        const { fitBounds = false } = options;
        feedsLayer.clearLayers();
        feedMarkers = [];
        const bounds = L.latLngBounds([]);
        let hasValidPoint = false;
        feeds.forEach((feed) => {
            const marker = addFeedMarker(feed);
            if (marker) {
                bounds.extend(marker.getLatLng());
                hasValidPoint = true;
            }
        });
        applyFilters();
        if (fitBounds) {
            if (hasValidPoint) {
                map.fitBounds(bounds, { padding: [30, 30] });
            } else {
                map.setView([20, 0], 2);
            }
        }
    }

    function updateSelectedText() {
        if (!feedCoords) return;
        if (Number.isFinite(selectedLat) && Number.isFinite(selectedLng)) {
            feedCoords.value = `${selectedLat.toFixed(5)},${selectedLng.toFixed(5)}`;
        } else {
            feedCoords.value = "";
        }
    }

    function showFeedFormError(message) {
        if (!feedFormError) return;
        if (!message) {
            feedFormError.style.display = "none";
            feedFormError.textContent = "";
            return;
        }
        feedFormError.textContent = message;
        feedFormError.style.display = "block";
    }

    function resetFeedForm() {
        if (feedNote) feedNote.value = "";
        if (feedPhoto) feedPhoto.value = "";
        showFeedFormError("");
        selectedLat = null;
        selectedLng = null;
        updateSelectedText();
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }
    }

    function getModal() {
        if (!feedModalEl || typeof bootstrap === "undefined") return null;
        return bootstrap.Modal.getOrCreateInstance(feedModalEl);
    }

    function openFeedModal() {
        const modal = getModal();
        if (!modal) return;
        updateSelectedText();
        if (!Number.isFinite(selectedLat) || !Number.isFinite(selectedLng)) {
            showFeedFormError("Once haritada bir nokta sec.");
        } else {
            showFeedFormError("");
        }
        modal.show();
    }

    if (openFeedFormBtn) {
        openFeedFormBtn.addEventListener("click", () => {
            openFeedModal();
        });
    }

    if (cancelFeedForm) {
        cancelFeedForm.addEventListener("click", () => {
            resetFeedForm();
        });
    }

    if (feedModalEl) {
        feedModalEl.addEventListener("hidden.bs.modal", () => {
            resetFeedForm();
        });
    }

    if (feedForm) {
        feedForm.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!Number.isFinite(selectedLat) || !Number.isFinite(selectedLng)) {
                showFeedFormError("Once haritada bir nokta sec.");
                return;
            }
            if (selectedLat === 0 && selectedLng === 0) {
                showFeedFormError("Konum zorunlu");
                return;
            }
            const noteValue = (feedNote?.value || "").trim();
            if (!noteValue) {
                showFeedFormError("Not zorunlu");
                return;
            }
            showFeedFormError("");
            const formData = new FormData();
            formData.append("lat", selectedLat);
            formData.append("lng", selectedLng);
            formData.append("note", noteValue);
            if (feedPhoto && feedPhoto.files && feedPhoto.files[0]) {
                formData.append("photo", feedPhoto.files[0]);
            }
            fetch("/api/feeds", {
                method: "POST",
                body: formData,
            })
                .then(async (res) => {
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        const msg = data.error || "Kaydetme basarisiz";
                        throw new Error(`${res.status} ${msg}`);
                    }
                    return data;
                })
                .then((data) => {
                    const modal = getModal();
                    if (modal) modal.hide();
                    resetFeedForm();
                    const feed = data.feed || data;
                    const marker = addFeedMarker(feed || {});
                    if (!marker) {
                        return loadFeeds({ fitBounds: false });
                    }
                    applyFilters();
                })
                .catch((err) => {
                    console.error(err);
                    showFeedFormError(err.message || "Kaydetme basarisiz");
                    alert(err.message || "Kaydetme basarisiz");
                });
        });
    }

    map.on("click", (e) => {
        setSelectedLocation(e.latlng.lat, e.latlng.lng, true);
    });

    function setSelectedLocation(lat, lng, openModal) {
        selectedLat = lat;
        selectedLng = lng;
        updateSelectedText();
        if (!selectedMarker) {
            selectedMarker = L.marker([selectedLat, selectedLng]);
            selectedMarker.addTo(map);
        } else {
            selectedMarker.setLatLng([selectedLat, selectedLng]);
        }
        showFeedFormError("");
        if (openModal) openFeedModal();
    }
});
