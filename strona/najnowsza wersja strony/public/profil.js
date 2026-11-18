// Nazwy kategorii pokazywane na profilu (klucz = kategoria w bazie).
// Możesz je dowolnie edytować.
const NAZWY_KATEGORII = {
    muzyka: "🎵 Muzyka",
    informatyka: "🧊 Zakątki Internetu",
    historia: "📜 Historia",
    biologia: "🔍 True Crime",
    warhammer: "⚔️ Warhammer 40K",
    internet: "⛩️ Touhou"
};

const LIMIT_HISTORII = 10;

const komunikat = document.querySelector("#komunikat");
const daneProfilu = document.querySelector("#dane-profilu");
const historiaWynikow = document.querySelector("#historia-wynikow");
const brakWynikow = document.querySelector("#brak-wynikow");
const kontenerTabeli = document.querySelector("#kontener-tabeli");
const tabelaWynikow = document.querySelector("#wyniki");
const przyciskWiecej = document.querySelector("#pokaz-wiecej");

const sekcjaStatystyk = document.querySelector("#statystyki-sekcja");
const sekcjaWykresu = document.querySelector("#wykres-sekcja");
const sekcjaKategorii = document.querySelector("#kategorie-sekcja");
const sekcjaOdznak = document.querySelector("#odznaki-sekcja");

const nazwaUzytkownika = document.querySelector("#nazwa-uzytkownika");
const emailUzytkownika = document.querySelector("#email-uzytkownika");
const dataUtworzenia = document.querySelector("#data-utworzenia");
const przyciskEmail = document.querySelector("#przelacz-email");
const awatarLitera = document.querySelector("#avatar-litera");
const staz = document.querySelector("#staz");

const sekcjaUstawien = document.querySelector("#ustawienia-sekcja");
const formularzNazwy = document.querySelector("#formularz-nazwy");
const poleNazwy = document.querySelector("#nowa-nazwa");
const przyciskNazwy = document.querySelector("#zmien-nazwe");
const infoNazwy = document.querySelector("#info-nazwy");


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

function ileDni(tekst) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(tekst));
    if (!m) {
        return 0;
    }

    const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const dni = Math.floor((Date.now() - start.getTime()) / 86400000);
    return Math.max(0, dni);
}

function zamaskujEmail(email) {
    const [lokalna, domena] = String(email).split("@");
    if (!domena) {
        return "•••";
    }
    return `${lokalna.charAt(0)}${"•".repeat(5)}@${domena}`;
}


/* ---------------- nagłówek ---------------- */

function pokazNaglowek(uzytkownik) {
    nazwaUzytkownika.textContent = uzytkownik.nazwa;
    dataUtworzenia.textContent = formatujDate(uzytkownik.data_utworzenia);
    awatarLitera.textContent = uzytkownik.nazwa.charAt(0).toUpperCase() || "?";

    const dni = ileDni(uzytkownik.data_utworzenia);
    staz.textContent = dni === 0
        ? "dołączono dziś"
        : `z nami od ${dni} ${dni === 1 ? "dzień" : "dni"}`;

    // e-mail domyślnie ukryty
    let widoczny = false;
    emailUzytkownika.textContent = zamaskujEmail(uzytkownik.email);

    przyciskEmail.addEventListener("click", () => {
        widoczny = !widoczny;
        emailUzytkownika.textContent = widoczny
            ? uzytkownik.email
            : zamaskujEmail(uzytkownik.email);
        przyciskEmail.textContent = widoczny ? "🙈 ukryj" : "👁 pokaż";
    });

    daneProfilu.hidden = false;
    return dni;
}


/* ---------------- statystyki ---------------- */

