import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  X,
  Cpu,
  User,
  AlertCircle
} from 'lucide-react';

export default function Ocorrencias() {
  const { user, isAdmin } = useAuth();
  const [ocorrencias, setOcorrencias] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalNewOpen, setModalNewOpen] = useState(false);
  const [modalDecidirOpen, setModalDecidirOpen] = useState(false);
  const [selectedOcorrencia, setSelectedOcorrencia] = useState(null);

  const [newForm, setNewForm] = useState({
    equipamento_id: '',
    titulo: '',
    descricao: '',
    gravidade: 'media'
  });

  const [decisaoForm, setDecisaoForm] = useState({
    status: 'resolvida',
    decisao_admin: '',
    encaminhar_manutencao: false
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [resOc, resEq] = await Promise.all([
        api.get('/ocorrencias'),
        api.get('/equipamentos')
      ]);
      setOcorrencias(resOc.data);
      setEquipamentos(resEq.data);
    } catch (err) {
      console.error('[Ocorrencias] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenNew = () => {
    setNewForm({
      equipamento_id: equipamentos[0]?.id || equipamentos[0]?.id_equipamento || '',
      titulo: '',
      descricao: '',
      gravidade: 'media'
    });
    setError('');
    setModalNewOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/ocorrencias', newForm);
      setSuccess('Ocorrência registrada com sucesso!');
      setModalNewOpen(false);
      loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao registrar ocorrência');
    }
  };

  const handleOpenDecidir = (oc) => {
    setSelectedOcorrencia(oc);
    setDecisaoForm({
      status: 'resolvida',
      decisao_admin: oc.decisao_admin || oc.resposta_admin || '',
      encaminhar_manutencao: false
    });
    setError('');
    setModalDecidirOpen(true);
  };

  const handleDecidirSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const ocId = selectedOcorrencia.id || selectedOcorrencia.id_ocorrencia;
      await api.patch(`/ocorrencias/${ocId}/decidir`, decisaoForm);
      setSuccess('Decisão administrativa registrada com sucesso!');
      setModalDecidirOpen(false);
      loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar decisão');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ocorrências Operacionais</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro de anomalias, avarias em equipamentos e análise de incidentes
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Registrar Nova Ocorrência
        </button>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Lista de Ocorrências */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : ocorrencias.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">
          Nenhuma ocorrência registrada. Tudo operando com normalidade!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ocorrencias.map((oc) => {
            const ocId = oc.id || oc.id_ocorrencia;
            const status = (oc.status || 'aberta').toLowerCase();
            const gravidade = (oc.gravidade || 'media').toLowerCase();

            return (
              <div
                key={ocId}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{oc.titulo}</h3>
                        <span className="text-[11px] text-slate-400">
                          {oc.equipamento_nome ? `Equipamento: ${oc.equipamento_nome}` : 'Ocorrência Geral'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        gravidade === 'alta' ? 'bg-rose-100 text-rose-800' :
                        gravidade === 'media' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        Gravidade {gravidade}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                        status === 'resolvida' ? 'bg-emerald-50 text-emerald-700' :
                        status === 'rejeitada' ? 'bg-slate-100 text-slate-600' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {status}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 my-3">{oc.descricao}</p>

                  {oc.decisao_admin && (
                    <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs space-y-1 mb-3">
                      <span className="font-bold text-purple-900 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                        Decisão da Administração:
                      </span>
                      <p className="text-purple-800">{oc.decisao_admin}</p>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Autor: {oc.usuario_nome || `Usuário #${oc.usuario_id}`}</span>
                    <span>{oc.data_registro ? new Date(oc.data_registro).toLocaleDateString('pt-BR') : ''}</span>
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleOpenDecidir(oc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Analisar e Decidir
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nova Ocorrência */}
      {modalNewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base">Registrar Ocorrência</h3>
              <button onClick={() => setModalNewOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Título da Ocorrência</label>
                <input
                  type="text"
                  required
                  value={newForm.titulo}
                  onChange={(e) => setNewForm({ ...newForm, titulo: e.target.value })}
                  placeholder="Ex: Aquecimento excessivo na fonte do osciloscópio"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Equipamento Envolvido</label>
                  <select
                    value={newForm.equipamento_id}
                    onChange={(e) => setNewForm({ ...newForm, equipamento_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="">Não vinculado a equipamento específico</option>
                    {equipamentos.map((eq) => (
                      <option key={eq.id || eq.id_equipamento} value={eq.id || eq.id_equipamento}>
                        {eq.nome} ({eq.codigo_patrimonio || eq.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nível de Gravidade</label>
                  <select
                    value={newForm.gravidade}
                    onChange={(e) => setNewForm({ ...newForm, gravidade: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="baixa">Baixa (Observação operacional)</option>
                    <option value="media">Média (Avaria parcial)</option>
                    <option value="alta">Alta (Risco operacional / Falha crítica)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição Detalhada do Ocorrido</label>
                <textarea
                  rows="4"
                  required
                  value={newForm.descricao}
                  onChange={(e) => setNewForm({ ...newForm, descricao: e.target.value })}
                  placeholder="Descreva o comportamento anômalo, barulhos, fumaça ou avarias observadas..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                ></textarea>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNewOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm"
                >
                  Registrar Ocorrência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Decisão Administrativa */}
      {modalDecidirOpen && selectedOcorrencia && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base">Decisão sobre a Ocorrência</h3>
              <button onClick={() => setModalDecidirOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDecidirSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Novo Status da Ocorrência</label>
                <select
                  value={decisaoForm.status}
                  onChange={(e) => setDecisaoForm({ ...decisaoForm, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  <option value="em_analise">Em Análise Técnica</option>
                  <option value="resolvida">Resolvida</option>
                  <option value="rejeitada">Rejeitada / Improcedente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parecer Técnico / Decisão Administrativa
                </label>
                <textarea
                  rows="3"
                  required
                  value={decisaoForm.decisao_admin}
                  onChange={(e) => setDecisaoForm({ ...decisaoForm, decisao_admin: e.target.value })}
                  placeholder="Justifique o encaminhamento ou informe medidas tomadas..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                ></textarea>
              </div>

              {selectedOcorrencia.equipamento_id && (
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <input
                      type="checkbox"
                      checked={decisaoForm.encaminhar_manutencao}
                      onChange={(e) => setDecisaoForm({ ...decisaoForm, encaminhar_manutencao: e.target.checked })}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800">Bloquear e encaminhar equipamento para Manutenção</span>
                      <p className="text-slate-500 text-[11px]">
                        Atualiza o status do equipamento imediatamente para 'manutencao'.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalDecidirOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm"
                >
                  Salvar Decisão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
