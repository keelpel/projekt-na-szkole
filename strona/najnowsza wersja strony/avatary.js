// avatary.js – obsługa własnych avatarów użytkowników (Express + multer + sharp)
//
// Każdy użytkownik ma jeden plik: avatary/<id>.webp (256x256).
// Nazwa pliku pochodzi WYŁĄCZNIE z id z sesji, nigdy z danych od klienta.
//
// Endpointy (po podpięciu pod /api/avatar):
//   GET    /api/avatar/ja     – avatar zalogowanego użytkownika (404, gdy brak)
//   GET    /api/avatar/<id>   – avatar użytkownika o danym id (404, gdy brak)
//   POST   /api/avatar        – wysłanie nowego avatara (pole "avatar")
//   DELETE /api/avatar        – usunięcie avatara

const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const MAKS_ROZMIAR_PLIKU = 2 * 1024 * 1024;     // 2 MB
const MAKS_PIKSELI = 40 * 1000 * 1000;          // 40 megapikseli
const MIN_BOK = 32;                             // px
const ROZMIAR_AVATARA = 256;                    // px
const DOZWOLONE_FORMATY = ["jpeg", "png", "webp", "gif"];
const MIN_PRZERWA_MS = 5000;                    // przerwa między wysłaniami
const NAGLOWEK_ZABEZPIECZAJACY = "avatar-upload";
const KATALOG_DOMYSLNY = path.join(__dirname, "avatary");

// Czy użytkownik o danym id ma wgrany avatar (do list, np. rankingu).
// Jeśli w utworzRouterAvatarow podajesz własny katalog, podaj go tutaj też.
function czyMaAvatar(id, katalog = KATALOG_DOMYSLNY) {
    const numer = Number(id);

    if (!Number.isSafeInteger(numer) || numer <= 0) {
        return false;
    }

    return fs.existsSync(path.join(katalog, `${numer}.webp`));
}

function utworzRouterAvatarow({
    pobierzIdUzytkownika,
    katalog = KATALOG_DOMYSLNY
}) {
    if (typeof pobierzIdUzytkownika !== "function") {
        throw new Error("Podaj funkcję pobierzIdUzytkownika(req)");
    }

    const router = express.Router();
    fs.mkdirSync(katalog, { recursive: true });

    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: MAKS_ROZMIAR_PLIKU, files: 1, fields: 0 }
    });

    const ostatnieWyslanie = new Map();

    function dodatnieId(wartosc) {
        const n = Number(wartosc);
        return Number.isSafeInteger(n) && n > 0 ? n : null;
    }

    function sciezkaAvatara(id) {
        return path.join(katalog, `${id}.webp`);
    }

    // zalogowany użytkownik
    function wymagajLogowania(req, res, next) {
        const id = dodatnieId(pobierzIdUzytkownika(req));

        if (!id) {
            return res.status(401).json({ blad: "Musisz być zalogowany." });
        }

        req.idUzytkownika = id;
        next();
    }

    // ochrona przed wysyłaniem z innych stron (CSRF): zwykły formularz
    // z obcej strony nie potrafi dodać własnego nagłówka
    function wymagajNaglowka(req, res, next) {
        if (req.get("X-Requested-With") !== NAGLOWEK_ZABEZPIECZAJACY) {
            return res.status(403).json({ blad: "Niedozwolone żądanie." });
        }
        next();
    }

    function ograniczCzestosc(req, res, next) {
        const teraz = Date.now();
        const ostatnio = ostatnieWyslanie.get(req.idUzytkownika) || 0;

        if (teraz - ostatnio < MIN_PRZERWA_MS) {
            return res.status(429).json({
                blad: "Poczekaj chwilę przed kolejną zmianą avatara."
            });
        }

        ostatnieWyslanie.set(req.idUzytkownika, teraz);
        next();
    }

    // ---------- pobieranie ----------

    router.get("/:id", (req, res) => {
        let id = null;

        if (req.params.id === "ja") {
            id = dodatnieId(pobierzIdUzytkownika(req));
        } else if (/^\d{1,9}$/.test(req.params.id)) {
            id = dodatnieId(req.params.id);
        }

        if (!id) {
            return res.status(404).end();
        }

        res.set({
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "no-cache"
        });

        res.sendFile(sciezkaAvatara(id), (blad) => {
            if (blad && !res.headersSent) {
                res.status(404).end();
            }
        });
    });

    // ---------- wysyłanie ----------

    router.post(
        "/",
        wymagajNaglowka,
        wymagajLogowania,
        ograniczCzestosc,
        (req, res) => {
            upload.single("avatar")(req, res, async (blad) => {
                if (blad) {
                    if (blad.code === "LIMIT_FILE_SIZE") {
                        return res.status(413).json({
                            blad: "Plik jest za duży (maksymalnie 2 MB)."
                        });
                    }
                    return res.status(400).json({
                        blad: "Nie udało się odebrać pliku."
                    });
                }

                if (!req.file) {
                    return res.status(400).json({ blad: "Nie wybrano pliku." });
                }

                try {
                    // sprawdzamy prawdziwy format obrazu, a nie to, co twierdzi klient
                    const obraz = sharp(req.file.buffer, {
                        limitInputPixels: MAKS_PIKSELI
                    });
                    const meta = await obraz.metadata();

                    if (!DOZWOLONE_FORMATY.includes(meta.format)) {
                        return res.status(400).json({
                            blad: "Dozwolone formaty: JPG, PNG, WebP i GIF."
                        });
                    }

                    if (
                        !meta.width ||
                        !meta.height ||
                        meta.width * meta.height > MAKS_PIKSELI
                    ) {
                        return res.status(400).json({
                            blad: "Obraz ma nieprawidłowe wymiary."
                        });
                    }

                    if (meta.width < MIN_BOK || meta.height < MIN_BOK) {
                        return res.status(400).json({
                            blad: "Obraz jest za mały (minimum 32×32 px)."
                        });
                    }

                    // przeskalowanie, przycięcie do kwadratu, usunięcie metadanych
                    const wynik = await obraz
                        .rotate()
                        .resize(ROZMIAR_AVATARA, ROZMIAR_AVATARA, {
                            fit: "cover",
                            position: "centre"
                        })
                        .webp({ quality: 85 })
                        .toBuffer();

                    const docelowa = sciezkaAvatara(req.idUzytkownika);
                    const tymczasowa =
                        `${docelowa}.${process.pid}.${Date.now()}.tmp`;

                    await fs.promises.writeFile(tymczasowa, wynik);
                    await fs.promises.rename(tymczasowa, docelowa);

                    res.json({ ok: true });
                } catch (error) {
                    console.error("Błąd przetwarzania avatara:", error.message);
                    res.status(400).json({
                        blad: "Nie udało się przetworzyć tego obrazu."
                    });
                }
            });
        }
    );

    // ---------- usuwanie ----------

    router.delete("/", wymagajNaglowka, wymagajLogowania, async (req, res) => {
        try {
            await fs.promises.unlink(sciezkaAvatara(req.idUzytkownika));
        } catch (error) {
            if (error.code !== "ENOENT") {
                console.error("Błąd usuwania avatara:", error.message);
                return res.status(500).json({
                    blad: "Nie udało się usunąć avatara."
                });
            }
        }

        res.json({ ok: true });
    });

    return router;
}

module.exports = { utworzRouterAvatarow, czyMaAvatar };
