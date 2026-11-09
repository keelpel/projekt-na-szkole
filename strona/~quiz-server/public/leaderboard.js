const ranking =
    document.querySelector("#ranking");

const komunikat =
    document.querySelector("#komunikat");

const wyborKategorii =
    document.querySelector("#kategoria");

async function pobierzLeaderboard() {
    try {
        ranking.innerHTML = "";
        komunikat.textContent =
            "Ładowanie rankingu...";

        const kategoria =
            wyborKategorii.value;

        const adres = kategoria
            ? `/api/leaderboard?kategoria=${encodeURIComponent(kategoria)}`
            : "/api/leaderboard";

        const odpowiedz = await fetch(adres, {
            credentials: "include",
            cache: "no-store"
        });

        const dane = await odpowiedz.json();

        if (!odpowiedz.ok) {
            throw new Error(dane.blad);
        }

        if (dane.length === 0) {
            komunikat.textContent =
                "Nie ma jeszcze żadnych wyników.";
            return;
        }

        komunikat.textContent = "";

        dane.forEach((wynik, indeks) => {
            const wiersz =
                document.createElement("tr");

            wiersz.innerHTML = `
                <td>${indeks + 1}</td>
                <td>${wynik.nazwa}</td>
                <td>${wynik.kategoria}</td>
                <td>${wynik.punkty}/${wynik.liczba_pytan}</td>
                <td>${wynik.data_wyniku}</td>
            `;

            ranking.appendChild(wiersz);
        });
    } catch (error) {
        console.error(error);

        komunikat.textContent =
            "Nie udało się pobrać rankingu.";
    }
}

wyborKategorii.addEventListener(
    "change",
    pobierzLeaderboard
);

pobierzLeaderboard();
