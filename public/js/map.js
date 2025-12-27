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
    const heroLocateBtn = document.getElementById("heroLocateBtn");
    const feedForm = document.getElementById("feedCreateForm");
    const feedLatInput = document.getElementById("feedLat");
    const feedLngInput = document.getElementById("feedLng");
    const feedNote = document.getElementById("feedNote");
    const feedPhoto = document.getElementById("feedPhoto");
    const selectedLocationInfo = document.getElementById("selectedLocationInfo");
    const feedSuccessAlert = document.getElementById("feedSuccessAlert");
    const feedErrorAlert = document.getElementById("feedErrorAlert");
    const feedHelpBar = document.getElementById("feedHelpBar");
    const feedSubmitBtn = document.querySelector(".feed-submit-btn");
    const mapSection = document.getElementById("mapSection");
    const defaultSelectedText = selectedLocationInfo ? selectedLocationInfo.textContent : "";

    if (isAuth) {
        const pending = sessionStorage.getItem("pendingFeedForm");
        if (pending) {
            try {
                const data = JSON.parse(pending);
                if (Number.isFinite(data.lat) && Number.isFinite(data.lng)) {
                    selectedLat = data.lat;
                    selectedLng = data.lng;
                    if (feedNote && data.note) feedNote.value = data.note;
                    setSelectedLocation(selectedLat, selectedLng);
                    // Otomatik kaydet
                    if (feedForm) {
                        if (feedLatInput) feedLatInput.value = selectedLat.toFixed(6);
                        if (feedLngInput) feedLngInput.value = selectedLng.toFixed(6);
                        const formData = new FormData(feedForm);
                        const action = feedForm.getAttribute("action") || "/api/feeds";
                        fetch(action, {
                            method: "POST",
                            body: formData,
                            credentials: "same-origin",
                        })
                            .then(async (res) => {
                                const ct = res.headers.get("content-type") || "";
                                if (res.redirected || ct.includes("text/html")) {
                                    throw new Error("Giris yapmalisiniz.");
                                }
                                const d = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                    const msg = d.error || "Kaydetme basarisiz";
                                    throw new Error(`${res.status} ${msg}`);
                                }
                                return d;
                            })
                            .then(() => {
                                showAlert(feedSuccessAlert, "Besleme kaydi eklendi.");
                                resetFeedForm();
                                return loadFeeds({ fitBounds: false });
                            })
                            .catch(() => {})
                            .finally(() => {
                                // Artık bekleyen veri yok
                                sessionStorage.removeItem("pendingFeedForm");
                            });
                    } else {
                        sessionStorage.removeItem("pendingFeedForm");
                    }
                }
            } catch (e) {}
        }
    }

    loadFeeds({ fitBounds: true });

    // Konumumu bul
    const locateBtn = document.getElementById("locateBtn");
    const requestGeolocation = () => {
        if (!navigator.geolocation) {
            alert("Tarayici konum destegi yok");
            return;
        }
        if (locateBtn) locateBtn.disabled = true;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                map.setView([latitude, longitude], 15);
                setSelectedLocation(latitude, longitude);
                if (locateBtn) locateBtn.disabled = false;
            },
            () => {
                const needsHttps = window.location.protocol !== "https:" && window.location.hostname !== "localhost";
                const suffix = needsHttps ? " HTTPS gerekli olabilir." : "";
                alert(`Konum izni verilmedi / Konum alinamadi.${suffix}`);
                if (locateBtn) locateBtn.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    if (heroLocateBtn) {
        heroLocateBtn.addEventListener("click", (event) => {
            event.preventDefault();
            if (mapSection) {
                mapSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            requestGeolocation();
        });
    }
    if (locateBtn) {
        locateBtn.addEventListener("click", requestGeolocation);
    }

    // Filtreler
    const filters = document.querySelectorAll(".filter-status");
    filters.forEach((f) => f.addEventListener("change", applyFilters));
    function applyFilters() {
        if (!filters || filters.length === 0) {
            feedMarkers.forEach((m) => feedsLayer.addLayer(m));
            updateActivePointCounter();
            return;
        }
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
        updateActivePointCounter();
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
                        heatLayer = L.heatLayer(points, {
                            radius: 28,
                            blur: 16,
                            maxZoom: 17,
                            minOpacity: 0.5,
                            gradient: {
                                0.2: "#fff5f5",
                                0.4: "#ff8a80",
                                0.6: "#ff5252",
                                0.8: "#c62828",
                                1.0: "#8e0000",
                            },
                        });
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
        updateActivePointCounter();
    }

    function updateSelectedText() {
        if (feedLatInput && Number.isFinite(selectedLat)) {
            feedLatInput.value = selectedLat.toFixed(6);
        }
        if (feedLngInput && Number.isFinite(selectedLng)) {
            feedLngInput.value = selectedLng.toFixed(6);
        }
        if (!selectedLocationInfo) return;
        if (Number.isFinite(selectedLat) && Number.isFinite(selectedLng)) {
            selectedLocationInfo.textContent = `Secilen konum: ${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
        } else {
            selectedLocationInfo.textContent = defaultSelectedText;
        }
    }

    function showAlert(el, message) {
        if (!el) return;
        if (!message) {
            el.textContent = "";
            el.classList.add("d-none");
            return;
        }
        el.textContent = message;
        el.classList.remove("d-none");
    }

    function setSubmitEnabled(enabled) {
        if (!feedSubmitBtn) return;
        feedSubmitBtn.disabled = !enabled;
    }

    function resetFeedForm() {
        if (feedNote) feedNote.value = "";
        if (feedPhoto) feedPhoto.value = "";
        showAlert(feedErrorAlert, "");
        showAlert(feedSuccessAlert, "");
        selectedLat = null;
        selectedLng = null;
        updateSelectedText();
        setSubmitEnabled(false);
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }
    }

    if (openFeedFormBtn) {
        openFeedFormBtn.addEventListener("click", () => {
            if (mapSection) {
                mapSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            if (feedHelpBar) {
                feedHelpBar.style.display = "inline-flex";
            }
        });
    }

    if (feedForm) {
        feedForm.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!isAuth) {
                showAlert(feedErrorAlert, "Besleme eklemek icin giris yapmalisiniz.");
                sessionStorage.setItem("pendingFeedForm", JSON.stringify({"lat": selectedLat, "lng": selectedLng, "note": (feedNote && feedNote.value) ? feedNote.value : ""}));
                window.location.href = "/auth/login?url=/";
                return;
            }

            try {
                const pending = sessionStorage.getItem("pendingFeedForm");
                if (pending) {
                    const data = JSON.parse(pending);
                    if (Number.isFinite(data.lat) && Number.isFinite(data.lng)) {
                        selectedLat = data.lat;
                        selectedLng = data.lng;
                        if (feedNote && data.note) feedNote.value = data.note;
                        setSelectedLocation(selectedLat, selectedLng);
                        sessionStorage.removeItem("pendingFeedForm");
                    }
                }
            } catch (e) {}
            if (!Number.isFinite(selectedLat) || !Number.isFinite(selectedLng)) {
                showAlert(feedErrorAlert, "Once haritada bir nokta sec.");
                return;
            }
            if (selectedLat === 0 && selectedLng === 0) {
                showAlert(feedErrorAlert, "Konum zorunlu");
                return;
            }
            showAlert(feedErrorAlert, "");
            showAlert(feedSuccessAlert, "");
            if (feedLatInput) feedLatInput.value = selectedLat.toFixed(6);
            if (feedLngInput) feedLngInput.value = selectedLng.toFixed(6);

            const formData = new FormData(feedForm);
            const action = feedForm.getAttribute("action") || "/api/feeds";
            fetch(action, {
                method: "POST",
                body: formData,
                credentials: "same-origin",
            })
                .then(async (res) => {
                    const contentType = res.headers.get("content-type") || "";
                    if (res.redirected || contentType.includes("text/html")) {
                        throw new Error("Giris yapmalisiniz.");
                    }
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        const msg = data.error || "Kaydetme basarisiz";
                        throw new Error(`${res.status} ${msg}`);
                    }
                    return data;
                })
                .then(() => {
                    showAlert(feedSuccessAlert, "Besleme kaydi eklendi.");
                    resetFeedForm();
                    return loadFeeds({ fitBounds: false });
                })
                .catch((err) => {
                    console.error(err);
                    showAlert(feedErrorAlert, err.message || "Kaydetme basarisiz");
                });
        });
    }

    map.on("click", (e) => {
        setSelectedLocation(e.latlng.lat, e.latlng.lng);
    });

    function setSelectedLocation(lat, lng) {
        selectedLat = lat;
        selectedLng = lng;
        updateSelectedText();
        if (!selectedMarker) {
            selectedMarker = L.marker([selectedLat, selectedLng]);
            selectedMarker.addTo(map);
        } else {
            selectedMarker.setLatLng([selectedLat, selectedLng]);
        }
        showAlert(feedErrorAlert, "");
        showAlert(feedSuccessAlert, "");
        setSubmitEnabled(true);
    }

    function updateActivePointCounter() {
        const el = document.getElementById("activePoints");
        if (!el) return;
        // Görünür marker adedi
        let visible = 0;
        feedMarkers.forEach((m) => {
            if (feedsLayer.hasLayer(m)) visible++;
        });
        el.innerText = String(visible);
    }
});
