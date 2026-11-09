const formularz = document.querySelector(
    "#formularz-rejestracji"
);

const komunikat = document.querySelector(
    "#komunikat"
);

formularz.addEventListener("submit", async event => {
    event.preventDefault();

    const nazwa = document.querySelector(
        "#nazwa"
    ).value.trim();

    const email = document.querySelector(
        "#email"
    ).value.trim().toLowerCase();

    const haslo = document.querySelector(
        "#haslo"
    ).value;

    komunikat.textContent = "Rejestrowanie...";
    komunikat.style.color = "";

    try {
        const odpowiedz = await fetch(
            "/api/rejestracja",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    nazwa,
                    email,
                    haslo
                })
            }
        );

        const dane = await odpowiedz.json();

        if (!odpowiedz.ok) {
            komunikat.textContent =
                `Błąd: ${dane.blad || "Nie udało się zarejestrować"}`;

            return;
        }

        komunikat.textContent =
            "Konto utworzone. Możesz się teraz zalogować.";

        komunikat.style.color = "green";

        formularz.reset();

        setTimeout(() => {
            window.location.href = "logowanie.html";
        }, 1200);

    } catch (blad) {
        console.error("Błąd rejestracji:", blad);

        komunikat.textContent =
            "Nie udało się połączyć z serwerem.";

        komunikat.style.color = "red";
    }
});
