const { pool, getPrimaryKey, insert, update, remove, getTableColumns } = require('./dbHelper');
const equipamentoModel = require('./equipamentoModel');

const TABLE = 'inventario';
const ITEM_TABLE = 'inventario_item';

function inventarioError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getAllInventarios() {
  const sql = `
    SELECT inv.*,
           esp.nome AS espaco_nome, esp.codigo AS espaco_codigo,
           u.nome AS usuario_nome, u.email AS usuario_email
    FROM \`${TABLE}\` inv
    LEFT JOIN \`espaco\` esp ON inv.espaco_id = esp.id
    LEFT JOIN \`usuario\` u ON inv.usuario_id = u.id
    ORDER BY inv.id DESC
  `;
  const [rows] = await pool.query(sql);
  return rows;
}

async function getInventarioById(id, executor = pool) {
  const sql = `
    SELECT inv.*,
           esp.nome AS espaco_nome, esp.codigo AS espaco_codigo,
           u.nome AS usuario_nome, u.email AS usuario_email
    FROM \`${TABLE}\` inv
    LEFT JOIN \`espaco\` esp ON inv.espaco_id = esp.id
    LEFT JOIN \`usuario\` u ON inv.usuario_id = u.id
    WHERE inv.id = ?
    LIMIT 1
  `;
  const [rows] = await executor.query(sql, [id]);
  const inventario = rows[0];
  if (!inventario) return null;

  // Equipamentos esperados neste espaço (ativos)
  const [esperados] = await executor.query(`
    SELECT e.*, esp.nome AS espaco_nome
    FROM equipamento e
    LEFT JOIN espaco esp ON e.espaco_id = esp.id
    WHERE e.espaco_id = ? AND (e.inativo = 0 OR e.inativo IS NULL)
    ORDER BY e.nome ASC
  `, [inventario.espaco_id]);

  // Itens conferidos nesta sessão
  const [itens] = await executor.query(`
    SELECT it.*,
           e.nome AS equipamento_nome, e.codigo_patrimonio, e.patrimonio_ufpi, e.codigo_labcontrol, e.status AS equipamento_status,
           esp_esp.nome AS espaco_esperado_nome,
           esp_enc.nome AS espaco_encontrado_nome,
           u_dec.nome AS decisao_usuario_nome
    FROM \`${ITEM_TABLE}\` it
    LEFT JOIN equipamento e ON it.equipamento_id = e.id
    LEFT JOIN espaco esp_esp ON it.espaco_esperado_id = esp_esp.id
    LEFT JOIN espaco esp_enc ON it.espaco_encontrado_id = esp_enc.id
    LEFT JOIN usuario u_dec ON it.decisao_usuario_id = u_dec.id
    WHERE it.inventario_id = ?
    ORDER BY it.id DESC
  `, [id]);

  return {
    ...inventario,
    esperados,
    itens
  };
}

async function startInventario(espacoId, usuarioId, observacoes = '', executor = pool) {
  // Conta quantos equipamentos ativos pertencem a este laboratório
  const [countRows] = await executor.query(`
    SELECT COUNT(*) AS total
    FROM equipamento
    WHERE espaco_id = ? AND (inativo = 0 OR inativo IS NULL)
  `, [espacoId]);

  const totalEsperados = countRows[0]?.total || 0;

  const [res] = await executor.query(`
    INSERT INTO \`${TABLE}\` (espaco_id, usuario_id, status, data_inicio, total_esperados, observacoes)
    VALUES (?, ?, 'em_andamento', NOW(), ?, ?)
  `, [espacoId, usuarioId, totalEsperados, observacoes || null]);

  return getInventarioById(res.insertId, executor);
}

