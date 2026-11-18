const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const { utworzRouterAvatarow, czyMaAvatar } = require("./avatary");

const app = express();
const PORT = 3000;

// Baza SQLite
const sciezkaBazy = path.join(__dirname, "projekt");
const db = new Database(sciezkaBazy);

// SQLite będzie czekać do 5 sekund na zwolnienie blokady
db.pragma("busy_timeout = 5000");

console.log("Używana baza:", sciezkaBazy);


// Tabela użytkowników
db.exec(`
    CREATE TABLE IF NOT EXISTS uzytkownicy (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nazwa TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        haslo TEXT NOT NULL,
        data_utworzenia TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);
db.exec(`
    CREATE TABLE IF NOT EXISTS wyniki (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_uzytkownika INTEGER NOT NULL,
        kategoria TEXT NOT NULL,
        punkty INTEGER NOT NULL,
        liczba_pytan INTEGER NOT NULL,
        data_wyniku TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_uzytkownika)
            REFERENCES uzytkownicy(id)
            ON DELETE CASCADE
    )
`);

// Migracja: data ostatniej zmiany nazwy użytkownika (NULL = jeszcze nie zmieniano)
const kolumnyUzytkownikow = db.prepare("PRAGMA table_info(uzytkownicy)").all();

if (!kolumnyUzytkownikow.some(kolumna => kolumna.name === "nazwa_zmieniona")) {
    db.exec("ALTER TABLE uzytkownicy ADD COLUMN nazwa_zmieniona TEXT");
    console.log("Dodano kolumnę uzytkownicy.nazwa_zmieniona");
}


// Zasady dotyczące nazwy użytkownika
const OKRES_ZMIANY_NAZWY_DNI = 7;
const MIN_DLUGOSC_NAZWY = 3;
const MAKS_DLUGOSC_NAZWY = 20;
const DOZWOLONE_ZNAKI_NAZWY = /^[\p{L}\p{N}_. -]+$/u;

// Zwraca komunikat błędu albo null, gdy nazwa jest poprawna
function sprawdzNazwe(nazwa) {
    const dlugosc = [...nazwa].length;

    if (
        dlugosc < MIN_DLUGOSC_NAZWY ||
        dlugosc > MAKS_DLUGOSC_NAZWY ||
        !DOZWOLONE_ZNAKI_NAZWY.test(nazwa)
    ) {
        return (
            `Nazwa użytkownika musi mieć ${MIN_DLUGOSC_NAZWY}-${MAKS_DLUGOSC_NAZWY} znaków ` +
            "(litery, cyfry, spacje oraz znaki _ . -)"
        );
    }

    return null;
}

// Ile sekund zostało do możliwości kolejnej zmiany nazwy (0 = można teraz)
function sekundyDoZmianyNazwy(nazwaZmieniona) {
    if (!nazwaZmieniona) {
        return 0;
    }

    // SQLite zapisuje czas w UTC jako "RRRR-MM-DD GG:MM:SS"
    const ostatnia = Date.parse(
        String(nazwaZmieniona).replace(" ", "T") + "Z"
    );

    if (Number.isNaN(ostatnia)) {
        return 0;
    }

    const koniec = ostatnia + OKRES_ZMIANY_NAZWY_DNI * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((koniec - Date.now()) / 1000));
}

function opiszCzas(sekundy) {
    const minuty = Math.ceil(sekundy / 60);
    const dni = Math.floor(minuty / 1440);
    const godziny = Math.floor((minuty % 1440) / 60);
    const reszta = minuty % 60;

    if (dni > 0) {
        return `${dni} d ${godziny} godz.`;
    }

    if (godziny > 0) {
        return `${godziny} godz. ${reszta} min`;
    }

    return `${Math.max(1, reszta)} min`;
}


// Middleware
app.use(cors());
app.use(express.json());

app.use(session({
    secret: "zmien-ten-sekret-na-dlugi-losowy-tekst",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// Udostępnianie plików z folderu public
app.use(express.static(path.join(__dirname, "public")));

// Avatary użytkowników: GET/POST/DELETE /api/avatar
app.use("/api/avatar", utworzRouterAvatarow({
    pobierzIdUzytkownika: req => req.session?.uzytkownik?.id
}));

// Test serwera
app.get("/", (req, res) => {
    res.send("API działa");
});

// Aktualna lista kategorii dla strony głównej i innych podstron
const kategorie = [
    { nazwa: "muzyka", tabela: "muzyka" },
    { nazwa: "informatyka", tabela: "informatyka" },
    { nazwa: "historia", tabela: "historia" },
    { nazwa: "biologia", tabela: "biologia" },
    { nazwa: "warhammer", tabela: "warhammer" },
    { nazwa: "internet", tabela: "internet" }
];

app.get("/api/kategorie", (req, res) => {
    res.json(kategorie.map(element => element.nazwa));
});

// Quiz z wybranej kategorii
app.get("/api/quiz", (req, res) => {
    try {
        const kategoria = String(
            req.query.kategoria || "muzyka"
        )
            .trim()
            .toLowerCase();

        console.log(
            "Otrzymana kategoria:",
            JSON.stringify(kategoria)
        );

        const wybranaKategoria = kategorie.find(
            element => element.nazwa === kategoria
        );

        const nazwaTabeli = wybranaKategoria?.tabela;

        if (!nazwaTabeli) {
            return res.status(400).json({
                blad: `Nieznana kategoria: ${kategoria}`,
                dostepneKategorie: kategorie.map(element => element.nazwa)
            });
        }

        const tabelaIstnieje = db.prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name = ?
        `).get(nazwaTabeli);

        if (!tabelaIstnieje) {
            return res.status(404).json({
                blad: `Tabela "${nazwaTabeli}" nie istnieje jeszcze w bazie`
            });
        }

        const rows = db.prepare(`
            WITH losowe_pytania AS (
                SELECT id, pytanie
                FROM ${nazwaTabeli}
                ORDER BY RANDOM()
                LIMIT 15
            )
            SELECT
                losowe_pytania.id AS pytanie_id,
                losowe_pytania.pytanie AS tresc_pytania,
                odpowiedzi.id AS odpowiedz_id,
                odpowiedzi.odpowiedz AS tresc_odpowiedzi,
                odpowiedzi.is_correct AS poprawna
            FROM losowe_pytania
            JOIN odpowiedzi
                ON odpowiedzi.id_pytanie = losowe_pytania.id
            ORDER BY losowe_pytania.id, RANDOM()
        `).all();

        const pytania = [];

        for (const row of rows) {
            let pytanie = pytania.find(
                element => element.id === row.pytanie_id
            );

            if (!pytanie) {
                pytanie = {
                    id: row.pytanie_id,
                    pytanie: row.tresc_pytania,
                    odpowiedzi: []
                };

                pytania.push(pytanie);
            }

            pytanie.odpowiedzi.push({
                id: row.odpowiedz_id,
                odpowiedz: row.tresc_odpowiedzi,
                is_correct: Number(row.poprawna)
            });
        }

        res.json(pytania);
    } catch (error) {
        console.error("Błąd pobierania quizu:", error);

        res.status(500).json({
            blad: "Nie udało się pobrać quizu"
        });
    }
});

