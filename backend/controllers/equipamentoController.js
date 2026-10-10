const equipamentoModel = require('../models/equipamentoModel');
const documentoTecnicoModel = require('../models/documentoTecnicoModel');
const auditoriaModel = require('../models/auditoriaModel');
const { pool } = require('../models/dbHelper');
const QRCode = require('qrcode');

const TECHNICAL_TEXT_LIMITS = {
  especificacoes: 5000,
  fornecedor: 160,
  garantia_detalhes: 500
};

function validateTechnicalFields(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Os dados técnicos informados são inválidos.' };
  }
  const fields = {};
  for (const [field, maxLength] of Object.entries(TECHNICAL_TEXT_LIMITS)) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
    const value = payload[field];
    if (value !== null && typeof value !== 'string') {
      return { error: `O campo ${field} deve ser texto.` };
    }
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (normalized.length > maxLength) {
      return { error: `O campo ${field} deve conter no máximo ${maxLength} caracteres.` };
    }
    fields[field] = normalized || null;
  }

  for (const field of ['data_aquisicao', 'garantia_ate']) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
    const value = payload[field];
    if (value === null || value === '') {
      fields[field] = null;
      continue;
    }
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { error: `O campo ${field} deve ser uma data válida no formato AAAA-MM-DD.` };
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      return { error: `O campo ${field} deve ser uma data válida no formato AAAA-MM-DD.` };
    }
    fields[field] = value;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'valor_aquisicao')) {
    const value = payload.valor_aquisicao;
    if (value === null || value === '') {
      fields.valor_aquisicao = null;
    } else {
      const amountText = String(value).trim();
      if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amountText)) {
        return { error: 'O valor de aquisição deve ser não negativo e ter no máximo duas casas decimais.' };
      }
      fields.valor_aquisicao = Number(amountText).toFixed(2);
    }
  }

  return { fields };
}

async function list(req, res) {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.espaco_id) filters.espaco_id = req.query.espaco_id;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.incluir_inativos !== undefined) filters.incluir_inativos = req.query.incluir_inativos;
    if (req.query.apenas_inativos !== undefined) filters.apenas_inativos = req.query.apenas_inativos;
    if (req.query.inativo !== undefined) filters.inativo = req.query.inativo === 'true' || req.query.inativo === '1';

    if (req.query.exige_capacitacao !== undefined) {
      filters.exige_capacitacao = req.query.exige_capacitacao === 'true' || req.query.exige_capacitacao === '1';
    }

    const equipamentos = await equipamentoModel.getAllEquipamentos(filters);
    res.json(equipamentos);
  } catch (err) {
    console.error('[Equipamento] Erro ao listar:', err.message);
    res.status(500).json({ error: 'Não foi possível carregar os equipamentos. Tente novamente.' });
  }
}

async function getById(req, res) {
  try {
    const equip = await equipamentoModel.getEquipamentoById(req.params.id);
    if (!equip) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }
    res.json(equip);
  } catch (err) {
    console.error('[Equipamento] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar equipamento' });
  }
}