function dodajStatystyke(rodzic, liczba, opis, pod) {
    const karta = document.createElement("div");
    karta.className = "statystyka";

    const liczbaEl = document.createElement("span");
    liczbaEl.className = "statystyka-liczba";
    liczbaEl.textContent = liczba;

    const opisEl = document.createElement("span");
    opisEl.className = "statystyka-opis";
    opisEl.textContent = opis;

    karta.appendChild(liczbaEl);
    karta.appendChild(opisEl);

    if (pod) {
        const podEl = document.createElement("span");
        podEl.className = "statystyka-pod";
        podEl.textContent = pod;
        karta.appendChild(podEl);
    }

    rodzic.appendChild(karta);
}

function pokazStatystyki(wyniki) {
    const rodzic = document.querySelector("#statystyki");
    rodzic.textContent = "";

    const procenty = wyniki.map(procent);
    const srednia = Math.round(
        procenty.reduce((a, b) => a + b, 0) / procenty.length
    );
    const najlepszyProc = Math.max(...procenty);
    const najlepszy = wyniki[procenty.indexOf(najlepszyProc)];

    const poprawne = wyniki.reduce((s, w) => s + w.punkty, 0);
    const wszystkie = wyniki.reduce((s, w) => s + w.liczba_pytan, 0);

    dodajStatystyke(rodzic, wyniki.length, "Rozwiązane quizy");
    dodajStatystyke(rodzic, `${srednia}%`, "Średni wynik");
    dodajStatystyke(
        rodzic,
        `${najlepszyProc}%`,
        "Najlepszy wynik",
        `${najlepszy.punkty}/${najlepszy.liczba_pytan} • ${nazwaKategorii(najlepszy.kategoria)}`
    );
    dodajStatystyke(
        rodzic,
        poprawne,
        "Poprawne odpowiedzi",
        `z ${wszystkie}`
    );

    sekcjaStatystyk.hidden = false;
}


/* ---------------- wykres postępów (SVG) ---------------- */

function rysujWykres(wyniki) {
    const rodzic = document.querySelector("#wykres");
    rodzic.textContent = "";

    const NS = "http://www.w3.org/2000/svg";
    const W = 600;
    const H = 170;
    const LEWO = 40;
    const PRAWO = 16;
    const GORA = 14;
    const DOL = 24;

    const ostatnie = wyniki.slice(0, 20).reverse();   // od najstarszego

    const yDla = (proc) =>
        (H - DOL) - (proc / 100) * (H - DOL - GORA);

    const xDla = (i) =>
        ostatnie.length === 1
            ? (LEWO + W - PRAWO) / 2
            : LEWO + (i * (W - PRAWO - LEWO)) / (ostatnie.length - 1);

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Wykres wyników w czasie");

    // linie pomocnicze 0 / 50 / 100%
    [0, 50, 100].forEach((p) => {
        const y = yDla(p);

        const linia = document.createElementNS(NS, "line");
        linia.setAttribute("x1", LEWO);
        linia.setAttribute("x2", W - PRAWO);
        linia.setAttribute("y1", y);
        linia.setAttribute("y2", y);
        linia.style.stroke = "var(--obramowanie)";
        linia.setAttribute("stroke-width", "1");
        linia.setAttribute("stroke-dasharray", "4 4");
        svg.appendChild(linia);

        const etykieta = document.createElementNS(NS, "text");
        etykieta.setAttribute("x", LEWO - 8);
        etykieta.setAttribute("y", y + 4);
        etykieta.setAttribute("text-anchor", "end");
        etykieta.setAttribute("font-size", "11");
        etykieta.style.fill = "var(--tekst)";
        etykieta.style.opacity = "0.7";
        etykieta.textContent = `${p}%`;
        svg.appendChild(etykieta);
    });

    const punkty = ostatnie.map((w, i) => ({
        x: xDla(i),
        y: yDla(procent(w)),
        wynik: w
    }));

    if (punkty.length > 1) {
        const linia = document.createElementNS(NS, "polyline");
        linia.setAttribute(
            "points",
            punkty.map((p) => `${p.x},${p.y}`).join(" ")
        );
        linia.setAttribute("fill", "none");
        linia.setAttribute("stroke-width", "3");
        linia.setAttribute("stroke-linejoin", "round");
        linia.setAttribute("stroke-linecap", "round");
        linia.style.stroke = "var(--akcent)";
        svg.appendChild(linia);
    }

    punkty.forEach((p) => {
        const kropka = document.createElementNS(NS, "circle");
        kropka.setAttribute("cx", p.x);
        kropka.setAttribute("cy", p.y);
        kropka.setAttribute("r", "5");
        kropka.setAttribute("stroke-width", "2");
        kropka.style.fill = "var(--akcent)";
        kropka.style.stroke = "var(--karta)";

        const podpowiedz = document.createElementNS(NS, "title");
        podpowiedz.textContent =
            `${nazwaKategorii(p.wynik.kategoria)}: ` +
            `${p.wynik.punkty}/${p.wynik.liczba_pytan} ` +
            `(${procent(p.wynik)}%) – ${formatujDate(p.wynik.data_wyniku)}`;
        kropka.appendChild(podpowiedz);

        svg.appendChild(kropka);
    });

    rodzic.appendChild(svg);
    sekcjaWykresu.hidden = false;
}


