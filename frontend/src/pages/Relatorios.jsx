import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, ClipboardList, Download, PackageCheck, RotateCcw, Wrench } from 'lucide-react';
import api from '../services/api';
import LoadError from '../components/LoadError';

const REPORTS = {
  inventario: {
    label: 'Inventário',
    description: 'Situação patrimonial dos equipamentos cadastrados, incluindo itens inativos.',
    url: '/equipamentos',
    params: { incluir_inativos: 'true' },
    dateField: null,
    status: (row) => isTrue(row.inativo) ? 'Inativo' : row.status || 'Sem status',
    metrics: [
      ['Equipamentos', (rows) => rows.length],
      ['Disponíveis', (rows) => rows.filter((row) => normalized(row.status) === 'disponivel' && !isTrue(row.inativo)).length],
      ['Em uso', (rows) => rows.filter((row) => normalized(row.status) === 'em_uso').length],
      ['Em manutenção', (rows) => rows.filter((row) => normalized(row.status).includes('manutencao')).length],
      ['Inativos', (rows) => rows.filter((row) => isTrue(row.inativo) || normalized(row.status) === 'inativo').length]
    ],
    columns: [
      ['patrimonio_ufpi', 'Patrimônio UFPI'],
      ['nome', 'Equipamento'],
      ['categoria', 'Categoria'],
      ['espaco_nome', 'Laboratório'],
      ['localizacao_detalhada', 'Localização'],
      ['status', 'Status', (row) => isTrue(row.inativo) ? 'Inativo' : row.status]
    ]
  },
  utilizacao: {
    label: 'Utilização',
    description: 'Histórico de check-ins e check-outs dos equipamentos.',
    url: '/utilizacoes',
    dateField: (row) => row.data_checkin || row.data_inicio || row.checkin || row.created_at,
    status: (row) => row.status || 'Sem status',
    metrics: [
      ['Registros', (rows) => rows.length],
      ['Em uso', (rows) => rows.filter((row) => normalized(row.status) === 'em_uso').length],
      ['Finalizados', (rows) => rows.filter((row) => ['finalizado', 'concluido'].includes(normalized(row.status))).length],
      ['Com avaria', (rows) => rows.filter((row) => isTrue(row.houve_avaria)).length]
    ],
    columns: [
      ['equipamento_nome', 'Equipamento'],
      ['equipamento_codigo', 'Patrimônio'],
      ['usuario_nome', 'Usuário'],
      ['data_inicio', 'Check-in', (row) => formatDate(row.data_checkin || row.data_inicio || row.checkin)],
      ['data_fim', 'Check-out', (row) => formatDate(row.data_checkout || row.data_fim || row.checkout)],
      ['status', 'Status'],
      ['houve_avaria', 'Avaria', (row) => isTrue(row.houve_avaria) ? 'Sim' : 'Não']
    ]
  },
  reservas: {
    label: 'Reservas',
    description: 'Reservas no período, com recurso, responsável, status e registro de no-show.',
    url: '/reservas',
    dateField: (row) => row.data_inicio,
    status: (row) => row.status || 'Sem status',
    metrics: [
      ['Reservas', (rows) => rows.length],
      ['Confirmadas', (rows) => rows.filter((row) => normalized(row.status) === 'confirmada').length],
      ['Em andamento', (rows) => rows.filter((row) => normalized(row.status) === 'em_andamento').length],
      ['No-show', (rows) => rows.filter((row) => isTrue(row.no_show)).length]
    ],
    columns: [
      ['data_inicio', 'Início', (row) => formatDate(row.data_inicio)],
      ['data_fim', 'Fim', (row) => formatDate(row.data_fim)],
      ['recurso', 'Recurso', (row) => row.equipamento_nome || row.espaco_nome || '—'],
      ['usuario_nome', 'Solicitante'],
      ['finalidade', 'Finalidade'],
      ['status', 'Status'],
      ['no_show', 'No-show', (row) => isTrue(row.no_show) ? 'Sim' : 'Não']
    ]
  },
  ocorrencias: {
    label: 'Ocorrências',
    description: 'Acompanhamento das ocorrências registradas e de suas prioridades.',
    url: '/ocorrencias',
    dateField: (row) => row.data_registro || row.data_criacao || row.created_at,
    status: (row) => row.status || 'Sem status',
    metrics: [
      ['Ocorrências', (rows) => rows.length],
      ['Abertas', (rows) => rows.filter((row) => normalized(row.status) === 'aberta').length],
      ['Alta prioridade', (rows) => rows.filter((row) => ['alta', 'critica', 'crítica'].includes(normalized(row.prioridade))).length],
      ['Resolvidas', (rows) => rows.filter((row) => ['resolvida', 'concluida', 'concluída'].includes(normalized(row.status))).length]
    ],
    columns: [
      ['data_registro', 'Registro', (row) => formatDate(row.data_registro || row.data_criacao || row.created_at)],
      ['titulo', 'Ocorrência', (row) => row.titulo || row.tipo || 'Ocorrência'],
      ['equipamento_nome', 'Equipamento'],
      ['espaco_nome', 'Laboratório'],
      ['prioridade', 'Prioridade'],
      ['status', 'Status'],
      ['usuario_nome', 'Registrado por']
    ]
  },
  manutencao: {
    label: 'Manutenção',
    description: 'Ordens de serviço, situação, responsável e custos registrados.',
    url: '/manutencoes',
    dateField: (row) => row.data_inicio || row.data_agendamento || row.created_at,
    status: (row) => row.status || 'Sem status',
    metrics: [
      ['Ordens', (rows) => rows.length],
      ['Em aberto', (rows) => rows.filter((row) => !['concluida', 'concluído', 'concluida', 'cancelada'].includes(normalized(row.status))).length],
      ['Concluídas', (rows) => rows.filter((row) => ['concluida', 'concluído'].includes(normalized(row.status))).length],
      ['Custo registrado', (rows) => formatCurrency(rows.reduce((total, row) => total + Number(row.custo || 0), 0))]
    ],
    columns: [
      ['data_inicio', 'Início', (row) => formatDate(row.data_inicio || row.data_agendamento)],
      ['equipamento_nome', 'Equipamento'],
      ['tipo', 'Tipo'],
      ['descricao', 'Descrição'],
      ['responsavel', 'Responsável'],
      ['custo', 'Custo', (row) => formatCurrency(row.custo)],
      ['status', 'Status']
    ]
  },
  estoque: {
    label: 'Estoque',
    description: 'Posição atual dos consumíveis e alerta para saldos no mínimo ou abaixo dele.',
    url: '/consumiveis',
    dateField: null,
    status: (row) => Number(row.quantidade || 0) <= Number(row.quantidade_minima || 0) ? 'Abaixo do mínimo' : 'Regular',
    metrics: [
      ['Itens cadastrados', (rows) => rows.length],
      ['Abaixo do mínimo', (rows) => rows.filter((row) => Number(row.quantidade || 0) <= Number(row.quantidade_minima || 0)).length],
      ['Saldo zerado', (rows) => rows.filter((row) => Number(row.quantidade || 0) === 0).length],
      ['Laboratórios', (rows) => new Set(rows.map((row) => row.espaco_nome).filter(Boolean)).size]
    ],
    columns: [
      ['nome', 'Consumível'],
      ['categoria', 'Categoria'],
      ['espaco_nome', 'Laboratório'],
      ['quantidade', 'Saldo'],
      ['quantidade_minima', 'Estoque mínimo'],
      ['unidade', 'Unidade'],
      ['status', 'Situação', (row) => Number(row.quantidade || 0) <= Number(row.quantidade_minima || 0) ? 'Abaixo do mínimo' : 'Regular']
    ]
  }
};

