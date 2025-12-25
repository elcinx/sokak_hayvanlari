document.addEventListener("DOMContentLoaded", () => {
    const target = document.querySelector("#explain");
    if (!target || typeof ClassicEditor === "undefined") return;
    ClassicEditor.create(target).catch(() => {});
});
