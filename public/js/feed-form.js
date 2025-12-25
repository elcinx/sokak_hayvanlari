document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector('form[action="/api/feeds"]');
    if (!form) return;

    const latInput = form.querySelector('input[name="lat"]');
    const lngInput = form.querySelector('input[name="lng"]');
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (!latInput || !lngInput || !submitBtn) return;

    const warningEl = document.createElement("div");
    warningEl.className = "text-danger small mt-2";
    warningEl.textContent = "Konum zorunlu";
    warningEl.style.display = "none";
    submitBtn.insertAdjacentElement("afterend", warningEl);

    const hasValidLocation = () => {
        const lat = Number(latInput.value);
        const lng = Number(lngInput.value);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        if (lat === 0 && lng === 0) return false;
        return true;
    };

    const updateState = () => {
        const valid = hasValidLocation();
        submitBtn.disabled = !valid;
        warningEl.style.display = valid ? "none" : "block";
    };

    ["change", "input", "blur"].forEach((evt) => {
        latInput.addEventListener(evt, updateState);
        lngInput.addEventListener(evt, updateState);
    });

    form.addEventListener("submit", (event) => {
        if (hasValidLocation()) return;
        event.preventDefault();
        warningEl.style.display = "block";
    });

    updateState();
});
