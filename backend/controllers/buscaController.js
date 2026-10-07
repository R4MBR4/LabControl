const equipamentoModel = require('../models/equipamentoModel');
const espacoModel = require('../models/espacoModel');
const reservaModel = require('../models/reservaModel');
const ocorrenciaModel = require('../models/ocorrenciaModel');
const consumivelModel = require('../models/consumivelModel');
const manutencaoModel = require('../models/manutencaoModel');
const inventarioModel = require('../models/inventarioModel');

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function matchRows(rows, fields, term) {
  return rows.filter((row) => fields.some((field) => normalize(row[field]).includes(term)));
}

function result(type, title, subtitle, path, id) {
  return { type, title: String(title || 'Sem identificação'), subtitle: String(subtitle || ''), path, id };
}

async function search(req, res) {
  const term = normalize(req.query.q).trim();
  if (term.length < 2 || term.length > 80) {
    return res.status(400).json({ error: 'Informe uma busca com 2 a 80 caracteres.' });
  }

  const role = normalize(req.user?.perfil);
  const isAdmin = ['admin', 'administrador'].includes(role);
  const isReservationPrivileged = isAdmin || ['docente', 'professor'].includes(role);
  const requests = [
    equipamentoModel.getAllEquipamentos({ incluir_inativos: isAdmin }),
    espacoModel.getAllEspacos(),
    reservaModel.getAllReservas(isReservationPrivileged ? { search: term } : { usuario_id: req.user.id, search: term }),
    ocorrenciaModel.getAllOcorrencias(isAdmin ? {} : { usuario_id: req.user.id }),
    consumivelModel.getAllConsumiveis()
  ];
  if (isAdmin) {
    requests.push(manutencaoModel.getAllManutencoes(), inventarioModel.getAllInventarios());
  }

  try {
    const [equipamentos, espacos, reservas, ocorrencias, consumiveis, manutencoes = [], inventarios = []] =
      await Promise.all(requests);
    const results = [];

    matchRows(equipamentos, [
      'nome', 'categoria', 'marca', 'modelo', 'numero_serie', 'patrimonio_ufpi',
      'codigo_patrimonio', 'codigo_labcontrol', 'espaco_nome', 'localizacao_detalhada'
    ], term).slice(0, 6).forEach((item) => {
      const id = item.id || item.id_equipamento;
      results.push(result('Equipamento', item.nome, [
        item.patrimonio_ufpi || item.codigo_patrimonio,
        item.espaco_nome,
        item.status
      ].filter(Boolean).join(' · '), `/equipamentos/${id}`, id));
    });

    matchRows(espacos, ['nome', 'codigo', 'localizacao', 'descricao'], term).slice(0, 5).forEach((item) => {
      const id = item.id || item.id_espaco;
      results.push(result('Espaço', item.nome, [item.codigo, item.localizacao, item.status].filter(Boolean).join(' · '), `/espacos/${id}`, id));
    });

    matchRows(reservas, [
      'finalidade', 'observacoes', 'usuario_nome', 'usuario_email',
      'equipamento_nome', 'equipamento_codigo', 'espaco_nome', 'status'
    ], term).slice(0, 5).forEach((item) => {
      const id = item.id || item.id_reserva;
      const resource = item.equipamento_nome || item.espaco_nome || 'Reserva';
      results.push(result('Reserva', resource, [
        item.finalidade,
        item.data_inicio ? new Date(item.data_inicio).toLocaleString('pt-BR') : '',
        item.status
      ].filter(Boolean).join(' · '), '/reservas', id));
    });

    matchRows(ocorrencias, [
      'titulo', 'descricao', 'equipamento_nome', 'equipamento_codigo', 'status', 'gravidade'
    ], term).slice(0, 5).forEach((item) => {
      const id = item.id || item.id_ocorrencia;
      results.push(result('Ocorrência', item.titulo, [
        item.equipamento_nome,
        item.status,
        item.gravidade
      ].filter(Boolean).join(' · '), '/ocorrencias', id));
    });

    matchRows(consumiveis, ['nome', 'categoria', 'localizacao', 'descricao'], term).slice(0, 5).forEach((item) => {
      const id = item.id || item.id_consumivel;
      results.push(result('Consumível', item.nome, [item.categoria, item.localizacao].filter(Boolean).join(' · '), '/consumiveis', id));
    });

    if (isAdmin) {
      matchRows(manutencoes, ['descricao', 'responsavel', 'tipo', 'equipamento_nome', 'ocorrencia_titulo', 'status'], term)
        .slice(0, 5)
        .forEach((item) => {
          const id = item.id || item.id_manutencao;
          results.push(result('Manutenção', item.equipamento_nome || item.descricao, [
            item.tipo,
            item.status,
            item.responsavel
          ].filter(Boolean).join(' · '), '/manutencao', id));
        });

      matchRows(inventarios, ['espaco_nome', 'espaco_codigo', 'status', 'observacoes', 'usuario_nome'], term)
        .slice(0, 5)
        .forEach((item) => {
          const id = item.id || item.id_inventario;
          results.push(result('Inventário', item.espaco_nome || `Sessão #${id}`, [
            item.espaco_codigo,
            item.status,
            item.data_inicio ? new Date(item.data_inicio).toLocaleDateString('pt-BR') : ''
          ].filter(Boolean).join(' · '), '/inventario', id));
        });
    }

    res.json({ results: results.slice(0, 30), truncated: results.length > 30 });
  } catch (err) {
    console.error('[Busca] Erro ao pesquisar registros:', err);
    res.status(500).json({ error: 'Não foi possível pesquisar os dados agora. Tente novamente.' });
  }
}

module.exports = { search };
