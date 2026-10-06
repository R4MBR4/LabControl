const { pool } = require('./dbHelper');

async function registrarEvento({
  equipamento_id = null,
  entidade,
  entidade_id = null,
  acao,
  usuario_id = null,
  detalhes = {}
}, executor = pool) {
  if (!entidade || !acao) {
    throw new Error('Entidade e ação são obrigatórias para registrar auditoria.');
  }

  const [result] = await executor.query(`
    INSERT INTO auditoria_evento
      (equipamento_id, entidade, entidade_id, acao, usuario_id, detalhes)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    equipamento_id || null,
    entidade,
    entidade_id === null || entidade_id === undefined ? null : String(entidade_id),
    acao,
    usuario_id || null,
    JSON.stringify(detalhes)
  ]);
  return result.insertId;
}

async function listarEventosEquipamento(equipamentoId) {
  const [rows] = await pool.query(`
    SELECT a.*, u.nome AS usuario_nome, u.email AS usuario_email
    FROM auditoria_evento a
    LEFT JOIN usuario u ON u.id = a.usuario_id
    WHERE a.equipamento_id = ?
    ORDER BY a.criado_em DESC, a.id DESC
  `, [equipamentoId]);

  return rows.map((row) => ({
    ...row,
    detalhes: row.detalhes ? JSON.parse(row.detalhes) : {}
  }));
}

module.exports = {
  registrarEvento,
  listarEventosEquipamento
};