// Rejestracja użytkownika
app.post("/api/rejestracja", async (req, res) => {
    try {
        const nazwa = String(req.body.nazwa || "").trim();

        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const haslo = String(req.body.haslo || "");

        if (!nazwa || !email || !haslo) {
            return res.status(400).json({
                blad: "Wszystkie pola są wymagane"
            });
        }

        const bladNazwy = sprawdzNazwe(nazwa);

        if (bladNazwy) {
            return res.status(400).json({
                blad: bladNazwy
            });
        }

        if (haslo.length < 6) {
            return res.status(400).json({
                blad: "Hasło musi mieć co najmniej 6 znaków"
            });
        }

        const istniejacyUzytkownik = db.prepare(`
            SELECT id
            FROM uzytkownicy
            WHERE nazwa = ? OR email = ?
        `).get(nazwa, email);

        if (istniejacyUzytkownik) {
            return res.status(409).json({
                blad: "Nazwa użytkownika lub email jest już zajęty"
            });
        }

        const hasloHash = await bcrypt.hash(haslo, 12);

        const wynik = db.prepare(`
            INSERT INTO uzytkownicy
            (nazwa, email, haslo)
            VALUES (?, ?, ?)
        `).run(nazwa, email, hasloHash);

        res.status(201).json({
            sukces: true,
            id: wynik.lastInsertRowid,
            komunikat: "Konto zostało utworzone"
        });
    } catch (error) {
        console.error("Błąd rejestracji:", error);

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                blad: "Nazwa użytkownika lub email jest już zajęty"
            });
        }

        res.status(500).json({
            blad: "Wewnętrzny błąd serwera"
        });
    }
});

