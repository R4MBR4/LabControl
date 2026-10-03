import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  CalendarCheck,
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
  X
} from 'lucide-react';

export default function Reservas() {
  const { user, isAdmin } = useAuth();
  const [reservas, setReservas] = useState([]);
  const [espacos, setEspacos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todas'); // 'todas', 'ativas'
  const [modalOpen, setModalOpen] = useState(false);
  const [tipoRecurso, setTipoRecurso] = useState('equipamento'); // 'equipamento' ou 'espaco'

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

  const loadData = async () => {
    try {
      setLoading(true);
      const [resReservas, resEsp, resEquip] = await Promise.all([
        api.get('/reservas'),
        api.get('/espacos'),
        api.get('/equipamentos')
      ]);
      setReservas(resReservas.data);
      setEspacos(resEsp.data);
      setEquipamentos(resEquip.data);
    } catch (err) {
      console.error('[Reservas] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = () => {
    // Define horário inicial sugerido (próxima hora cheia)
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const startStr = now.toISOString().slice(0, 16);

    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    const endStr = end.toISOString().slice(0, 16);

    setFormData({
      equipamento_id: equipamentos[0]?.id || equipamentos[0]?.id_equipamento || '',
      espaco_id: espacos[0]?.id || espacos[0]?.id_espaco || '',
      data_inicio: startStr,
      data_fim: endStr,
      finalidade: '',
      observacoes: ''
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const payload = {
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        finalidade: formData.finalidade,
        observacoes: formData.observacoes,
        equipamento_id: tipoRecurso === 'equipamento' ? formData.equipamento_id : null,
        espaco_id: tipoRecurso === 'espaco' ? formData.espaco_id : null,
      };

      await api.post('/reservas', payload);
      setSuccess('Reserva confirmada com sucesso! Sem conflitos de horário identificados.');
      setModalOpen(false);
      loadData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao realizar reserva');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Deseja realmente cancelar esta reserva?')) return;
    try {
      setCancellingId(id);
      setError('');
      await api.put(`/reservas/${id}/cancelar`);
      setSuccess('Reserva cancelada com sucesso!');
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao cancelar reserva');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reservas de Recursos</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Agendamentos com prevenção automática de sobreposição e verificação de habilitação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Alternador de Filtro: Ativas / Todas */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200">
            <button
              onClick={() => setFiltroStatus('ativas')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filtroStatus === 'ativas'
                  ? 'bg-white text-teal-700 shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              Ativas ({reservas.filter(r => (r.status || '').toLowerCase() !== 'cancelada').length})
            </button>
            <button
              onClick={() => setFiltroStatus('todas')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filtroStatus === 'todas'
                  ? 'bg-white text-teal-700 shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              Todas / Histórico ({reservas.length})
            </button>
          </div>

          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Solicitar Nova Reserva
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-2">
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
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Lista de Reservas */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : reservas.filter(r => filtroStatus === 'todas' || (r.status || 'confirmada').toLowerCase() !== 'cancelada').length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">
          {filtroStatus === 'ativas' ? 'Nenhuma reserva ativa no momento (todas foram concluídas ou canceladas).' : 'Nenhuma reserva registrada.'}
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
                {reservas
                  .filter(r => filtroStatus === 'todas' || (r.status || 'confirmada').toLowerCase() !== 'cancelada')
                  .map((r) => {
                  const resId = r.id || r.id_reserva;
                  const status = (r.status || 'confirmada').toLowerCase();
                  const userRole = (user?.perfil || '').toLowerCase();
                  const isPrivileged = isAdmin || userRole === 'professor' || userRole === 'docente';
                  const isOwner = Number(r.usuario_id || r.id_usuario) === Number(user?.id);
                  const canCancel = (isOwner || isPrivileged) && status !== 'cancelada';

                  return (
                    <tr key={resId} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                            {r.equipamento_nome ? <Cpu className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">
                              {r.equipamento_nome || r.espaco_nome || `Recurso #${resId}`}
                            </span>
                            {r.equipamento_codigo && (
                              <span className="block font-mono text-[10px] text-slate-400">
                                {r.equipamento_codigo}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        <span className="font-medium text-slate-800">{r.usuario_nome || `Usuário #${r.usuario_id}`}</span>
                        {r.usuario_email && <span className="block text-[10px] text-slate-400">{r.usuario_email}</span>}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        <div>De: <strong>{r.data_inicio ? new Date(r.data_inicio).toLocaleString('pt-BR') : '-'}</strong></div>
                        <div>Até: <strong>{r.data_fim ? new Date(r.data_fim).toLocaleString('pt-BR') : '-'}</strong></div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">
                        {r.finalidade || r.observacoes || 'Uso acadêmico/pesquisa'}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          status === 'confirmada' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          status === 'cancelada' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          status === 'em_andamento' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          status === 'pendente' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {status === 'cancelada' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            Cancelada
                          </span>
                        ) : canCancel ? (
                          <button
                            onClick={() => handleCancel(resId)}
                            disabled={cancellingId === resId}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 transition cursor-pointer disabled:opacity-50"
                            title="Cancelar esta reserva"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {cancellingId === resId ? 'Cancelando...' : 'Cancelar'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic" title="Apenas o solicitante ou a administração podem cancelar esta reserva">
                            Apenas solicitante
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Nova Reserva */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base">Solicitar Reserva de Recurso</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo de Recurso */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipo de Recurso</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoRecurso('equipamento')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition ${
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
                    onClick={() => setTipoRecurso('espaco')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition ${
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
                    onChange={(e) => setFormData({ ...formData, equipamento_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
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
                    onChange={(e) => setFormData({ ...formData, espaco_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
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

              {/* Data Início e Fim */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data e Hora de Início</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data e Hora de Término</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.data_fim}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Finalidade / Projeto Acadêmico</label>
                <input
                  type="text"
                  required
                  value={formData.finalidade}
                  onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })}
                  placeholder="Ex: Trabalho de Conclusão de Curso - Impressão de chassi robótico"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm"
                >
                  Confirmar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
