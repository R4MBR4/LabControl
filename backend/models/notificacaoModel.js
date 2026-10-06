const { pool } = require('./dbHelper');

async function createForUser(notification, executor = pool) {
  const [result] = await executor.query(`
    INSERT INTO notificacao
      (usuario_id, tipo, titulo, mensagem, link, entidade, entidade_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    notification.usuario_id,
    notification.tipo,
    notification.titulo,
    notification.mensagem,
    notification.link || null,
    notification.entidade || null,
    notification.entidade_id === undefined || notification.entidade_id === null
      ? null
      : String(notification.entidade_id)
  ]);
  return result.insertId;
}

async function createForRole(role, notification, executor = pool, excludeUserId = null) {
  const isAdminRole = ['admin', 'administrador'].includes(role.toLowerCase());
  const [users] = isAdminRole
    ? await executor.query(`
      SELECT id FROM usuario
      WHERE LOWER(perfil) IN ('admin', 'administrador') AND LOWER(status) = 'ativo'
    `)
    : await executor.query(
      'SELECT id FROM usuario WHERE LOWER(perfil) = ? AND LOWER(status) = \'ativo\'',
      [role.toLowerCase()]
    );
  const recipients = users.filter((user) => Number(user.id) !== Number(excludeUserId));
  for (const user of recipients) {
    await createForUser({ ...notification, usuario_id: user.id }, executor);
  }
  return recipients.length;
}

async function listByUser(usuarioId, limit = 50) {
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 100));
  const [rows] = await pool.query(`
    SELECT id, tipo, titulo, mensagem, link, entidade, entidade_id, lida_em, criada_em
    FROM notificacao
    WHERE usuario_id = ?
    ORDER BY criada_em DESC, id DESC
    LIMIT ?
  `, [usuarioId, safeLimit]);
  const [[{ total_nao_lidas }]] = await pool.query(`
    SELECT COUNT(*) AS total_nao_lidas
    FROM notificacao
    WHERE usuario_id = ? AND lida_em IS NULL
  `, [usuarioId]);

  return { items: rows, unread: Number(total_nao_lidas) };
}

async function markRead(id, usuarioId) {
  const [result] = await pool.query(`
    UPDATE notificacao
    SET lida_em = COALESCE(lida_em, CURRENT_TIMESTAMP)
    WHERE id = ? AND usuario_id = ?
  `, [id, usuarioId]);
  if (result.affectedRows > 0) return true;

  const [rows] = await pool.query(
    'SELECT id FROM notificacao WHERE id = ? AND usuario_id = ? LIMIT 1',
    [id, usuarioId]
  );
  return rows.length > 0;
}

async function markAllRead(usuarioId) {
  const [result] = await pool.query(`
    UPDATE notificacao
    SET lida_em = CURRENT_TIMESTAMP
    WHERE usuario_id = ? AND lida_em IS NULL
  `, [usuarioId]);
  return result.affectedRows;
}

module.exports = {
  createForUser,
  createForRole,
  listByUser,
  markRead,
  markAllRead
};
