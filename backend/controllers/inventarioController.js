const inventarioModel = require('../models/inventarioModel');
const auditoriaModel = require('../models/auditoriaModel');
const notificacaoModel = require('../models/notificacaoModel');
const { pool } = require('../models/dbHelper');

async function list(req, res) {
  try {
    const inventarios = await inventarioModel.getAllInventarios();
    res.json(inventarios);
  } catch (err) {
    console.error('[Inventario] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro ao listar sessões de inventário' });
  }
}

async function getById(req, res) {
  try {
    const inventario = await inventarioModel.getInventarioById(req.params.id);
    if (!inventario) {
      return res.status(404).json({ error: 'Sessão de inventário não encontrada' });
    }
    res.json(inventario);
  } catch (err) {
    console.error('[Inventario] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar detalhes do inventário' });
  }
}

async function start(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const { espaco_id, observacoes } = req.body;
    const usuario_id = req.user.id;

    if (!espaco_id) {
      return res.status(400).json({ error: 'O laboratório (espaço) é obrigatório para iniciar a contagem.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const novo = await inventarioModel.startInventario(espaco_id, usuario_id, observacoes, connection);
    await auditoriaModel.registrarEvento({
      entidade: 'inventario',
      entidade_id: novo.id,
      acao: 'inventario_iniciado',
      usuario_id,
      detalhes: { espaco_id: novo.espaco_id, total_esperados: novo.total_esperados }
    }, connection);
    await notificacaoModel.createForRole('admin', {
      tipo: 'inventario_iniciado',
      titulo: 'Inventário iniciado',
      mensagem: `Uma sessão de inventário foi iniciada no laboratório #${novo.espaco_id}.`,
      link: '/inventario',
      entidade: 'inventario',
      entidade_id: novo.id,
      dedupe_key: `inventario_iniciado:${novo.id}`
    }, connection, usuario_id);
    await connection.commit();
    transactionStarted = false;
    res.status(201).json(novo);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Inventario] Erro ao iniciar:', err);
    res.status(500).json({ error: 'Erro ao iniciar sessão de inventário: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

async function scan(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const { scanned_value } = req.body;
    const usuario_id = req.user.id;

    if (!scanned_value) {
      return res.status(400).json({ error: 'Código do equipamento ou leitura QR é obrigatória.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const resultado = await inventarioModel.scanItem(req.params.id, scanned_value, usuario_id, connection);
    if (!resultado.jaConferido && resultado.isDivergente) {
      await auditoriaModel.registrarEvento({
        equipamento_id: resultado.equipamento.id,
        entidade: 'inventario_item',
        entidade_id: resultado.item.id,
        acao: 'inventario_divergencia_detectada',
        usuario_id,
        detalhes: {
          inventario_id: req.params.id,
          espaco_esperado_id: resultado.item.espaco_esperado_id,
          espaco_encontrado_id: resultado.item.espaco_encontrado_id
        }
      }, connection);
      await notificacaoModel.createForRole('admin', {
        tipo: 'inventario_divergencia',
        titulo: 'Divergência de inventário detectada',
        mensagem: `O equipamento "${resultado.equipamento.nome}" foi encontrado em um laboratório diferente do cadastrado.`,
        link: '/inventario',
        entidade: 'inventario_item',
        entidade_id: resultado.item.id,
        dedupe_key: `inventario_divergencia:${resultado.item.id}`
      }, connection, usuario_id);
    }
    await connection.commit();
    transactionStarted = false;
    res.json(resultado);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Inventario] Erro ao escanear item:', err);
    res.status(400).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
}

async function decidirDivergencia(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const { item_id, acao } = req.body;
    const usuario_id = req.user.id;

    if (!item_id || !['transferir', 'manter'].includes(acao)) {
      return res.status(400).json({ error: 'Item e ação (transferir ou manter) são obrigatórios.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const atualizado = await inventarioModel.decidirDivergencia(req.params.id, item_id, acao, usuario_id, connection);
    const item = atualizado.itens.find((registro) => String(registro.id) === String(item_id));
    const alteracao = atualizado.alteracaoLocalizacao;
    delete atualizado.alteracaoLocalizacao;
    await auditoriaModel.registrarEvento({
      equipamento_id: item?.equipamento_id,
      entidade: 'inventario_item',
      entidade_id: item_id,
      acao: 'inventario_divergencia_decidida',
      usuario_id,
      detalhes: {
        inventario_id: req.params.id,
        decisao: acao,
        equipamento_id: item?.equipamento_id,
        espaco_esperado_id: item?.espaco_esperado_id,
        espaco_encontrado_id: item?.espaco_encontrado_id,
        espaco_anterior_id: alteracao?.espaco_anterior_id,
        espaco_anterior_nome: alteracao?.espaco_anterior_nome,
        espaco_novo_id: alteracao?.espaco_novo_id,
        espaco_novo_nome: alteracao?.espaco_novo_nome,
        usuario_responsavel_id: usuario_id,
        data_hora_decisao: new Date().toISOString()
      }
    }, connection);
    if (acao === 'transferir') {
      await auditoriaModel.registrarEvento({
        equipamento_id: item?.equipamento_id,
        entidade: 'equipamento',
        entidade_id: item?.equipamento_id,
        acao: 'equipamento_local_alterado',
        usuario_id,
        detalhes: {
          origem: 'inventario_divergencia',
          inventario_id: req.params.id,
          item_inventario_id: item_id,
          equipamento_id: item?.equipamento_id,
          espaco_anterior_id: alteracao.espaco_anterior_id,
          espaco_anterior_nome: alteracao.espaco_anterior_nome,
          espaco_novo_id: alteracao.espaco_novo_id,
          espaco_novo_nome: alteracao.espaco_novo_nome,
          usuario_responsavel_id: usuario_id,
          data_hora_alteracao: new Date().toISOString()
        }
      }, connection);
    }
    await connection.commit();
    transactionStarted = false;
    res.json({
      message: acao === 'transferir' 
        ? 'Localização do equipamento atualizada com sucesso para este laboratório.' 
        : 'Localização original do equipamento preservada.',
      inventario: atualizado
    });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Inventario] Erro ao decidir divergência:', err);
    res.status(err.statusCode || 500).json({ error: 'Erro ao registrar decisão de divergência: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

async function finalizar(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const finalizado = await inventarioModel.finalizarInventario(req.params.id, connection);
    for (const item of finalizado.itens.filter((registro) => registro.status_conferencia === 'nao_localizado')) {
      await auditoriaModel.registrarEvento({
        equipamento_id: item.equipamento_id,
        entidade: 'inventario_item',
        entidade_id: item.id,
        acao: 'equipamento_nao_localizado_em_inventario',
        usuario_id: req.user.id,
        detalhes: { inventario_id: req.params.id, espaco_esperado_id: item.espaco_esperado_id }
      }, connection);
    }
    await auditoriaModel.registrarEvento({
      entidade: 'inventario',
      entidade_id: req.params.id,
      acao: 'inventario_finalizado',
      usuario_id: req.user.id,
      detalhes: {
        total_conferidos: finalizado.total_conferidos,
        total_divergentes: finalizado.total_divergentes,
        total_nao_localizados: finalizado.total_nao_localizados
      }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.json({
      message: 'Sessão de inventário concluída com sucesso!',
      inventario: finalizado
    });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Inventario] Erro ao finalizar:', err);
    res.status(500).json({ error: 'Erro ao finalizar inventário: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  list,
  getById,
  start,
  scan,
  decidirDivergencia,
  finalizar
};
