const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

process.env.JWT_SECRET = 'test-only-secret-for-table-viewer-authorization';

const { generateToken } = require('./middlewares/auth');
const { pool } = require('./config/db');
const usuarioModel = require('./models/usuarioModel');
const tabelasRoutes = require('./routes/tabelasRoutes');

async function request(server, token) {
  const address = server.address();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/tabelas',
      headers
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
  });
}

async function testTableViewerRequiresAdmin() {
  const app = express();
  app.use('/tabelas', tabelasRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const originalQuery = pool.query;
  const originalGetUserById = usuarioModel.getUserById;
  let queryCount = 0;

  usuarioModel.getUserById = async (id) => ({
    id,
    nome: id === 1 ? 'Admin' : 'Usuário',
    perfil: id === 1 ? 'administrador' : 'usuario',
    status: 'ativo'
  });
  pool.query = async (sql) => {
    queryCount += 1;
    if (sql === 'SHOW TABLES;') return [[{ Tables_in_labcontrol: 'usuario' }]];
    if (sql.includes('SHOW COLUMNS')) return [[{ Field: 'id' }, { Field: 'nome' }]];
    if (sql.includes('SELECT *')) return [[{ id: 17, nome: 'Registro protegido' }]];
    throw new Error(`Query inesperada: ${sql}`);
  };

  try {
    const unauthenticated = await request(server);
    assert.equal(unauthenticated.status, 401);
    assert.equal(queryCount, 0, 'Requisições anônimas não devem executar consultas.');

    const userToken = generateToken({ id: 4, nome: 'Usuário', perfil: 'usuario' });
    const forbidden = await request(server, userToken);
    assert.equal(forbidden.status, 403);
    assert.equal(queryCount, 0, 'Usuários comuns não devem executar consultas.');

    const adminToken = generateToken({ id: 1, nome: 'Admin', perfil: 'administrador' });
    const allowed = await request(server, adminToken);
    assert.equal(allowed.status, 200);
    assert.match(allowed.body, /Registro protegido/);
    assert.equal(queryCount, 3);
  } finally {
    pool.query = originalQuery;
    usuarioModel.getUserById = originalGetUserById;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

testTableViewerRequiresAdmin()
  .then(() => console.log('Testes de autorização do visualizador de tabelas passaram.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
