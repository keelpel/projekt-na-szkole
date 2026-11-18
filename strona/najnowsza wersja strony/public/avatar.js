// avatar.js – zmiana avatara na stronie profilu (wybór zdjęcia, kadrowanie, wysyłka)

(function () {
    const ROZMIAR_PODGLADU = 280;      // bok płótna w oknie (px)
    const ROZMIAR_WYNIKU = 512;        // bok wysyłanego obrazu (px)
    const MAKS_WYBRANY_PLIK = 15 * 1024 * 1024;
    const NAGLOWKI = { "X-Requested-With": "avatar-upload" };

    const awatarObraz = document.querySelector("#avatar-obraz");
    const awatarLitera = document.querySelector("#avatar-litera");
    const przyciskZmien = document.querySelector("#zmien-avatar");
    const przyciskUsun = document.querySelector("#usun-avatar");
    const poleWyboru = document.querySelector("#plik-avatara");

    const okno = document.querySelector("#okno-avatara");
    const plotno = document.querySelector("#kadr-avatara");
    const suwak = document.querySelector("#zoom-avatara");
    const komunikatBledu = document.querySelector("#blad-avatara");
    const przyciskZapisz = document.querySelector("#zapisz-avatar");
    const przyciskAnuluj = document.querySelector("#anuluj-avatar");

    if (!awatarObraz || !przyciskZmien || !okno || !plotno) {
        return;
    }

    let zdjecie = null;     // ImageBitmap albo <img>
    let zoom = 1;
    let przesuniecieX = 0;
    let przesuniecieY = 0;
    let przeciaga = false;
    let ostatniX = 0;
    let ostatniY = 0;
    let przesyla = false;

    /* ---------------- wyświetlanie avatara ---------------- */

    function wczytajAvatar() {
        const proba = new Image();

        proba.onload = () => {
            awatarObraz.src = proba.src;
            awatarObraz.hidden = false;
            awatarLitera.hidden = true;
            przyciskUsun.hidden = false;
        };

        proba.onerror = () => {
            awatarObraz.hidden = true;
            awatarObraz.removeAttribute("src");
            awatarLitera.hidden = false;
            przyciskUsun.hidden = true;
        };

        // parametr v omija pamięć podręczną po zmianie avatara
        proba.src = `/api/avatar/ja?v=${Date.now()}`;
    }

    /* ---------------- pomocnicze do kadrowania ---------------- */

    function wymiary() {
        return {
            w: zdjecie.naturalWidth || zdjecie.width,
            h: zdjecie.naturalHeight || zdjecie.height
        };
    }

    function ogranicz(liczba, min, max) {
        return Math.min(max, Math.max(min, liczba));
    }

    // położenie i rozmiar zdjęcia na płótnie podglądu
    function ustawienie() {
        const { w, h } = wymiary();
        const skala = (ROZMIAR_PODGLADU / Math.min(w, h)) * zoom;
        const rw = w * skala;
        const rh = h * skala;

        return {
            rw,
            rh,
            x: (ROZMIAR_PODGLADU - rw) / 2 + przesuniecieX,
            y: (ROZMIAR_PODGLADU - rh) / 2 + przesuniecieY
        };
    }

    // zdjęcie ma zawsze wypełniać cały kadr
    function pilnujKadru() {
        const u = ustawienie();
        const maxX = Math.max(0, (u.rw - ROZMIAR_PODGLADU) / 2);
        const maxY = Math.max(0, (u.rh - ROZMIAR_PODGLADU) / 2);

        przesuniecieX = ogranicz(przesuniecieX, -maxX, maxX);
        przesuniecieY = ogranicz(przesuniecieY, -maxY, maxY);
    }

    function rysuj() {
        if (!zdjecie) {
            return;
        }

        const ctx = plotno.getContext("2d");
        const S = ROZMIAR_PODGLADU;
        const u = ustawienie();

        ctx.clearRect(0, 0, S, S);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(zdjecie, u.x, u.y, u.rw, u.rh);

        // przyciemnienie poza okrągłym kadrem
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, S, S);
        ctx.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fill("evenodd");
        ctx.restore();

        ctx.beginPath();
        ctx.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.stroke();
    }

    function pokazBlad(tekst) {
        komunikatBledu.textContent = tekst;
        komunikatBledu.hidden = !tekst;
    }

    /* ---------------- otwieranie i zamykanie okna ---------------- */

    function otworzOkno() {
        zoom = 1;
        przesuniecieX = 0;
        przesuniecieY = 0;
        suwak.value = "1";
        pokazBlad("");
        przyciskZapisz.disabled = false;
        okno.hidden = false;
        rysuj();
    }

    function zamknijOkno() {
        okno.hidden = true;

        if (zdjecie && typeof zdjecie.close === "function") {
            zdjecie.close();
        }
        zdjecie = null;
    }

    async function wczytajObraz(plik) {
        // createImageBitmap uwzględnia obrót ze zdjęć z telefonu (EXIF)
        if (window.createImageBitmap) {
            try {
                return await createImageBitmap(plik, {
                    imageOrientation: "from-image"
                });
            } catch (blad) {
                // spróbujemy starszym sposobem
            }
        }

        return new Promise((resolve, reject) => {
            const adres = URL.createObjectURL(plik);
            const obraz = new Image();

            obraz.onload = () => {
                URL.revokeObjectURL(adres);
                resolve(obraz);
            };
            obraz.onerror = () => {
                URL.revokeObjectURL(adres);
                reject(new Error("Nie udało się odczytać obrazu"));
            };
            obraz.src = adres;
        });
    }

    /* ---------------- wybór pliku ---------------- */

    przyciskZmien.addEventListener("click", () => {
        poleWyboru.click();
    });

    poleWyboru.addEventListener("change", async () => {
        const plik = poleWyboru.files[0];
        poleWyboru.value = "";   // pozwala wybrać ten sam plik jeszcze raz

        if (!plik) {
            return;
        }

        if (!plik.type.startsWith("image/")) {
            alert("To nie jest obraz.");
            return;
        }

        if (plik.size > MAKS_WYBRANY_PLIK) {
            alert("Plik jest za duży (maksymalnie 15 MB).");
            return;
        }

        try {
            zdjecie = await wczytajObraz(plik);
        } catch (blad) {
            alert("Nie udało się odczytać tego obrazu.");
            return;
        }

        otworzOkno();
    });

    /* ---------------- przeciąganie i przybliżanie ---------------- */

    plotno.addEventListener("pointerdown", (zdarzenie) => {
        przeciaga = true;
        ostatniX = zdarzenie.clientX;
        ostatniY = zdarzenie.clientY;
        plotno.setPointerCapture(zdarzenie.pointerId);
    });

    plotno.addEventListener("pointermove", (zdarzenie) => {
        if (!przeciaga || !zdjecie) {
            return;
        }

        // płótno może być wyświetlane mniejsze niż jego rozmiar w pikselach
        const proporcja = ROZMIAR_PODGLADU / plotno.clientWidth;

        przesuniecieX += (zdarzenie.clientX - ostatniX) * proporcja;
        przesuniecieY += (zdarzenie.clientY - ostatniY) * proporcja;
        ostatniX = zdarzenie.clientX;
        ostatniY = zdarzenie.clientY;

        pilnujKadru();
        rysuj();
    });

    const koniecPrzeciagania = () => { przeciaga = false; };
    plotno.addEventListener("pointerup", koniecPrzeciagania);
    plotno.addEventListener("pointercancel", koniecPrzeciagania);

    suwak.addEventListener("input", () => {
        zoom = parseFloat(suwak.value);
        pilnujKadru();
        rysuj();
    });

    plotno.addEventListener("wheel", (zdarzenie) => {
        if (!zdjecie) {
            return;
        }

        zdarzenie.preventDefault();

        const nowy = ogranicz(
            parseFloat(suwak.value) - Math.sign(zdarzenie.deltaY) * 0.1,
            1,
            3
        );
        suwak.value = String(nowy);
        zoom = nowy;

        pilnujKadru();
        rysuj();
    }, { passive: false });

    /* ---------------- zapis ---------------- */

    // kadr z podglądu w większej rozdzielczości
    function przygotujObraz() {
        return new Promise((resolve) => {
            const wynik = document.createElement("canvas");
            wynik.width = ROZMIAR_WYNIKU;
            wynik.height = ROZMIAR_WYNIKU;

            const ctx = wynik.getContext("2d");
            const k = ROZMIAR_WYNIKU / ROZMIAR_PODGLADU;
            const u = ustawienie();

            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(zdjecie, u.x * k, u.y * k, u.rw * k, u.rh * k);

            // przeglądarki bez obsługi WebP zapiszą PNG
            wynik.toBlob(resolve, "image/webp", 0.9);
        });
    }

    async function zapisz() {
        if (przesyla || !zdjecie) {
            return;
        }

        przesyla = true;
        przyciskZapisz.disabled = true;
        przyciskZapisz.textContent = "Zapisywanie...";
        pokazBlad("");

        try {
            const blob = await przygotujObraz();

            if (!blob) {
                throw new Error("Nie udało się przygotować obrazu.");
            }

            const dane = new FormData();
            dane.append(
                "avatar",
                blob,
                blob.type === "image/webp" ? "avatar.webp" : "avatar.png"
            );

            const odpowiedz = await fetch("/api/avatar", {
                method: "POST",
                headers: NAGLOWKI,        // Content-Type ustawia przeglądarka
                credentials: "include",
                body: dane
            });

            let odp = {};
            try {
                odp = await odpowiedz.json();
            } catch (blad) {
                // odpowiedź bez JSON-a
            }

            if (!odpowiedz.ok) {
                throw new Error(odp.blad || "Nie udało się zapisać avatara.");
            }

            zamknijOkno();
            wczytajAvatar();
        } catch (blad) {
            pokazBlad(blad.message);
        } finally {
            przesyla = false;
            przyciskZapisz.disabled = false;
            przyciskZapisz.textContent = "Zapisz";
        }
    }

    przyciskZapisz.addEventListener("click", zapisz);
    przyciskAnuluj.addEventListener("click", zamknijOkno);

    okno.addEventListener("click", (zdarzenie) => {
        if (zdarzenie.target === okno && !przesyla) {
            zamknijOkno();
        }
    });

    document.addEventListener("keydown", (zdarzenie) => {
        if (zdarzenie.key === "Escape" && !okno.hidden && !przesyla) {
            zamknijOkno();
        }
    });

    /* ---------------- usuwanie ---------------- */

    przyciskUsun.addEventListener("click", async () => {
        if (!confirm("Na pewno usunąć avatar?")) {
            return;
        }

        try {
            const odpowiedz = await fetch("/api/avatar", {
                method: "DELETE",
                headers: NAGLOWKI,
                credentials: "include"
            });

            if (!odpowiedz.ok) {
                throw new Error("Błąd usuwania");
            }

            wczytajAvatar();
        } catch (blad) {
            alert("Nie udało się usunąć avatara.");
        }
    });

    wczytajAvatar();
})();
