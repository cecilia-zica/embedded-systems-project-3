import 'dotenv/config';
import express from 'express';
import sqlite3pkg from 'sqlite3';

const sqlite3 = sqlite3pkg.verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./residents.db', (err) => {
    if (err) console.error("Erro ao conectar ao banco:", err);
    else console.log("Conectado ao residents.db");
});

db.run(`CREATE TABLE IF NOT EXISTS condominhos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    unidade TEXT NOT NULL,
    locker_id INTEGER NOT NULL
)`);

const dbAll = (sql, params = []) => new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
);

const dbRun = (sql, params = []) => new Promise((resolve, reject) =>
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); })
);

// Cadastro
app.post('/condominhos', async (req, res) => {
    try {
        const { nome, email, unidade, locker_id } = req.body;
        if (!nome || !email || !unidade || !locker_id) {
            return res.status(400).json({ erro: "Informe nome, email, unidade e locker_id." });
        }
        const result = await dbRun(
            "INSERT INTO condominhos (nome, email, unidade, locker_id) VALUES (?, ?, ?, ?)",
            [nome, email, unidade, locker_id]
        );
        res.status(201).json({ mensagem: "Condômino cadastrado com sucesso!", id: result.lastID });
    } catch (err) {
        console.error("Erro POST /condominhos:", err.message);
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Lista todos os condôminos
app.get('/condominhos', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM condominhos");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Busca condômino por ID
app.get('/condominhos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await dbAll("SELECT * FROM condominhos WHERE id = ?", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ erro: "Condômino não encontrado." });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Atualização
app.patch('/condominhos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, email, unidade, locker_id } = req.body;
        if (!nome && !email && !unidade && !locker_id) {
            return res.status(400).json({ erro: "Informe pelo menos um campo para atualizar." });
        }
        const fields = [];
        const params = [];
        if (nome) { fields.push("nome = ?"); params.push(nome); }
        if (email) { fields.push("email = ?"); params.push(email); }
        if (unidade) { fields.push("unidade = ?"); params.push(unidade); }
        if (locker_id) { fields.push("locker_id = ?"); params.push(locker_id); }
        params.push(id);
        await dbRun(`UPDATE condominhos SET ${fields.join(", ")} WHERE id = ?`, params);
        res.json({ mensagem: "Condômino atualizado com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Remove condômino
app.delete('/condominhos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await dbAll("SELECT * FROM condominhos WHERE id = ?", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ erro: "Condômino não encontrado." });
        }
        await dbRun("DELETE FROM condominhos WHERE id = ?", [id]);
        res.json({ mensagem: "Condômino removido com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

app.listen(3002, () => console.log('Serviço de Condôminos rodando na porta 3002'));
