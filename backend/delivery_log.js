import 'dotenv/config';
import express from 'express';
import sqlite3pkg from 'sqlite3';

const sqlite3 = sqlite3pkg.verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./logs.db', (err) => {
    if (err) console.error("Erro ao conectar ao banco:", err);
    else console.log("Conectado ao logs.db");
});

db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entrega_id INTEGER NOT NULL,
    condominho_id INTEGER NOT NULL,
    locker_id INTEGER NOT NULL,
    compartimento_id INTEGER NOT NULL,
    tamanho TEXT NOT NULL CHECK(tamanho IN ('P', 'M', 'G', 'XG')),
    evento TEXT NOT NULL CHECK(evento IN ('entrega', 'retirada')),
    data_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

const dbAll = (sql, params = []) => new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
);

const dbRun = (sql, params = []) => new Promise((resolve, reject) =>
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); })
);

// Busca logs de um condômino (antes do genérico)
app.get('/logs/condominho/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await dbAll("SELECT * FROM logs WHERE condominho_id = ?", [id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Lista todos os logs
app.get('/logs', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM logs");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Registra log
app.post('/logs', async (req, res) => {
    try {
        const { entrega_id, condominho_id, locker_id, compartimento_id, tamanho, evento } = req.body;
        if (!entrega_id || !condominho_id || !locker_id || !compartimento_id || !tamanho || !evento) {
            return res.status(400).json({ erro: "Dados incompletos para registrar log." });
        }
        const result = await dbRun(
            "INSERT INTO logs (entrega_id, condominho_id, locker_id, compartimento_id, tamanho, evento) VALUES (?, ?, ?, ?, ?, ?)",
            [entrega_id, condominho_id, locker_id, compartimento_id, tamanho, evento]
        );
        res.status(201).json({ mensagem: "Log registrado com sucesso!", id: result.lastID });
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

app.listen(3004, () => console.log('Serviço de Logs rodando na porta 3004'));
