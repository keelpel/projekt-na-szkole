// Nazwy kategorii pokazywane w rankingu (klucz = kategoria w bazie).
// Trzymaj w zgodzie z NAZWY_KATEGORII w profil.js.
const NAZWY_KATEGORII = {
    muzyka: "🎵 Muzyka",
    informatyka: "🧊 Zakątki Internetu",
    historia: "📜 Historia",
    biologia: "🔍 True Crime",
    warhammer: "⚔️ Warhammer 40K",
    internet: "⛩️ Touhou"
};

const MEDALE = ["🥇", "🥈", "🥉"];

const filtry = document.querySelector("#filtry");
const komunikat = document.querySelector("#komunikat");
const twojeMiejsce = document.querySelector("#twoje-miejsce");
const podium = document.querySelector("#podium");
const ranking = document.querySelector("#ranking");

let aktualnaKategoria = "";
let mojeId = null;
let numerZapytania = 0;   // żeby spóźniona odpowiedź nie nadpisała nowszej


/* ---------------- pomocnicze ---------------- */

function nazwaKategorii(klucz) {
    return NAZWY_KATEGORII[klucz] || klucz;
}

function procent(wynik) {
    if (!wynik.liczba_pytan) {
        return 0;
    }
    return Math.round((wynik.punkty / wynik.liczba_pytan) * 100);
}

function klasaWyniku(proc) {
    if (proc >= 70) {
        return "wysoki";
    }
    if (proc >= 40) {
        return "sredni";
    }
    return "niski";
}

// "2026-11-17 11:48:04" -> "17.11.2026, 11:48"
function formatujDate(tekst) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(
        String(tekst)
    );
    return m ? `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}` : String(tekst);
}

function dodaj(rodzic, znacznik, klasa, tekst) {
    const el = document.createElement(znacznik);

    if (klasa) {
        el.className = klasa;
    }
    if (tekst !== undefined) {
        el.textContent = tekst;
    }

    rodzic.appendChild(el);
    return el;
}

function opiszPodejscia(proby) {
    return `podejść: ${proby}`;
}

// okrągły avatar: zdjęcie (jeśli jest) albo pierwsza litera nicku
function stworzAvatar(gracz, duzy) {
    const el = document.createElement("span");
    el.className = duzy ? "mini-avatar duzy" : "mini-avatar";
    el.textContent = (gracz.nazwa || "?").charAt(0).toUpperCase();

    if (gracz.ma_avatar) {
        const obraz = new Image();
        obraz.alt = "";
        obraz.loading = "lazy";

        obraz.onload = () => {
            el.textContent = "";
            el.appendChild(obraz);
        };

        obraz.src = `/api/avatar/${gracz.id_uzytkownika}`;
    }

    return el;
}

function czyToJa(gracz) {
    return mojeId !== null && gracz.id_uzytkownika === mojeId;
}


/* ---------------- podium (miejsca 1-3) ---------------- */

function pokazPodium(najlepsi) {
    podium.textContent = "";

    najlepsi.forEach((gracz, indeks) => {
        const karta = document.createElement("div");
        karta.className = `podium-karta miejsce-${indeks + 1}`;
        karta.style.setProperty("--i", indeks);
        karta.title = opiszPodejscia(gracz.proby);

        dodaj(karta, "span", "podium-medal", MEDALE[indeks]);
        karta.appendChild(stworzAvatar(gracz, true));

        const nick = dodaj(karta, "span", "podium-nick", gracz.nazwa);
        if (czyToJa(gracz)) {
            nick.textContent = `${gracz.nazwa} (to ty)`;
        }

        const proc = procent(gracz);
        const wynik = dodaj(
            karta, "span", "podium-wynik",
            `${gracz.punkty}/${gracz.liczba_pytan} `
        );
        dodaj(wynik, "span", `pigulka ${klasaWyniku(proc)}`, `${proc}%`);

        dodaj(karta, "span", "podium-kat", nazwaKategorii(gracz.kategoria));
        dodaj(karta, "span", "podium-data", formatujDate(gracz.data_wyniku));

        podium.appendChild(karta);
    });
}


/* ---------------- lista (miejsca 4+) ---------------- */

