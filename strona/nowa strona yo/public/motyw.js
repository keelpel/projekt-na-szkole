(function () {
    const klucz = "motyw";
    let zapisany = null;

    try { zapisany = localStorage.getItem(klucz); } catch {}

    const systemCiemny =
        window.matchMedia("(prefers-color-scheme: dark)").matches;

    document.documentElement.dataset.theme =
        zapisany || (systemCiemny ? "dark" : "light");

    document.addEventListener("DOMContentLoaded", () => {
        const przycisk = document.createElement("button");
        przycisk.type = "button";
        przycisk.className = "przycisk-motywu";

        const odswiez = () => {
            const ciemny =
                document.documentElement.dataset.theme === "dark";
            przycisk.textContent = ciemny ? "☀️" : "🌙";
            przycisk.setAttribute(
                "aria-label",
                ciemny ? "Włącz jasny motyw" : "Włącz ciemny motyw"
            );
        };

        przycisk.addEventListener("click", () => {
            const nowy =
                document.documentElement.dataset.theme === "dark"
                    ? "light" : "dark";

            document.documentElement.dataset.theme = nowy;
            try { localStorage.setItem(klucz, nowy); } catch {}
            odswiez();
        });

        odswiez();
        document.body.appendChild(przycisk);
    });
})();