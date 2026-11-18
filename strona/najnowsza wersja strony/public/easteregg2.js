// easteregg2.js – kręcące się logo, zmiana tytułu karty oraz "flip"

(function () {
    const bezRuchu =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // czy ktoś właśnie pisze tekst (wtedy nie podsłuchujemy klawiszy)
    function czyPoleTekstowe(el) {
        if (!(el instanceof HTMLElement)) {
            return false;
        }

        if (
            el instanceof HTMLTextAreaElement ||
            el instanceof HTMLSelectElement ||
            el.isContentEditable
        ) {
            return true;
        }

        if (el instanceof HTMLInputElement) {
            const bezTekstu = ["radio", "checkbox", "button", "submit", "reset"];
            return !bezTekstu.includes(el.type);
        }

        return false;
    }

    /* ---------------- 1. zmiana tytułu po przełączeniu karty ---------------- */

    const TYTUL_NIEOBECNY = "Wróć... 🥺";
    const TYTUL_POWROT = "Wróciłeś! 💖";
    let tytulOryginalny = null;
    let zegarPowrotu = null;

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            clearTimeout(zegarPowrotu);

            if (tytulOryginalny === null) {
                tytulOryginalny = document.title;
            }
            document.title = TYTUL_NIEOBECNY;
        } else if (tytulOryginalny !== null) {
            document.title = TYTUL_POWROT;

            clearTimeout(zegarPowrotu);
            zegarPowrotu = setTimeout(() => {
                document.title = tytulOryginalny;
                tytulOryginalny = null;
            }, 2000);
        }
    });

    /* ---------------- 2. "flip" – strona do góry nogami ---------------- */

    const CZAS_FLIP = 5000;   // po tylu ms strona sama wraca
    let buforFlip = "";
    let odwrocona = false;
    let zegarFlip = null;

    function ustawOdwrocenie(czyOdwrocic) {
        const html = document.documentElement;
        odwrocona = czyOdwrocic;

        html.style.transition =
            bezRuchu ? "none" : "transform 0.9s ease-in-out";
        html.style.transform = czyOdwrocic ? "rotate(180deg)" : "";
    }

    function flip() {
        clearTimeout(zegarFlip);

        // wpisanie "flip" jeszcze raz przywraca stronę od razu
        if (odwrocona) {
            ustawOdwrocenie(false);
            return;
        }

        ustawOdwrocenie(true);
        zegarFlip = setTimeout(() => ustawOdwrocenie(false), CZAS_FLIP);
    }

    document.addEventListener("keydown", (zdarzenie) => {
        if (
            zdarzenie.repeat ||
            zdarzenie.ctrlKey ||
            zdarzenie.metaKey ||
            zdarzenie.altKey
        ) {
            return;
        }

        if (czyPoleTekstowe(zdarzenie.target)) {
            return;
        }

        if (zdarzenie.key.length !== 1) {
            return;
        }

        buforFlip = (buforFlip + zdarzenie.key.toLowerCase()).slice(-4);

        if (buforFlip === "flip") {
            buforFlip = "";
            flip();
        }
    });

    /* ---------------- 3. kręcące się logo ---------------- */

    function pokazBabelek(logo, tekst) {
        const prostokat = logo.getBoundingClientRect();

        const babelek = document.createElement("div");
        babelek.textContent = tekst;
        babelek.style.cssText = `
            position: absolute;
            left: ${prostokat.left + window.scrollX + prostokat.width / 2}px;
            top: ${prostokat.bottom + window.scrollY + 8}px;
            transform: translateX(-50%);
            padding: 8px 14px;
            font-size: 15px;
            font-weight: 600;
            white-space: nowrap;
            color: var(--tekst, #172033);
            background: var(--karta, #fff);
            border: 2px solid var(--obramowanie, #e1e8f0);
            border-radius: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
            pointer-events: none;
            z-index: 1200;
        `;
        document.body.appendChild(babelek);

        const animacja = babelek.animate(
            [
                { opacity: 0 },
                { opacity: 1, offset: 0.1 },
                { opacity: 1, offset: 0.8 },
                { opacity: 0 }
            ],
            { duration: 2600 }
        );
        animacja.onfinish = () => babelek.remove();
    }

    function zakrec(logo, gdyKoniec) {
        if (bezRuchu) {
            gdyKoniec();
            return;
        }

        const animacja = logo.animate(
            [
                { transform: "rotate(0deg)" },
                { transform: "rotate(2880deg)" }
            ],
            { duration: 3200, easing: "ease-in-out" }
        );
        animacja.onfinish = gdyKoniec;
    }

    function ustawLogo() {
        const logo = document.querySelector("header img");
        if (!logo) {
            return;
        }

        const POTRZEBNE_KLIKNIECIA = 10;
        let klikniecia = 0;
        let zegar = null;
        let krecisie = false;

        logo.addEventListener("click", () => {
            if (krecisie) {
                return;
            }

            klikniecia++;
            clearTimeout(zegar);
            zegar = setTimeout(() => { klikniecia = 0; }, 2000);

            // mała reakcja na każde kliknięcie
            if (!bezRuchu) {
                logo.animate(
                    [
                        { transform: "scale(1)" },
                        { transform: "scale(1.12)" },
                        { transform: "scale(1)" }
                    ],
                    { duration: 150 }
                );
            }

            if (klikniecia >= POTRZEBNE_KLIKNIECIA) {
                klikniecia = 0;
                clearTimeout(zegar);
                krecisie = true;

                zakrec(logo, () => {
                    krecisie = false;
                    pokazBabelek(logo, "aua, przestań ;-;");
                });
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ustawLogo);
    } else {
        ustawLogo();
    }
})();
