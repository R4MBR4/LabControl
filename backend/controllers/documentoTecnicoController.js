const equipamentoModel = require('../models/equipamentoModel');
const documentoTecnicoModel = require('../models/documentoTecnicoModel');
const auditoriaModel = require('../models/auditoriaModel');
const { pool } = require('../models/dbHelper');

const DOCUMENT_TYPES = new Set(['manual', 'ficha_tecnica', 'especificacao', 'documentacao', 'outro']);

function validateDocument(payload) {
  const input = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const titulo = typeof input.titulo === 'string' ? input.titulo.trim() : '';
  const tipo = typeof input.tipo === 'string' ? input.tipo.trim().toLowerCase() : '';
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  const descricao = typeof input.descricao === 'string' ? input.descricao.trim() : '';

  if (!titulo || titulo.length > 160) return { error: 'Informe um título com até 160 caracteres.' };
  if (!DOCUMENT_TYPES.has(tipo)) return { error: 'Selecione um tipo de documento válido.' };
  if (!url || url.length > 2048) return { error: 'Informe uma URL válida com até 2048 caracteres.' };
  if (descricao.length > 500) return { error: 'A descrição deve ter até 500 caracteres.' };

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      return { error: 'A URL deve usar HTTP ou HTTPS e não pode conter credenciais.' };
    }
  } catch {
    return { error: 'Informe uma URL HTTP ou HTTPS válida.' };
  }

  return { value: { titulo, tipo, url, descricao } };
}

async function list(req, res) {
  try {
    const equipamento = await equipamentoModel.getEquipamentoById(req.params.id);
    if (!equipamento) return res.status(404).json({ error: 'Equipamento não encontrado.' });
    res.json(await documentoTecnicoModel.listByEquipamento(req.params.id));
  } catch (err) {
    console.error('[DocumentoTecnico] Erro ao listar:', err);
    res.status(500).json({ error: 'Não foi possível carregar os documentos técnicos.' });
  }
}

async function create(req, res) {
  const validation = validateDocument(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const equipamento = await equipamentoModel.getEquipamentoById(req.params.id, connection);
    if (!equipamento) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }

    const documentoId = await documentoTecnicoModel.create({
      ...validation.value,
      equipamento_id: req.params.id,
      criado_por_usuario_id: req.user.id
    }, connection);
    await auditoriaModel.registrarEvento({
      equipamento_id: equipamento.id || equipamento.id_equipamento,
      entidade: 'equipamento',
      entidade_id: equipamento.id || equipamento.id_equipamento,
      acao: 'documento_tecnico_adicionado',
      usuario_id: req.user.id,
      detalhes: { documento_id: documentoId, titulo: validation.value.titulo, tipo: validation.value.tipo }
    }, connection);
    const [documento] = await documentoTecnicoModel.listByEquipamento(req.params.id, connection);
    await connection.commit();
    transactionStarted = false;
    res.status(201).json(documento);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[DocumentoTecnico] Erro ao cadastrar:', err);
    res.status(500).json({ error: 'Não foi possível cadastrar o documento técnico.' });
  } finally {
    if (connection) connection.release();
  }
}

async function remove(req, res) {
  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const equipamento = await equipamentoModel.getEquipamentoById(req.params.id, connection);
    if (!equipamento) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }
    const documento = (await documentoTecnicoModel.listByEquipamento(req.params.id, connection))
      .find((item) => Number(item.id) === Number(req.params.documentoId));
    if (!documento) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Documento técnico não encontrado.' });
    }

    await documentoTecnicoModel.remove(req.params.id, req.params.documentoId, connection);
    await auditoriaModel.registrarEvento({
      equipamento_id: equipamento.id || equipamento.id_equipamento,
      entidade: 'equipamento',
      entidade_id: equipamento.id || equipamento.id_equipamento,
      acao: 'documento_tecnico_removido',
      usuario_id: req.user.id,
      detalhes: { documento_id: documento.id, titulo: documento.titulo, tipo: documento.tipo }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.json({ message: 'Documento técnico removido.' });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[DocumentoTecnico] Erro ao remover:', err);
    res.status(500).json({ error: 'Não foi possível remover o documento técnico.' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { list, create, remove };
