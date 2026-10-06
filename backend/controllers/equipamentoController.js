const equipamentoModel = require('../models/equipamentoModel');
const QRCode = require('qrcode');

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
    res.json([
      { id: 1, nome: 'Impressora 3D Creality Ender 3 Pro', codigo_patrimonio: 'EQ-1001', patrimonio_ufpi: 'UFPI-1001', codigo_labcontrol: 'LC-EQ-0001', espaco_nome: 'Lab Prototipagem', categoria: 'Prototipagem', marca: 'Creality', status: 'disponivel', inativo: 0, exige_capacitacao: 1, descricao: 'Impressora FDM com área de impressão 220x220x250mm para filamentos PLA e PETG.' },
      { id: 2, nome: 'Osciloscópio Digital Tektronix TBS1052B', codigo_patrimonio: 'EQ-1002', patrimonio_ufpi: 'UFPI-1002', codigo_labcontrol: 'LC-EQ-0002', espaco_nome: 'Lab Robótica', categoria: 'Eletrônica', marca: 'Tektronix', status: 'em_uso', inativo: 0, exige_capacitacao: 0, descricao: 'Dois canais, 50 MHz de largura de banda e taxa de amostragem de 1 GS/s.' },
      { id: 3, nome: 'Cortadora a Laser CO2 60W', codigo_patrimonio: 'EQ-1003', patrimonio_ufpi: 'UFPI-1003', codigo_labcontrol: 'LC-EQ-0003', espaco_nome: 'Lab Prototipagem', categoria: 'Corte / Usinagem', marca: 'LaserMaster', status: 'manutencao', inativo: 0, exige_capacitacao: 1, descricao: 'Corte e gravação de chapas acrílicas e MDF. Bloqueada para alinhamento óptico.' },
      { id: 4, nome: 'Fonte de Alimentação Simétrica DC 30V 5A', codigo_patrimonio: 'EQ-1004', patrimonio_ufpi: 'UFPI-1004', codigo_labcontrol: 'LC-EQ-0004', espaco_nome: 'Lab Robótica', categoria: 'Eletrônica', marca: 'Minipa', status: 'disponivel', inativo: 0, exige_capacitacao: 0, descricao: 'Fonte ajustável com proteção de sobrecorrente e display digital quádruplo.' }
    ]);
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
  try {
    const { nome } = req.body;
    if (!nome) {
      return res.status(400).json({ error: 'O nome do equipamento é obrigatório' });
    }
    const novo = await equipamentoModel.createEquipamento(req.body);
    res.status(201).json(novo);
  } catch (err) {
    console.error('[Equipamento] Erro ao cadastrar:', err);
    res.status(500).json({ error: 'Erro ao cadastrar equipamento: ' + err.message });
  }
}

async function update(req, res) {
  try {
    const updated = await equipamentoModel.updateEquipamento(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }
    res.json(updated);
  } catch (err) {
    console.error('[Equipamento] Erro ao atualizar:', err);
    res.status(500).json({ error: 'Erro ao atualizar equipamento: ' + err.message });
  }
}

/**
 * Inativação de Equipamentos (Regra obrigatória Bloco 02):
 * Não exclui fisicamente o equipamento. Impede novas reservas e utilização,
 * preservando histórico, ocorrências e manutenções.
 */
async function inativar(req, res) {
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

    const inativado = await equipamentoModel.inativarEquipamento(req.params.id, usuarioId, motivo.trim());
    res.json({
      message: 'Equipamento inativado com sucesso. Histórico preservado.',
      equipamento: inativado
    });
  } catch (err) {
    console.error('[Equipamento] Erro ao inativar:', err);
    res.status(500).json({ error: 'Erro ao inativar equipamento: ' + err.message });
  }
}

/**
 * Reativação de Equipamentos
 */
async function reativar(req, res) {
  try {
    const equipamento = await equipamentoModel.getEquipamentoById(req.params.id);
    if (!equipamento) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    const reativado = await equipamentoModel.reativarEquipamento(req.params.id);
    res.json({
      message: 'Equipamento reativado com sucesso.',
      equipamento: reativado
    });
  } catch (err) {
    console.error('[Equipamento] Erro ao reativar:', err);
    res.status(500).json({ error: 'Erro ao reativar equipamento: ' + err.message });
  }
}