/* ---------------- kategorie ---------------- */

function pokazKategorie(wyniki) {
    const rodzic = document.querySelector("#kategorie");
    rodzic.textContent = "";

    const grupy = new Map();
    wyniki.forEach((w) => {
        if (!grupy.has(w.kategoria)) {
            grupy.set(w.kategoria, []);
        }
        grupy.get(w.kategoria).push(w);
    });

    const posortowane = [...grupy.entries()]
        .sort((a, b) => b[1].length - a[1].length);

    const paski = [];

    posortowane.forEach(([klucz, lista]) => {
        const procenty = lista.map(procent);
        const najlepszy = Math.max(...procenty);
        const srednia = Math.round(
            procenty.reduce((a, b) => a + b, 0) / procenty.length
        );

        const wiersz = document.createElement("div");
        wiersz.className = "kategoria";

        const gora = document.createElement("div");
        gora.className = "kategoria-gora";

        const nazwa = document.createElement("span");
        nazwa.textContent = nazwaKategorii(klucz);

        const info = document.createElement("span");
        info.className = "kategoria-info";
        info.textContent =
            `najlepszy ${najlepszy}% • średnia ${srednia}% • ` +
            `podejść: ${lista.length}`;

        gora.appendChild(nazwa);
        gora.appendChild(info);

        const pasek = document.createElement("div");
        pasek.className = "pasek";

        const wypelnienie = document.createElement("div");
        wypelnienie.className = "pasek-wypelnienie";
        pasek.appendChild(wypelnienie);
        paski.push([wypelnienie, najlepszy]);

        wiersz.appendChild(gora);
        wiersz.appendChild(pasek);
        rodzic.appendChild(wiersz);
    });

    sekcjaKategorii.hidden = false;

    // animacja wypełniania pasków
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            paski.forEach(([el, proc]) => {
                el.style.width = `${proc}%`;
            });
        });
    });
}


/* ---------------- odznaki ---------------- */

const ODZNAKI = [
    {
        ikona: "🌱",
        nazwa: "Pierwszy krok",
        opis: "Rozwiąż pierwszy quiz",
        zdobyta: (c) => c.ilosc >= 1
    },
    {
        ikona: "🔥",
        nazwa: "Maniak quizów",
        opis: "Rozwiąż 10 quizów",
        zdobyta: (c) => c.ilosc >= 10
    },
    {
        ikona: "💯",
        nazwa: "Perfekcjonista",
        opis: "Zdobądź maksymalny wynik",
        zdobyta: (c) => c.maksimum
    },
    {
        ikona: "🧭",
        nazwa: "Odkrywca",
        opis: "Spróbuj 3 różnych kategorii",
        zdobyta: (c) => c.kategorie >= 3
    },
    {
        ikona: "🌈",
        nazwa: "Wszechstronny",
        opis: "Spróbuj wszystkich kategorii",
        zdobyta: (c) => c.kategorie >= Object.keys(NAZWY_KATEGORII).length
    },
    {
        ikona: "🏅",
        nazwa: "Weteran",
        opis: "Konto starsze niż 30 dni",
        zdobyta: (c) => c.dni >= 30
    }
];

