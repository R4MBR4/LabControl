import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Wrench,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Cpu,
  User,
  X,
  FileCheck
} from 'lucide-react';

export default function Manutencao() {
  const [manutencoes, setManutencoes] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalNewOpen, setModalNewOpen] = useState(false);
  const [modalConcluirOpen, setModalConcluirOpen] = useState(false);
  const [selectedManutencao, setSelectedManutencao] = useState(null);

  const [newForm, setNewForm] = useState({
    equipamento_id: '',
    tipo: 'corretiva',
    descricao: '',
    custo: 0,
    responsavel: ''
  });

  const [concluirForm, setConcluirForm] = useState({
    laudo_tecnico: '',
    custo: 0
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [resMan, resEq] = await Promise.all([
        api.get('/manutencoes'),
        api.get('/equipamentos')
      ]);
      setManutencoes(resMan.data);
      setEquipamentos(resEq.data);
    } catch (err) {
      console.error('[Manutencao] Erro:', err);
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
      tipo: 'corretiva',
      descricao: '',
      custo: 0,
      responsavel: ''
    });
    setError('');
    setModalNewOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/manutencoes', newForm);
      setSuccess('Manutenção iniciada e equipamento bloqueado automaticamente!');
      setModalNewOpen(false);
      loadData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao registrar manutenção');
    }
  };

  const handleOpenConcluir = (m) => {
    setSelectedManutencao(m);
    setConcluirForm({
      laudo_tecnico: 'Equipamento testado, calibrado e operacional para retorno às atividades.',
      custo: m.custo || 0
    });
    setError('');
    setModalConcluirOpen(true);
  };

  const handleConcluirSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const mId = selectedManutencao.id || selectedManutencao.id_manutencao;
      await api.patch(`/manutencoes/${mId}/concluir`, concluirForm);
      setSuccess('Manutenção concluída! Equipamento desbloqueado e retornado ao status disponível com sucesso.');
      setModalConcluirOpen(false);
      loadData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao concluir manutenção');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Manutenções</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fluxo rigoroso: Bloqueio imediato → Execução técnica → Conclusão e liberação de equipamento
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Iniciar Nova Manutenção (Bloquear)
        </button>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Lista de Manutenções */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : manutencoes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">
          Nenhuma manutenção em andamento ou registrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {manutencoes.map((m) => {
            const mId = m.id || m.id_manutencao;
            const isConcluida = (m.status || '').toLowerCase() === 'concluida';

            return (
              <div
                key={mId}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isConcluida ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {m.equipamento_nome || `Equipamento #${m.equipamento_id}`}
                        </h3>
                        <span className="text-[11px] font-mono text-slate-400">
                          {m.equipamento_codigo || 'Sem código'}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isConcluida
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                    }`}>
                      {m.status || 'em_andamento'}
                    </span>
                  </div>

                  <div className="my-3 space-y-1.5 text-xs">
                    <p className="text-slate-700 font-medium">
                      <strong className="text-slate-900">Tipo:</strong> {m.tipo ? m.tipo.toUpperCase() : 'CORRETIVA'}
                    </p>
                    <p className="text-slate-600">{m.descricao}</p>
                    {m.observacoes && (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-600 text-[11px]">
                        <strong>Laudo / Devolução:</strong> {m.observacoes}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-3 border-t border-slate-100">
                    <div>
                      <span>Início: <strong>{m.data_inicio ? new Date(m.data_inicio).toLocaleDateString('pt-BR') : '-'}</strong></span>
                    </div>
                    <div>
                      <span>Término: <strong>{m.data_fim ? new Date(m.data_fim).toLocaleDateString('pt-BR') : 'Em andamento'}</strong></span>
                    </div>
                    <div>
                      <span>Responsável: <strong>{m.responsavel || 'Técnico de Laboratório'}</strong></span>
                    </div>
                    <div>
                      <span>Custo: <strong>R$ {Number(m.custo || 0).toFixed(2)}</strong></span>
                    </div>
                  </div>
                </div>

                {!isConcluida && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleOpenConcluir(m)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Concluir e Liberar Equipamento
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Iniciar Manutenção (Bloqueio) */}
      {modalNewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-rose-600">
                <Wrench className="w-5 h-5" />
                <h3 className="font-bold text-slate-800 text-base">Registrar Manutenção & Bloquear</h3>
              </div>
              <button onClick={() => setModalNewOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 mb-4">
              ⚠️ O equipamento selecionado terá seu status alterado para <strong>"manutencao"</strong> e ficará indisponível para reservas e check-ins até a conclusão deste processo.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Selecione o Equipamento</label>
                <select
                  value={newForm.equipamento_id}
                  onChange={(e) => setNewForm({ ...newForm, equipamento_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  {equipamentos.map((eq) => (
                    <option key={eq.id || eq.id_equipamento} value={eq.id || eq.id_equipamento}>
                      {eq.nome} ({eq.codigo_patrimonio || eq.codigo}) - Atual: {eq.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Manutenção</label>
                  <select
                    value={newForm.tipo}
                    onChange={(e) => setNewForm({ ...newForm, tipo: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  >
                    <option value="corretiva">Corretiva (Reparo de Avaria)</option>
                    <option value="preventiva">Preventiva (Calibração / Limpeza)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Custo Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newForm.custo}
                    onChange={(e) => setNewForm({ ...newForm, custo: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Técnico / Responsável</label>
                <input
                  type="text"
                  value={newForm.responsavel}
                  onChange={(e) => setNewForm({ ...newForm, responsavel: e.target.value })}
                  placeholder="Nome do técnico ou assistência técnica autorizada"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição do Diagnóstico e Serviço</label>
                <textarea
                  rows="3"
                  required
                  value={newForm.descricao}
                  onChange={(e) => setNewForm({ ...newForm, descricao: e.target.value })}
                  placeholder="Descreva o problema detectado e o escopo do reparo..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
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
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm"
                >
                  Bloquear e Iniciar Manutenção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Concluir Manutenção (Liberação Automática) */}
      {modalConcluirOpen && selectedManutencao && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-bold text-slate-800 text-base">Conclusão e Desbloqueio do Equipamento</h3>
              </div>
              <button onClick={() => setModalConcluirOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200 mb-4">
              Ao confirmar a conclusão, o equipamento será imediatamente retornado ao status <strong>"disponivel"</strong> para agendamentos e utilizações.
            </p>

            <form onSubmit={handleConcluirSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Custo Final Realizado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={concluirForm.custo}
                  onChange={(e) => setConcluirForm({ ...concluirForm, custo: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Laudo Técnico / Observações de Conclusão</label>
                <textarea
                  rows="3"
                  required
                  value={concluirForm.laudo_tecnico}
                  onChange={(e) => setConcluirForm({ ...concluirForm, laudo_tecnico: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalConcluirOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                >
                  Concluir e Liberar Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
