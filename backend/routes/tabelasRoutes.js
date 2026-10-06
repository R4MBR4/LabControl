const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const [tableRows] = await pool.query('SHOW TABLES;');
    const tableNames = tableRows.map(r => Object.values(r)[0]);
    const currentTable = req.query.tabela || tableNames[0] || 'usuario';

    let columns = [];
    let rows = [];

    if (tableNames.includes(currentTable)) {
      const [colRows] = await pool.query(`SHOW COLUMNS FROM \`${currentTable}\`;`);
      columns = colRows.map(c => c.Field);
      const [dataRows] = await pool.query(`SELECT * FROM \`${currentTable}\` LIMIT 100;`);
      rows = dataRows;
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>LabControl - Visualizador do Banco de Dados</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen p-6 font-sans">
  <div class="max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Conectado ao TiDB Cloud (AWS São Paulo)
        </div>
        <h1 class="text-2xl font-bold tracking-tight">Visualizador de Tabelas do Banco de Dados</h1>
        <p class="text-slate-400 text-xs mt-1">Base ativa: <span class="font-mono text-emerald-400 font-semibold">${process.env.DB_NAME || 'labcontrol'}</span> | Host: <span class="font-mono text-slate-300">${process.env.DB_HOST}</span></p>
      </div>
      <a href="http://localhost:3000" class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl transition shadow">
        Ir para a Plataforma Web →
      </a>
    </div>

    <!-- Navegação pelas 9 tabelas -->
    <div class="flex flex-wrap gap-2">
      ${tableNames.map(name => `
        <a href="/tabelas?tabela=${name}" class="px-4 py-2 rounded-xl text-xs font-semibold transition ${name === currentTable ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'}">
          ${name}
        </a>
      `).join('')}
    </div>

    <!-- Tabela de Dados -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Tabela: <span class="text-teal-600">${currentTable}</span> (${rows.length} registros)
        </h2>
        <span class="text-xs text-slate-500">Dados lidos em tempo real da nuvem</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              ${columns.map(c => `<th class="p-3 border-r border-slate-200 last:border-0">${c}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-800">
            ${rows.length === 0 ? `
              <tr>
                <td colspan="${columns.length || 1}" class="p-6 text-center text-slate-400">Nenhum registro encontrado nesta tabela.</td>
              </tr>
            ` : rows.map(r => `
              <tr class="hover:bg-slate-50 transition">
                ${columns.map(c => {
                  let val = r[c];
                  if (val === null || val === undefined) val = '<span class="text-slate-300 italic">null</span>';
                  else if (typeof val === 'object') val = JSON.stringify(val);
                  else if (c === 'senha') val = '<span class="font-mono text-[10px] text-slate-400">●●●●●● (hash bcrypt)</span>';
                  return `<td class="p-3 border-r border-slate-100 last:border-0">${val}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    res.status(500).send(`Erro ao carregar visualizador de tabelas: ${err.message}`);
  }
});

module.exports = router;
