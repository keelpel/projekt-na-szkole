const parametryAdresu =
    new URLSearchParams(window.location.search);

const kategoria =
    parametryAdresu.get("kategoria") || "muzyka";

const listaPytan =
    document.querySelector("#lista-pytan");

const przyciskSprawdz =
    document.querySelector("#sprawdz");

const elementWyniku =
    document.querySelector("#wynik");

const nazwaQuizu =
    document.querySelector("#nazwa-quizu");

let pytania = [];
let wynik = 0;
let quizSprawdzony = false;

nazwaQuizu.textContent = `Quiz: ${kategoria}`;


async function pobierzPytania() {
    try {
        listaPytan.textContent = "Ładowanie pytań...";
        przyciskSprawdz.disabled = true;

        const adresApi =
            `/api/quiz?kategoria=${encodeURIComponent(kategoria)}`;

        const odpowiedz = await fetch(adresApi, {
            cache: "no-store",
            credentials: "include"
        });

        if (!odpowiedz.ok) {
            throw new Error(`Błąd HTTP: ${odpowiedz.status}`);
        }

        pytania = await odpowiedz.json();

        if (!Array.isArray(pytania)) {
            throw new Error("Serwer zwrócił nieprawidłowe dane");
        }

        if (pytania.length === 0) {
            listaPytan.textContent =
                "Brak pytań w tej kategorii.";
            return;
        }

        wygenerujPytania();
        przyciskSprawdz.disabled = false;
    } catch (blad) {
        console.error(blad);

        listaPytan.textContent =
            `Nie udało się pobrać pytań: ${blad.message}`;
    }
}


function wygenerujPytania() {
    listaPytan.innerHTML = "";
    elementWyniku.textContent = "";
    quizSprawdzony = false;

    pytania.forEach((danePytania, numerPytania) => {
        const pytanie = document.createElement("section");

        pytanie.className = "pytanie";
        pytanie.dataset.id = danePytania.id;

        const trescPytania = document.createElement("h3");
        trescPytania.className = "tresc-pytania";
        trescPytania.textContent =
            `${numerPytania + 1}. ${danePytania.pytanie}`;

        pytanie.appendChild(trescPytania);

        const odpowiedzi = document.createElement("div");
        odpowiedzi.className = "odpowiedzi";

        danePytania.odpowiedzi.forEach(
            (daneOdpowiedzi, numerOdpowiedzi) => {
                const odpowiedz = document.createElement("label");
                odpowiedz.className = "odpowiedz";
                odpowiedz.dataset.id = daneOdpowiedzi.id;

                const radio = document.createElement("input");
                radio.className = "radio-odpowiedzi";
                radio.type = "radio";
                radio.name = `pytanie-${danePytania.id}`;
                radio.value = daneOdpowiedzi.id;
                radio.dataset.poprawna = daneOdpowiedzi.is_correct;

                const tekstOdpowiedzi = document.createElement("span");
                tekstOdpowiedzi.className = "tekst-odpowiedzi";
                tekstOdpowiedzi.textContent =
                    `${String.fromCharCode(65 + numerOdpowiedzi)}. ${daneOdpowiedzi.odpowiedz}`;

                odpowiedz.appendChild(radio);
                odpowiedz.appendChild(tekstOdpowiedzi);

                odpowiedz.addEventListener("click", (zdarzenie) => {
                    // po sprawdzeniu quizu nie można już zmieniać odpowiedzi
                    if (quizSprawdzony) {
                        zdarzenie.preventDefault();
                        return;
                    }

                    odpowiedzi
                        .querySelectorAll(".odpowiedz")
                        .forEach(element => {
                            element.classList.remove("wybrana");
                        });

                    odpowiedz.classList.add("wybrana");
                    radio.checked = true;
                });

                odpowiedzi.appendChild(odpowiedz);
            }
        );

        pytanie.appendChild(odpowiedzi);
        listaPytan.appendChild(pytanie);
    });
}


async function sprawdzQuiz() {
    if (quizSprawdzony) {
        return;
    }

    wynik = 0;

    pytania.forEach(danePytania => {
        const wybranaOdpowiedz = document.querySelector(
            `input[name="pytanie-${danePytania.id}"]:checked`
        );

        if (
            wybranaOdpowiedz &&
            Number(wybranaOdpowiedz.dataset.poprawna) === 1
        ) {
            wynik++;
        }

        // oznaczanie poprawnych (zielone) i błędnych (czerwone) odpowiedzi
        document
            .querySelectorAll(`input[name="pytanie-${danePytania.id}"]`)
            .forEach(radio => {
                const etykieta = radio.closest(".odpowiedz");
                radio.disabled = true;

                if (Number(radio.dataset.poprawna) === 1) {
                    etykieta.classList.add("poprawna");
                } else if (radio.checked) {
                    etykieta.classList.add("zla");
                }
            });
    });

    quizSprawdzony = true;
    przyciskSprawdz.disabled = true;

    elementWyniku.textContent =
        `Wynik: ${wynik}/${pytania.length}`;

    elementWyniku.classList.add("wynik-pokazany");

    await zapiszWynik(wynik, pytania.length);
}


async function zapiszWynik(punkty, liczbaPytan) {
    try {
        const odpowiedz = await fetch("/api/wyniki", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                kategoria,
                punkty,
                liczba_pytan: liczbaPytan
            })
        });

        const dane = await odpowiedz.json();

        if (odpowiedz.status === 401) {
            elementWyniku.textContent +=
                " Gość ma stulejke.";
            console.log("Gość — wynik pozostał tylko na ekranie.");
            return;
        }

        if (!odpowiedz.ok) {
            console.error("Błąd zapisu wyniku:", dane.blad);
            elementWyniku.textContent +=
                " Nie udało się zapisać wyniku.";
            return;
        }

        elementWyniku.textContent +=
            " Wynik zapisano na Twoim koncie.";
    } catch (error) {
        console.error("Błąd połączenia przy zapisie wyniku:", error);
        elementWyniku.textContent +=
            " Nie udało się połączyć z serwerem wyników.";
    }
}


przyciskSprawdz.addEventListener("click", sprawdzQuiz);

pobierzPytania();
