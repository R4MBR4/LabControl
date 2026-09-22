import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import QRCodeModal from '../components/QRCodeModal';
import {
  Cpu,
  Plus,
  Search,
  QrCode,
  History,
  ShieldAlert,
  Building2,
  Tag,
  Edit,
  Trash2,
  X,
  CheckCircle2,
  Filter
} from 'lucide-react';

export default function Equipamentos() {
  const { isAdmin } = useAuth();
  const [equipamentos, setEquipamentos] = useState([]);
  const [espacos, setEspacos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedQR, setSelectedQR] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEquip, setEditingEquip] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    codigo_patrimonio: '',
    espaco_id: '',
    tipo: '',
    status: 'disponivel',
    exige_capacitacao: false,
    descricao: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [resEquip, resEsp] = await Promise.all([
        api.get('/equipamentos'),
        api.get('/espacos')
      ]);
      setEquipamentos(resEquip.data);
      setEspacos(resEsp.data);
    } catch (err) {
      console.error('[Equipamentos] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (equip = null) => {
    if (equip) {
      setEditingEquip(equip);
      setFormData({
        nome: equip.nome || '',
        codigo_patrimonio: equip.codigo_patrimonio || equip.patrimonio || equip.codigo || '',
        espaco_id: equip.espaco_id || equip.id_espaco || '',
        tipo: equip.tipo || '',
        status: equip.status || 'disponivel',
        exige_capacitacao: equip.exige_capacitacao === 1 || equip.exige_capacitacao === true,
        descricao: equip.descricao || ''
      });
    } else {
      setEditingEquip(null);
      setFormData({
        nome: '',
        codigo_patrimonio: `EQ-${Math.floor(1000 + Math.random() * 9000)}`,
        espaco_id: espacos[0]?.id || espacos[0]?.id_espaco || '',
        tipo: '',
        status: 'disponivel',
        exige_capacitacao: false,
        descricao: ''
      });
    }
    setError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingEquip(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...formData,
        exige_capacitacao: formData.exige_capacitacao ? 1 : 0
      };

      if (editingEquip) {
        const id = editingEquip.id || editingEquip.id_equipamento;
        await api.put(`/equipamentos/${id}`, payload);
        setSuccess('Equipamento atualizado com sucesso!');
      } else {
        await api.post('/equipamentos', payload);
        setSuccess('Equipamento cadastrado com sucesso!');
      }
      handleCloseModal();
      loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar equipamento');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente remover este equipamento?')) return;
    try {
      await api.delete(`/equipamentos/${id}`);
      setSuccess('Equipamento excluído com sucesso');
      loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir equipamento');
    }
  };

  const filtered = equipamentos.filter((e) => {
    const matchesSearch =
      e.nome?.toLowerCase().includes(search.toLowerCase()) ||
      (e.codigo_patrimonio || e.codigo || '').toLowerCase().includes(search.toLowerCase()) ||
      e.tipo?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = !statusFilter || (e.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Equipamentos & Instrumentos</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rastreabilidade por QR Code, histórico de manutenções e controle de capacitação técnica
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Novo Equipamento
          </button>
        )}
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, patrimônio ou tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          >
            <option value="">Todos os status</option>
            <option value="disponivel">Disponível</option>
            <option value="em_uso">Em Uso</option>
            <option value="manutencao">Em Manutenção</option>
          </select>
        </div>
      </div>

      {/* Grid de Equipamentos */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">
          Nenhum equipamento encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((equip) => {
            const equipId = equip.id || equip.id_equipamento;
            const status = (equip.status || 'disponivel').toLowerCase();
            const codigo = equip.codigo_patrimonio || equip.patrimonio || equip.codigo || `EQ-${equipId}`;
            const exigeCap = equip.exige_capacitacao === 1 || equip.exige_capacitacao === true;

            return (
              <div
                key={equipId}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md mb-1.5">
                        <Tag className="w-3 h-3" />
                        {codigo}
                      </span>
                      <h3 className="font-bold text-slate-800 text-sm">{equip.nome}</h3>
                      <p className="text-[11px] text-slate-500">{equip.tipo || 'Equipamento Geral'}</p>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      status === 'disponivel' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      status === 'manutencao' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      status === 'em_uso' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {status}
                    </span>
                  </div>

                  {equip.descricao && (
                    <p className="text-xs text-slate-600 mb-3 line-clamp-2">{equip.descricao}</p>
                  )}

                  {/* Badges e Informações */}
                  <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                    {equip.espaco_nome && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Espaço: {equip.espaco_nome}</span>
                      </div>
                    )}

                    {exigeCap && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-semibold">
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                        <span>Exige Capacitação Obrigatória</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedQR(equip)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-semibold transition"
                      title="Ver QR Code do Equipamento"
                    >
                      <QrCode className="w-3.5 h-3.5 text-teal-600" />
                      <span>QR Code</span>
                    </button>

                    <Link
                      to={`/equipamentos/${equipId}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition"
                      title="Ver Histórico Completo de Rastreabilidade"
                    >
                      <History className="w-3.5 h-3.5 text-slate-400" />
                      <span>Histórico</span>
                    </Link>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenModal(equip)}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(equipId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal QR Code */}
      <QRCodeModal
        isOpen={!!selectedQR}
        onClose={() => setSelectedQR(null)}
        equipamento={selectedQR}
      />

      {/* Modal Criar / Editar Equipamento */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base">
                {editingEquip ? 'Editar Equipamento' : 'Cadastrar Novo Equipamento'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Equipamento</label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Impressora 3D Creality Ender 3 Pro"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Código / Patrimônio</label>
                  <input
                    type="text"
                    required
                    value={formData.codigo_patrimonio}
                    onChange={(e) => setFormData({ ...formData, codigo_patrimonio: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo / Categoria</label>
                  <input
                    type="text"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    placeholder="Ex: Prototipagem, Óptico..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Espaço Vinculado</label>
                  <select
                    value={formData.espaco_id}
                    onChange={(e) => setFormData({ ...formData, espaco_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="">Nenhum espaço vinculado</option>
                    {espacos.map((esp) => (
                      <option key={esp.id || esp.id_espaco} value={esp.id || esp.id_espaco}>
                        {esp.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status Operacional</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="em_uso">Em Uso</option>
                    <option value="manutencao">Em Manutenção</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.exige_capacitacao}
                    onChange={(e) => setFormData({ ...formData, exige_capacitacao: e.target.checked })}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Exige Capacitação Obrigatória do Usuário para Reserva/Uso
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 pl-6 mt-0.5">
                  Se marcado, apenas usuários cadastrados na tabela de capacitação poderão realizar reservas e check-in.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Especificações Técnicas / Observações</label>
                <textarea
                  rows="3"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Instruções de segurança, voltagem, limites operacionais..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                ></textarea>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm"
                >
                  {editingEquip ? 'Salvar Alterações' : 'Cadastrar Equipamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
