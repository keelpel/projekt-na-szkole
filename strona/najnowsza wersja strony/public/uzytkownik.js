const menu = document.querySelector("#menu-uzytkownika");
const status = document.querySelector("#status-uzytkownika");
const linkLogowanie = document.querySelector("#link-logowanie");
const linkRejestracja = document.querySelector("#link-rejestracja");

function pokazLinkiGoscia(pokaz) {
    if (linkLogowanie) linkLogowanie.hidden = !pokaz;
    if (linkRejestracja) linkRejestracja.hidden = !pokaz;
}

async function pokazStatusUzytkownika() {
    if (!menu || !status) {
        console.error(
            "Brak #menu-uzytkownika albo #status-uzytkownika w index.html"
        );
        return;
    }

    try {
        const odpowiedz = await fetch("/api/uzytkownik", {
            credentials: "include",
            cache: "no-store"
        });

        const dane = await odpowiedz.json();

        if (!dane.zalogowany) {
            status.textContent = "Gość";
            pokazLinkiGoscia(true);
            return;
        }

        status.textContent =
            `Zalogowano jako: ${dane.uzytkownik.nazwa}`;
        pokazLinkiGoscia(false);

        const linkLeaderboard = document.createElement("a");
        linkLeaderboard.href = "leaderboard.html";
        linkLeaderboard.textContent = "Leaderboard";

        const linkProfil = document.createElement("a");
        linkProfil.href = "profil.html";
        linkProfil.textContent = "Mój profil";

        const przyciskWyloguj = document.createElement("button");
        przyciskWyloguj.type = "button";
        przyciskWyloguj.textContent = "Wyloguj się";

        przyciskWyloguj.addEventListener(
            "click",
            wylogujUzytkownika
        );

        menu.appendChild(linkLeaderboard);
        menu.appendChild(linkProfil);
        menu.appendChild(przyciskWyloguj);
    } catch (error) {
        console.error("Błąd sprawdzania statusu:", error);
        status.textContent = "Nie można sprawdzić statusu";
        pokazLinkiGoscia(true);
    }
}

async function wylogujUzytkownika() {
    try {
        const odpowiedz = await fetch("/api/wylogowanie", {
            method: "POST",
            credentials: "include"
        });

        const dane = await odpowiedz.json();

        if (!odpowiedz.ok) {
            throw new Error(
                dane.blad || "Nie udało się wylogować"
            );
        }

        window.location.href = "index.html";
    } catch (error) {
        console.error("Błąd wylogowania:", error);
        alert(error.message);
    }
}

pokazStatusUzytkownika();
