import express from 'express';
import httpProxy from 'express-http-proxy';

const app = express();

function selectProxyHost(req) {
    if (req.path.startsWith('/lockers'))        return 'http://localhost:3001';
    if (req.path.startsWith('/compartimentos')) return 'http://localhost:3001';
    if (req.path.startsWith('/condominhos'))    return 'http://localhost:3002';
    if (req.path.startsWith('/entregas'))       return 'http://localhost:3003';
    if (req.path.startsWith('/logs'))           return 'http://localhost:3004';
    if (req.path.startsWith('/abrir'))          return 'http://localhost:3005';
    return null;
}

app.use((req, res, next) => {
    const host = selectProxyHost(req);
    if (!host) return res.status(404).json({ erro: "Rota não encontrada." });
    httpProxy(host)(req, res, next);
});

app.listen(3000, () => console.log('API Gateway rodando na porta 3000'));