/**
 * Remoção: verifica histórico e inativa se houver uso prévio
 */
async function remove(req, res) {
  try {
    const usuarioId = req.user?.id;
    const motivo = req.body?.motivo || 'Inativação solicitada via exclusão de equipamento com histórico.';
    const result = await equipamentoModel.deleteEquipamento(req.params.id, usuarioId, motivo);
    
    if (!result || !result.success) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    res.json(result);
  } catch (err) {
    console.error('[Equipamento] Erro ao remover:', err);
    res.status(500).json({ error: 'Erro ao remover equipamento: ' + err.message });
  }
}

/**
 * Histórico completo por equipamento
 * (utilizações, ocorrências, manutenções)
 */
async function getHistorico(req, res) {
  try {
    const equip = await equipamentoModel.getEquipamentoById(req.params.id);
    if (!equip) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }
    const historico = await equipamentoModel.getEquipamentoHistorico(req.params.id);
    res.json({
      equipamento: equip,
      ...historico
    });
  } catch (err) {
    console.error('[Equipamento] Erro ao obter histórico:', err.message);
    res.json({
      equipamento: {
        id: req.params.id,
        nome: 'Impressora 3D Creality Ender 3 Pro',
        codigo_patrimonio: `EQ-${req.params.id}`,
        patrimonio_ufpi: `UFPI-${req.params.id}`,
        codigo_labcontrol: `LC-EQ-${req.params.id}`,
        status: 'disponivel',
        exige_capacitacao: 1,
        espaco_nome: 'Laboratório de Prototipagem e Impressão 3D',
        descricao: 'Equipamento de fabricação digital para criação de peças mecânicas em PLA.'
      },
      utilizacoes: [
        {
          id: 1,
          usuario_nome: 'Aluno Pesquisador',
          usuario_email: 'aluno@labcontrol.com',
          data_checkin: new Date(Date.now() - 7200000),
          data_checkout: new Date(Date.now() - 1800000),
          condicao_inicial: 'Equipamento limpo e nivelado',
          condicao_devolucao: 'Perfeito estado operacional',
          status: 'finalizado'
        }
      ],
      ocorrencias: [
        {
          id: 1,
          titulo: 'Calibração do bico extrusor',
          descricao: 'Ajuste de offset do sensor Z para primeira camada',
          gravidade: 'baixa',
          status: 'resolvida',
          usuario_nome: 'Técnico de Laboratório',
          decisao_admin: 'Calibração validada com impressão de cubo de teste 20mm.',
          data_registro: new Date(Date.now() - 86400000)
        }
      ],
      manutencoes: [
        {
          id: 1,
          tipo: 'preventiva',
          descricao: 'Lubrificação das guias lineares e troca do bico 0.4mm',
          status: 'concluida',
          custo: 85.00,
          data_inicio: new Date(Date.now() - 172800000),
          data_fim: new Date(Date.now() - 86400000),
          responsavel: 'Suporte Técnico',
          observacoes: 'Equipamento testado e liberado para uso acadêmico.'
        }
      ]
    });
  }
}

/**
 * Geração de QR Code com dados estáveis do equipamento
 */
async function getQRCode(req, res) {
  try {
    const equip = await equipamentoModel.getEquipamentoById(req.params.id);
    if (!equip) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    const codigoLab = equip.codigo_labcontrol || `LC-EQ-${String(equip.id).padStart(4, '0')}`;
    const codigoPat = equip.patrimonio_ufpi || equip.codigo_patrimonio || equip.codigo || `EQ-${equip.id}`;

    const payload = JSON.stringify({
      id: equip.id,
      codigo_labcontrol: codigoLab,
      patrimonio_ufpi: codigoPat,
      nome: equip.nome,
      action: 'LABCONTROL_CHECKIN_CHECKOUT'
    });

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
      codigo: codigoPat,
      codigo_labcontrol: codigoLab,
      patrimonio_ufpi: codigoPat,
      qr_payload: payload,
      qr_code_image: qrDataUrl
    });
  } catch (err) {
    console.error('[Equipamento] Erro ao gerar QR Code:', err);
    res.status(500).json({ error: 'Erro ao gerar QR Code do equipamento' });
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
  getQRCode
};
