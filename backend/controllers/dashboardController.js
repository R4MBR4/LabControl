const { pool } = require('../config/db');

function asNumber(value) {
  return Number(value || 0);
}

async function getAdminMetrics(req, res) {
  try {
    const queries = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('disponivel', 'disponível') AND COALESCE(inativo, 0) = 0 THEN 1 ELSE 0 END) AS disponiveis,
          SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('em_uso', 'uso', 'ocupado') AND COALESCE(inativo, 0) = 0 THEN 1 ELSE 0 END) AS em_uso,
          SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('manutencao', 'manutenção', 'em_manutencao') AND COALESCE(inativo, 0) = 0 THEN 1 ELSE 0 END) AS manutencao,
          SUM(CASE WHEN COALESCE(inativo, 0) = 1 OR LOWER(COALESCE(status, '')) = 'inativo' THEN 1 ELSE 0 END) AS inativos
        FROM equipamento
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN LOWER(COALESCE(s.status, '')) IN ('disponivel', 'disponível') AND NOT (
            EXISTS (
              SELECT 1 FROM reserva r
              WHERE r.espaco_id = s.id
                AND r.status IN ('confirmada', 'em_andamento')
                AND NOW() BETWEEN r.data_inicio AND r.data_fim
            ) OR EXISTS (
              SELECT 1 FROM utilizacao u
              JOIN equipamento e ON e.id = u.equipamento_id
              WHERE e.espaco_id = s.id AND u.status = 'em_uso'
            )
          ) THEN 1 ELSE 0 END) AS disponiveis,
          SUM(CASE WHEN
            EXISTS (
              SELECT 1 FROM reserva r
              WHERE r.espaco_id = s.id
                AND r.status IN ('confirmada', 'em_andamento')
                AND NOW() BETWEEN r.data_inicio AND r.data_fim
            ) OR EXISTS (
              SELECT 1 FROM utilizacao u
              JOIN equipamento e ON e.id = u.equipamento_id
              WHERE e.espaco_id = s.id AND u.status = 'em_uso'
            ) OR LOWER(COALESCE(s.status, '')) IN ('ocupado', 'em_uso')
          THEN 1 ELSE 0 END) AS ocupados,
          SUM(CASE WHEN LOWER(COALESCE(s.status, '')) NOT IN ('disponivel', 'disponível', 'ocupado', 'em_uso')
            THEN 1 ELSE 0 END) AS indisponiveis
        FROM espaco s
      `),
      pool.query(`
        SELECT
          SUM(CASE WHEN DATE(data_inicio) = CURDATE()
            AND LOWER(COALESCE(status, '')) NOT IN ('cancelada', 'cancelado', 'no_show') THEN 1 ELSE 0 END) AS hoje,
          SUM(CASE WHEN data_inicio > NOW()
            AND LOWER(COALESCE(status, '')) NOT IN ('cancelada', 'cancelado', 'no_show') THEN 1 ELSE 0 END) AS futuras,
          SUM(CASE WHEN data_inicio <= NOW() AND data_fim >= NOW()
            AND LOWER(COALESCE(status, '')) IN ('confirmada', 'em_andamento') THEN 1 ELSE 0 END) AS em_andamento,
          SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('cancelada', 'cancelado') THEN 1 ELSE 0 END) AS canceladas,
          SUM(CASE WHEN COALESCE(no_show, 0) = 1 OR LOWER(COALESCE(status, '')) = 'no_show' THEN 1 ELSE 0 END) AS no_show
        FROM reserva
      `),
      pool.query(`
        SELECT
          SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('aberta', 'em_analise', 'pendente') THEN 1 ELSE 0 END) AS abertas,
          SUM(CASE WHEN data_registro >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS recentes
        FROM ocorrencia
      `),
      pool.query(`
        SELECT LOWER(COALESCE(gravidade, 'sem_gravidade')) AS gravidade, COUNT(*) AS total
        FROM ocorrencia
        WHERE LOWER(COALESCE(status, '')) IN ('aberta', 'em_analise', 'pendente')
        GROUP BY LOWER(COALESCE(gravidade, 'sem_gravidade'))
      `),
      pool.query(`
        SELECT COUNT(DISTINCT o.id) AS total
        FROM ocorrencia o
        JOIN manutencao m ON m.equipamento_id = o.equipamento_id
        WHERE LOWER(COALESCE(o.status, '')) IN ('aberta', 'em_analise', 'pendente')
          AND LOWER(COALESCE(m.status, '')) NOT IN ('concluida', 'concluído', 'concluido', 'cancelada', 'cancelado')
      `),
      pool.query(`
        SELECT
          SUM(CASE WHEN LOWER(COALESCE(status, '')) NOT IN ('concluida', 'concluído', 'concluido', 'cancelada', 'cancelado') THEN 1 ELSE 0 END) AS abertas,
          SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('concluida', 'concluído', 'concluido') THEN 1 ELSE 0 END) AS concluidas,
          ROUND(AVG(CASE WHEN data_fim IS NOT NULL AND data_inicio IS NOT NULL
            THEN TIMESTAMPDIFF(HOUR, data_inicio, data_fim) END), 1) AS tempo_medio_horas
        FROM manutencao
      `),
      pool.query(`
        SELECT e.id, e.nome, e.codigo_patrimonio, e.patrimonio_ufpi,
               COUNT(m.id) AS total_manutencoes
        FROM manutencao m
        JOIN equipamento e ON e.id = m.equipamento_id
        GROUP BY e.id, e.nome, e.codigo_patrimonio, e.patrimonio_ufpi
        HAVING COUNT(m.id) >= 2
        ORDER BY total_manutencoes DESC, e.nome ASC
        LIMIT 5
      `),
      pool.query(`
        SELECT
          COUNT(*) AS abaixo_minimo,
          SUM(CASE WHEN quantidade <= 0 THEN 1 ELSE 0 END) AS criticos
        FROM consumivel
        WHERE quantidade <= quantidade_minima
      `),
      pool.query(`
        SELECT c.id, c.nome, c.quantidade, c.quantidade_minima, c.unidade,
               s.nome AS espaco_nome
        FROM consumivel c
        LEFT JOIN espaco s ON s.id = c.espaco_id
        WHERE c.quantidade <= c.quantidade_minima
        ORDER BY CASE WHEN c.quantidade <= 0 THEN 0 ELSE 1 END, c.nome ASC
        LIMIT 8
      `),
      pool.query(`
        SELECT COUNT(*) AS total
        FROM capacitacao
        WHERE validade IS NOT NULL AND validade < CURDATE()
          AND LOWER(COALESCE(status, '')) IN ('ativo', 'valido', 'válido', 'aprovado', 'concluido')
      `),
      pool.query(`
        SELECT COUNT(*) AS total
        FROM inventario
        WHERE LOWER(COALESCE(status, '')) IN ('em_andamento', 'em andamento')
      `),
      pool.query(`
        SELECT COUNT(*) AS total
        FROM inventario_item ii
        JOIN inventario i ON i.id = ii.inventario_id
        WHERE LOWER(COALESCE(ii.status_conferencia, '')) = 'divergente'
          AND LOWER(COALESCE(ii.decisao_admin, '')) IN ('pendente', '')
          AND LOWER(COALESCE(i.status, '')) IN ('em_andamento', 'em andamento')
      `),
      pool.query(`
        SELECT COUNT(*) AS total
        FROM (
          SELECT ii.equipamento_id, ii.status_conferencia,
                 ROW_NUMBER() OVER (PARTITION BY ii.equipamento_id ORDER BY i.data_inicio DESC, ii.id DESC) AS posicao
          FROM inventario_item ii
          JOIN inventario i ON i.id = ii.inventario_id
          WHERE LOWER(COALESCE(i.status, '')) = 'concluido'
        ) ultimos
        WHERE posicao = 1 AND LOWER(COALESCE(status_conferencia, '')) = 'nao_localizado'
      `),
      pool.query(`
        SELECT o.id, o.titulo, o.gravidade, o.data_registro,
               e.nome AS equipamento_nome, s.nome AS espaco_nome
        FROM ocorrencia o
        LEFT JOIN equipamento e ON e.id = o.equipamento_id
        LEFT JOIN espaco s ON s.id = o.espaco_id
        WHERE LOWER(COALESCE(o.status, '')) IN ('aberta', 'em_analise', 'pendente')
        ORDER BY o.data_registro DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT m.id, m.tipo, m.descricao, m.data_inicio, m.status,
               e.nome AS equipamento_nome
        FROM manutencao m
        LEFT JOIN equipamento e ON e.id = m.equipamento_id
        WHERE LOWER(COALESCE(m.status, '')) NOT IN ('concluida', 'concluído', 'concluido', 'cancelada', 'cancelado')
        ORDER BY m.data_inicio ASC
        LIMIT 6
      `),
      pool.query(`
        SELECT r.id, COUNT(*) OVER() AS total_proximas,
               r.data_inicio, r.data_fim, r.finalidade,
               u.nome AS usuario_nome, e.nome AS equipamento_nome, s.nome AS espaco_nome
        FROM reserva r
        JOIN usuario u ON u.id = r.usuario_id
        LEFT JOIN equipamento e ON e.id = r.equipamento_id
        LEFT JOIN espaco s ON s.id = COALESCE(r.espaco_id, e.espaco_id)
        WHERE r.data_inicio >= NOW()
          AND r.data_inicio < DATE_ADD(NOW(), INTERVAL 24 HOUR)
          AND LOWER(COALESCE(r.status, '')) IN ('confirmada', 'pendente')
        ORDER BY r.data_inicio ASC
        LIMIT 6
      `),
      pool.query(`
        SELECT r.id, r.data_inicio, r.data_fim, r.finalidade,
               u.nome AS usuario_nome, e.nome AS equipamento_nome, s.nome AS espaco_nome
        FROM reserva r
        JOIN usuario u ON u.id = r.usuario_id
        LEFT JOIN equipamento e ON e.id = r.equipamento_id
        LEFT JOIN espaco s ON s.id = COALESCE(r.espaco_id, e.espaco_id)
        WHERE COALESCE(r.no_show, 0) = 1 OR LOWER(COALESCE(r.status, '')) = 'no_show'
        ORDER BY COALESCE(r.no_show_at, r.data_inicio) DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT u.id, usr.nome AS usuario_nome, e.nome AS recurso_nome,
               s.nome AS espaco_nome, u.data_inicio, r.data_fim AS data_fim_previsto,
               u.reserva_id, 'equipamento' AS tipo_recurso
        FROM utilizacao u
        JOIN usuario usr ON usr.id = u.usuario_id
        LEFT JOIN equipamento e ON e.id = u.equipamento_id
        LEFT JOIN espaco s ON s.id = e.espaco_id
        LEFT JOIN reserva r ON r.id = u.reserva_id
        WHERE LOWER(COALESCE(u.status, '')) = 'em_uso'
        UNION ALL
        SELECT r.id, usr.nome AS usuario_nome, s.nome AS recurso_nome,
               s.nome AS espaco_nome, r.data_inicio, r.data_fim AS data_fim_previsto,
               r.id AS reserva_id, 'espaco' AS tipo_recurso
        FROM reserva r
        JOIN usuario usr ON usr.id = r.usuario_id
        JOIN espaco s ON s.id = r.espaco_id
        WHERE r.equipamento_id IS NULL
          AND r.data_inicio <= NOW() AND r.data_fim >= NOW()
          AND LOWER(COALESCE(r.status, '')) IN ('confirmada', 'em_andamento')
        ORDER BY data_inicio DESC
        LIMIT 8
      `),
      pool.query(`
        SELECT s.nome AS label, COUNT(*) AS total
        FROM utilizacao u
        JOIN equipamento e ON e.id = u.equipamento_id
        JOIN espaco s ON s.id = e.espaco_id
        WHERE u.data_inicio >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY s.id, s.nome
        ORDER BY total DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT e.nome AS label, COUNT(*) AS total
        FROM utilizacao u
        JOIN equipamento e ON e.id = u.equipamento_id
        GROUP BY e.id, e.nome
        ORDER BY total DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT DATE(data_inicio) AS dia, COUNT(*) AS total
        FROM reserva
        WHERE data_inicio >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND LOWER(COALESCE(status, '')) NOT IN ('cancelada', 'cancelado')
        GROUP BY DATE(data_inicio)
        ORDER BY dia ASC
      `),
      pool.query(`
        SELECT DATE(COALESCE(no_show_at, data_inicio)) AS dia, COUNT(*) AS total
        FROM reserva
        WHERE (COALESCE(no_show, 0) = 1 OR LOWER(COALESCE(status, '')) = 'no_show')
          AND COALESCE(no_show_at, data_inicio) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(COALESCE(no_show_at, data_inicio))
        ORDER BY dia ASC
      `),
      pool.query(`
        SELECT LOWER(COALESCE(status, 'sem_status')) AS label, COUNT(*) AS total
        FROM manutencao
        GROUP BY LOWER(COALESCE(status, 'sem_status'))
        ORDER BY total DESC
      `)
    ]);

    const [
      equipamentoRows,
      espacoRows,
      reservaRows,
      ocorrenciaRows,
      gravidadeRows,
      ocorrenciaManutencaoRows,
      manutencaoRows,
      manutencaoRecorrenteRows,
      estoqueRows,
      itemCriticoRows,
      capacitacaoVencidaRows,
      inventarioAbertoRows,
      divergenciaRows,
      equipamentoNaoLocalizadoRows,
      ocorrenciaAbertaRows,
      manutencaoPendenteRows,
      reservaProximaRows,
      noShowRows,
      utilizacaoAtualRows,
      utilizacaoLaboratorioRows,
      equipamentoUtilizadoRows,
      reservaSemanaRows,
      noShowSemanaRows,
      manutencaoStatusRows
    ] = queries.map(([result]) => result);
    const equipamentos = equipamentoRows[0];
    const espacos = espacoRows[0];
    const reservas = reservaRows[0];
    const ocorrencias = ocorrenciaRows[0];
    const manutencoes = manutencaoRows[0];
    const estoque = estoqueRows[0];
    const gravidades = gravidadeRows.map((item) => ({ label: item.gravidade, total: asNumber(item.total) }));
    const equipamentosNaoLocalizados = asNumber(equipamentoNaoLocalizadoRows[0]?.total);
    const alertas = {
      manutencoes_pendentes: asNumber(manutencoes.abertas),
      ocorrencias_abertas: asNumber(ocorrencias.abertas),
      inventarios_incompletos: asNumber(inventarioAbertoRows[0]?.total),
      divergencias_localizacao: asNumber(divergenciaRows[0]?.total),
      equipamentos_nao_localizados: equipamentosNaoLocalizados,
      estoque_baixo: asNumber(estoque.abaixo_minimo),
      capacitacoes_vencidas: asNumber(capacitacaoVencidaRows[0]?.total),
      reservas_proximas: asNumber(reservaProximaRows[0]?.total_proximas),
      no_shows: asNumber(reservas.no_show)
    };

    res.json({
      gerado_em: new Date().toISOString(),
      equipamentos: {
        total: asNumber(equipamentos.total),
        disponiveis: asNumber(equipamentos.disponiveis),
        em_uso: asNumber(equipamentos.em_uso),
        manutencao: asNumber(equipamentos.manutencao),
        inativos: asNumber(equipamentos.inativos),
        nao_localizados: equipamentosNaoLocalizados
      },
      espacos: {
        total: asNumber(espacos.total),
        disponiveis: asNumber(espacos.disponiveis),
        ocupados: asNumber(espacos.ocupados),
        indisponiveis: asNumber(espacos.indisponiveis)
      },
      reservas: {
        hoje: asNumber(reservas.hoje),
        futuras: asNumber(reservas.futuras),
        em_andamento: asNumber(reservas.em_andamento),
        canceladas: asNumber(reservas.canceladas),
        no_show: asNumber(reservas.no_show)
      },
      ocorrencias: {
        abertas: asNumber(ocorrencias.abertas),
        recentes: asNumber(ocorrencias.recentes),
        com_manutencao: asNumber(ocorrenciaManutencaoRows[0]?.total),
        por_gravidade: gravidades
      },
      manutencoes: {
        abertas: asNumber(manutencoes.abertas),
        concluidas: asNumber(manutencoes.concluidas),
        recorrentes: manutencaoRecorrenteRows.map((item) => ({
          equipamento_id: item.id,
          equipamento_nome: item.nome,
          total: asNumber(item.total_manutencoes)
        })),
        tempo_medio_horas: manutencoes.tempo_medio_horas === null
          ? null
          : asNumber(manutencoes.tempo_medio_horas)
      },
      consumiveis: {
        abaixo_minimo: asNumber(estoque.abaixo_minimo),
        criticos: asNumber(estoque.criticos),
        itens_criticos: itemCriticoRows
      },
      em_utilizacao_agora: utilizacaoAtualRows,
      proximas_reservas: reservaProximaRows,
      ocorrencias_pendentes: ocorrenciaAbertaRows,
      manutencoes_pendentes: manutencaoPendenteRows,
      no_shows_recentes: noShowRows,
      alertas,
      graficos: {
        utilizacao_por_laboratorio: utilizacaoLaboratorioRows.map((item) => ({ label: item.label, total: asNumber(item.total) })),
        equipamentos_mais_utilizados: equipamentoUtilizadoRows.map((item) => ({ label: item.label, total: asNumber(item.total) })),
        reservas_ultimos_7_dias: reservaSemanaRows.map((item) => ({ label: item.dia, total: asNumber(item.total) })),
        no_shows_ultimos_7_dias: noShowSemanaRows.map((item) => ({ label: item.dia, total: asNumber(item.total) })),
        manutencoes_por_status: manutencaoStatusRows.map((item) => ({ label: item.label, total: asNumber(item.total) })),
        manutencoes_recorrentes: manutencaoRecorrenteRows.map((item) => ({ label: item.nome, total: asNumber(item.total_manutencoes) })),
        ocorrencias_por_gravidade: gravidades
      }
    });
  } catch (err) {
    console.error('[Dashboard] Erro ao consolidar indicadores:', err);
    res.status(500).json({ error: 'Erro ao consolidar indicadores do dashboard.' });
  }
}

module.exports = {
  getAdminMetrics
};
