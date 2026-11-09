const komunikat = document.querySelector("#komunikat");
const daneProfilu = document.querySelector("#dane-profilu");
const historiaWynikow = document.querySelector("#historia-wynikow");
const brakWynikow = document.querySelector("#brak-wynikow");
const tabelaWynikow = document.querySelector("#wyniki");

const nazwaUzytkownika = document.querySelector(
    "#nazwa-uzytkownika"
);

const emailUzytkownika = document.querySelector(
    "#email-uzytkownika"
);

const dataUtworzenia = document.querySelector(
    "#data-utworzenia"
);

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

        nazwaUzytkownika.textContent = dane.uzytkownik.nazwa;
        emailUzytkownika.textContent = dane.uzytkownik.email;
        dataUtworzenia.textContent = dane.uzytkownik.data_utworzenia;

        daneProfilu.hidden = false;
        historiaWynikow.hidden = false;
        komunikat.hidden = true;

        if (!Array.isArray(dane.wyniki) || dane.wyniki.length === 0) {
            brakWynikow.hidden = false;
            return;
        }

        dane.wyniki.forEach(wynik => {
            const wiersz = document.createElement("tr");

            const kategoria = document.createElement("td");
            kategoria.textContent = wynik.kategoria;

            const punkty = document.createElement("td");
            punkty.textContent =
                `${wynik.punkty}/${wynik.liczba_pytan}`;

            const data = document.createElement("td");
            data.textContent = wynik.data_wyniku;

            wiersz.appendChild(kategoria);
            wiersz.appendChild(punkty);
            wiersz.appendChild(data);
            tabelaWynikow.appendChild(wiersz);
        });
    } catch (error) {
        console.error("Błąd profilu:", error);
        komunikat.textContent =
            "Nie udało się połączyć z serwerem.";
    }
}

pobierzProfil();
