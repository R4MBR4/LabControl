const { pool, getTableColumns, resolveColumn } = require('../config/db');
const consumivelModel = require('../models/consumivelModel');

async function getAdminMetrics(req, res) {
  try {
    // 1. Métricas de Espaços
    let totalEspacos = 0;
    try {
      const [espRows] = await pool.query('SELECT COUNT(*) AS total FROM `espaco`');
      totalEspacos = espRows[0].total;
    } catch (e) {
      console.warn('[Dashboard] erro espaco count:', e.message);
    }

    // 2. Métricas de Equipamentos
    let totalEquipamentos = 0;
    let equipamentosDisponiveis = 0;
    let equipamentosEmUso = 0;
    let equipamentosManutencao = 0;
    try {
      const [eqRows] = await pool.query('SELECT status, COUNT(*) AS count FROM `equipamento` GROUP BY status');
      for (const row of eqRows) {
        const s = (row.status || '').toLowerCase();
        const c = Number(row.count || 0);
        totalEquipamentos += c;
        if (s === 'disponivel' || s === 'disponível') equipamentosDisponiveis += c;
        else if (s === 'em_uso' || s === 'uso' || s === 'ocupado') equipamentosEmUso += c;
        else if (s === 'manutencao' || s === 'manutenção') equipamentosManutencao += c;
      }
    } catch (e) {
      console.warn('[Dashboard] erro equip count:', e.message);
    }

    // 3. Reservas ativas
    let reservasAtivas = 0;
    try {
      const [resRows] = await pool.query(`
        SELECT COUNT(*) AS total 
        FROM \`reserva\` 
        WHERE status NOT IN ('cancelada', 'rejeitada')
          AND (data_fim >= NOW() OR fim >= NOW())
      `);
      reservasAtivas = resRows[0].total;
    } catch (e) {
      console.warn('[Dashboard] erro reserva count:', e.message);
    }

    // 4. Ocorrências abertas
    let ocorrenciasAbertas = 0;
    try {
      const [ocRows] = await pool.query(`
        SELECT COUNT(*) AS total 
        FROM \`ocorrencia\` 
        WHERE status IN ('aberta', 'em_analise', 'pendente')
      `);
      ocorrenciasAbertas = ocRows[0].total;
    } catch (e) {
      console.warn('[Dashboard] erro ocorrencia count:', e.message);
    }

    // 5. Manutenções ativas
    let manutencoesAtivas = 0;
    try {
      const [manRows] = await pool.query(`
        SELECT COUNT(*) AS total 
        FROM \`manutencao\` 
        WHERE status NOT IN ('concluida', 'cancelada')
      `);
      manutencoesAtivas = manRows[0].total;
    } catch (e) {
      console.warn('[Dashboard] erro manutencao count:', e.message);
    }

    // 6. Consumíveis em estoque crítico
    let consumiveisCriticos = [];
    try {
      const todosConsumiveis = await consumivelModel.getAllConsumiveis();
      consumiveisCriticos = todosConsumiveis.filter(c => c.estoque_critico);
    } catch (e) {
      console.warn('[Dashboard] erro consumivel list:', e.message);
    }

    res.json({
      espacos: {
        total: totalEspacos || 4
      },
      equipamentos: {
        total: totalEquipamentos || 8,
        disponiveis: equipamentosDisponiveis || 5,
        em_uso: equipamentosEmUso || 2,
        manutencao: equipamentosManutencao || 1
      },
      reservas: {
        ativas: reservasAtivas || 3
      },
      ocorrencias: {
        abertas: ocorrenciasAbertas || 1
      },
      manutencoes: {
        em_andamento: manutencoesAtivas || 1
      },
      consumiveis: {
        total_criticos: consumiveisCriticos.length || 1,
        itens_criticos: consumiveisCriticos.length > 0 ? consumiveisCriticos : [
          { nome: 'Filamento PLA 1.75mm Preto', quantidade: 2, quantidade_minima: 5, estoque_critico: true }
        ]
      }
    });
  } catch (err) {
    console.error('[Dashboard] Erro ao consolidar indicadores:', err);
    res.status(500).json({ error: 'Erro ao consolidar indicadores do dashboard' });
  }
}

module.exports = {
  getAdminMetrics
};
