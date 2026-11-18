// easteregg.js – wpisz "bad apple" na stronie głównej, a włączy się wideo

(function () {
    const HASLO = "badapple";   // spacje są ignorowane, więc "bad apple" też działa
    const PLIK_WIDEO = "badapple.mp4";
    const DEBUG = false;  // zmień na true, żeby widzieć bufor w konsoli

    console.log("[easteregg] skrypt załadowany – wpisz: " + HASLO);

    const OBRAZ_FUMO = "fumo.png";
    const BUZKA = "ᗜˬᗜ";

    let bufor = "";
    let nakladka = null;
    let stronaZamieniona = false;

    // wczytaj obrazek wcześniej, żeby pojawił się od razu
    new Image().src = OBRAZ_FUMO;

    document.addEventListener("keydown", (zdarzenie) => {
        // Esc zamyka wideo
        if (zdarzenie.key === "Escape" && nakladka) {
            zamknijWideo();
            return;
        }

        // nie reaguj, gdy ktoś pisze w polu formularza
        const cel = zdarzenie.target;
        if (
            cel instanceof HTMLInputElement ||
            cel instanceof HTMLTextAreaElement ||
            cel instanceof HTMLSelectElement
        ) {
            return;
        }

        // tylko pojedyncze znaki (litery, spacja)
        if (zdarzenie.key.length !== 1) {
            return;
        }

        // spacje ignorujemy, więc "bad apple" i "badapple" działają tak samo
        if (zdarzenie.key === " ") {
            return;
        }

        bufor = (bufor + zdarzenie.key.toLowerCase()).slice(-HASLO.length);

        if (DEBUG) {
            console.log("[easteregg] bufor:", JSON.stringify(bufor));
        }

        if (bufor === HASLO && !nakladka) {
            bufor = "";
            uruchomWideo();
        }
    });

    // zamienia logo na fumo i boczny panel na buźkę (do odświeżenia strony)
    function zamienStrone() {
        if (stronaZamieniona) {
            return;
        }
        stronaZamieniona = true;

        const logo = document.querySelector("header img");
        if (logo) {
            logo.src = OBRAZ_FUMO;
            logo.alt = "Fumo";
            logo.style.objectFit = "contain";
        }

        const panel = document.querySelector(".content > nav");
        if (panel) {
            panel.textContent = BUZKA;
            panel.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                font-size: clamp(1.4rem, 3vw, 2.8rem);
                overflow: hidden;
            `;
        }
    }

    function uruchomWideo() {
        zamienStrone();

        nakladka = document.createElement("div");
        nakladka.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const wideo = document.createElement("video");
        wideo.src = PLIK_WIDEO;
        wideo.autoplay = true;
        wideo.playsInline = true;
        wideo.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
        `;

        const podpowiedz = document.createElement("div");
        podpowiedz.textContent = "Esc lub kliknięcie – zamknij";
        podpowiedz.style.cssText = `
            position: absolute;
            bottom: 12px;
            left: 50%;
            transform: translateX(-50%);
            color: #888;
            font: 14px sans-serif;
            pointer-events: none;
            opacity: 1;
            transition: opacity 1s ease;
        `;
        setTimeout(() => { podpowiedz.style.opacity = "0"; }, 3000);

        nakladka.appendChild(wideo);
        nakladka.appendChild(podpowiedz);
        document.body.appendChild(nakladka);

        // kliknięcie albo koniec filmu zamyka nakładkę
        nakladka.addEventListener("click", zamknijWideo);
        wideo.addEventListener("ended", zamknijWideo);

        // jeśli wideo się nie wczyta, pokaż na ekranie dlaczego
        wideo.addEventListener("error", async () => {
            console.error("Błąd wideo:", PLIK_WIDEO, wideo.error);

            let powod =
                "Przeglądarka nie potrafi odtworzyć tego pliku " +
                "(prawdopodobnie nieobsługiwany kodek). " +
                "Przekonwertuj go do MP4 (H.264 + AAC).";

            try {
                const odpowiedz = await fetch(PLIK_WIDEO, {
                    method: "HEAD",
                    cache: "no-store"
                });
                const typ = odpowiedz.headers.get("content-type") || "";

                if (!odpowiedz.ok) {
                    powod =
                        `Serwer zwrócił błąd ${odpowiedz.status} dla ` +
                        `"${PLIK_WIDEO}". Plik nie jest udostępniany ` +
                        "przez serwer albo leży w złym folderze.";
                } else if (!typ.startsWith("video/")) {
                    powod =
                        `Serwer odpowiada typem "${typ}" zamiast wideo. ` +
                        "Pewnie zwraca stronę zamiast pliku – sprawdź " +
                        "ścieżkę i udostępnianie plików statycznych.";
                }
            } catch (blad) {
                powod = "Nie udało się połączyć z serwerem.";
            }

            pokazBlad(powod);
        });

        // wpisywanie liter to gest użytkownika, więc dźwięk też może ruszyć
        wideo.play().catch((blad) => {
            console.warn("Autoodtwarzanie zablokowane:", blad);
        });

        // próba pełnego ekranu (przeglądarka może odmówić)
        if (nakladka.requestFullscreen) {
            nakladka.requestFullscreen().catch(() => {});
        }
    }

    // ręczny test z konsoli: wpisz badApple()
    window.badApple = uruchomWideo;

    function pokazBlad(tekst) {
        if (!nakladka) {
            return;
        }

        const komunikat = document.createElement("div");
        komunikat.textContent = "Easter egg nie działa: " + tekst;
        komunikat.style.cssText = `
            position: absolute;
            max-width: 600px;
            padding: 20px;
            color: #fff;
            text-align: center;
            font: 18px/1.5 sans-serif;
        `;
        nakladka.appendChild(komunikat);
    }

    function zamknijWideo() {
        if (!nakladka) {
            return;
        }

        const wideo = nakladka.querySelector("video");
        if (wideo) {
            wideo.pause();
        }

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }

        nakladka.remove();
        nakladka = null;
    }

    // wyjście z pełnego ekranu (Esc) też zamyka wideo
    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement && nakladka) {
            zamknijWideo();
        }
    });
})();