const REPORT_KEYS = Object.keys(REPORTS);

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

function cellValue(row, [key, , formatter]) {
  const value = key === 'status' ? row.__reportStatus : key === 'recurso'
    ? (row.equipamento_nome || row.espaco_nome || '—')
    : row[key];
  const display = formatter ? formatter(row) : value;
  return display === null || display === undefined || display === '' ? '—' : String(display);
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function Relatorios() {
  const [activeReport, setActiveReport] = useState('inventario');
  const [dataByReport, setDataByReport] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
        return reportRow;
      });
      if (key === 'estoque') {
        const spacesResponse = await api.get('/espacos');
        if (!Array.isArray(spacesResponse.data)) {
          throw new Error('A resposta recebida não contém uma lista de espaços.');
        }
        reportRows = reportRows.map((item) => ({
          ...item,
          espaco_nome: item.espaco_nome
            || spacesResponse.data.find((space) => Number(space.id) === Number(item.espaco_id))?.nome
            || (item.espaco_id ? `Espaço #${item.espaco_id}` : 'Sem vínculo')
        }));
      }
      if (requestId === latestRequest.current) {
        setDataByReport((current) => ({ ...current, [key]: reportRows }));
      }
    } catch (requestError) {
      console.error(`[Relatórios] Erro ao carregar ${REPORTS[key].label.toLowerCase()}:`, requestError);
      if (requestId === latestRequest.current) {
        setError(requestError.response?.data?.error || requestError.message || `Não foi possível carregar o relatório de ${REPORTS[key].label.toLowerCase()}.`);
      }
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    loadReport(activeReport);
  }, [activeReport]);

  const rows = useMemo(() => {
    if (!sourceRows) return [];
    return sourceRows.map((row) => ({
      ...row,
      __reportStatus: report.status(row)
    })).filter((row) => {
      if (statusFilter && normalized(row.__reportStatus) !== normalized(statusFilter)) return false;
      if (report.dateField && (dateFrom || dateTo)) {
        const rowDate = dateInputValue(report.dateField(row));
        if (!rowDate || (dateFrom && rowDate < dateFrom) || (dateTo && rowDate > dateTo)) return false;
      }
      return true;
    });
  }, [sourceRows, report, dateFrom, dateTo, statusFilter]);

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

  const metricValues = sourceRows ? report.metrics.map(([label, calculate]) => [label, calculate(rows)]) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Análise operacional</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Consulte indicadores e exporte os dados filtrados de inventário, utilização, reservas, ocorrências, manutenção e estoque.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!sourceRows || loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Tipos de relatório">
        {REPORT_KEYS.map((key) => {
          const Icon = key === 'inventario' ? ClipboardList
            : key === 'utilizacao' ? PackageCheck
              : key === 'reservas' ? CalendarDays
                : key === 'ocorrencias' ? AlertTriangle
                  : key === 'manutencao' ? Wrench : PackageCheck;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeReport === key}
              onClick={() => setActiveReport(key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                activeReport === key
                  ? 'border-teal-200 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {REPORTS[key].label}
            </button>
          );
        })}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                  <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                </label>
                <label className="grid gap-1 text-[11px] font-medium text-slate-600">
                  Até
                  <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                </label>
              </>
            )}
            {statusOptions.length > 0 && (
              <label className="grid gap-1 text-[11px] font-medium text-slate-600">
                Situação
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-36 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
                  <option value="">Todas</option>
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter(''); }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar
            </button>
          </div>
        </div>
      </section>

      {error && <LoadError message={error} onRetry={() => loadReport(activeReport, true)} />}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Carregando relatório...</div>
      ) : !error && sourceRows && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
            {metricValues.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Registros do relatório</h3>
              <span className="text-xs text-slate-500">{rows.length} de {sourceRows.length}</span>
            </div>
            {rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">Nenhum registro corresponde aos filtros selecionados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>{report.columns.map((column) => <th key={column[0]} className="whitespace-nowrap px-3 py-2.5 font-semibold">{column[1]}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, index) => (
                      <tr key={row.id || `${activeReport}-${index}`} className="hover:bg-slate-50">
                        {report.columns.map((column) => (
                          <td key={column[0]} className="max-w-64 px-3 py-2.5 text-slate-700">
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
