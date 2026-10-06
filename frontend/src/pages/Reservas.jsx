import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LoadError from '../components/LoadError';
import {
  CalendarCheck,
  Calendar as CalendarIcon,
  CalendarDays,
  Plus,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Cpu,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  List,
  Eye,
  RotateCcw,
  Info,
  Repeat,
  AlertTriangle,
  Settings2
} from 'lucide-react';

const dateKeyForLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLocalDateTime = (date) => {
  const dateKey = dateKeyForLocalDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${dateKey} ${hours}:${minutes}:${seconds}`;
};

export default function Reservas() {
  const { user, isAdmin } = useAuth();
  const [reservas, setReservas] = useState([]);
  const [eventosCalendario, setEventosCalendario] = useState([]);
  const [calendarioLoading, setCalendarioLoading] = useState(false);
  const [calendarioError, setCalendarioError] = useState('');
  const [calendarioRevision, setCalendarioRevision] = useState(0);
  const [espacos, setEspacos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  // Modo de visualização: 'tabela' ou 'calendario'
  const [viewMode, setViewMode] = useState('tabela');
  // Submodo do calendário: 'mes', 'semana', 'dia'
  const [calendarMode, setCalendarMode] = useState('mes');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filtros Avançados
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipoRecurso, setFiltroTipoRecurso] = useState('todos'); // 'todos', 'equipamento', 'espaco'
  const [filtroEspacoId, setFiltroEspacoId] = useState('');
  const [filtroEquipamentoId, setFiltroEquipamentoId] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todas'); // 'todas', 'confirmada', 'em_andamento', 'cancelada', 'no_show'
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Modais
  const [modalOpen, setModalOpen] = useState(false);
  const [detalheModalOpen, setDetalheModalOpen] = useState(false);
  const [reservaSelecionada, setReservaSelecionada] = useState(null);
  const [tipoRecurso, setTipoRecurso] = useState('equipamento'); // 'equipamento' ou 'espaco'

  // Recorrência (Bloco 08)
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [diasSemana, setDiasSemana] = useState([1, 3]); // Padrão: Segunda e Quarta
  const [dataFimSerie, setDataFimSerie] = useState('');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('10:00');
  const [toleranciaNoShow, setToleranciaNoShow] = useState(15);
  const [savingNoShowTolerance, setSavingNoShowTolerance] = useState(false);

  // Cancelamento de série recorrente (Bloco 08)
  const [cancelRecModalOpen, setCancelRecModalOpen] = useState(false);
  const [reservaParaCancelar, setReservaParaCancelar] = useState(null);
  const [tipoCancelamento, setTipoCancelamento] = useState('apenas_esta'); // 'apenas_esta', 'proximas', 'toda_serie'

  const [formData, setFormData] = useState({
    equipamento_id: '',
    espaco_id: '',
    data_inicio: '',
    data_fim: '',
    finalidade: '',
    observacoes: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [conflictSuggestions, setConflictSuggestions] = useState(null);

  const updateFormData = (changes) => {
    setFormData((current) => ({ ...current, ...changes }));
    setConflictSuggestions(null);
    setError('');
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = {};
      if (filtroStatus !== 'todas') params.status = filtroStatus;
      if (filtroTipoRecurso !== 'todos') params.tipo_recurso = filtroTipoRecurso;
      if (filtroEspacoId) params.espaco_id = filtroEspacoId;
      if (filtroEquipamentoId) params.equipamento_id = filtroEquipamentoId;
      if (filtroDataInicio) params.data_inicio_de = filtroDataInicio;
      if (filtroDataFim) params.data_fim_ate = filtroDataFim;
      if (searchTerm) params.search = searchTerm;

      const [resReservas, resEsp, resEquip] = await Promise.all([
        api.get('/reservas', { params }),
        api.get('/espacos'),
        api.get('/equipamentos')
      ]);
      setReservas(resReservas.data || []);
      setEspacos(resEsp.data || []);
      setEquipamentos(resEquip.data || []);
      setCalendarioRevision((revision) => revision + 1);
    } catch (err) {
      console.error('[Reservas] Erro ao carregar dados:', err);
      setLoadError(err.response?.data?.error || 'Verifique a conexão e tente carregar novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filtroStatus, filtroTipoRecurso, filtroEspacoId, filtroEquipamentoId, filtroDataInicio, filtroDataFim]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/reservas/configuracao/no-show')
      .then((res) => setToleranciaNoShow(res.data.tolerancia_no_show_min))
      .catch((err) => {
        setError(err.response?.data?.error || 'Não foi possível carregar a configuração de no-show.');
      });
  }, [isAdmin]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    loadData();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFiltroTipoRecurso('todos');
    setFiltroEspacoId('');
    setFiltroEquipamentoId('');
    setFiltroStatus('todas');
    setFiltroDataInicio('');
    setFiltroDataFim('');
  };

  const activeFiltersCount = [
    searchTerm,
    filtroTipoRecurso !== 'todos' ? filtroTipoRecurso : '',
    filtroEspacoId,
    filtroEquipamentoId,
    filtroStatus !== 'todas' ? filtroStatus : '',
    filtroDataInicio,
    filtroDataFim
  ].filter(Boolean).length;

  const handleOpenModal = (prefilledDate = null) => {
    const now = prefilledDate ? new Date(prefilledDate) : new Date();
    if (!prefilledDate) {
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
    }
    const startStr = now.toISOString().slice(0, 16);

    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    const endStr = end.toISOString().slice(0, 16);

    // Data padrão para fim de série (4 semanas no futuro)
    const fimSerieDate = new Date(now);
    fimSerieDate.setDate(fimSerieDate.getDate() + 28);
    setDataFimSerie(fimSerieDate.toISOString().slice(0, 10));

    setHoraInicio(startStr.slice(11, 16));
    setHoraFim(endStr.slice(11, 16));
    setIsRecorrente(false);

    setFormData({
      equipamento_id: equipamentos[0]?.id || equipamentos[0]?.id_equipamento || '',
      espaco_id: espacos[0]?.id || espacos[0]?.id_espaco || '',
      data_inicio: startStr,
      data_fim: endStr,
      finalidade: '',
      observacoes: ''
    });
    setError('');
    setConflictSuggestions(null);
    setModalOpen(true);
  };

  const toggleDiaSemana = (dia) => {
    if (diasSemana.includes(dia)) {
      if (diasSemana.length === 1) return; // Mínimo 1 dia
      setDiasSemana(diasSemana.filter(d => d !== dia));
    } else {
      setDiasSemana([...diasSemana, dia].sort());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setConflictSuggestions(null);

    try {
      if (isRecorrente) {
        // Bloco 08: Criação de série recorrente com verificação em todas as ocorrências
        const payload = {
          equipamento_id: tipoRecurso === 'equipamento' ? formData.equipamento_id : null,
          espaco_id: tipoRecurso === 'espaco' ? formData.espaco_id : null,
          finalidade: formData.finalidade,
          observacoes: formData.observacoes,
          dias_semana: diasSemana,
          data_inicio_serie: formData.data_inicio.slice(0, 10),
          data_fim_serie: dataFimSerie,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
          tolerancia_no_show_min: Number(toleranciaNoShow) || 15
        };

        const res = await api.post('/reservas/recorrente', payload);
        setSuccess(`Série recorrente criada com sucesso! ${res.data.totalCriadas} ocorrências confirmadas sem conflitos.`);
      } else {
        // Reserva simples (Bloco 07)
        const payload = {
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim,
          finalidade: formData.finalidade,
          observacoes: formData.observacoes,
          equipamento_id: tipoRecurso === 'equipamento' ? formData.equipamento_id : null,
          espaco_id: tipoRecurso === 'espaco' ? formData.espaco_id : null
        };

        await api.post('/reservas', payload);
        setSuccess('Reserva confirmada com sucesso! Sem conflitos de horário identificados.');
      }

      setModalOpen(false);
      loadData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao realizar reserva');
      setConflictSuggestions(err.response?.status === 409 ? err.response.data?.sugestoes || null : null);
    }
  };

  const applyTimeSuggestion = (suggestion) => {
    updateFormData({
      data_inicio: suggestion.data_inicio.slice(0, 16),
      data_fim: suggestion.data_fim.slice(0, 16)
    });
    setError('');
  };

  const applySpaceSuggestion = (spaceId) => {
    setTipoRecurso('espaco');
    updateFormData({ espaco_id: String(spaceId), equipamento_id: '' });
    setError('');
  };

  const applyEquipmentSuggestion = (equipmentId) => {
    setTipoRecurso('equipamento');
    updateFormData({ equipamento_id: String(equipmentId), espaco_id: '' });
    setError('');
  };

  const handleInitiateCancel = (r) => {
    const isRec = r.recorrente === 1 || !!r.grupo_recorrencia_id;
    if (isRec) {
      setReservaParaCancelar(r);
      setTipoCancelamento('apenas_esta');
      setCancelRecModalOpen(true);
    } else {
      handleCancel(r.id || r.id_reserva);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Deseja realmente cancelar esta reserva?')) return;
    try {
      setCancellingId(id);
      setError('');
      await api.put(`/reservas/${id}/cancelar`);
      setSuccess('Reserva cancelada com sucesso!');
      if (reservaSelecionada && (reservaSelecionada.id === id || reservaSelecionada.id_reserva === id)) {
        setDetalheModalOpen(false);
      }
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao cancelar reserva');
    } finally {
      setCancellingId(null);
    }
  };

  const handleConfirmCancelRecorrente = async () => {
    if (!reservaParaCancelar) return;
    try {
      const id = reservaParaCancelar.id || reservaParaCancelar.id_reserva;
      setCancellingId(id);
      setError('');
      const res = await api.put(`/reservas/${id}/cancelar-recorrencia`, { tipo: tipoCancelamento });
      const msg = tipoCancelamento === 'apenas_esta'
        ? 'Ocorrência individual cancelada com sucesso! As demais reservas da série foram preservadas.'
        : tipoCancelamento === 'proximas'
        ? `Esta e ${res.data.afetadas - 1} ocorrência(s) futuras canceladas.`
        : `Toda a série recorrente (${res.data.afetadas} ocorrências) foi cancelada.`;

      setSuccess(msg);
      setCancelRecModalOpen(false);
      setReservaParaCancelar(null);
      if (detalheModalOpen) setDetalheModalOpen(false);
      await loadData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cancelar ocorrência recorrente');
    } finally {
      setCancellingId(null);
    }
  };

  const handleMarcarNoShow = async (id) => {
    if (!window.confirm('Deseja registrar No-Show para esta reserva? O histórico será preservado para relatórios e indicadores.')) return;
    try {
      await api.post(`/reservas/${id}/no-show`);
      setSuccess('No-Show registrado com sucesso! O histórico foi preservado para indicadores.');
      if (detalheModalOpen) setDetalheModalOpen(false);
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao registrar no-show');
    }
  };

  const handleVerificarNoShows = async () => {
    try {
      setLoading(true);
      const res = await api.post('/reservas/verificar-no-shows');
      setSuccess(res.data.message || 'Verificação de no-shows concluída com sucesso!');
      await loadData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao verificar no-shows');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNoShowTolerance = async () => {
    const minutos = Number(toleranciaNoShow);
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 180) {
      setError('Informe uma tolerância inteira entre 1 e 180 minutos.');
      return;
    }
    try {
      setSavingNoShowTolerance(true);
      setError('');
      const res = await api.put('/reservas/configuracao/no-show', {
        tolerancia_no_show_min: minutos
      });
      setToleranciaNoShow(res.data.tolerancia_no_show_min);
      setSuccess('Tolerância de no-show atualizada.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar a tolerância de no-show.');
    } finally {
      setSavingNoShowTolerance(false);
    }
  };

  // Filtragem local rápida para o termo de busca caso não aperte enter
  const filteredReservas = useMemo(() => {
    if (!searchTerm.trim()) return reservas;
    const term = searchTerm.toLowerCase();
    return reservas.filter(r =>
      r.finalidade?.toLowerCase().includes(term) ||
      r.observacoes?.toLowerCase().includes(term) ||
      r.usuario_nome?.toLowerCase().includes(term) ||
      r.usuario_email?.toLowerCase().includes(term) ||
      r.equipamento_nome?.toLowerCase().includes(term) ||
      r.equipamento_codigo?.toLowerCase().includes(term) ||
      r.espaco_nome?.toLowerCase().includes(term)
    );
  }, [reservas, searchTerm]);

  // Controles de Navegação de Datas no Calendário
  const handlePrevDate = () => {
    const next = new Date(currentDate);
    if (calendarMode === 'mes') next.setMonth(next.getMonth() - 1);
    else if (calendarMode === 'semana') next.setDate(next.getDate() - 7);
    else if (calendarMode === 'dia') next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNextDate = () => {
    const next = new Date(currentDate);
    if (calendarMode === 'mes') next.setMonth(next.getMonth() + 1);
    else if (calendarMode === 'semana') next.setDate(next.getDate() + 7);
    else if (calendarMode === 'dia') next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const currentMonthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // Calendário - Renderização do Mês
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0: domingo
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    // Dias do mês anterior para preencher a primeira semana
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Dias do mês atual
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Dias do próximo mês para completar grade
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  // Semana atual (7 dias)
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    const diff = curr.getDate() - day;

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(curr.setDate(diff + i));
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const calendarRange = useMemo(() => {
    let start;
    let end;
    if (calendarMode === 'mes') {
      start = new Date(calendarDays[0].date);
      end = new Date(calendarDays[calendarDays.length - 1].date);
      end.setDate(end.getDate() + 1);
    } else if (calendarMode === 'semana') {
      start = new Date(weekDays[0]);
      end = new Date(weekDays[6]);
      end.setDate(end.getDate() + 1);
    } else {
      start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return { inicio: start, fim: end };
  }, [calendarMode, calendarDays, weekDays, currentDate]);

  const filteredCalendarEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return eventosCalendario;
    return eventosCalendario.filter((reserva) => [
      reserva.finalidade,
      reserva.observacoes,
      reserva.usuario_nome,
      reserva.equipamento_nome,
      reserva.equipamento_codigo,
      reserva.espaco_nome
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [eventosCalendario, searchTerm]);

  // Mapeamento de reservas por data (YYYY-MM-DD), incluindo eventos que atravessam dias.
  const reservasPorData = useMemo(() => {
    const map = {};
    filteredCalendarEvents.forEach((reserva) => {
      const inicio = new Date(reserva.data_inicio);
      const fim = new Date(reserva.data_fim);
      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return;

      const primeiroDia = new Date(inicio);
      primeiroDia.setHours(0, 0, 0, 0);
      const dia = new Date(Math.max(primeiroDia.getTime(), calendarRange.inicio.getTime()));
      while (dia < fim && dia < calendarRange.fim) {
        if (dia >= calendarRange.inicio) {
          const key = dateKeyForLocalDate(dia);
          if (!map[key]) map[key] = [];
          map[key].push(reserva);
        }
        dia.setDate(dia.getDate() + 1);
      }
    });
    return map;
  }, [filteredCalendarEvents, calendarRange]);

  useEffect(() => {
    if (viewMode !== 'calendario') return undefined;

    let active = true;
    const params = {
      inicio: formatLocalDateTime(calendarRange.inicio),
      fim: formatLocalDateTime(calendarRange.fim)
    };
    if (filtroTipoRecurso !== 'todos') params.tipo_recurso = filtroTipoRecurso;
    if (filtroEspacoId) params.espaco_id = filtroEspacoId;
    if (filtroEquipamentoId) params.equipamento_id = filtroEquipamentoId;
    if (filtroStatus !== 'todas') params.status = filtroStatus;
    if (filtroDataInicio) params.data_inicio_de = filtroDataInicio;
    if (filtroDataFim) params.data_fim_ate = filtroDataFim;

    setCalendarioLoading(true);
    setCalendarioError('');
    api.get('/reservas/calendario', { params })
      .then((response) => {
        if (active) setEventosCalendario(response.data || []);
      })
      .catch((err) => {
        if (active) {
          setCalendarioError(err.response?.data?.error || 'Não foi possível carregar os eventos do calendário.');
        }
      })
      .finally(() => {
        if (active) setCalendarioLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    viewMode,
    calendarRange,
    filtroTipoRecurso,
    filtroEspacoId,
    filtroEquipamentoId,
    filtroStatus,
    filtroDataInicio,
    filtroDataFim,
    calendarioRevision
  ]);

  const reservaOcupaHorario = (reserva) => !['cancelada', 'cancelado', 'recusada', 'rejeitada']
    .includes((reserva.status || '').toLowerCase());

  const tipoRecursoDaReserva = (reserva) => reserva.tipo_recurso
    || (reserva.equipamento_id || reserva.equipamento_nome ? 'equipamento' : 'espaco');

  // Horários para visão Diária (07:00 às 22:00)
  const hoursOfDay = Array.from({ length: 16 }, (_, i) => i + 7);

  const isToday = (d) => {
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-teal-600" />
            Gestão de Reservas e Recorrência
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Agendamentos com prevenção de sobreposição, séries periódicas e tolerância de no-show
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Alternador de Visualização: Tabela vs Calendário */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200">
            <button
              onClick={() => setViewMode('tabela')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'tabela'
                  ? 'bg-white text-teal-700 shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Tabela
            </button>
            <button
              onClick={() => setViewMode('calendario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'calendario'
                  ? 'bg-white text-teal-700 shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendário
            </button>
          </div>

          {/* Configuração e verificação administrativa de no-show */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2">
              <label className="flex items-center gap-2 text-xs font-medium text-amber-900">
                <Settings2 className="h-3.5 w-3.5" />
                Tolerância (min)
                <input
                  type="number"
                  min="1"
                  max="180"
                  step="1"
                  value={toleranciaNoShow}
                  onChange={(e) => setToleranciaNoShow(e.target.value)}
                  className="w-16 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs text-slate-800"
                  aria-label="Tolerância de no-show em minutos"
                />
              </label>
              <button
                onClick={handleSaveNoShowTolerance}
                disabled={savingNoShowTolerance}
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
              >
                {savingNoShowTolerance ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={handleVerificarNoShows}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
                title={`Identifica reservas sem check-in após ${toleranciaNoShow} minutos`}
              >
                <Clock className="h-3.5 w-3.5" />
                Verificar No-Shows
              </button>
            </div>
          )}

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Reserva
          </button>
        </div>
      </div>

      {/* Alertas de Notificação */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <LoadError message={loadError} onRetry={loadData} />

      {/* Barra de Busca e Filtros Combinados */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Busca Textual */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por solicitante, recurso, patrimônio ou finalidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </form>

          {/* Botão de Filtros Avançados */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition shrink-0 cursor-pointer ${
              showAdvancedFilters || activeFiltersCount > 0
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4.5 h-4.5 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-600 text-xs px-2 py-1 transition cursor-pointer"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>

        {/* Painel Expansível de Filtros Avançados */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Tipo de Recurso */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Recurso</label>
              <select
                value={filtroTipoRecurso}
                onChange={(e) => setFiltroTipoRecurso(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
              >
                <option value="todos">Todos os Recursos</option>
                <option value="equipamento">Apenas Equipamentos</option>
                <option value="espaco">Apenas Espaços / Salas</option>
              </select>
            </div>

            {/* Laboratório / Espaço */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Laboratório</label>
              <select
                value={filtroEspacoId}
                onChange={(e) => setFiltroEspacoId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
              >
                <option value="">Todos os Laboratórios</option>
                {espacos.map(esp => (
                  <option key={esp.id || esp.id_espaco} value={esp.id || esp.id_espaco}>
                    {esp.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Equipamento */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Equipamento</label>
              <select
                value={filtroEquipamentoId}
                onChange={(e) => setFiltroEquipamentoId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
              >
                <option value="">Todos os Equipamentos</option>
                {equipamentos.map(eq => (
                  <option key={eq.id || eq.id_equipamento} value={eq.id || eq.id_equipamento}>
                    {eq.nome} ({eq.codigo_patrimonio})
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
              >
                <option value="todas">Todos os Status</option>
                <option value="confirmada">Confirmada</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="pendente">Pendente</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
                <option value="no_show">No-Show</option>
              </select>
            </div>

            {/* Período */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">A Partir De</label>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* VISÃO 1: CALENDÁRIO INTERATIVO */}
      {viewMode === 'calendario' && !loadError && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          {calendarioError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              {calendarioError}
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={handlePrevDate}
                  className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition"
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white rounded-lg transition"
                >
                  Hoje
                </button>
                <button
                  onClick={handleNextDate}
                  className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition"
                  title="Próximo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <h2 className="text-base font-bold text-slate-800 capitalize tracking-tight">
                {calendarMode === 'dia'
                  ? currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  : currentMonthName}
              </h2>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setCalendarMode('mes')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  calendarMode === 'mes' ? 'bg-white text-teal-700 font-bold shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Mês
              </button>
              <button
                onClick={() => setCalendarMode('semana')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  calendarMode === 'semana' ? 'bg-white text-teal-700 font-bold shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setCalendarMode('dia')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  calendarMode === 'dia' ? 'bg-white text-teal-700 font-bold shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Dia
              </button>
            </div>
          </div>
          {calendarioLoading && (
            <div className="text-center text-[11px] text-slate-400" role="status">
              Atualizando eventos do calendário...
            </div>
          )}

          {/* MODO MÊS */}
          {calendarMode === 'mes' && (
            <div className="space-y-1">
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 uppercase py-2">
                <span>Dom</span>
                <span>Seg</span>
                <span>Ter</span>
                <span>Qua</span>
                <span>Qui</span>
                <span>Sex</span>
                <span>Sáb</span>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((cell, idx) => {
                  const dateKey = dateKeyForLocalDate(cell.date);
                  const reservasDoDia = reservasPorData[dateKey] || [];
                  const diaHoje = isToday(cell.date);

                  return (
                    <div
                      key={idx}
                      className={`min-h-[105px] p-1.5 rounded-xl border flex flex-col justify-between transition ${
                        cell.isCurrentMonth
                          ? diaHoje
                            ? 'bg-teal-50/40 border-teal-300 ring-1 ring-teal-400/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                          : 'bg-slate-50/60 border-slate-100 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                          diaHoje
                            ? 'bg-teal-600 text-white'
                            : cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                        }`}>
                          {cell.date.getDate()}
                        </span>
                        {reservasDoDia.length > 0 && (
                          <span className="text-[10px] font-medium text-slate-400">
                            {reservasDoDia.length} res.
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 my-1 overflow-y-auto max-h-[65px] scrollbar-thin">
                        {reservasDoDia.slice(0, 3).map((r) => {
                          const status = (r.status || 'confirmada').toLowerCase();
                          const isCanc = status === 'cancelada';
                          const isRec = r.recorrente === 1 || !!r.grupo_recorrencia_id;
                          const isNoShow = r.no_show === 1;
                          const horaInicioRes = r.data_inicio ? new Date(r.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

                          return (
                            <button
                              key={r.id}
                              onClick={() => {
                                setReservaSelecionada(r);
                                setDetalheModalOpen(true);
                              }}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate flex items-center gap-1 transition ${
                                isCanc
                                  ? 'bg-rose-50 text-rose-500 line-through'
                                  : isNoShow
                                  ? 'bg-amber-100 text-amber-900 font-semibold'
                                  : status === 'em_andamento'
                                  ? 'bg-blue-100 text-blue-800 font-semibold'
                                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                              }`}
                              title={`${horaInicioRes} - ${r.equipamento_nome || r.espaco_nome} (${r.usuario_nome})${r.espaco_nome && r.equipamento_nome ? ` - Laboratório: ${r.espaco_nome}` : ''} - ${tipoRecursoDaReserva(r) === 'equipamento' ? 'Equipamento' : 'Espaço'} ${isRec ? '[Recorrente]' : ''}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRec ? 'bg-indigo-500' : 'bg-teal-500'}`}></span>
                              <span className="shrink-0">{horaInicioRes}</span>
                              <span className="shrink-0 opacity-70">{tipoRecursoDaReserva(r) === 'equipamento' ? 'Eq.' : 'Esp.'}</span>
                              <span className="truncate">{r.equipamento_nome || r.espaco_nome}</span>
                            </button>
                          );
                        })}
                        {reservasDoDia.length > 3 && (
                          <button
                            onClick={() => {
                              setCurrentDate(cell.date);
                              setCalendarMode('dia');
                            }}
                            className="text-[9px] font-bold text-teal-600 hover:underline w-full text-center"
                          >
                            +{reservasDoDia.length - 3} mais...
                          </button>
                        )}
                      </div>

                      {cell.isCurrentMonth && (
                        <button
                          onClick={() => handleOpenModal(cell.date)}
                          className="text-[10px] text-slate-400 hover:text-teal-600 hover:bg-teal-50/50 rounded py-0.5 transition text-center opacity-0 hover:opacity-100"
                        >
                          + Agendar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODO SEMANA */}
          {calendarMode === 'semana' && (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDays.map((d, idx) => {
                const dateKey = dateKeyForLocalDate(d);
                const reservasDoDia = reservasPorData[dateKey] || [];
                const diaHoje = isToday(d);

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-3 flex flex-col justify-between min-h-[300px] ${
                      diaHoje ? 'bg-teal-50/30 border-teal-300 ring-1 ring-teal-400/20' : 'bg-slate-50/50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase">
                          {d.toLocaleDateString('pt-BR', { weekday: 'short' })}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                          diaHoje ? 'bg-teal-600 text-white' : 'text-slate-800'
                        }`}>
                          {d.getDate()}/{d.getMonth() + 1}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {!reservasDoDia.some(reservaOcupaHorario) && (
                          <p className="text-[11px] text-slate-400 italic text-center py-4">Livre</p>
                        )}
                        {reservasDoDia.map(r => {
                            const status = (r.status || 'confirmada').toLowerCase();
                            const isCanc = status === 'cancelada';
                            const isRec = r.recorrente === 1 || !!r.grupo_recorrencia_id;
                            const isNoShow = r.no_show === 1;
                            const horaI = new Date(r.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            const horaF = new Date(r.data_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                            return (
                              <div
                                key={r.id}
                                onClick={() => {
                                  setReservaSelecionada(r);
                                  setDetalheModalOpen(true);
                                }}
                                className={`p-2 rounded-xl border text-xs cursor-pointer transition ${
                                  isCanc
                                    ? 'bg-rose-50 border-rose-200 opacity-60'
                                    : 'bg-white border-slate-200 hover:border-teal-500 shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                  <span className="font-mono font-bold text-teal-700">{horaI} - {horaF}</span>
                                  <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                                    isCanc ? 'text-rose-600' : isNoShow ? 'text-amber-700' : 'text-emerald-700'
                                  }`}>
                                    {isNoShow ? 'No-Show' : status}
                                  </span>
                                </div>
                                <div className="font-bold text-slate-800 text-[11px] truncate flex items-center gap-1">
                                  {isRec && <Repeat className="w-2.5 h-2.5 text-indigo-500 shrink-0" />}
                                  <span className="text-[9px] uppercase text-slate-400 shrink-0">
                                    {tipoRecursoDaReserva(r) === 'equipamento' ? 'Equip.' : 'Espaço'}
                                  </span>
                                  <span className="truncate">{r.equipamento_nome || r.espaco_nome}</span>
                                </div>
                                {r.equipamento_nome && r.espaco_nome && (
                                  <div className="text-[9px] text-slate-500 truncate">Laboratório: {r.espaco_nome}</div>
                                )}
                                <div className="text-[10px] text-slate-500 truncate">{r.usuario_nome}</div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenModal(d)}
                      className="mt-3 w-full py-1.5 text-center text-[11px] font-semibold text-teal-600 hover:bg-teal-50 rounded-xl transition"
                    >
                      + Reservar neste dia
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO DIA */}
          {calendarMode === 'dia' && (
            <div className="space-y-3">
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                {hoursOfDay.map(hour => {
                  const hourStr = String(hour).padStart(2, '0');
                  const currDayReservas = reservasPorData[dateKeyForLocalDate(currentDate)] || [];
                  const reservasDaHora = currDayReservas.filter(r => {
                    const slotStart = new Date(currentDate);
                    slotStart.setHours(hour, 0, 0, 0);
                    const slotEnd = new Date(slotStart);
                    slotEnd.setHours(slotEnd.getHours() + 1);
                    return new Date(r.data_inicio) < slotEnd && new Date(r.data_fim) > slotStart;
                  });

                  return (
                    <div key={hour} className="flex items-start gap-4 p-3 hover:bg-slate-50/50 transition">
                      <div className="w-16 font-mono font-bold text-xs text-slate-500 shrink-0 pt-1">
                        {hourStr}:00
                      </div>

                      <div className="flex-1 space-y-2">
                        {!reservasDaHora.some(reservaOcupaHorario) && (
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Horário disponível</span>
                            <button
                              onClick={() => {
                                const d = new Date(currentDate);
                                d.setHours(hour, 0, 0);
                                handleOpenModal(d);
                              }}
                              className="text-[11px] text-teal-600 font-semibold hover:underline"
                            >
                              + Agendar
                            </button>
                          </div>
                        )}
                        {reservasDaHora.map(r => {
                          const isCancelled = (r.status || '').toLowerCase() === 'cancelada';
                          return (
                            <div
                              key={r.id}
                              onClick={() => {
                                setReservaSelecionada(r);
                                setDetalheModalOpen(true);
                              }}
                              className={`p-3 border rounded-xl cursor-pointer transition flex items-center justify-between ${
                                isCancelled
                                  ? 'bg-rose-50 border-rose-200 opacity-70'
                                  : 'bg-teal-50/60 border-teal-200 hover:bg-teal-50'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] uppercase text-slate-400">
                                    {tipoRecursoDaReserva(r) === 'equipamento' ? 'Equipamento' : 'Espaço'}
                                  </span>
                                  <span className="font-bold text-slate-800 text-xs">
                                    {r.equipamento_nome || r.espaco_nome}
                                  </span>
                                  {r.recorrente === 1 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold flex items-center gap-1 border border-indigo-200">
                                      <Repeat className="w-2.5 h-2.5" />
                                      Recorrente
                                    </span>
                                  )}
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                    isCancelled ? 'bg-rose-100 text-rose-700' : 'bg-teal-600 text-white'
                                  }`}>
                                    {r.status}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600">
                                  Solicitante: <strong>{r.usuario_nome}</strong> | Finalidade: {r.finalidade || 'Uso acadêmico'}
                                </p>
                                {r.equipamento_nome && r.espaco_nome && (
                                  <p className="text-[10px] text-slate-500">Laboratório: {r.espaco_nome}</p>
                                )}
                              </div>
                              <div className="text-right font-mono text-xs text-slate-500">
                                {new Date(r.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(r.data_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISÃO 2: TABELA ADMINISTRATIVA / LISTA */}
      {viewMode === 'tabela' && !loadError && (
        <>
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredReservas.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">
              Nenhuma reserva encontrada com os filtros selecionados.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Recurso</th>
                      <th className="px-5 py-3">Solicitante</th>
                      <th className="px-5 py-3">Período Reservado</th>
                      <th className="px-5 py-3">Finalidade</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReservas.map((r) => {
                      const resId = r.id || r.id_reserva;
                      const status = (r.status || 'confirmada').toLowerCase();
                      const userRole = (user?.perfil || '').toLowerCase();
                      const isPrivileged = isAdmin || userRole === 'professor' || userRole === 'docente';
                      const isOwner = Number(r.usuario_id || r.id_usuario) === Number(user?.id);
                      const canCancel = (isOwner || isPrivileged) && status !== 'cancelada';
                      const isRec = r.recorrente === 1 || !!r.grupo_recorrencia_id;
                      const isNoShow = r.no_show === 1;

                      return (
                        <tr key={resId} className="hover:bg-slate-50/50 transition">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                                {r.equipamento_nome ? <Cpu className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-800">
                                    {r.equipamento_nome || r.espaco_nome || `Recurso #${resId}`}
                                  </span>
                                  {isRec && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title="Reserva integrante de série periódica">
                                      <Repeat className="w-2.5 h-2.5" />
                                      Série
                                    </span>
                                  )}
                                </div>
                                {r.equipamento_codigo && (
                                  <span className="block font-mono text-[10px] text-slate-400">
                                    UFPI: {r.equipamento_codigo} {r.equipamento_codigo_labcontrol ? `| LC: ${r.equipamento_codigo_labcontrol}` : ''}
                                  </span>
                                )}
                                {r.espaco_nome && r.equipamento_nome && (
                                  <span className="block text-[10px] text-teal-600 font-medium">
                                    Local: {r.espaco_nome}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-slate-600">
                            <span className="font-semibold text-slate-800">{r.usuario_nome || `Usuário #${r.usuario_id}`}</span>
                            {r.usuario_email && <span className="block text-[10px] text-slate-400">{r.usuario_email}</span>}
                          </td>

                          <td className="px-5 py-3.5 text-slate-600">
                            <div>De: <strong>{r.data_inicio ? new Date(r.data_inicio).toLocaleString('pt-BR') : '-'}</strong></div>
                            <div>Até: <strong>{r.data_fim ? new Date(r.data_fim).toLocaleString('pt-BR') : '-'}</strong></div>
                          </td>

                          <td className="px-5 py-3.5 text-slate-600 max-w-xs">
                            <span className="line-clamp-2">{r.finalidade || r.observacoes || 'Uso acadêmico/pesquisa'}</span>
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isNoShow ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                status === 'confirmada' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                status === 'cancelada' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                status === 'em_andamento' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                status === 'pendente' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {isNoShow ? 'No-Show' : status}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setReservaSelecionada(r);
                                  setDetalheModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition cursor-pointer"
                                title="Ver detalhes completos"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {status === 'cancelada' ? (
                                <span className="text-[11px] text-slate-400 font-medium px-2 py-1">
                                  Cancelada
                                </span>
                              ) : canCancel ? (
                                <button
                                  onClick={() => handleInitiateCancel(r)}
                                  disabled={cancellingId === resId}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 transition cursor-pointer disabled:opacity-50"
                                  title={isRec ? 'Opções de cancelamento da série recorrente' : 'Cancelar esta reserva'}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  {cancellingId === resId ? '...' : isRec ? 'Cancelar...' : 'Cancelar'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  Solicitante
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal 1: Nova Reserva (Simples ou Recorrente) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-teal-600" />
                {isRecorrente ? 'Criar Série de Reservas Recorrentes' : 'Solicitar Reserva de Recurso'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {!isRecorrente && conflictSuggestions && (
              <div className="mb-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
                <h4 className="font-bold text-amber-900">Alternativas disponíveis</h4>
                {conflictSuggestions.proximos_horarios?.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-700">Próximos horários livres para o recurso selecionado</p>
                    <div className="flex flex-wrap gap-2">
                      {conflictSuggestions.proximos_horarios.map((slot) => (
                        <button
                          key={`${slot.data_inicio}-${slot.data_fim}`}
                          type="button"
                          onClick={() => applyTimeSuggestion(slot)}
                          className="rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-left text-teal-800 hover:bg-teal-50"
                        >
                          {new Date(slot.data_inicio).toLocaleString('pt-BR')} – {new Date(slot.data_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {conflictSuggestions.espacos?.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-700">Outros espaços livres no mesmo horário</p>
                    <div className="flex flex-wrap gap-2">
                      {conflictSuggestions.espacos.map((space) => (
                        <button
                          key={space.id}
                          type="button"
                          onClick={() => applySpaceSuggestion(space.id)}
                          className="rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-teal-800 hover:bg-teal-50"
                        >
                          {space.nome}{space.localizacao ? ` · ${space.localizacao}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {conflictSuggestions.equipamentos?.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-700">Equipamentos equivalentes livres no mesmo horário</p>
                    <div className="flex flex-wrap gap-2">
                      {conflictSuggestions.equipamentos.map((equipment) => (
                        <button
                          key={equipment.id}
                          type="button"
                          onClick={() => applyEquipmentSuggestion(equipment.id)}
                          className="rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-left text-teal-800 hover:bg-teal-50"
                        >
                          {equipment.nome}{equipment.espaco_nome ? ` · ${equipment.espaco_nome}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!conflictSuggestions.proximos_horarios?.length
                  && !conflictSuggestions.espacos?.length
                  && !conflictSuggestions.equipamentos?.length
                  && <p className="text-slate-600">Não encontramos alternativas livres para esse período. Seus dados permanecem preenchidos.</p>}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo de Recurso */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipo de Recurso</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setTipoRecurso('equipamento'); setConflictSuggestions(null); }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      tipoRecurso === 'equipamento'
                        ? 'bg-teal-50 border-teal-500 text-teal-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                    Equipamento
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTipoRecurso('espaco'); setConflictSuggestions(null); }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      tipoRecurso === 'espaco'
                        ? 'bg-teal-50 border-teal-500 text-teal-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Espaço / Lab
                  </button>
                </div>
              </div>

              {/* Seleção do Item */}
              {tipoRecurso === 'equipamento' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Selecione o Equipamento</label>
                  <select
                    value={formData.equipamento_id}
                    onChange={(e) => updateFormData({ equipamento_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                  >
                    {equipamentos.map((eq) => {
                      const id = eq.id || eq.id_equipamento;
                      const isManutencao = (eq.status || '').toLowerCase() === 'manutencao';
                      return (
                        <option key={id} value={id} disabled={isManutencao}>
                          {eq.nome} ({eq.codigo_patrimonio || `ID ${id}`}) {isManutencao ? '⚠️ [EM MANUTENÇÃO - BLOQUEADO]' : ''} {eq.exige_capacitacao ? '🔒 [Exige Capacitação]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Selecione o Espaço / Sala</label>
                  <select
                    value={formData.espaco_id}
                    onChange={(e) => updateFormData({ espaco_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                  >
                    {espacos.map((esp) => {
                      const id = esp.id || esp.id_espaco;
                      return (
                        <option key={id} value={id}>
                          {esp.nome} ({esp.localizacao || 'Campus'})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Checkbox / Toggle de Recorrência (Bloco 08) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecorrente}
                    onChange={(e) => {
                      setIsRecorrente(e.target.checked);
                      setConflictSuggestions(null);
                      setError('');
                    }}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-xs font-bold text-slate-800">Repetir agendamento (Reserva Recorrente)</span>
                  </div>
                </label>

                {isRecorrente && (
                  <div className="space-y-3 pt-2 border-t border-slate-200/80">
                    <div className="p-2 bg-amber-50 rounded-lg text-[11px] text-amber-800 border border-amber-200 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Verificação Rigorosa:</strong> Testaremos todas as ocorrências da série contra a agenda. Se houver qualquer sobreposição em alguma das datas, a série é rejeitada para evitar conflitos.
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                        Dias da Semana de Ocorrência
                      </label>
                      <div className="grid grid-cols-7 gap-1">
                        {diasSemanaNomes.map((nome, idx) => {
                          const active = diasSemana.includes(idx);
                          return (
                            <button
                              type="button"
                              key={idx}
                              onClick={() => toggleDiaSemana(idx)}
                              className={`py-1.5 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                                active
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {nome}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Data Início da Série</label>
                        <input
                          type="date"
                          required
                          value={formData.data_inicio.slice(0, 10)}
                          onChange={(e) => updateFormData({ data_inicio: `${e.target.value}T${horaInicio}` })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Data Limite da Repetição</label>
                        <input
                          type="date"
                          required
                          value={dataFimSerie}
                          onChange={(e) => setDataFimSerie(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Horário Inicial</label>
                        <input
                          type="time"
                          required
                          value={horaInicio}
                          onChange={(e) => setHoraInicio(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Horário Final</label>
                        <input
                          type="time"
                          required
                          value={horaFim}
                          onChange={(e) => setHoraFim(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600">
                      O sistema usará a tolerância administrativa atual de {toleranciaNoShow} minutos para a verificação de no-show.
                    </p>
                  </div>
                )}
              </div>

              {/* Data Início e Fim (Modo simples) */}
              {!isRecorrente && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Início da Reserva</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.data_inicio}
                      onChange={(e) => updateFormData({ data_inicio: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Término da Reserva</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.data_fim}
                      onChange={(e) => updateFormData({ data_fim: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Finalidade / Projeto Acadêmico</label>
                <input
                  type="text"
                  required
                  value={formData.finalidade}
                  onChange={(e) => updateFormData({ finalidade: e.target.value })}
                  placeholder="Ex: TCC - Fabricação mecânica e testes em bancada"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Observações Adicionais (opcional)</label>
                <textarea
                  rows="2"
                  value={formData.observacoes}
                  onChange={(e) => updateFormData({ observacoes: e.target.value })}
                  placeholder="Materiais que serão levados ou observações de segurança..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                ></textarea>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm cursor-pointer"
                >
                  {isRecorrente ? 'Confirmar Série Recorrente' : 'Confirmar Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Detalhes da Reserva Selecionada */}
      {detalheModalOpen && reservaSelecionada && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Info className="w-5 h-5 text-teal-600" />
                Detalhes da Reserva #{reservaSelecionada.id || reservaSelecionada.id_reserva}
              </h3>
              <button onClick={() => setDetalheModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Recurso Reservado</span>
                <div className="font-bold text-slate-900 text-sm">
                  {reservaSelecionada.equipamento_nome || reservaSelecionada.espaco_nome}
                </div>
                {reservaSelecionada.equipamento_codigo && (
                  <div className="text-[11px] font-mono text-slate-500">
                    Patrimônio: {reservaSelecionada.equipamento_codigo}
                  </div>
                )}
                {reservaSelecionada.espaco_nome && reservaSelecionada.equipamento_nome && (
                  <div className="text-[11px] text-teal-700 font-medium">
                    Laboratório: {reservaSelecionada.espaco_nome}
                  </div>
                )}
                {reservaSelecionada.recorrente === 1 && (
                  <div className="inline-flex items-center gap-1 mt-1 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                    <Repeat className="w-3 h-3" />
                    <span>Integrante de série periódica</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Solicitante</span>
                  <div className="font-semibold text-slate-800">{reservaSelecionada.usuario_nome || 'N/A'}</div>
                  <div className="text-[11px] text-slate-500">{reservaSelecionada.usuario_email || ''}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                  <div>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
                      {reservaSelecionada.no_show === 1 ? 'No-Show' : reservaSelecionada.status}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Horário Agendado</span>
                <div className="text-slate-800 font-medium">
                  {new Date(reservaSelecionada.data_inicio).toLocaleString('pt-BR')} até{' '}
                  {new Date(reservaSelecionada.data_fim).toLocaleString('pt-BR')}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Finalidade</span>
                <p className="text-slate-700">{reservaSelecionada.finalidade || 'Uso acadêmico'}</p>
              </div>

              {reservaSelecionada.observacoes && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Observações</span>
                  <p className="text-slate-600 bg-slate-50 p-2 rounded-lg">{reservaSelecionada.observacoes}</p>
                </div>
              )}
            </div>

            <div className="pt-5 border-t border-slate-100 mt-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {(reservaSelecionada.status || '').toLowerCase() !== 'cancelada' && (
                  <button
                    onClick={() => handleInitiateCancel(reservaSelecionada)}
                    disabled={cancellingId === (reservaSelecionada.id || reservaSelecionada.id_reserva)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                  >
                    Cancelar Reserva
                  </button>
                )}

                {isAdmin && reservaSelecionada.no_show !== 1 && (reservaSelecionada.status || '').toLowerCase() !== 'cancelada' && (
                  <button
                    onClick={() => handleMarcarNoShow(reservaSelecionada.id || reservaSelecionada.id_reserva)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50 border border-amber-200 transition cursor-pointer"
                    title="Registrar que o usuário não compareceu"
                  >
                    Marcar No-Show
                  </button>
                )}
              </div>

              <button
                onClick={() => setDetalheModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Cancelamento de Série Recorrente (Bloco 08) */}
      {cancelRecModalOpen && reservaParaCancelar && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Repeat className="w-5 h-5 text-indigo-600" />
                Cancelar Ocorrência Recorrente
              </h3>
              <button onClick={() => setCancelRecModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Esta reserva é integrante de uma série periódica. Selecione como deseja proceder com o cancelamento:
            </p>

            <div className="space-y-3">
              <label className={`block p-3 rounded-xl border cursor-pointer transition ${
                tipoCancelamento === 'apenas_esta'
                  ? 'border-teal-500 bg-teal-50/50 ring-1 ring-teal-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="tipo_canc"
                    value="apenas_esta"
                    checked={tipoCancelamento === 'apenas_esta'}
                    onChange={() => setTipoCancelamento('apenas_esta')}
                    className="mt-0.5 text-teal-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">
                      Apenas esta ocorrência ({new Date(reservaParaCancelar.data_inicio).toLocaleDateString('pt-BR')})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Libera este horário sem destruir nem alterar as demais semanas da série.
                    </span>
                  </div>
                </div>
              </label>

              <label className={`block p-3 rounded-xl border cursor-pointer transition ${
                tipoCancelamento === 'proximas'
                  ? 'border-teal-500 bg-teal-50/50 ring-1 ring-teal-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="tipo_canc"
                    value="proximas"
                    checked={tipoCancelamento === 'proximas'}
                    onChange={() => setTipoCancelamento('proximas')}
                    className="mt-0.5 text-teal-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">
                      Esta e todas as próximas ocorrências
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Encerra a série a partir desta data, mantendo o histórico das datas anteriores.
                    </span>
                  </div>
                </div>
              </label>

              <label className={`block p-3 rounded-xl border cursor-pointer transition ${
                tipoCancelamento === 'toda_serie'
                  ? 'border-rose-500 bg-rose-50/40 ring-1 ring-rose-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="tipo_canc"
                    value="toda_serie"
                    checked={tipoCancelamento === 'toda_serie'}
                    onChange={() => setTipoCancelamento('toda_serie')}
                    className="mt-0.5 text-rose-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">
                      Toda a série recorrente
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Cancela todas as ocorrências vinculadas a este grupo de repetição.
                    </span>
                  </div>
                </div>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelRecModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelRecorrente}
                disabled={cancellingId !== null}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
              >
                {cancellingId ? 'Processando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
