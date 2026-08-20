import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json());

// Simula abertura do compartimento imprimindo no terminal
app.post('/abrir', (req, res) => {
    const { locker_id, compartimento_id } = req.body;
    if (!locker_id || !compartimento_id) {
        return res.status(400).json({ erro: "Informe locker_id e compartimento_id." });
    }
    console.log(`[ABERTURA] Locker ${locker_id} — Compartimento ${compartimento_id} ABERTO`);
    res.json({ mensagem: "Compartimento aberto com sucesso." });
});

app.listen(3005, () => console.log('Serviço de Abertura rodando na porta 3005'));
