const { pool } = require('./dbHelper');

async function listByEquipamento(equipamentoId, executor = pool) {
  const [rows] = await executor.query(`
    SELECT d.id, d.equipamento_id, d.titulo, d.tipo, d.url, d.descricao,
      d.criado_em, d.criado_por_usuario_id, u.nome AS criado_por_nome
    FROM equipamento_documento d
    LEFT JOIN usuario u ON u.id = d.criado_por_usuario_id
    WHERE d.equipamento_id = ?
    ORDER BY d.criado_em DESC, d.id DESC
  `, [equipamentoId]);
  return rows;
}

async function create(documento, executor = pool) {
  const [result] = await executor.query(`
    INSERT INTO equipamento_documento
      (equipamento_id, titulo, tipo, url, descricao, criado_por_usuario_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    documento.equipamento_id,
    documento.titulo,
    documento.tipo,
    documento.url,
    documento.descricao || null,
    documento.criado_por_usuario_id || null
  ]);
  return result.insertId;
}

async function remove(equipamentoId, documentoId, executor = pool) {
  const [result] = await executor.query(
    'DELETE FROM equipamento_documento WHERE equipamento_id = ? AND id = ?',
    [equipamentoId, documentoId]
  );
  return result.affectedRows > 0;
}

module.exports = { listByEquipamento, create, remove };
