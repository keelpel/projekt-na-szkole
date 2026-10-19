const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./baza.db", (err) => {
    if (err) {
        console.error("Błąd połączenia:", err.message);
    } else {
        console.log("Połączono z bazą danych!");
    }
});

module.exports = db;