async function scanItem(inventarioId, scannedValue, usuarioId, executor = pool) {
  const inventario = await getInventarioById(inventarioId, executor);
  if (!inventario) throw new Error('Sessão de inventário não encontrada.');
  if (inventario.status !== 'em_andamento') throw new Error('Esta sessão de inventário já foi finalizada.');

  // Localiza o equipamento pelo ID, codigo_patrimonio, patrimonio_ufpi ou codigo_labcontrol
  const term = String(scannedValue).trim();
  const [equipRows] = await executor.query(`
    SELECT e.*, esp.nome AS espaco_nome
    FROM equipamento e
    LEFT JOIN espaco esp ON e.espaco_id = esp.id
    WHERE e.id = ? 
       OR UPPER(e.codigo_patrimonio) = UPPER(?)
       OR UPPER(e.patrimonio_ufpi) = UPPER(?)
       OR UPPER(e.codigo_labcontrol) = UPPER(?)
    LIMIT 1
  `, [Number(term) || 0, term, term, term]);

  const equipamento = equipRows[0];
  if (!equipamento) {
    throw new Error(`Nenhum equipamento cadastrado corresponde a "${scannedValue}".`);
  }

  // Verifica se já foi escaneado nesta sessão
  const [jaLido] = await executor.query(`
    SELECT * FROM \`${ITEM_TABLE}\`
    WHERE inventario_id = ? AND equipamento_id = ?
    LIMIT 1
  `, [inventarioId, equipamento.id]);

  if (jaLido.length > 0) {
    return {
      jaConferido: true,
      item: jaLido[0],
      equipamento,
      message: `Equipamento "${equipamento.nome}" já havia sido registrado nesta sessão.`
    };
  }

  // Verifica compatibilidade de localização
  const isLocalizacaoCorreta = Number(equipamento.espaco_id) === Number(inventario.espaco_id);
  const statusConferencia = isLocalizacaoCorreta ? 'conferido' : 'divergente';

  // Insere o item conferido
  const [insItem] = await executor.query(`
    INSERT INTO \`${ITEM_TABLE}\` (
      inventario_id, equipamento_id, espaco_esperado_id, espaco_encontrado_id, status_conferencia, decisao_admin
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    inventarioId,
    equipamento.id,
    equipamento.espaco_id,
    inventario.espaco_id,
    statusConferencia,
    isLocalizacaoCorreta ? 'conforme' : 'pendente'
  ]);

  // Atualiza os contadores na sessão
  if (isLocalizacaoCorreta) {
    await executor.query(`UPDATE \`${TABLE}\` SET total_conferidos = total_conferidos + 1 WHERE id = ?`, [inventarioId]);
  } else {
    await executor.query(`UPDATE \`${TABLE}\` SET total_divergentes = total_divergentes + 1 WHERE id = ?`, [inventarioId]);
  }

  const [itemCriado] = await executor.query(`
    SELECT it.*,
           e.nome AS equipamento_nome, e.codigo_patrimonio, e.patrimonio_ufpi, e.codigo_labcontrol,
           esp_esp.nome AS espaco_esperado_nome,
           esp_enc.nome AS espaco_encontrado_nome
    FROM \`${ITEM_TABLE}\` it
    LEFT JOIN equipamento e ON it.equipamento_id = e.id
    LEFT JOIN espaco esp_esp ON it.espaco_esperado_id = esp_esp.id
    LEFT JOIN espaco esp_enc ON it.espaco_encontrado_id = esp_enc.id
    WHERE it.id = ?
  `, [insItem.insertId]);

  return {
    jaConferido: false,
    item: itemCriado[0],
    equipamento,
    isDivergente: !isLocalizacaoCorreta,
    message: isLocalizacaoCorreta 
      ? `Equipamento "${equipamento.nome}" conferido com sucesso!`
      : `Divergência detectada! "${equipamento.nome}" pertence originalmente ao laboratório "${itemCriado[0].espaco_esperado_nome}".`
  };
}

