import 'dotenv/config';
import express from 'express';
import sqlite3pkg from 'sqlite3';

const sqlite3 = sqlite3pkg.verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./lockers.db', (err) => {
    if (err) console.error("Erro ao conectar ao banco:", err);
    else console.log("Conectado ao lockers.db");
});

db.run(`CREATE TABLE IF NOT EXISTS lockers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_condominio TEXT NOT NULL,
    localizacao TEXT NOT NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS compartimentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    locker_id INTEGER NOT NULL,
    tamanho TEXT NOT NULL CHECK(tamanho IN ('P', 'M', 'G', 'XG')),
    status TEXT NOT NULL DEFAULT 'livre' CHECK(status IN ('livre', 'ocupado')),
    FOREIGN KEY (locker_id) REFERENCES lockers(id)
)`);

const dbAll = (sql, params = []) => new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
);

const dbRun = (sql, params = []) => new Promise((resolve, reject) =>
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); })
);

// Lista compartimentos disponíveis (antes do :id genérico)
app.get('/compartimentos/disponiveis', async (req, res) => {
    try {
        const { locker_id, tamanho } = req.query;
        let sql = "SELECT * FROM compartimentos WHERE status = 'livre'";
        const params = [];
        if (locker_id) { sql += " AND locker_id = ?"; params.push(locker_id); }
        if (tamanho) { sql += " AND tamanho = ?"; params.push(tamanho); }
        const rows = await dbAll(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

//Atualiza status do compartimento
app.patch('/compartimentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !["livre", "ocupado"].includes(status)) {
            return res.status(400).json({ erro: "Informe um status válido: 'livre' ou 'ocupado'." });
        }
        const compartimento = await dbAll("SELECT * FROM compartimentos WHERE id = ?", [id]);
        if (compartimento.length === 0) {
            return res.status(404).json({ erro: "Compartimento não encontrado." });
        }
        await dbRun("UPDATE compartimentos SET status = ? WHERE id = ?", [status, id]);
        res.json({ mensagem: "Status do compartimento atualizado com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Cadastro
app.post('/lockers', async (req, res) => {
    try {
        const { nome_condominio, localizacao } = req.body;
        if (!nome_condominio || !localizacao) {
            return res.status(400).json({ erro: "Informe o condomínio e a localização." });
        }
        const result = await dbRun(
            "INSERT INTO lockers (nome_condominio, localizacao) VALUES (?, ?)",
            [nome_condominio, localizacao]
        );
        res.status(201).json({ mensagem: "Locker cadastrado com sucesso!", id: result.lastID });
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Lista todos os lockers
app.get('/lockers', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM lockers");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Buscar o locker por ID
app.get('/lockers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await dbAll("SELECT * FROM lockers WHERE id = ?", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ erro: "Locker não encontrado." });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Atualização
app.patch('/lockers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome_condominio, localizacao } = req.body;
        if (!nome_condominio && !localizacao) {
            return res.status(400).json({ erro: "Informe pelo menos um campo para atualizar." });
        }
        const fields = [];
        const params = [];
        if (nome_condominio) { fields.push("nome_condominio = ?"); params.push(nome_condominio); }
        if (localizacao) { fields.push("localizacao = ?"); params.push(localizacao); }
        params.push(id);
        await dbRun(`UPDATE lockers SET ${fields.join(", ")} WHERE id = ?`, params);
        res.json({ mensagem: "Locker atualizado com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

//Adiciona compartimento ao locker
app.post('/lockers/:id/compartimentos', async (req, res) => {
    try {
        const { id } = req.params;
        const { tamanho } = req.body;
        if (!tamanho) {
            return res.status(400).json({ erro: "Informe o tamanho do compartimento." });
        }
        const locker = await dbAll("SELECT * FROM lockers WHERE id = ?", [id]);
        if (locker.length === 0) {
            return res.status(404).json({ erro: "Locker não encontrado." });
        }
        const result = await dbRun(
            "INSERT INTO compartimentos (locker_id, tamanho) VALUES (?, ?)",
            [id, tamanho]
        );
        res.status(201).json({ mensagem: "Compartimento adicionado com sucesso!", id: result.lastID });
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

//Busca primeiro compartimento livre (uso interno)
app.get('/lockers/:id/compartimentos/livre', async (req, res) => {
    try {
        const { id } = req.params;
        const locker = await dbAll("SELECT * FROM lockers WHERE id = ?", [id]);
        if (locker.length === 0) {
            return res.status(404).json({ erro: "Locker não encontrado." });
        }
        const compartimento = await dbAll(
            "SELECT * FROM compartimentos WHERE locker_id = ? AND status = 'livre' LIMIT 1",
            [id]
        );
        if (compartimento.length === 0) {
            return res.status(404).json({ erro: "Nenhum compartimento livre encontrado." });
        }
        res.json(compartimento[0]);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

//Lista compartimentos do locker
app.get('/lockers/:id/compartimentos', async (req, res) => {
    try {
        const { id } = req.params;
        const locker = await dbAll("SELECT * FROM lockers WHERE id = ?", [id]);
        if (locker.length === 0) {
            return res.status(404).json({ erro: "Locker não encontrado." });
        }
        const compartimentos = await dbAll("SELECT * FROM compartimentos WHERE locker_id = ?", [id]);
        res.json(compartimentos);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

app.listen(3001, () => console.log('Serviço de Lockers rodando na porta 3001'));
