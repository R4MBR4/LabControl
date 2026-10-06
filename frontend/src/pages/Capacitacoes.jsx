import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  GraduationCap,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Cpu,
  User,
  X,
  Trash2
} from 'lucide-react';

export default function Capacitacoes() {
  const { user, isAdmin } = useAuth();
  const [capacitacoes, setCapacitacoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    usuario_id: '',
    equipamento_id: '',
    data_capacitacao: new Date().toISOString().slice(0, 10),
    validade: '',
    status: 'ativo'
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const resCap = await api.get('/capacitacoes');
      setCapacitacoes(resCap.data);

      if (isAdmin) {
        const [resUsers, resEquips] = await Promise.all([
          api.get('/usuarios'),
          api.get('/equipamentos')
        ]);
        setUsuarios(resUsers.data);
        setEquipamentos(resEquips.data);

        if (resUsers.data.length > 0 && !formData.usuario_id) {
          setFormData(prev => ({ ...prev, usuario_id: resUsers.data[0].id || resUsers.data[0].id_usuario }));
        }
        if (resEquips.data.length > 0 && !formData.equipamento_id) {
          setFormData(prev => ({ ...prev, equipamento_id: resEquips.data[0].id || resEquips.data[0].id_equipamento }));
        }
      }
    } catch (err) {
      console.error('[Capacitacoes] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const handleOpenModal = () => {
    // Validade sugerida de 1 ano
    const valDate = new Date();
    valDate.setFullYear(valDate.getFullYear() + 1);

    setFormData({
      usuario_id: usuarios[0]?.id || usuarios[0]?.id_usuario || '',
      equipamento_id: equipamentos[0]?.id || equipamentos[0]?.id_equipamento || '',
      data_capacitacao: new Date().toISOString().slice(0, 10),
      validade: valDate.toISOString().slice(0, 10),
      status: 'ativo'
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/capacitacoes', formData);
      setSuccess('Capacitação concedida com sucesso! Usuário agora está habilitado a operar o equipamento.');
      setModalOpen(false);
      loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao conceder capacitação');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente revogar esta capacitação?')) return;
    try {
      await api.delete(`/capacitacoes/${id}`);
      setSuccess('Capacitação revogada com sucesso');
      loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Habilitações & Capacitações</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle de segurança: usuários autorizados a reservar e operar equipamentos que exigem certificação
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Conceder Nova Habilitação
          </button>
        )}
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabela ou Grid de Capacitações */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : capacitacoes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">
          Nenhuma capacitação registrada no momento.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Equipamento Habilitado</th>
                  <th className="px-5 py-3">Usuário Habilitado</th>
                  <th className="px-5 py-3">Data da Concessão</th>
                  <th className="px-5 py-3">Validade</th>
                  <th className="px-5 py-3">Status</th>
                  {isAdmin && <th className="px-5 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {capacitacoes.map((c) => {
                  const id = c.id || c.id_capacitacao;
                  const isValid = !c.validade || new Date(c.validade) >= new Date();

                  return (
                    <tr key={id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                            <Cpu className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-semibold text-slate-800">
                            {c.equipamento_nome || `Equipamento #${c.equipamento_id}`}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-700">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium">{c.usuario_nome || `Usuário #${c.usuario_id}`}</span>
                        </div>
                        {c.usuario_email && <span className="block text-[10px] text-slate-400 pl-5">{c.usuario_email}</span>}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        {c.data_capacitacao ? new Date(c.data_capacitacao).toLocaleDateString('pt-BR') : '-'}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        {c.validade ? new Date(c.validade).toLocaleDateString('pt-BR') : 'Indeterminada'}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isValid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <ShieldCheck className="w-3 h-3" />
                          {isValid ? 'Habilitado' : 'Vencido'}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleDelete(id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Revogar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Conceder Capacitação */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-teal-700">
                <GraduationCap className="w-5 h-5" />
                <h3 className="font-bold text-slate-800 text-base">Conceder Habilitação Técnica</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Selecione o Usuário / Aluno</label>
                <select
                  value={formData.usuario_id}
                  onChange={(e) => setFormData({ ...formData, usuario_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  {usuarios.map((u) => (
                    <option key={u.id || u.id_usuario} value={u.id || u.id_usuario}>
                      {u.nome} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Equipamento Restrito</label>
                <select
                  value={formData.equipamento_id}
                  onChange={(e) => setFormData({ ...formData, equipamento_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  {equipamentos.map((eq) => (
                    <option key={eq.id || eq.id_equipamento} value={eq.id || eq.id_equipamento}>
                      {eq.nome} ({eq.codigo_patrimonio || eq.codigo}) {eq.exige_capacitacao ? '🔒 [Exige Capacitação]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data da Capacitação</label>
                  <input
                    type="date"
                    required
                    value={formData.data_capacitacao}
                    onChange={(e) => setFormData({ ...formData, data_capacitacao: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Validade (Opcional)</label>
                  <input
                    type="date"
                    value={formData.validade}
                    onChange={(e) => setFormData({ ...formData, validade: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
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
                  Registrar Habilitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