async function create(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const { nome } = req.body;
    if (!nome) {
      return res.status(400).json({ error: 'O nome do equipamento é obrigatório' });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const novo = await equipamentoModel.createEquipamento(req.body, connection);
    await auditoriaModel.registrarEvento({
      equipamento_id: novo.id || novo.id_equipamento,
      entidade: 'equipamento',
      entidade_id: novo.id || novo.id_equipamento,
      acao: 'equipamento_criado',
      usuario_id: req.user.id,
      detalhes: { nome: novo.nome, espaco_id: novo.espaco_id, status: novo.status }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.status(201).json(novo);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Equipamento] Erro ao cadastrar:', err);
    res.status(500).json({
      error: 'Erro ao cadastrar equipamento',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
}

async function update(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const technicalFields = validateTechnicalFields(req.body);
    if (technicalFields.error) {
      return res.status(400).json({ error: technicalFields.error });
    }
    const payload = { ...req.body, ...technicalFields.fields };
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const anterior = await equipamentoModel.getEquipamentoById(req.params.id, connection);
    if (!anterior) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }
    const updated = await equipamentoModel.updateEquipamento(req.params.id, payload, connection);
    if (!updated) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }
    const camposIgnorados = new Set(['foto_url', 'foto', 'imagem', 'image']);
    const alteracoes = Object.entries(payload)
      .filter(([campo]) => !camposIgnorados.has(campo.toLowerCase()))
      .reduce((resultado, [campo, valorNovo]) => {
        const valorAnterior = anterior[campo];
        if (String(valorAnterior ?? '') !== String(valorNovo ?? '')) {
          resultado[campo] = { anterior: valorAnterior ?? null, novo: valorNovo ?? null };
        }
        return resultado;
      }, {});
    if (Object.keys(alteracoes).length > 0) {
      const campos = Object.keys(alteracoes);
      const acao = campos.includes('espaco_id') || campos.includes('id_espaco')
        ? 'equipamento_local_alterado'
        : campos.includes('status')
          ? 'equipamento_status_alterado'
          : 'equipamento_atualizado';
      await auditoriaModel.registrarEvento({
        equipamento_id: updated.id || updated.id_equipamento,
        entidade: 'equipamento',
        entidade_id: updated.id || updated.id_equipamento,
        acao,
        usuario_id: req.user.id,
        detalhes: { alteracoes }
      }, connection);
    }
    await connection.commit();
    transactionStarted = false;
    res.json(updated);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Equipamento] Erro ao atualizar:', err);
    res.status(500).json({
      error: 'Erro ao atualizar equipamento',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Inativação de Equipamentos (Regra obrigatória Bloco 02):
 * Não exclui fisicamente o equipamento. Impede novas reservas e utilização,
 * preservando histórico, ocorrências e manutenções.
 */
async function inativar(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const { motivo } = req.body;
    const usuarioId = req.user?.id;

    if (!motivo || motivo.trim() === '') {
      return res.status(400).json({ error: 'O motivo da inativação é obrigatório' });
    }

    const equipamento = await equipamentoModel.getEquipamentoById(req.params.id);
    if (!equipamento) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const inativado = await equipamentoModel.inativarEquipamento(req.params.id, usuarioId, motivo.trim(), connection);
    await auditoriaModel.registrarEvento({
      equipamento_id: req.params.id,
      entidade: 'equipamento',
      entidade_id: req.params.id,
      acao: 'equipamento_inativado',
      usuario_id: usuarioId,
      detalhes: { motivo: motivo.trim() }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.json({
      message: 'Equipamento inativado com sucesso. Histórico preservado.',
      equipamento: inativado
    });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Equipamento] Erro ao inativar:', err);
    res.status(500).json({
      error: 'Erro ao inativar equipamento',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Reativação de Equipamentos
 */
async function reativar(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const equipamento = await equipamentoModel.getEquipamentoById(req.params.id);
    if (!equipamento) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const reativado = await equipamentoModel.reativarEquipamento(req.params.id, connection);
    await auditoriaModel.registrarEvento({
      equipamento_id: req.params.id,
      entidade: 'equipamento',
      entidade_id: req.params.id,
      acao: 'equipamento_reativado',
      usuario_id: req.user.id
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.json({
      message: 'Equipamento reativado com sucesso.',
      equipamento: reativado
    });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Equipamento] Erro ao reativar:', err);
    res.status(500).json({
      error: 'Erro ao reativar equipamento',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Remoção: verifica histórico e inativa se houver uso prévio
 */
async function remove(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const usuarioId = req.user?.id;
    const motivo = req.body?.motivo || 'Inativação solicitada via exclusão de equipamento com histórico.';
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const result = await equipamentoModel.deleteEquipamento(req.params.id, usuarioId, motivo, connection);
    
    if (!result || !result.success) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    await auditoriaModel.registrarEvento({
      equipamento_id: req.params.id,
      entidade: 'equipamento',
      entidade_id: req.params.id,
      acao: result.inativado ? 'equipamento_inativado_por_exclusao' : 'equipamento_excluido_sem_historico',
      usuario_id: usuarioId,
      detalhes: { motivo }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.json(result);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Equipamento] Erro ao remover:', err);
    res.status(500).json({
      error: 'Erro ao remover equipamento',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Histórico completo por equipamento
 */
async function getHistorico(req, res) {
  try {
    const equip = await equipamentoModel.getEquipamentoById(req.params.id);
    if (!equip) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }
    const historico = await equipamentoModel.getEquipamentoHistorico(req.params.id);
    const auditoria = await auditoriaModel.listarEventosEquipamento(req.params.id);
    const documentos = await documentoTecnicoModel.listByEquipamento(req.params.id);
    res.json({
      equipamento: equip,
      ...historico,
      auditoria,
      documentos
    });
  } catch (err) {
    console.error('[Equipamento] Erro ao obter histórico:', err.message);
    res.status(500).json({
      error: 'Erro ao obter histórico do equipamento',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

/**
 * Geração de QR Code com dados estáveis do equipamento.
 * Não cria dados fictícios de patrimônio.
 */
async function getQRCode(req, res) {
  try {
    const equip = await equipamentoModel.getEquipamentoById(req.params.id);
    if (!equip) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    const codigoLab = equip.codigo_labcontrol || `LC-EQ-${String(equip.id).padStart(4, '0')}`;
    const patrimonioUfpi = equip.patrimonio_ufpi || equip.codigo_patrimonio || null;

    const payloadObj = {
      id: equip.id,
      codigo_labcontrol: codigoLab,
      nome: equip.nome,
      action: 'LABCONTROL_CHECKIN_CHECKOUT'
    };
    if (patrimonioUfpi) {
      payloadObj.patrimonio_ufpi = patrimonioUfpi;
    }
    const payload = JSON.stringify(payloadObj);

    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    });

    res.json({
      equipamento_id: equip.id,
      nome: equip.nome,
      codigo: patrimonioUfpi || codigoLab,
      codigo_labcontrol: codigoLab,
      patrimonio_ufpi: patrimonioUfpi,
      qr_payload: payload,
      qr_code_image: qrDataUrl
    });
  } catch (err) {
    console.error('[Equipamento] Erro ao gerar QR Code:', err);
    res.status(500).json({ error: 'Erro ao gerar QR Code do equipamento' });
  }
}

/**
 * Identificação inequívoca de equipamento por leitura de QR Code ou código digitado.
 * Retorna estado operacional, verificação de uso ativo e direcionamento correto de fluxo.
 */
async function identificarQR(req, res) {
  try {
    const scannedValue = req.body?.scanned_value || req.query?.scanned_value || req.body?.codigo || req.query?.codigo;
    if (!scannedValue) {
      return res.status(400).json({ error: 'Identificador ou leitura de QR Code é obrigatório.' });
    }

    const equip = await equipamentoModel.localizarPorIdentificadorQR(scannedValue);
    if (!equip) {
      return res.status(404).json({ error: 'Nenhum equipamento cadastrado corresponde a esta leitura.' });
    }

    const equipId = equip.id || equip.id_equipamento;
    const status = (equip.status || 'disponivel').toLowerCase();
    const isInactive = equip.inativo === 1 || equip.inativo === true || status === 'inativo';
    const isManutencao = status === 'manutencao' || status === 'em_manutencao';

    // Verifica utilização ativa no banco de dados
    const utilizacaoModel = require('../models/utilizacaoModel');
    const utilizacaoAtiva = await utilizacaoModel.getActiveUtilizacaoByEquipamento(equipId);

    // Validação de capacitação técnica obrigatória
    const capacitacaoModel = require('../models/capacitacaoModel');
    const exigeCapacitacao = equip.exige_capacitacao === 1 || equip.exige_capacitacao === true;
    let usuarioCapacitado = true;
    if (exigeCapacitacao && req.user?.id) {
      usuarioCapacitado = await capacitacaoModel.checkUserCapacitacao(req.user.id, equipId);
    }

    const role = (req.user?.perfil || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrador';

    let fluxoRecomendado = 'checkin';
    let motivoBloqueio = null;

    if (isInactive) {
      fluxoRecomendado = 'bloqueado';
      motivoBloqueio = 'Equipamento inativo. Não pode ser utilizado.';
    } else if (isManutencao) {
      fluxoRecomendado = 'bloqueado';
      motivoBloqueio = 'Equipamento em manutenção. Check-in bloqueado.';
    } else if (utilizacaoAtiva) {
      fluxoRecomendado = 'checkout';
    } else if (exigeCapacitacao && !usuarioCapacitado) {
      fluxoRecomendado = 'bloqueado';
      motivoBloqueio = 'Equipamento exige capacitação técnica prévia. Usuário não autorizado.';
    } else {
      fluxoRecomendado = 'checkin';
    }

    const podeCheckout = Boolean(
      utilizacaoAtiva &&
      (isAdmin || String(utilizacaoAtiva.usuario_id || utilizacaoAtiva.id_usuario) === String(req.user?.id))
    );

    res.json({
      equipamento: equip,
      utilizacaoAtiva: utilizacaoAtiva || null,
      fluxoRecomendado,
      motivoBloqueio,
      podeCheckout,
      podeCheckin: fluxoRecomendado === 'checkin',
      exigeCapacitacao,
      usuarioCapacitado
    });
  } catch (err) {
    console.error('[Equipamento] Erro ao identificar QR:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

/**
 * Geração de etiquetas em lote para múltiplos equipamentos selecionados.
 * Retorna saída adequada para impressão contendo QR, nome, código LabControl e patrimônio UFPI (quando disponível).
 * Não cria dados fictícios.
 */
async function gerarEtiquetasLote(req, res) {
  try {
    const ids = req.body?.ids || (req.query?.ids ? String(req.query.ids).split(',') : []);
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Nenhum equipamento selecionado para geração de etiquetas.' });
    }

    const etiquetas = await equipamentoModel.gerarEtiquetasEmLote(ids);
    res.json({
      total: etiquetas.length,
      etiquetas
    });
  } catch (err) {
    console.error('[Equipamento] Erro ao gerar etiquetas em lote:', err);
    res.status(500).json({ error: 'Erro ao gerar etiquetas em lote' });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  inativar,
  reativar,
  remove,
  getHistorico,
  getQRCode,
  identificarQR,
  gerarEtiquetasLote,
  validateTechnicalFields
};
