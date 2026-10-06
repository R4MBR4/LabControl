const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const { testConnection } = require('./config/db');

// Importação das rotas
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const espacoRoutes = require('./routes/espacoRoutes');
const equipamentoRoutes = require('./routes/equipamentoRoutes');
const reservaRoutes = require('./routes/reservaRoutes');
const utilizacaoRoutes = require('./routes/utilizacaoRoutes');
const ocorrenciaRoutes = require('./routes/ocorrenciaRoutes');
const manutencaoRoutes = require('./routes/manutencaoRoutes');
const consumivelRoutes = require('./routes/consumivelRoutes');
const capacitacaoRoutes = require('./routes/capacitacaoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const tabelasRoutes = require('./routes/tabelasRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');
const integracaoRoutes = require('./routes/integracaoRoutes');
const buscaRoutes = require('./routes/buscaRoutes');
const notificacaoRoutes = require('./routes/notificacaoRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares essenciais
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de verificação de integridade (Health Check)
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'ok',
    sistema: 'LabControl API',
    database_connected: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Registro de endpoints RESTful
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/espacos', espacoRoutes);
app.use('/api/equipamentos', equipamentoRoutes);
app.use('/api/reservas', reservaRoutes);
app.use('/api/utilizacoes', utilizacaoRoutes);
app.use('/api/ocorrencias', ocorrenciaRoutes);
app.use('/api/manutencoes', manutencaoRoutes);
app.use('/api/consumiveis', consumivelRoutes);
app.use('/api/capacitacoes', capacitacaoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventarios', inventarioRoutes);
app.use('/api/integracao', integracaoRoutes);
app.use('/api/busca', buscaRoutes);
app.use('/api/notificacoes', notificacaoRoutes);
app.use('/tabelas', tabelasRoutes);

// Rota 404 para endpoints inexistentes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Rota da API não encontrada: ${req.method} ${req.originalUrl}` });
});

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
  console.error('[Servidor] Erro não tratado:', err);
  res.status(500).json({ 
    error: 'Ocorreu um erro interno no servidor',
    detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Inicialização do servidor
app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`  LabControl Backend API rodando na porta ${PORT}`);
  console.log(`  Ambiente: ${process.env.NODE_ENV || 'production'}`);
  console.log(`====================================================`);
  await testConnection();
});