function pokazOdznaki(wyniki, dni) {
    const rodzic = document.querySelector("#odznaki");
    rodzic.textContent = "";

    const kontekst = {
        ilosc: wyniki.length,
        maksimum: wyniki.some(
            (w) => w.liczba_pytan > 0 && w.punkty === w.liczba_pytan
        ),
        kategorie: new Set(wyniki.map((w) => w.kategoria)).size,
        dni
    };

    ODZNAKI.forEach((odznaka) => {
        const zdobyta = odznaka.zdobyta(kontekst);

        const el = document.createElement("div");
        el.className = `odznaka ${zdobyta ? "zdobyta" : "zablokowana"}`;
        el.title = zdobyta ? "Zdobyta!" : "Jeszcze niezdobyta";

        const ikona = document.createElement("span");
        ikona.className = "odznaka-ikona";
        ikona.textContent = odznaka.ikona;

        const nazwa = document.createElement("span");
        nazwa.className = "odznaka-nazwa";
        nazwa.textContent = odznaka.nazwa;

        const opis = document.createElement("span");
        opis.className = "odznaka-opis";
        opis.textContent = odznaka.opis;

        el.appendChild(ikona);
        el.appendChild(nazwa);
        el.appendChild(opis);
        rodzic.appendChild(el);
    });

    sekcjaOdznak.hidden = false;
}


/* ---------------- historia ---------------- */

function dodajWierszHistorii(wynik) {
    const wiersz = document.createElement("tr");

    const kategoria = document.createElement("td");
    kategoria.textContent = nazwaKategorii(wynik.kategoria);

    const punkty = document.createElement("td");
    punkty.textContent = `${wynik.punkty}/${wynik.liczba_pytan}`;

    const proc = procent(wynik);
    const pigulka = document.createElement("span");
    pigulka.className = `pigulka ${klasaWyniku(proc)}`;
    pigulka.textContent = `${proc}%`;
    punkty.appendChild(pigulka);

    const data = document.createElement("td");
    data.textContent = formatujDate(wynik.data_wyniku);

    wiersz.appendChild(kategoria);
    wiersz.appendChild(punkty);
    wiersz.appendChild(data);
    tabelaWynikow.appendChild(wiersz);
}

function pokazHistorie(wyniki) {
    let wszystkie = false;

    const odswiez = () => {
        tabelaWynikow.textContent = "";

        const doPokazania = wszystkie
            ? wyniki
            : wyniki.slice(0, LIMIT_HISTORII);
        doPokazania.forEach(dodajWierszHistorii);

        if (wyniki.length > LIMIT_HISTORII) {
            przyciskWiecej.hidden = false;
            przyciskWiecej.textContent = wszystkie
                ? "Pokaż mniej"
                : `Pokaż wszystkie (${wyniki.length})`;
        } else {
            przyciskWiecej.hidden = true;
        }
    };

    przyciskWiecej.addEventListener("click", () => {
        wszystkie = !wszystkie;
        odswiez();
    });

    odswiez();
}


/* ---------------- zmiana nazwy (raz na tydzień) ---------------- */

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

function pokazInfoNazwy(tekst, rodzaj) {
    infoNazwy.textContent = tekst;
    infoNazwy.className = rodzaj ? `info-nazwy ${rodzaj}` : "info-nazwy";
}

