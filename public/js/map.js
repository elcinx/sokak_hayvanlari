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

    function loadFeeds(options = {}) {
        const { fitBounds = false } = options;
        fetch("/api/feeds")
            .then((r) => r.json())
            .then((feeds) => {
                markers.forEach((m) => map.removeLayer(m));
                markers = [];
                const bounds = L.latLngBounds([]);
                let hasValidPoint = false;
                feeds.forEach((feed) => {
                    const lat = Number(feed.lat);
                    const lng = Number(feed.lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                    if (lat === 0 && lng === 0) return;
                    const popupParts = [];
                    if (feed.photo_url) {
                        popupParts.push(
                            `<img src="${feed.photo_url}" style="max-width:180px; display:block; margin-bottom:8px;">`
                        );
                    }
                    popupParts.push(`<strong>${feed.user_name || "Kullanici"}</strong>`);
                    popupParts.push(`<div>${formatDate(feed.created_at)}</div>`);
                    if (feed.note) popupParts.push(`<div>${feed.note}</div>`);
                    popupParts.push(
                        `<div>Yorum: ${feed.comments_count || 0} / Begeni: ${feed.likes_count || 0}</div>`
                    );
                    popupParts.push(
                        `<a href="/feeds/${feed.id}" class="btn btn-sm btn-outline-primary mt-1">Detay</a>`
                    );
                    if (isAuth) {
                        popupParts.push(
                            `<button class="btn btn-sm btn-outline-secondary mt-1 fav-btn" data-lat="${feed.lat}" data-lng="${feed.lng}">Favori</button>`
                        );
                    }
                    const marker = L.marker([lat, lng], { status: feed.status || "normal" });
                    marker.bindPopup(popupParts.join("<br>"));
                    marker.addTo(map);
                    markers.push(marker);
                    bounds.extend([lat, lng]);
                    hasValidPoint = true;
                });
                attachFavHandlers();
                applyFilters();
                if (fitBounds) {
                    if (hasValidPoint) {
                        map.fitBounds(bounds, { padding: [30, 30] });
                    } else {
                        map.setView([20, 0], 2);
                    }
                }
            })
            .catch(() => {});
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
            showFeedFormError("Önce haritada bir nokta seç.");
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
                showFeedFormError("Önce haritada bir nokta seç.");
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
                    if (res.ok) return res.json().catch(() => ({}));
                    const errData = await res.json().catch(() => ({}));
                    const msg = errData.error || "Kaydetme basarisiz";
                    throw new Error(`${res.status} ${msg}`);
                })
                .then(() => {
                    const modal = getModal();
                    if (modal) modal.hide();
                    resetFeedForm();
                    loadFeeds({ fitBounds: false });
                })
                .catch((err) => {
                    showFeedFormError(err.message || "Kaydetme basarisiz");
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
