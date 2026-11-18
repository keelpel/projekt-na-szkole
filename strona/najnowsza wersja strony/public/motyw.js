(function () {
    const KLUCZ = "motyw";
    const KLUCZ_POPRZEDNI = "motyw-poprzedni";
    const KLUCZ_CISZA = "muzyka-wyciszona";
    const KLUCZ_POZYCJA = "muzyka-pozycja";
    const HASLO = "femboy";
    const PLIK_MUZYKI = "yuumy.mp3";
    const GLOSNOSC = 0.5;
    const SLODKIE = ["💖", "🌸", "✨", "🎀", "💕", "🐾", "🍓", "🦋"];
    const PREFIKS_TYTULU = "💖 ";

    const html = document.documentElement;
    const bezRuchu =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function odczyt(klucz) {
        try { return localStorage.getItem(klucz); } catch { return null; }
    }

    function zapis(klucz, wartosc) {
        try { localStorage.setItem(klucz, wartosc); } catch {}
    }

    function usun(klucz) {
        try { localStorage.removeItem(klucz); } catch {}
    }

    // motyw ustawiamy od razu (skrypt jest w <head>), żeby strona nie mrugała
    const systemCiemny =
        window.matchMedia("(prefers-color-scheme: dark)").matches;

    html.dataset.theme =
        odczyt(KLUCZ) || (systemCiemny ? "dark" : "light");

    let przycisk = null;
    let przyciskMuzyki = null;

    /* ---------------- muzyka ---------------- */

    let audio = null;
    let czekaNaInterakcje = false;

    function wyciszona() {
        return odczyt(KLUCZ_CISZA) === "1";
    }

    function pobierzAudio() {
        if (audio) {
            return audio;
        }

        audio = new Audio(PLIK_MUZYKI);
        audio.loop = true;
        audio.volume = GLOSNOSC;

        // wznów od miejsca, w którym muzyka była na poprzedniej stronie
        const pozycja = parseFloat(odczyt(KLUCZ_POZYCJA));
        if (pozycja > 0) {
            audio.addEventListener("loadedmetadata", () => {
                if (pozycja < audio.duration) {
                    audio.currentTime = pozycja;
                }
            }, { once: true });
        }

        audio.addEventListener("play", odswiezPrzyciskMuzyki);
        audio.addEventListener("pause", odswiezPrzyciskMuzyki);
        return audio;
    }

    function graj() {
        if (wyciszona()) {
            return;
        }

        pobierzAudio().play().catch((blad) => {
            if (blad && blad.name === "NotAllowedError") {
                // przeglądarka wymaga kliknięcia – ruszymy przy pierwszej interakcji
                czekajNaInterakcje();
            } else {
                console.error("Nie udało się odtworzyć muzyki:", PLIK_MUZYKI, blad);
            }
        });
    }

    function czekajNaInterakcje() {
        if (czekaNaInterakcje) {
            return;
        }
        czekaNaInterakcje = true;

        const start = (zdarzenie) => {
            // kliknięcie samego przycisku muzyki obsługuje on sam
            if (
                zdarzenie.target instanceof Element &&
                zdarzenie.target.closest(".przycisk-muzyki")
            ) {
                return;
            }

            czekaNaInterakcje = false;
            document.removeEventListener("pointerdown", start);
            document.removeEventListener("keydown", start);

            if (html.dataset.theme === "femboy") {
                graj();
            }
        };

        document.addEventListener("pointerdown", start);
        document.addEventListener("keydown", start);
    }

    function zatrzymajMuzyke() {
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        usun(KLUCZ_POZYCJA);
    }

    // zapamiętaj pozycję przy zmianie strony
    window.addEventListener("pagehide", () => {
        if (audio && !audio.paused) {
            zapis(KLUCZ_POZYCJA, String(audio.currentTime));
        }
    });

    function odswiezPrzyciskMuzyki() {
        if (!przyciskMuzyki) {
            return;
        }

        const gra = audio && !audio.paused;
        przyciskMuzyki.textContent = gra ? "🔊" : "🔇";
        przyciskMuzyki.setAttribute(
            "aria-label",
            gra ? "Wycisz muzykę" : "Włącz muzykę"
        );
    }

    function przelaczMuzyke() {
        if (audio && !audio.paused) {
            zapis(KLUCZ_CISZA, "1");
            audio.pause();
        } else {
            zapis(KLUCZ_CISZA, "0");
            graj();
        }
        odswiezPrzyciskMuzyki();
    }

    /* ---------------- słodkie ozdobniki ---------------- */

    let interwalSlodyczy = null;

    function losowy(lista) {
        return lista[Math.floor(Math.random() * lista.length)];
    }

    function wypuscSlodycz() {
        if (document.hidden || !document.body) {
            return;
        }

        const el = document.createElement("span");
        el.className = "slodki-unosi";
        el.textContent = losowy(SLODKIE);
        el.style.left = (Math.random() * 95) + "vw";
        el.style.fontSize = (16 + Math.random() * 22) + "px";
        el.style.animationDuration = (7 + Math.random() * 6) + "s";
        el.addEventListener("animationend", () => el.remove());
        document.body.appendChild(el);
    }

    function startSlodyczy() {
        if (bezRuchu || interwalSlodyczy) {
            return;
        }
        interwalSlodyczy = setInterval(wypuscSlodycz, 1200);
    }

    function stopSlodyczy() {
        clearInterval(interwalSlodyczy);
        interwalSlodyczy = null;
        document
            .querySelectorAll(".slodki-unosi, .slodki-klik")
            .forEach((el) => el.remove());
    }

    // iskierki w miejscu kliknięcia
    document.addEventListener("click", (zdarzenie) => {
        if (bezRuchu || html.dataset.theme !== "femboy" || !document.body) {
            return;
        }

        const el = document.createElement("span");
        el.className = "slodki-klik";
        el.textContent = losowy(SLODKIE);
        el.style.left = zdarzenie.clientX + "px";
        el.style.top = zdarzenie.clientY + "px";
        el.addEventListener("animationend", () => el.remove());
        document.body.appendChild(el);
    });

    function ustawTytul(femboy) {
        if (femboy && !document.title.startsWith(PREFIKS_TYTULU)) {
            document.title = PREFIKS_TYTULU + document.title;
        } else if (!femboy && document.title.startsWith(PREFIKS_TYTULU)) {
            document.title = document.title.slice(PREFIKS_TYTULU.length);
        }
    }

    /* ---------------- motywy ---------------- */

    function zastosujEfekty() {
        const femboy = html.dataset.theme === "femboy";

        if (przyciskMuzyki) {
            przyciskMuzyki.hidden = !femboy;
        }

        ustawTytul(femboy);

        if (femboy) {
            startSlodyczy();
            graj();
        } else {
            stopSlodyczy();
            zatrzymajMuzyke();
        }

        odswiezPrzyciskMuzyki();
    }

    function odswiezPrzycisk() {
        if (!przycisk) {
            return;
        }

        const motyw = html.dataset.theme;

        if (motyw === "femboy") {
            przycisk.textContent = "💖";
            przycisk.setAttribute("aria-label", "Wyłącz motyw femboy");
        } else if (motyw === "dark") {
            przycisk.textContent = "☀️";
            przycisk.setAttribute("aria-label", "Włącz jasny motyw");
        } else {
            przycisk.textContent = "🌙";
            przycisk.setAttribute("aria-label", "Włącz ciemny motyw");
        }
    }

    function ustawMotyw(nowy) {
        html.dataset.theme = nowy;
        zapis(KLUCZ, nowy);
        odswiezPrzycisk();
        zastosujEfekty();
    }

    function wylaczFemboy() {
        const poprzedni = odczyt(KLUCZ_POPRZEDNI);
        ustawMotyw(poprzedni === "dark" ? "dark" : "light");
    }

    // przycisk w rogu: jasny <-> ciemny (a w trybie femboy wyłącza go)
    function przelaczPrzyciskiem() {
        const aktualny = html.dataset.theme;

        if (aktualny === "femboy") {
            wylaczFemboy();
        } else {
            ustawMotyw(aktualny === "dark" ? "light" : "dark");
        }
    }

    // wpisanie "femboy" włącza (albo wyłącza) motyw femboy
    function przelaczFemboy() {
        const aktualny = html.dataset.theme;

        if (aktualny === "femboy") {
            wylaczFemboy();
        } else {
            zapis(KLUCZ_POPRZEDNI, aktualny);
            usun(KLUCZ_POZYCJA);   // muzyka za każdym razem od początku
            ustawMotyw("femboy");
        }
    }

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
            // radio i checkbox nie służą do pisania (np. odpowiedzi w quizie)
            const bezTekstu = ["radio", "checkbox", "button", "submit", "reset"];
            return !bezTekstu.includes(el.type);
        }

        return false;
    }

    let bufor = "";

    document.addEventListener("keydown", (zdarzenie) => {
        if (zdarzenie.ctrlKey || zdarzenie.metaKey || zdarzenie.altKey) {
            return;
        }

        if (czyPoleTekstowe(zdarzenie.target)) {
            return;
        }

        if (zdarzenie.key.length !== 1) {
            return;
        }

        bufor = (bufor + zdarzenie.key.toLowerCase()).slice(-HASLO.length);

        if (bufor === HASLO) {
            bufor = "";
            przelaczFemboy();
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        przycisk = document.createElement("button");
        przycisk.type = "button";
        przycisk.className = "przycisk-motywu";
        przycisk.addEventListener("click", przelaczPrzyciskiem);

        przyciskMuzyki = document.createElement("button");
        przyciskMuzyki.type = "button";
        przyciskMuzyki.className = "przycisk-motywu przycisk-muzyki";
        przyciskMuzyki.hidden = true;
        przyciskMuzyki.addEventListener("click", przelaczMuzyke);

        document.body.appendChild(przycisk);
        document.body.appendChild(przyciskMuzyki);

        odswiezPrzycisk();
        zastosujEfekty();
    });
})();
