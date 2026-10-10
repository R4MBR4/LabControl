import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LoadError from '../components/LoadError';
import { Building2, Plus, Search, MapPin, Users, Edit, Trash2, X, CheckCircle2, Eye, Tv, Shield } from 'lucide-react';

export default function Espacos() {
  const { isAdmin } = useAuth();
  const [espacos, setEspacos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEspaco, setEditingEspaco] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'Laboratório',
    capacidade: 30,
    localizacao: '',
    descricao: '',
    responsavel: '',
    regras_utilizacao: '',
    status: 'disponivel'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadEspacos = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get('/espacos');
      setEspacos(res.data);
    } catch (err) {
      console.error('[Espacos] Erro:', err);
      setLoadError(err.response?.data?.error || 'Verifique a conexão e tente carregar novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEspacos();
  }, []);

  const handleOpenModal = (espaco = null) => {
    if (espaco) {
      setEditingEspaco(espaco);
      setFormData({
        nome: espaco.nome || '',
        tipo: espaco.tipo || 'Laboratório',
        capacidade: espaco.capacidade || 30,
        localizacao: espaco.localizacao || '',
        descricao: espaco.descricao || '',
        responsavel: espaco.responsavel || '',
        regras_utilizacao: espaco.regras_utilizacao || '',
        status: espaco.status || 'disponivel'
      });
    } else {
      setEditingEspaco(null);
      setFormData({
        nome: '',
        tipo: 'Laboratório',
        capacidade: 30,
        localizacao: '',
        descricao: '',
        responsavel: '',
        regras_utilizacao: '',
        status: 'disponivel'
      });
    }
    setError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingEspaco(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingEspaco) {
        const id = editingEspaco.id || editingEspaco.id_espaco;
        await api.put(`/espacos/${id}`, formData);
        setSuccess('Espaço atualizado com sucesso!');
      } else {
        await api.post('/espacos', formData);
        setSuccess('Espaço cadastrado com sucesso!');
      }
      handleCloseModal();
      loadEspacos();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar espaço');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente remover este espaço?')) return;
    try {
      await api.delete(`/espacos/${id}`);
      setSuccess('Espaço removido com sucesso');
      loadEspacos();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir espaço');
    }
  };

  const filtered = espacos.filter(e =>
    (statusFilter === 'todos' || String(e.status || 'disponivel').toLowerCase() === statusFilter) &&
    (
      e.nome?.toLowerCase().includes(search.toLowerCase()) ||
      e.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      e.localizacao?.toLowerCase().includes(search.toLowerCase()) ||
      e.tipo?.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Espaços e Laboratórios</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ambientes de ensino, pesquisa e experimentos disponíveis na instituição
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Novo Espaço
          </button>
        )}
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}
      <LoadError message={loadError} onRetry={loadEspacos} />

      {/* Busca */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Buscar por nome, código ou localização..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
          />
        </div>
        <select
          aria-label="Filtrar espaços por status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 sm:w-auto"
        >
          <option value="todos">Todos os status</option>
          <option value="disponivel">Disponível</option>
          <option value="manutencao">Em manutenção</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {/* Grid de Espaços */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : loadError ? null : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">
          {search || statusFilter !== 'todos'
            ? 'Nenhum espaço corresponde aos filtros selecionados. Ajuste a busca ou o status.'
            : 'Nenhum espaço cadastrado no momento.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((esp) => {
            const espId = esp.id || esp.id_espaco;
            const status = (esp.status || 'disponivel').toLowerCase();
            return (
              <div
                key={espId}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{esp.nome}</h3>
                        <span className="text-[11px] font-medium text-slate-500">{esp.tipo || 'Laboratório'}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      status === 'disponivel' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      status === 'manutencao' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {status}
                    </span>
                  </div>

                  {esp.descricao && (
                    <p className="text-xs text-slate-600 mb-4 line-clamp-2">{esp.descricao}</p>
                  )}

                  <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    {esp.responsavel && (
                      <div className="flex items-center gap-2 text-teal-700 font-medium">
                        <Shield className="w-3.5 h-3.5 text-teal-600" />
                        <span>Responsável: {esp.responsavel}</span>
                      </div>
                    )}
                    {esp.localizacao && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{esp.localizacao}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Capacidade: {esp.capacidade || 'N/A'} pessoas</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/espacos/${espId}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition"
                      title="Ver detalhes completos, inventário e agenda"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Painel Lab
                    </Link>
                    <Link
                      to={`/espacos/${espId}/monitor`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs"
                      title="Abrir Painel de Ocupação da Porta (Exibição Kiosk em Tempo Real)"
                    >
                      <Tv className="w-3.5 h-3.5 text-teal-400" />
                      Painel Kiosk
                    </Link>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenModal(esp)}
                        className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(espId)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Excluir"
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

      {/* Modal Criar / Editar Espaço */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base">
                {editingEspaco ? 'Editar Espaço' : 'Cadastrar Novo Espaço'}
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Espaço / Sala</label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Laboratório de Robótica Avançada"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Ambiente</label>
                  <input
                    type="text"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    placeholder="Laboratório / Sala / Auditório"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Capacidade (Pessoas)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacidade}
                    onChange={(e) => setFormData({ ...formData, capacidade: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Localização (Bloco / Sala)</label>
                  <input
                    type="text"
                    value={formData.localizacao}
                    onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                    placeholder="Ex: Bloco B, Sala 204"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Responsável / Docente</label>
                  <input
                    type="text"
                    value={formData.responsavel}
                    onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    placeholder="Ex: Prof. Dr. Silva"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status Operacional</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="disponivel">Disponível</option>
                  <option value="manutencao">Em Manutenção</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição / Recursos do Espaço</label>
                <textarea
                  rows="2"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Bancadas de teste com fontes DC, osciloscópios..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Regras de Utilização / Segurança</label>
                <textarea
                  rows="2"
                  value={formData.regras_utilizacao}
                  onChange={(e) => setFormData({ ...formData, regras_utilizacao: e.target.value })}
                  placeholder="Obrigatório uso de jaleco e óculos de proteção. Proibido alimentos no recinto."
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
                  {editingEspaco ? 'Salvar Alterações' : 'Cadastrar Espaço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
