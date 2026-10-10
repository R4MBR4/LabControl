import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  Cpu,
  Download,
  GraduationCap,
  PackageCheck,
  PackageSearch,
  Printer,
  RotateCcw,
  Wrench
} from 'lucide-react';
import api from '../services/api';
import LoadError from '../components/LoadError';

function normalized(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isTrue(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function topItem(rows, field) {
  if (!rows || rows.length === 0) return '—';
  const counts = {};
  rows.forEach((r) => {
    const val = r[field];
    if (val) counts[val] = (counts[val] || 0) + 1;
  });
  const entries = Object.entries(counts);
  if (entries.length === 0) return '—';
  entries.sort((a, b) => b[1] - a[1]);
  return `${entries[0][0]} (${entries[0][1]})`;
}

const REPORTS = {
  utilizacao: {
    label: 'Utilização',
    icon: PackageCheck,
    description: 'Histórico operacional de check-ins e check-outs, tempo de uso, avarias e demanda por laboratório.',
    url: '/utilizacoes',
    dateField: (row) => row.data_checkin || row.data_inicio || row.checkin || row.created_at,
    filters: ['espaco', 'equipamento', 'usuario'],
    status: (row) => row.status || 'Sem status',
    metrics: [
      ['Total de Utilizações', (rows) => rows.length],
      ['Em uso agora', (rows) => rows.filter((r) => normalized(r.status) === 'em_uso').length],
      ['Finalizadas', (rows) => rows.filter((r) => ['finalizado', 'concluido', 'finalizada'].includes(normalized(r.status))).length],
      ['Com avaria registrada', (rows) => rows.filter((r) => isTrue(r.houve_avaria)).length],
      ['Equipamento top', (rows) => topItem(rows, 'equipamento_nome')],
      ['Laboratório top', (rows) => topItem(rows, 'espaco_nome')]
    ],
    columns: [
      ['equipamento_nome', 'Equipamento'],
      ['equipamento_codigo', 'Patrimônio / Cód', (r) => r.equipamento_patrimonio_ufpi || r.equipamento_codigo || r.equipamento_labcontrol || '—'],
      ['espaco_nome', 'Laboratório', (r) => r.espaco_nome || '—'],
      ['usuario_nome', 'Usuário', (r) => r.usuario_nome || '—'],
      ['data_inicio', 'Check-in', (r) => formatDate(r.data_checkin || r.data_inicio || r.checkin)],
      ['data_fim', 'Check-out', (r) => formatDate(r.data_checkout || r.data_fim || r.checkout)],
      ['status', 'Status'],
      ['houve_avaria', 'Avaria', (r) => isTrue(r.houve_avaria) ? 'Sim' : 'Não']
    ]
  },
  reservas: {
    label: 'Reservas',
    icon: CalendarDays,
    description: 'Solicitações de reserva, taxa de efetivação em utilização real, cancelamentos e ocorrências de no-show.',
    url: '/reservas',
    dateField: (row) => row.data_inicio,
    filters: ['espaco', 'equipamento', 'usuario'],
    status: (row) => isTrue(row.no_show) ? 'No-show' : row.status || 'Sem status',
    metrics: [
      ['Total de Reservas', (rows) => rows.length],
      ['Utilizadas (Check-in)', (rows) => rows.filter((r) => Boolean(r.utilizacao_id)).length],
      ['Em andamento', (rows) => rows.filter((r) => normalized(r.status) === 'em_andamento').length],
      ['Canceladas', (rows) => rows.filter((r) => ['cancelada', 'cancelado'].includes(normalized(r.status))).length],
      ['No-shows', (rows) => rows.filter((r) => isTrue(r.no_show) || normalized(r.status) === 'no_show').length],
      ['Taxa de Efetivação', (rows) => rows.length === 0 ? '0%' : `${Math.round((rows.filter((r) => Boolean(r.utilizacao_id)).length / rows.length) * 100)}%`]
    ],
    columns: [
      ['data_inicio', 'Início', (r) => formatDate(r.data_inicio)],
      ['data_fim', 'Fim', (r) => formatDate(r.data_fim)],
      ['recurso', 'Recurso', (r) => r.equipamento_nome || r.espaco_nome || '—'],
      ['espaco_nome', 'Laboratório', (r) => r.espaco_nome || r.equipamento_espaco_nome || '—'],
      ['usuario_nome', 'Solicitante', (r) => r.usuario_nome || '—'],
      ['finalidade', 'Finalidade', (r) => r.finalidade || '—'],
      ['status', 'Status', (r) => isTrue(r.no_show) ? 'No-show' : r.status],
      ['utilizacao_id', 'Utilizada?', (r) => r.utilizacao_id ? 'Sim (Check-in)' : (['cancelada', 'cancelado'].includes(normalized(r.status)) ? 'Cancelada' : (isTrue(r.no_show) ? 'No-show' : 'Pendente'))],
      ['no_show', 'No-show', (r) => isTrue(r.no_show) ? 'Sim' : 'Não']
    ]
  },
  equipamentos: {
    label: 'Equipamentos',
    icon: Cpu,
    description: 'Situação patrimonial, disponibilidade operacional, frequência de uso, manutenções e registros de inativação.',
    url: '/equipamentos',
    params: { incluir_inativos: 'true' },
    dateField: (row) => row.data_aquisicao || row.data_compra,
    filters: ['espaco'],
    status: (row) => isTrue(row.inativo) || normalized(row.status) === 'inativo' ? 'Inativo' : row.status || 'Sem status',
    metrics: [
      ['Total Cadastrado', (rows) => rows.length],
      ['Disponíveis', (rows) => rows.filter((r) => ['disponivel', 'disponível'].includes(normalized(r.status)) && !isTrue(r.inativo)).length],
      ['Em uso', (rows) => rows.filter((r) => ['em_uso', 'uso', 'ocupado'].includes(normalized(r.status)) && !isTrue(r.inativo)).length],
      ['Em manutenção', (rows) => rows.filter((r) => normalized(r.status).includes('manutencao') && !isTrue(r.inativo)).length],
      ['Inativos', (rows) => rows.filter((r) => isTrue(r.inativo) || normalized(r.status) === 'inativo').length]
    ],
    columns: [
      ['patrimonio_ufpi', 'Patrimônio UFPI', (r) => r.patrimonio_ufpi || r.codigo_patrimonio || '—'],
      ['codigo_labcontrol', 'Cód. LabControl', (r) => r.codigo_labcontrol || '—'],
      ['nome', 'Equipamento'],
      ['espaco_nome', 'Laboratório', (r) => r.espaco_nome || '—'],
      ['categoria', 'Categoria', (r) => r.categoria || 'Geral'],
      ['status', 'Status', (r) => isTrue(r.inativo) ? 'Inativo' : r.status],
      ['total_utilizacoes', 'Utilizações', (r) => r.total_utilizacoes ?? '0'],
      ['total_manutencoes', 'Manutenções', (r) => r.total_manutencoes ?? '0'],
      ['situacao', 'Situação', (r) => isTrue(r.inativo) ? 'Inativo' : 'Ativo'],
      ['motivo_inativacao', 'Motivo da Inativação', (r) => r.motivo_inativacao || (isTrue(r.inativo) ? 'Inativado pelo administrador' : '—')]
    ]
  },
  ocorrencias: {
    label: 'Ocorrências',
    icon: AlertTriangle,
    description: 'Incidentes, avarias e não conformidades registradas por criticidade, laboratório e resolução.',
    url: '/ocorrencias',
    dateField: (row) => row.data_registro || row.data_criacao || row.created_at,
    filters: ['espaco', 'equipamento', 'usuario'],
    status: (row) => row.status || 'Sem status',
    metrics: [
      ['Total de Ocorrências', (rows) => rows.length],
      ['Abertas / Em Análise', (rows) => rows.filter((r) => ['aberta', 'em_analise', 'pendente'].includes(normalized(r.status))).length],
      ['Críticas / Altas', (rows) => rows.filter((r) => ['alta', 'critica', 'crítica'].includes(normalized(r.gravidade || r.prioridade))).length],
      ['Resolvidas', (rows) => rows.filter((r) => ['resolvida', 'concluida', 'concluída'].includes(normalized(r.status))).length],
      ['Com OS de Manutenção', (rows) => rows.filter((r) => Boolean(r.manutencao_id)).length]
    ],
    columns: [
      ['data_registro', 'Registro', (r) => formatDate(r.data_registro || r.data_criacao || r.created_at)],
      ['titulo', 'Ocorrência', (r) => r.titulo || r.tipo || 'Ocorrência'],
      ['gravidade', 'Gravidade', (r) => r.gravidade || r.prioridade || 'Normal'],
      ['espaco_nome', 'Laboratório', (r) => r.espaco_nome || '—'],
      ['equipamento_nome', 'Equipamento', (r) => r.equipamento_nome || '—'],
      ['usuario_nome', 'Registrado por', (r) => r.usuario_nome || '—'],
      ['status', 'Status'],
      ['manutencao_id', 'Manutenção?', (r) => r.manutencao_id ? `OS #${r.manutencao_id} (${r.manutencao_status || 'gerada'})` : 'Não vinculada']
    ]
  },
  manutencao: {
    label: 'Manutenção',
    icon: Wrench,
    description: 'Ordens de serviço preventivas e corretivas, situação, reincidência de falhas e custos.',
    url: '/manutencoes',
    dateField: (row) => row.data_inicio || row.data_agendamento || row.created_at,
    filters: ['espaco', 'equipamento'],
    status: (row) => row.status || 'Sem status',
    metrics: [
      ['Ordens de Serviço', (rows) => rows.length],
      ['Em Aberto', (rows) => rows.filter((r) => !['concluida', 'concluído', 'concluido', 'cancelada', 'cancelado'].includes(normalized(r.status))).length],
      ['Concluídas', (rows) => rows.filter((r) => ['concluida', 'concluído', 'concluido'].includes(normalized(r.status))).length],
      ['Recorrentes (≥2 OS)', (rows) => rows.filter((r) => Number(r.total_manutencoes_equipamento || 0) >= 2).length],
      ['Custo Total', (rows) => formatCurrency(rows.reduce((total, r) => total + Number(r.custo || 0), 0))]
    ],
    columns: [
      ['data_inicio', 'Início', (r) => formatDate(r.data_inicio || r.data_agendamento)],
      ['equipamento_nome', 'Equipamento'],
      ['equipamento_codigo', 'Patrimônio', (r) => r.equipamento_patrimonio_ufpi || r.equipamento_codigo || r.equipamento_labcontrol || '—'],
      ['espaco_nome', 'Laboratório', (r) => r.espaco_nome || '—'],
      ['tipo', 'Tipo', (r) => r.tipo || 'corretiva'],
      ['descricao', 'Descrição'],
      ['responsavel', 'Responsável', (r) => r.responsavel || '—'],
      ['custo', 'Custo', (r) => formatCurrency(r.custo)],
      ['status', 'Status'],
      ['recorrente', 'Reincidência', (r) => Number(r.total_manutencoes_equipamento || 0) >= 2 ? `Recorrente (${r.total_manutencoes_equipamento} OS)` : '1ª Ordem']
    ]
  },
  inventario: {
    label: 'Inventário Físico',
    icon: ClipboardCheck,
    description: 'Auditoria de equipamentos por QR Code, conferência de localização esperada vs encontrada, divergências e decisões.',
    url: '/inventario/relatorio',
    dateField: (row) => row.data_leitura || row.created_at,
    filters: ['espaco', 'equipamento'],
    status: (row) => row.status_conferencia === 'divergente' ? 'Divergente' : (row.status_conferencia === 'nao_localizado' ? 'Não localizado' : 'Conforme'),
    metrics: [
      ['Itens Conferidos', (rows) => rows.length],
      ['Conformes', (rows) => rows.filter((r) => normalized(r.status_conferencia) === 'conforme').length],
      ['Divergências', (rows) => rows.filter((r) => normalized(r.status_conferencia) === 'divergente').length],
      ['Não Localizados', (rows) => rows.filter((r) => normalized(r.status_conferencia) === 'nao_localizado').length],
      ['Transferências Efetuadas', (rows) => rows.filter((r) => normalized(r.decisao_admin) === 'transferir').length],
      ['Mantidos no Original', (rows) => rows.filter((r) => normalized(r.decisao_admin) === 'manter').length],
      ['Decisão Pendente', (rows) => rows.filter((r) => normalized(r.status_conferencia) === 'divergente' && (!r.decisao_admin || normalized(r.decisao_admin) === 'pendente')).length]
    ],
    columns: [
      ['data_leitura', 'Conferido em', (r) => formatDate(r.data_leitura || r.created_at)],
      ['inventario_espaco_nome', 'Laboratório Auditado', (r) => r.inventario_espaco_nome || (r.inventario_espaco_id ? `Laboratório #${r.inventario_espaco_id}` : '—')],
      ['equipamento_nome', 'Equipamento', (r) => r.equipamento_nome || '—'],
      ['codigo_patrimonio', 'Patrimônio', (r) => r.patrimonio_ufpi || r.codigo_patrimonio || r.codigo_labcontrol || '—'],
      ['espaco_esperado_nome', 'Local Esperado', (r) => r.espaco_esperado_nome || '—'],
      ['espaco_encontrado_nome', 'Local Encontrado', (r) => r.espaco_encontrado_nome || '—'],
      ['status_conferencia', 'Conferência', (r) => r.status_conferencia === 'divergente' ? 'Divergente' : (r.status_conferencia === 'nao_localizado' ? 'Não localizado' : 'Conforme')],
      ['decisao_admin', 'Decisão Administrativa', (r) => r.decisao_admin === 'transferir' ? 'Transferência Efetuada' : (r.decisao_admin === 'manter' ? 'Mantido Local Original' : (r.status_conferencia === 'divergente' ? 'Pendente' : '—'))],
      ['decisao_usuario_nome', 'Decidido por', (r) => r.decisao_usuario_nome || '—']
    ]
  },
  estoque: {
    label: 'Consumo & Estoque',
    icon: PackageSearch,
    description: 'Posição atual de consumíveis de bancada e alerta para saldos no estoque mínimo ou zerados.',
    url: '/consumiveis',
    dateField: null,
    filters: ['espaco'],
    status: (row) => Number(row.quantidade || 0) <= Number(row.quantidade_minima || 0) ? 'Abaixo do mínimo' : 'Regular',
    metrics: [
      ['Itens Cadastrados', (rows) => rows.length],
      ['Abaixo do Mínimo', (rows) => rows.filter((r) => Number(r.quantidade || 0) <= Number(r.quantidade_minima || 0)).length],
      ['Saldo Zerado', (rows) => rows.filter((r) => Number(r.quantidade || 0) === 0).length],
      ['Laboratórios', (rows) => new Set(rows.map((r) => r.espaco_nome).filter(Boolean)).size]
    ],
    columns: [
      ['nome', 'Consumível'],
      ['categoria', 'Categoria', (r) => r.categoria || 'Geral'],
      ['espaco_nome', 'Laboratório', (r) => r.espaco_nome || 'Geral'],
      ['quantidade', 'Saldo em Estoque', (r) => `${r.quantidade} ${r.unidade || 'un'}`],
      ['quantidade_minima', 'Estoque Mínimo', (r) => `${r.quantidade_minima} ${r.unidade || 'un'}`],
      ['status', 'Situação', (r) => Number(r.quantidade || 0) <= Number(r.quantidade_minima || 0) ? 'Abaixo do mínimo' : 'Regular']
    ]
  },
  capacitacao: {
    label: 'Capacitações',
    icon: GraduationCap,
    description: 'Capacitações técnicas de segurança e operação em equipamentos dos laboratórios.',
    url: '/capacitacoes',
    dateField: (row) => row.data_realizacao || row.data_validade || row.validade || row.created_at,
    filters: ['espaco', 'equipamento', 'usuario'],
    status: (row) => row.status || 'Sem status',
    metrics: [
      ['Total de Registros', (rows) => rows.length],
      ['Concluídas', (rows) => rows.filter((r) => normalized(r.status).includes('conclu') || ['ativo', 'valido'].includes(normalized(r.status))).length],
      ['Equipamentos Vinculados', (rows) => rows.filter((r) => Boolean(r.equipamento_id)).length]
    ],
    columns: [
      ['titulo', 'Capacitação', (r) => r.titulo || r.nome],
      ['equipamento_nome', 'Equipamento', (r) => r.equipamento_nome || '—'],
      ['espaco_nome', 'Laboratório', (r) => r.espaco_nome || '—'],
      ['usuario_nome', 'Usuário', (r) => r.usuario_nome || '—'],
      ['instrutor', 'Instrutor', (r) => r.instrutor || '—'],
      ['data_realizacao', 'Data', (r) => formatDate(r.data_realizacao || r.data_validade || r.validade || r.created_at)],
      ['carga_horaria', 'Carga Horária', (r) => r.carga_horaria ? `${r.carga_horaria}h` : '—'],
      ['status', 'Status']
    ]
  }
};

const REPORT_KEYS = Object.keys(REPORTS);

function cellValue(row, [key, , formatter]) {
  const value = key === 'status' ? row.__reportStatus : key === 'recurso'
    ? (row.equipamento_nome || row.espaco_nome || '—')
    : row[key];
  const display = formatter ? formatter(row) : value;
  return display === null || display === undefined || display === '' ? '—' : String(display);
}

function dimensionId(row, dimension) {
  if (dimension === 'espaco') {
    return row.espaco_id || row.inventario_espaco_id || row.equipamento_espaco_id || '';
  }
  if (dimension === 'equipamento') {
    return row.equipamento_id || row.id_equipamento || (row.codigo_patrimonio ? row.id : '');
  }
  return row.usuario_id || row.id_usuario || '';
}

function dimensionName(row, dimension) {
  if (dimension === 'espaco') return row.espaco_nome || row.inventario_espaco_nome || row.equipamento_espaco_nome || '';
  if (dimension === 'equipamento') return row.equipamento_nome || row.nome || '';
  return row.usuario_nome || '';
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function Relatorios() {
  const [activeReport, setActiveReport] = useState('utilizacao');
  const [dataByReport, setDataByReport] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [spaceFilter, setSpaceFilter] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const latestRequest = useRef(0);
  const report = REPORTS[activeReport];
  const sourceRows = dataByReport[activeReport];

  const loadReport = async (key = activeReport, force = false) => {
    const requestId = ++latestRequest.current;
    setError('');
    if (!force && dataByReport[key]) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const config = REPORTS[key];
      const response = await api.get(config.url, { params: config.params });
      if (!Array.isArray(response.data)) {
        throw new Error('A resposta recebida não contém uma lista de registros.');
      }
      let reportRows = response.data.map((row) => {
        const reportRow = { ...row };
        delete reportRow.foto_evidencia;
        delete reportRow.foto_metadata;
        delete reportRow.senha;
        delete reportRow.password;
        return reportRow;
      });

      if (key === 'estoque') {
        try {
          const spacesResponse = await api.get('/espacos');
          if (Array.isArray(spacesResponse.data)) {
            reportRows = reportRows.map((item) => ({
              ...item,
              espaco_nome: item.espaco_nome
                || spacesResponse.data.find((s) => Number(s.id) === Number(item.espaco_id))?.nome
                || (item.espaco_id ? `Espaço #${item.espaco_id}` : 'Geral')
            }));
          }
        } catch {
          // Mantém valores originais
        }
      }

      if (requestId === latestRequest.current) {
        setDataByReport((current) => ({ ...current, [key]: reportRows }));
      }
    } catch (requestError) {
      console.error(`[Relatórios] Erro ao carregar ${REPORTS[key]?.label?.toLowerCase()}:`, requestError);
      if (requestId === latestRequest.current) {
        setError(requestError.response?.data?.error || requestError.message || `Não foi possível carregar o relatório de ${REPORTS[key]?.label?.toLowerCase()}.`);
      }
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setSpaceFilter('');
    setEquipmentFilter('');
    setUserFilter('');
    loadReport(activeReport);
  }, [activeReport]);

  const dimensionOptions = useMemo(() => {
    const rowsList = sourceRows || [];
    return ['espaco', 'equipamento', 'usuario'].reduce((options, dimension) => {
      if (!report.filters?.includes(dimension)) return options;
      const unique = new Map();
      rowsList.forEach((row) => {
        const id = dimensionId(row, dimension);
        const name = dimensionName(row, dimension);
        if (id !== '' && name) unique.set(String(id), name);
      });
      options[dimension] = [...unique.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      return options;
    }, {});
  }, [sourceRows, report]);

  const rows = useMemo(() => {
    if (!sourceRows) return [];
    return sourceRows.map((row) => ({
      ...row,
      __reportStatus: report.status(row)
    })).filter((row) => {
      if (statusFilter && normalized(row.__reportStatus) !== normalized(statusFilter)) return false;
      if (spaceFilter && String(dimensionId(row, 'espaco')) !== spaceFilter) return false;
      if (equipmentFilter && String(dimensionId(row, 'equipamento')) !== equipmentFilter) return false;
      if (userFilter && String(dimensionId(row, 'usuario')) !== userFilter) return false;
      if (report.dateField && (dateFrom || dateTo)) {
        const rowDate = dateInputValue(report.dateField(row));
        if (!rowDate || (dateFrom && rowDate < dateFrom) || (dateTo && rowDate > dateTo)) return false;
      }
      return true;
    });
  }, [sourceRows, report, dateFrom, dateTo, statusFilter, spaceFilter, equipmentFilter, userFilter]);

  const statusOptions = useMemo(
    () => [...new Set((sourceRows || []).map((row) => report.status(row)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [sourceRows, report]
  );

  const exportCsv = () => {
    const content = [
      report.columns.map((column) => csvEscape(column[1])).join(';'),
      ...rows.map((row) => report.columns.map((column) => csvEscape(cellValue(row, column))).join(';'))
    ].join('\r\n');
    const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `labcontrol-relatorio-${activeReport}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const metricValues = sourceRows ? report.metrics.map(([label, calculate]) => [label, calculate(rows)]) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 print:p-0 print:m-0 print:max-w-none">
      {/* Cabeçalho formal impresso para PDF / Papel */}
      <div className="hidden print:block pb-4 mb-4 border-b-2 border-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900">LabControl — UFPI</h1>
            <p className="text-xs text-slate-600">Universidade Federal do Piauí • Sistema Integrado de Laboratórios</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Emissão: {new Date().toLocaleString('pt-BR')}</p>
            <p>Registros filtrados: {rows.length} de {sourceRows?.length || 0}</p>
          </div>
        </div>
        <div className="mt-3 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
          <p className="font-semibold text-slate-900">Relatório: {report.label}</p>
          <p className="text-slate-600 mt-0.5">{report.description}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700">
            <span><strong>Período:</strong> {dateFrom || 'Início'} até {dateTo || 'Hoje'}</span>
            {statusFilter && <span><strong>Situação:</strong> {statusFilter}</span>}
            {spaceFilter && <span><strong>Laboratório:</strong> {dimensionOptions.espaco?.find((o) => o.id === spaceFilter)?.name || spaceFilter}</span>}
            {equipmentFilter && <span><strong>Equipamento:</strong> {dimensionOptions.equipamento?.find((o) => o.id === equipmentFilter)?.name || equipmentFilter}</span>}
            {userFilter && <span><strong>Usuário:</strong> {dimensionOptions.usuario?.find((o) => o.id === userFilter)?.name || userFilter}</span>}
          </div>
        </div>
      </div>

      {/* Cabeçalho de Tela */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Acompanhamento e Gestão</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Relatórios Gerenciais</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Acompanhe indicadores analíticos e operacionais dos laboratórios com fontes de dados auditadas e consistentes com o Dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!sourceRows || loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            Imprimir / Salvar PDF
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!sourceRows || loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </header>

      {/* Abas dos Relatórios */}
      <div className="flex gap-2 overflow-x-auto pb-1 print:hidden" role="tablist" aria-label="Tipos de relatório">
        {REPORT_KEYS.map((key) => {
          const TabIcon = REPORTS[key].icon;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeReport === key}
              onClick={() => setActiveReport(key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                activeReport === key
                  ? 'border-teal-200 bg-teal-50 text-teal-800 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {REPORTS[key].label}
            </button>
          );
        })}
      </div>

      {/* Filtros em Tela */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{report.label}</h2>
            <p className="mt-1 text-xs text-slate-500">{report.description}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {report.dateField && (
              <>
                <label className="grid gap-1 text-[11px] font-medium text-slate-600">
                  De
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-teal-600 focus:outline-hidden"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-medium text-slate-600">
                  Até
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-teal-600 focus:outline-hidden"
                  />
                </label>
              </>
            )}
            {statusOptions.length > 0 && (
              <label className="grid gap-1 text-[11px] font-medium text-slate-600">
                Situação
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="min-w-36 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-teal-600 focus:outline-hidden"
                >
                  <option value="">Todas</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            )}
            {report.filters?.includes('espaco') && dimensionOptions.espaco?.length > 0 && (
              <label className="grid gap-1 text-[11px] font-medium text-slate-600">
                Laboratório
                <select
                  value={spaceFilter}
                  onChange={(event) => setSpaceFilter(event.target.value)}
                  className="min-w-36 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-teal-600 focus:outline-hidden"
                >
                  <option value="">Todos</option>
                  {dimensionOptions.espaco.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </label>
            )}
            {report.filters?.includes('equipamento') && dimensionOptions.equipamento?.length > 0 && (
              <label className="grid gap-1 text-[11px] font-medium text-slate-600">
                Equipamento
                <select
                  value={equipmentFilter}
                  onChange={(event) => setEquipmentFilter(event.target.value)}
                  className="min-w-36 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-teal-600 focus:outline-hidden"
                >
                  <option value="">Todos</option>
                  {dimensionOptions.equipamento.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </label>
            )}
            {report.filters?.includes('usuario') && dimensionOptions.usuario?.length > 0 && (
              <label className="grid gap-1 text-[11px] font-medium text-slate-600">
                Usuário
                <select
                  value={userFilter}
                  onChange={(event) => setUserFilter(event.target.value)}
                  className="min-w-36 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-teal-600 focus:outline-hidden"
                >
                  <option value="">Todos</option>
                  {dimensionOptions.usuario.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setStatusFilter('');
                setSpaceFilter('');
                setEquipmentFilter('');
                setUserFilter('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar
            </button>
          </div>
        </div>
      </section>

      {error && <LoadError message={error} onRetry={() => loadReport(activeReport, true)} />}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando indicadores do relatório...
        </div>
      ) : !error && sourceRows && (
        <>
          {/* Métricas / Cards */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 print:gap-2">
            {metricValues.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs print:p-2.5 print:border-slate-400">
                <p className="text-[11px] font-medium text-slate-500 print:text-slate-700">{label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900 truncate" title={String(value)}>{value}</p>
              </div>
            ))}
          </section>

          {/* Tabela de Dados */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs print:border-none print:shadow-none">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 print:hidden">
              <h3 className="text-sm font-semibold text-slate-800">Registros do relatório</h3>
              <span className="text-xs text-slate-500">{rows.length} de {sourceRows.length}</span>
            </div>
            {rows.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                <p className="font-medium text-slate-700">Nenhum registro encontrado</p>
                <p className="mt-1 text-xs text-slate-400">Ajuste os filtros de período ou laboratório para visualizar dados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs print:border print:border-slate-300">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600 print:bg-slate-100">
                    <tr>
                      {report.columns.map((column) => (
                        <th key={column[0]} className="whitespace-nowrap px-3 py-2.5 font-semibold print:px-2 print:py-1.5 print:border print:border-slate-300">
                          {column[1]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                    {rows.map((row, index) => (
                      <tr key={row.id || `${activeReport}-${index}`} className="hover:bg-slate-50 print:break-inside-avoid">
                        {report.columns.map((column) => (
                          <td key={column[0]} className="max-w-64 px-3 py-2.5 text-slate-700 print:px-2 print:py-1.5 print:border print:border-slate-300 print:text-[11px]">
                            <span className="block truncate" title={cellValue(row, column)}>{cellValue(row, column)}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