// Logowanie użytkownika
app.post("/api/logowanie", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const haslo = String(req.body.haslo || "");

        if (!email || !haslo) {
            return res.status(400).json({
                blad: "Email i hasło są wymagane"
            });
        }

        const uzytkownik = db.prepare(`
            SELECT id, nazwa, email, haslo
            FROM uzytkownicy
            WHERE email = ?
        `).get(email);

        if (!uzytkownik) {
            return res.status(401).json({
                blad: "Nieprawidłowy email lub hasło"
            });
        }

        const poprawneHaslo = await bcrypt.compare(
            haslo,
            uzytkownik.haslo
        );

        if (!poprawneHaslo) {
            return res.status(401).json({
                blad: "Nieprawidłowy email lub hasło"
            });
        }

        req.session.uzytkownik = {
            id: uzytkownik.id,
            nazwa: uzytkownik.nazwa,
            email: uzytkownik.email
        };

        res.json({
            sukces: true,
            komunikat: "Zalogowano pomyślnie",
            uzytkownik: req.session.uzytkownik
        });
    } catch (error) {
        console.error("Błąd logowania:", error);

        res.status(500).json({
            blad: "Wewnętrzny błąd serwera"
        });
    }
});

// Informacje o aktualnie zalogowanym użytkowniku
app.get("/api/uzytkownik", (req, res) => {
    if (!req.session.uzytkownik) {
        return res.json({
            zalogowany: false,
            nazwa: "Gość"
        });
    }

    res.json({
        zalogowany: true,
        uzytkownik: req.session.uzytkownik
    });
});

// Wylogowanie użytkownika
app.post("/api/wylogowanie", (req, res) => {
    req.session.destroy(error => {
        if (error) {
            console.error("Błąd wylogowania:", error);

            return res.status(500).json({
                blad: "Nie udało się wylogować"
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            sukces: true,
            komunikat: "Wylogowano pomyślnie"
        });
    });
});
 // Zapisywanie wyniku tylko dla zalogowanego użytkownika
app.post("/api/wyniki", (req, res) => {
    try {
        if (!req.session.uzytkownik) {
            return res.status(401).json({
                zapisano: false,
                blad: "Musisz być zalogowany, aby zapisać wynik"
            });
        }

        const kategoria = String(req.body.kategoria || "").trim();
        const punkty = Number(req.body.punkty);
        const liczbaPytan = Number(req.body.liczba_pytan);

        if (!kategoria) {
            return res.status(400).json({
                blad: "Brak kategorii"
            });
        }

        if (
            !Number.isInteger(punkty) ||
            !Number.isInteger(liczbaPytan) ||
            punkty < 0 ||
            liczbaPytan <= 0 ||
            punkty > liczbaPytan
        ) {
            return res.status(400).json({
                blad: "Nieprawidłowy wynik"
            });
        }

        db.prepare(`
            INSERT INTO wyniki
            (id_uzytkownika, kategoria, punkty, liczba_pytan)
            VALUES (?, ?, ?, ?)
        `).run(
            req.session.uzytkownik.id,
            kategoria,
            punkty,
            liczbaPytan
        );

        res.status(201).json({
            zapisano: true,
            komunikat: "Wynik został zapisany"
        });
    } catch (error) {
        console.error("Błąd zapisywania wyniku:", error);

        res.status(500).json({
            zapisano: false,
            blad: "Nie udało się zapisać wyniku"
        });
    }
});

// Dane profilu i historia wyników
app.get("/api/profil", (req, res) => {
    try {
        if (!req.session.uzytkownik) {
            return res.status(401).json({
                blad: "Musisz być zalogowany"
            });
        }

        const idUzytkownika =
            req.session.uzytkownik.id;

        const rekordUzytkownika = db.prepare(`
            SELECT id, nazwa, email, data_utworzenia, nazwa_zmieniona
            FROM uzytkownicy
            WHERE id = ?
        `).get(idUzytkownika);

        if (!rekordUzytkownika) {
            return res.status(401).json({
                blad: "Musisz być zalogowany"
            });
        }

        const { nazwa_zmieniona: nazwaZmieniona, ...uzytkownik } =
            rekordUzytkownika;

        const wyniki = db.prepare(`
            SELECT
                id,
                kategoria,
                punkty,
                liczba_pytan,
                data_wyniku
            FROM wyniki
            WHERE id_uzytkownika = ?
            ORDER BY data_wyniku DESC
        `).all(idUzytkownika);

        res.json({
            uzytkownik,
            wyniki,
            zmiana_nazwy_za_sekund: sekundyDoZmianyNazwy(nazwaZmieniona)
        });
    } catch (error) {
        console.error("Błąd profilu:", error);

        res.status(500).json({
            blad: "Nie udało się pobrać profilu"
        });
    }
});

// Zmiana nazwy użytkownika (raz na OKRES_ZMIANY_NAZWY_DNI dni)
app.post("/api/profil/nazwa", (req, res) => {
    try {
        if (!req.session.uzytkownik) {
            return res.status(401).json({
                blad: "Musisz być zalogowany"
            });
        }

        const nowaNazwa = String(req.body.nazwa || "").trim();
        const bladNazwy = sprawdzNazwe(nowaNazwa);

        if (bladNazwy) {
            return res.status(400).json({
                blad: bladNazwy
            });
        }

        const idUzytkownika = req.session.uzytkownik.id;

        // sprawdzenie i zapis w jednej transakcji
        const zmienNazwe = db.transaction(() => {
            const obecny = db.prepare(`
                SELECT nazwa, nazwa_zmieniona
                FROM uzytkownicy
                WHERE id = ?
            `).get(idUzytkownika);

            if (!obecny) {
                return { status: 401, blad: "Musisz być zalogowany" };
            }

            if (obecny.nazwa === nowaNazwa) {
                return {
                    status: 400,
                    blad: "To jest już twoja obecna nazwa"
                };
            }

            const zaSekund = sekundyDoZmianyNazwy(obecny.nazwa_zmieniona);

            if (zaSekund > 0) {
                return {
                    status: 429,
                    blad:
                        `Nazwę możesz zmieniać raz na ${OKRES_ZMIANY_NAZWY_DNI} dni. ` +
                        `Następna zmiana za ${opiszCzas(zaSekund)}.`,
                    zmiana_nazwy_za_sekund: zaSekund
                };
            }

            const zajeta = db.prepare(`
                SELECT id
                FROM uzytkownicy
                WHERE LOWER(nazwa) = LOWER(?) AND id != ?
            `).get(nowaNazwa, idUzytkownika);

            if (zajeta) {
                return { status: 409, blad: "Ta nazwa jest już zajęta" };
            }

            db.prepare(`
                UPDATE uzytkownicy
                SET nazwa = ?, nazwa_zmieniona = datetime('now')
                WHERE id = ?
            `).run(nowaNazwa, idUzytkownika);

            return { status: 200 };
        });

        const wynik = zmienNazwe();

        if (wynik.status !== 200) {
            const { status, ...tresc } = wynik;
            return res.status(status).json(tresc);
        }

        req.session.uzytkownik.nazwa = nowaNazwa;

        res.json({
            sukces: true,
            nazwa: nowaNazwa,
            zmiana_nazwy_za_sekund: OKRES_ZMIANY_NAZWY_DNI * 24 * 60 * 60
        });
    } catch (error) {
        console.error("Błąd zmiany nazwy:", error);

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                blad: "Ta nazwa jest już zajęta"
            });
        }

        res.status(500).json({
            blad: "Nie udało się zmienić nazwy"
        });
    }
});

