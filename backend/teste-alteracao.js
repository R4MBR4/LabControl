const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function executarTeste(acao) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
  });

  try {
    if (acao === 'adicionar') {
      console.log('\n[1] Adicionando coluna "telefone" na tabela "usuario" no TiDB Cloud...');
      await connection.query('ALTER TABLE usuario ADD COLUMN telefone VARCHAR(20) NULL;');
      console.log('✅ SUCESSO: Coluna "telefone" criada no banco na nuvem!');
    } else if (acao === 'remover') {
      console.log('\n[2] Removendo coluna "telefone" da tabela "usuario" no TiDB Cloud...');
      await connection.query('ALTER TABLE usuario DROP COLUMN telefone;');
      console.log('✅ SUCESSO: Coluna "telefone" deletada do banco na nuvem!');
    }

    // Exibe as colunas atuais da tabela usuario no TiDB Cloud
    console.log('\n--- COLUNAS ATUAIS DA TABELA "usuario" NO TiDB CLOUD: ---');
    const [colunas] = await connection.query('SHOW COLUMNS FROM usuario;');
    console.table(colunas.map(c => ({ Campo: c.Field, Tipo: c.Type })));

  } catch (error) {
    console.error('Erro na execução:', error.message);
  } finally {
    await connection.end();
  }
}

const acao = process.argv[2] || 'adicionar';
executarTeste(acao);
