import 'dotenv/config';
import express from 'express';
import sqlite3pkg from 'sqlite3';
import axios from 'axios';

const sqlite3 = sqlite3pkg.verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./deliveries.db', (err) => {
    if (err) console.error("Erro ao conectar ao banco:", err);
    else console.log("Conectado ao deliveries.db");
});

db.run(`CREATE TABLE IF NOT EXISTS entregas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    locker_id INTEGER NOT NULL,
    compartimento_id INTEGER NOT NULL,
    condominho_id INTEGER NOT NULL,
    tamanho TEXT NOT NULL CHECK(tamanho IN ('P', 'M', 'G', 'XG')),
    status TEXT NOT NULL DEFAULT 'aguardando' CHECK(status IN ('aguardando', 'retirada')),
    data_entrega TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_retirada TIMESTAMP
)`);

const dbAll = (sql, params = []) => new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
);

const dbRun = (sql, params = []) => new Promise((resolve, reject) =>
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); })
);

// Busca entregas de um condômino (antes do :id genérico)
app.get('/entregas/condominho/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await dbAll("SELECT * FROM entregas WHERE condominho_id = ?", [id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Busca entrega por ID
app.get('/entregas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await dbAll("SELECT * FROM entregas WHERE id = ?", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ erro: "Entrega não encontrada." });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Lista todas as entregas
app.get('/entregas', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM entregas");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Registra entrega
app.post('/entregas', async (req, res) => {
    try {
        const { locker_id, condominho_id, tamanho } = req.body;
        if (!locker_id || !condominho_id || !tamanho) {
            return res.status(400).json({ erro: "Informe locker_id, condominho_id e tamanho." });
        }

        // Verifica se o condômino existe
        try {
            await axios.get(`http://localhost:3002/condominhos/${condominho_id}`);
        } catch {
            return res.status(404).json({ erro: "Condômino não encontrado." });
        }

        // Busca compartimento disponível com o tamanho certo
        let compartimento;
        try {
            const resp = await axios.get(`http://localhost:3001/compartimentos/disponiveis?locker_id=${locker_id}&tamanho=${tamanho}`);
            if (!resp.data || resp.data.length === 0) {
                return res.status(404).json({ erro: "Nenhum compartimento disponível." });
            }
            compartimento = resp.data[0];
        } catch {
            return res.status(404).json({ erro: "Nenhum compartimento disponível." });
        }

        // Insere entrega
        const result = await dbRun(
            "INSERT INTO entregas (locker_id, compartimento_id, condominho_id, tamanho) VALUES (?, ?, ?, ?)",
            [locker_id, compartimento.id, condominho_id, tamanho]
        );
        const entrega_id = result.lastID;

        // Marca compartimento como ocupado
        await axios.patch(`http://localhost:3001/compartimentos/${compartimento.id}`, { status: 'ocupado' });

        // Registra log
        await axios.post('http://localhost:3004/logs', {
            entrega_id, condominho_id, locker_id,
            compartimento_id: compartimento.id,
            tamanho, evento: 'entrega'
        });

        res.status(201).json({
            mensagem: "Entrega registrada com sucesso!",
            id: entrega_id,
            compartimento_id: compartimento.id,
            status: 'aguardando'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Retirada de entrega
app.patch('/entregas/:id/retirar', async (req, res) => {
    try {
        const { id } = req.params;

        // Busca entrega
        const rows = await dbAll("SELECT * FROM entregas WHERE id = ?", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ erro: "Entrega não encontrada." });
        }
        const entrega = rows[0];

        // Verifica se já foi retirada
        if (entrega.status === 'retirada') {
            return res.status(400).json({ erro: "Entrega já foi retirada." });
        }

        // Abre o compartimento
        await axios.post('http://localhost:3005/abrir', {
            locker_id: entrega.locker_id,
            compartimento_id: entrega.compartimento_id
        });

        // Atualiza status da entrega
        await dbRun(
            "UPDATE entregas SET status = 'retirada', data_retirada = CURRENT_TIMESTAMP WHERE id = ?",
            [id]
        );

        // Libera compartimento
        await axios.patch(`http://localhost:3001/compartimentos/${entrega.compartimento_id}`, { status: 'livre' });

        // Registra log
        await axios.post('http://localhost:3004/logs', {
            entrega_id: entrega.id,
            condominho_id: entrega.condominho_id,
            locker_id: entrega.locker_id,
            compartimento_id: entrega.compartimento_id,
            tamanho: entrega.tamanho,
            evento: 'retirada'
        });

        const updated = await dbAll("SELECT * FROM entregas WHERE id = ?", [id]);
        res.json({ mensagem: "Entrega retirada com sucesso!", ...updated[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

app.listen(3003, () => console.log('Serviço de Entregas rodando na porta 3003'));
