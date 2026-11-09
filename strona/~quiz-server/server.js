const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const session = require("express-session");

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

        if (nazwa.length < 3) {
            return res.status(400).json({
                blad: "Nazwa użytkownika musi mieć co najmniej 3 znaki"
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

        const uzytkownik = db.prepare(`
            SELECT id, nazwa, email, data_utworzenia
            FROM uzytkownicy
            WHERE id = ?
        `).get(idUzytkownika);

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
            wyniki
        });
    } catch (error) {
        console.error("Błąd profilu:", error);

        res.status(500).json({
            blad: "Nie udało się pobrać profilu"
        });
    }
});

// Leaderboard
app.get("/api/leaderboard", (req, res) => {
    try {
        const kategoria =
            String(req.query.kategoria || "").trim();

        let wyniki;

        if (kategoria) {
            wyniki = db.prepare(`
                SELECT
                    u.nazwa,
                    w.kategoria,
                    w.punkty,
                    w.liczba_pytan,
                    w.data_wyniku
                FROM wyniki w
                JOIN uzytkownicy u
                    ON u.id = w.id_uzytkownika
                WHERE w.kategoria = ?
                ORDER BY
                    w.punkty DESC,
                    w.data_wyniku ASC
                LIMIT 100
            `).all(kategoria);
        } else {
            wyniki = db.prepare(`
                SELECT
                    u.nazwa,
                    w.kategoria,
                    w.punkty,
                    w.liczba_pytan,
                    w.data_wyniku
                FROM wyniki w
                JOIN uzytkownicy u
                    ON u.id = w.id_uzytkownika
                ORDER BY
                    w.punkty DESC,
                    w.data_wyniku ASC
                LIMIT 100
            `).all();
        }

        res.json(wyniki);
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