// Leaderboard: najlepszy wynik każdego gracza
// (w całości albo w wybranej kategorii), każdy gracz tylko raz
app.get("/api/leaderboard", (req, res) => {
    try {
        const kategoria =
            String(req.query.kategoria || "").trim();

        // warunek jest stałym tekstem, a kategoria trafia do zapytania jako parametr
        const warunek = kategoria ? "WHERE w.kategoria = ?" : "";
        const parametry = kategoria ? [kategoria] : [];

        const wyniki = db.prepare(`
            SELECT
                id_uzytkownika,
                nazwa,
                kategoria,
                punkty,
                liczba_pytan,
                data_wyniku,
                proby
            FROM (
                SELECT
                    u.id AS id_uzytkownika,
                    u.nazwa AS nazwa,
                    w.kategoria AS kategoria,
                    w.punkty AS punkty,
                    w.liczba_pytan AS liczba_pytan,
                    w.data_wyniku AS data_wyniku,
                    COUNT(*) OVER (
                        PARTITION BY w.id_uzytkownika
                    ) AS proby,
                    ROW_NUMBER() OVER (
                        PARTITION BY w.id_uzytkownika
                        ORDER BY
                            CAST(w.punkty AS REAL) / w.liczba_pytan DESC,
                            w.punkty DESC,
                            w.data_wyniku ASC,
                            w.id ASC
                    ) AS numer
                FROM wyniki w
                JOIN uzytkownicy u
                    ON u.id = w.id_uzytkownika
                ${warunek}
            )
            WHERE numer = 1
            ORDER BY
                CAST(punkty AS REAL) / liczba_pytan DESC,
                punkty DESC,
                data_wyniku ASC,
                id_uzytkownika ASC
            LIMIT 100
        `).all(...parametry);

        res.json(wyniki.map(wynik => ({
            ...wynik,
            ma_avatar: czyMaAvatar(wynik.id_uzytkownika)
        })));
    } catch (error) {
        console.error("Błąd leaderboardu:", error);

        res.status(500).json({
            blad: "Nie udało się pobrać leaderboardu"
        });
    }
});

// Uruchomienie serwera
app.listen(PORT, "0.0.0.0", () => {
    console.log(`API działa na porcie ${PORT}`);
    console.log(`Strona: http://localhost:${PORT}/index.html` );
});