function ustawFormularzNazwy(zaSekund) {
    const zablokowany = zaSekund > 0;

    poleNazwy.disabled = zablokowany;
    przyciskNazwy.disabled = zablokowany;

    pokazInfoNazwy(
        zablokowany
            ? `Następna zmiana nazwy będzie możliwa za ${opiszCzas(zaSekund)}.`
            : "Nazwę możesz zmieniać raz na 7 dni.",
        ""
    );

    sekcjaUstawien.hidden = false;
}

formularzNazwy.addEventListener("submit", async (zdarzenie) => {
    zdarzenie.preventDefault();

    const nowaNazwa = poleNazwy.value.trim();

    if (!nowaNazwa) {
        return;
    }

    if (!confirm(
        `Zmienić nazwę na „${nowaNazwa}"?\n` +
        "Następna zmiana będzie możliwa dopiero za 7 dni."
    )) {
        return;
    }

    przyciskNazwy.disabled = true;
    pokazInfoNazwy("Zapisywanie...", "");

    try {
        const odpowiedz = await fetch("/api/profil/nazwa", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ nazwa: nowaNazwa })
        });

        const dane = await odpowiedz.json();

        if (!odpowiedz.ok) {
            pokazInfoNazwy(dane.blad || "Nie udało się zmienić nazwy.", "blad");

            if (dane.zmiana_nazwy_za_sekund > 0) {
                ustawFormularzNazwy(dane.zmiana_nazwy_za_sekund);
                pokazInfoNazwy(dane.blad, "blad");
            } else {
                przyciskNazwy.disabled = false;
            }
            return;
        }

        nazwaUzytkownika.textContent = dane.nazwa;
        awatarLitera.textContent = dane.nazwa.charAt(0).toUpperCase() || "?";
        poleNazwy.value = "";

        ustawFormularzNazwy(dane.zmiana_nazwy_za_sekund);
        pokazInfoNazwy(
            `Zapisano! Następna zmiana nazwy za ${opiszCzas(dane.zmiana_nazwy_za_sekund)}.`,
            "sukces"
        );
    } catch (blad) {
        console.error("Błąd zmiany nazwy:", blad);
        pokazInfoNazwy("Nie udało się połączyć z serwerem.", "blad");
        przyciskNazwy.disabled = false;
    }
});


/* ---------------- pobieranie profilu ---------------- */

async function pobierzProfil() {
    try {
        const odpowiedz = await fetch("/api/profil", {
            credentials: "include",
            cache: "no-store"
        });

        const dane = await odpowiedz.json();

        if (odpowiedz.status === 401) {
            komunikat.textContent =
                "Musisz się zalogować, aby zobaczyć profil.";

            setTimeout(() => {
                window.location.href = "logowanie.html";
            }, 1200);

            return;
        }

        if (!odpowiedz.ok) {
            throw new Error(
                dane.blad || "Nie udało się pobrać profilu"
            );
        }

        const dni = pokazNaglowek(dane.uzytkownik);
        komunikat.hidden = true;
        ustawFormularzNazwy(dane.zmiana_nazwy_za_sekund || 0);

        // najnowsze wyniki na górze
        const wyniki = (Array.isArray(dane.wyniki) ? dane.wyniki : [])
            .slice()
            .sort((a, b) =>
                String(b.data_wyniku).localeCompare(String(a.data_wyniku))
            );

        pokazOdznaki(wyniki, dni);
        historiaWynikow.hidden = false;

        if (wyniki.length === 0) {
            brakWynikow.hidden = false;
            kontenerTabeli.hidden = true;
            return;
        }

        pokazStatystyki(wyniki);
        rysujWykres(wyniki);
        pokazKategorie(wyniki);
        pokazHistorie(wyniki);
    } catch (error) {
        console.error("Błąd profilu:", error);
        komunikat.textContent =
            "Nie udało się połączyć z serwerem.";
    }
}

pobierzProfil();
