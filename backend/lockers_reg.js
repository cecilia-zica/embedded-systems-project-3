import 'dotenv/config';
import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const app = express();

const db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

app.use(express.json());

// Rota para CADASTRAR um novo locker (POST)
app.post('/lockers', async (req, res) => {
    try {
        // 1. Pegamos os dados que o usuário enviou no corpo da requisição (req.body)
        const { nome_condominio, localizacao } = req.body;

        // 2. Verificar se enviaram os dados obrigatórios
        if (!nome_condominio || !localizacao) {
            return res.status(400).json({ erro: "Faltam dados! Informe o condomínio e a localização." });
        }

        // 3. Query para inserção no banco
        const query = "INSERT INTO lockers (nome_condominio, localizacao) VALUES ($1, $2) RETURNING id";

        // 4. Executamos o comando no banco de dados
        const resultado = await db.query(query, [nome_condominio, localizacao]);

        res.status(201).json({
            mensagem: "Locker cadastrado com sucesso!",
            id_locker: resultado.rows[0].id
        });
    } catch (erro) {
        console.error("Erro ao cadastrar locker:", erro);
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

app.listen(3001, () => {
    console.log('Serviço de Cadastro de Lockers rodando na porta 3001');
});
