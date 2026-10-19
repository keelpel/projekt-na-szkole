const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const db = new sqlite3.Database(
    path.join(__dirname, "baza.db")
);

app.use(express.static(__dirname));

app.get("/dane", (req, res) => {
    db.all("SELECT * FROM pytania LIMIT 20", [], (err, rows) => {
        if (err) {
            return res.status(500).send(err.message);
        }

        res.json(rows);
    });
});

app.listen(3000, () => {
    console.log("Strona działa: http://localhost:3000");
});