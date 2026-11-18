const formularz = document.querySelector(
    "#formularz-logowania"
);

const komunikat = document.querySelector(
    "#komunikat"
);

formularz.addEventListener("submit", async event => {
    event.preventDefault();

    const email = document.querySelector(
        "#email"
    ).value.trim().toLowerCase();

    const haslo = document.querySelector(
        "#haslo"
    ).value;

    komunikat.textContent = "Logowanie...";

    try {
        const odpowiedz = await fetch(
            "/api/logowanie",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    email,
                    haslo
                })
            }
        );

        const dane = await odpowiedz.json();

        if (!odpowiedz.ok) {
            komunikat.textContent =
                `Błąd: ${
                    dane.blad || "Nieprawidłowe dane logowania"
                }`;
            return;
        }

        komunikat.textContent =
            `Zalogowano jako ${dane.uzytkownik.nazwa}`;

        setTimeout(() => {
            window.location.href = "index.html";
        }, 1000);

    } catch (blad) {
        console.error("Błąd logowania:", blad);

        komunikat.textContent =
            "Nie udało się połączyć z serwerem";
    }
});