function pokazListe(reszta, przesuniecie) {
    ranking.textContent = "";

    reszta.forEach((gracz, indeks) => {
        const wiersz = document.createElement("li");
        wiersz.className = czyToJa(gracz) ? "wiersz ja" : "wiersz";
        wiersz.style.setProperty("--i", indeks);

        dodaj(wiersz, "span", "miejsce", przesuniecie + indeks + 1);

        const graczEl = dodaj(wiersz, "span", "gracz");
        graczEl.appendChild(stworzAvatar(gracz, false));
        dodaj(graczEl, "span", "nick", gracz.nazwa);
        if (czyToJa(gracz)) {
            dodaj(graczEl, "span", "znacznik-ja", "to ty");
        }

        dodaj(wiersz, "span", "kat", nazwaKategorii(gracz.kategoria));

        const proc = procent(gracz);
        const blok = dodaj(wiersz, "span", "wynik-blok");
        dodaj(blok, "span", "liczba", `${gracz.punkty}/${gracz.liczba_pytan}`);

        const pasek = dodaj(blok, "span", "pasek");
        const wypelnienie = document.createElement("i");
        wypelnienie.style.width = `${proc}%`;
        pasek.appendChild(wypelnienie);

        dodaj(blok, "span", `pigulka ${klasaWyniku(proc)}`, `${proc}%`);

        const data = dodaj(wiersz, "span", "data", formatujDate(gracz.data_wyniku));
        dodaj(data, "small", "", opiszPodejscia(gracz.proby));

        ranking.appendChild(wiersz);
    });
}


/* ---------------- "twoje miejsce" ---------------- */

function pokazTwojeMiejsce(dane) {
    if (mojeId === null) {
        twojeMiejsce.hidden = true;
        return;
    }

    const indeks = dane.findIndex(czyToJa);

    twojeMiejsce.textContent = indeks === -1
        ? "Nie masz jeszcze wyniku w tym rankingu. Czas zagrać! 🎮"
        : `Twoje miejsce: #${indeks + 1} z ${dane.length} 🏆`;
    twojeMiejsce.hidden = false;
}


/* ---------------- pobieranie danych ---------------- */

async function pobierzMojeId() {
    try {
        const odpowiedz = await fetch("/api/uzytkownik", {
            credentials: "include",
            cache: "no-store"
        });
        const dane = await odpowiedz.json();

        mojeId = dane.zalogowany ? dane.uzytkownik.id : null;
    } catch (blad) {
        mojeId = null;
    }
}

async function pobierzLeaderboard() {
    const numer = ++numerZapytania;

    komunikat.hidden = false;
    komunikat.textContent = "Ładowanie rankingu...";
    twojeMiejsce.hidden = true;
    podium.textContent = "";
    ranking.textContent = "";

    try {
        const adres = aktualnaKategoria
            ? `/api/leaderboard?kategoria=${encodeURIComponent(aktualnaKategoria)}`
            : "/api/leaderboard";

        const odpowiedz = await fetch(adres, {
            credentials: "include",
            cache: "no-store"
        });

        const dane = await odpowiedz.json();

        if (numer !== numerZapytania) {
            return;
        }

        if (!odpowiedz.ok) {
            throw new Error(dane.blad);
        }

        if (!Array.isArray(dane) || dane.length === 0) {
            komunikat.textContent = "Nie ma jeszcze żadnych wyników.";
            return;
        }

        komunikat.hidden = true;

        pokazTwojeMiejsce(dane);
        pokazPodium(dane.slice(0, 3));
        pokazListe(dane.slice(3), 3);
    } catch (error) {
        console.error(error);

        if (numer === numerZapytania) {
            komunikat.textContent = "Nie udało się pobrać rankingu.";
        }
    }
}


/* ---------------- filtry kategorii ---------------- */

function ustawKategorie(klucz) {
    aktualnaKategoria = klucz;

    filtry.querySelectorAll(".filtr").forEach((przycisk) => {
        const aktywny = przycisk.dataset.klucz === klucz;
        przycisk.classList.toggle("aktywny", aktywny);
        przycisk.setAttribute("aria-pressed", String(aktywny));
    });

    pobierzLeaderboard();
}

function dodajFiltr(klucz, etykieta) {
    const przycisk = document.createElement("button");
    przycisk.type = "button";
    przycisk.className = "filtr";
    przycisk.dataset.klucz = klucz;
    przycisk.textContent = etykieta;
    przycisk.addEventListener("click", () => ustawKategorie(klucz));
    filtry.appendChild(przycisk);
}

async function zbudujFiltry() {
    let kategorie = Object.keys(NAZWY_KATEGORII);

    try {
        const odpowiedz = await fetch("/api/kategorie", { cache: "no-store" });

        if (odpowiedz.ok) {
            const dane = await odpowiedz.json();

            if (Array.isArray(dane) && dane.length > 0) {
                kategorie = dane;
            }
        }
    } catch (blad) {
        // zostają kategorie z listy powyżej
    }

    dodajFiltr("", "Wszystkie");
    kategorie.forEach((klucz) => dodajFiltr(klucz, nazwaKategorii(klucz)));
}


/* ---------------- start ---------------- */

(async function start() {
    await Promise.all([pobierzMojeId(), zbudujFiltry()]);
    ustawKategorie("");
})();