async function decidirDivergencia(inventarioId, itemId, acao, usuarioId, executor = pool) {
  const [items] = await executor.query(`
    SELECT it.*, inv.espaco_id AS inventario_espaco_id, inv.status AS inventario_status,
           e.espaco_id AS equipamento_espaco_id,
           esp_anterior.nome AS espaco_anterior_nome,
           esp_novo.nome AS espaco_novo_nome
    FROM \`${ITEM_TABLE}\` it
    JOIN \`${TABLE}\` inv ON it.inventario_id = inv.id
    JOIN equipamento e ON e.id = it.equipamento_id
    LEFT JOIN espaco esp_anterior ON esp_anterior.id = e.espaco_id
    LEFT JOIN espaco esp_novo ON esp_novo.id = it.espaco_encontrado_id
    WHERE it.id = ? AND it.inventario_id = ?
    FOR UPDATE
  `, [itemId, inventarioId]);

  const item = items[0];
  if (!item) throw inventarioError('Item de divergência não encontrado.', 404);
  if ((item.status_conferencia || '').toLowerCase() !== 'divergente') {
    throw inventarioError('Este item não possui uma divergência de localização pendente.');
  }
  if ((item.inventario_status || '').toLowerCase() !== 'em_andamento') {
    throw inventarioError('Não é possível decidir divergências em uma sessão finalizada.');
  }
  if ((item.decisao_admin || '').toLowerCase() !== 'pendente') {
    throw inventarioError('Esta divergência já possui uma decisão administrativa.');
  }
  if (!['transferir', 'manter'].includes(acao)) {
    throw inventarioError('A decisão deve ser transferir ou manter a localização original.', 400);
  }

  const decisao = acao === 'transferir' ? 'transferir_localizacao' : 'manter_localizacao_original';
  const espacoAnteriorId = item.equipamento_espaco_id;
  const espacoAnteriorNome = item.espaco_anterior_nome || item.espaco_esperado_nome || null;
  const espacoNovoId = acao === 'transferir' ? item.espaco_encontrado_id : espacoAnteriorId;
  const espacoNovoNome = acao === 'transferir'
    ? item.espaco_novo_nome || null
    : espacoAnteriorNome;

  if (acao === 'transferir') {
    const [resultado] = await executor.query(`UPDATE equipamento SET espaco_id = ? WHERE id = ? AND espaco_id = ?`, [
      espacoNovoId,
      item.equipamento_id,
      espacoAnteriorId
    ]);
    if (resultado.affectedRows !== 1) {
      throw inventarioError('A localização do equipamento foi alterada por outra operação. Recarregue o inventário e revise a divergência.');
    }
  }

  const [resultadoDecisao] = await executor.query(`
    UPDATE \`${ITEM_TABLE}\`
    SET decisao_admin = ?, decisao_usuario_id = ?, decisao_data = NOW()
    WHERE id = ? AND decisao_admin = 'pendente'
  `, [
    decisao,
    usuarioId,
    itemId
  ]);
  if (resultadoDecisao.affectedRows !== 1) {
    throw inventarioError('Esta divergência já foi decidida por outra operação.');
  }

  const inventario = await getInventarioById(inventarioId, executor);
  inventario.alteracaoLocalizacao = {
    equipamento_id: item.equipamento_id,
    espaco_anterior_id: espacoAnteriorId,
    espaco_anterior_nome: espacoAnteriorNome,
    espaco_novo_id: espacoNovoId,
    espaco_novo_nome: espacoNovoNome,
    usuario_id: usuarioId,
    decisao
  };
  return inventario;
}

async function finalizarInventario(inventarioId, executor = pool) {
  const inventario = await getInventarioById(inventarioId, executor);
  if (!inventario) throw new Error('Inventário não encontrado.');
  if ((inventario.status || '').toLowerCase() !== 'em_andamento') {
    throw new Error('Esta sessão de inventário já foi finalizada.');
  }

  // Identifica equipamentos esperados que não foram lidos
  const conferidosIds = inventario.itens.map(it => it.equipamento_id);
  const naoLocalizados = inventario.esperados.filter(e => !conferidosIds.includes(e.id));

  // Grava itens não localizados
  for (const nl of naoLocalizados) {
    await executor.query(`
      INSERT INTO \`${ITEM_TABLE}\` (
        inventario_id, equipamento_id, espaco_esperado_id, espaco_encontrado_id, status_conferencia, decisao_admin
      ) VALUES (?, ?, ?, ?, 'nao_localizado', 'pendente')
    `, [inventarioId, nl.id, inventario.espaco_id, inventario.espaco_id]);
  }

  // Atualiza totais e finaliza
  await executor.query(`
    UPDATE \`${TABLE}\`
    SET status = 'concluido',
        data_fim = NOW(),
        total_nao_localizados = ?
    WHERE id = ?
  `, [naoLocalizados.length, inventarioId]);

  return getInventarioById(inventarioId, executor);
}

module.exports = {
  TABLE,
  ITEM_TABLE,
  getAllInventarios,
  getInventarioById,
  startInventario,
  scanItem,
  decidirDivergencia,
  finalizarInventario
};
