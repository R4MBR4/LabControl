import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LoadError from '../components/LoadError';
import {
  Boxes,
  Plus,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Search,
  Tag,
  X,
  Layers,
  History
} from 'lucide-react';

export default function Consumiveis() {
  const { isAdmin } = useAuth();
  const [consumiveis, setConsumiveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const [modalNewOpen, setModalNewOpen] = useState(false);
  const [modalMovOpen, setModalMovOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [movementHistory, setMovementHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [newForm, setNewForm] = useState({
    nome: '',
    categoria: 'Impressão 3D',
    quantidade: 10,
    quantidade_minima: 5,
    unidade: 'un',
    localizacao: ''
  });

  const [movForm, setMovForm] = useState({
    tipo: 'consumo',
    quantidade: 1,
    observacao: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get('/consumiveis');
      setConsumiveis(res.data);
    } catch (err) {
      console.error('[Consumiveis] Erro:', err);
      setLoadError(err.response?.data?.error || 'Verifique a conexão e tente carregar novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenNew = () => {
    setNewForm({
      nome: '',
      categoria: 'Impressão 3D',
      quantidade: 10,
      quantidade_minima: 5,
      unidade: 'un',
      localizacao: ''
    });
    setError('');
    setModalNewOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/consumiveis', newForm);
      setSuccess('Consumível cadastrado com sucesso!');
      setModalNewOpen(false);
      loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar item');
    }
  };

  const handleOpenMov = (item) => {
    setSelectedItem(item);
    setMovForm({
      tipo: 'consumo',
      quantidade: 1,
      observacao: ''
    });
    setError('');
    setModalMovOpen(true);
  };

  const handleMovSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Regra crítica: Estoque não pode ser negativo
    const saldoAtual = Number(selectedItem.quantidade || selectedItem.qtd || 0);
    const qtdMov = Number(movForm.quantidade);

    if (['saida', 'consumo'].includes(movForm.tipo) && qtdMov > saldoAtual) {
      setError(`Estoque insuficiente! Saldo atual é ${saldoAtual} ${selectedItem.unidade_medida || selectedItem.unidade || 'un'}. O estoque não pode ficar negativo.`);
      return;
    }

    try {
      const id = selectedItem.id || selectedItem.id_consumivel;
      await api.post(`/consumiveis/${id}/movimentar`, {
        tipo: movForm.tipo,
        quantidade: qtdMov,
        observacao: movForm.observacao
      });
      setSuccess(`Movimentação de estoque (${movForm.tipo.toUpperCase()}) concluída com sucesso!`);
      setModalMovOpen(false);
      loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao movimentar estoque');
    }
  };

  const handleOpenHistory = async (item) => {
    setSelectedItem(item);
    setMovementHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    setHistoryModalOpen(true);
    const id = item.id || item.id_consumivel;
    try {
      const response = await api.get(`/consumiveis/${id}/historico`);
      setMovementHistory(response.data);
    } catch (err) {
      console.error('[Consumiveis] Erro ao carregar histórico:', err);
      setHistoryError(err.response?.data?.error || 'Não foi possível carregar o histórico.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = consumiveis.filter(c =>
    c.nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.categoria?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Estoque de Consumíveis</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Materiais de consumo, filamentos, componentes e alertas automáticos de reposição
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Novo Consumível
          </button>
        )}
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}
      <LoadError message={loadError} onRetry={loadData} />

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar consumível ou categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
        />
      </div>

      {/* Grid de Consumíveis */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : loadError ? null : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">
          Nenhum item consumível encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => {
            const id = item.id || item.id_consumivel;
            const qtd = Number(item.quantidade || item.qtd || 0);
            const qtdMin = Number(item.quantidade_minima || item.estoque_minimo || item.qtd_minima || 0);
            const isCritico = item.estoque_critico || qtd <= qtdMin;

            return (
              <div
                key={id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition flex flex-col justify-between ${
                  isCritico ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isCritico ? 'bg-amber-100 text-amber-700' : 'bg-teal-50 text-teal-600'
                      }`}>
                        <Boxes className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{item.nome}</h3>
                        <span className="text-[11px] text-slate-400">{item.categoria || 'Geral'}</span>
                      </div>
                    </div>

                    {isCritico ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Estoque Baixo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Normal
                      </span>
                    )}
                  </div>

                  {/* Informações de Estoque */}
                  <div className="my-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-around text-center">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400">Saldo Atual</span>
                      <p className={`text-xl font-extrabold ${isCritico ? 'text-amber-700' : 'text-slate-800'}`}>
                        {qtd} <span className="text-xs font-normal text-slate-500">{item.unidade_medida || item.unidade || 'un'}</span>
                      </p>
                    </div>
                    <div className="h-8 w-px bg-slate-200"></div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400">Estoque Mínimo</span>
                      <p className="text-xl font-bold text-slate-600">
                        {qtdMin} <span className="text-xs font-normal text-slate-400">{item.unidade_medida || item.unidade || 'un'}</span>
                      </p>
                    </div>
                  </div>

                  {item.localizacao && (
                    <p className="text-[11px] text-slate-500 mb-2">
                      Local no Almoxarifado: <strong>{item.localizacao}</strong>
                    </p>
                  )}
                </div>

                <div className="mt-2 pt-3 border-t border-slate-100 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenHistory(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
                  >
                    <History className="w-3.5 h-3.5" />
                    Histórico
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleOpenMov(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Movimentar Estoque
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Novo Consumível */}
      {modalNewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base">Cadastrar Item Consumível</h3>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Consumível</label>
                <input
                  type="text"
                  required
                  value={newForm.nome}
                  onChange={(e) => setNewForm({ ...newForm, nome: e.target.value })}
                  placeholder="Ex: Filamento PLA 1.75mm Preto 1kg"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
                  <input
                    type="text"
                    value={newForm.categoria}
                    onChange={(e) => setNewForm({ ...newForm, categoria: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unidade de Medida</label>
                  <input
                    type="text"
                    value={newForm.unidade}
                    onChange={(e) => setNewForm({ ...newForm, unidade: e.target.value })}
                    placeholder="un, kg, m, rolo..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantidade Inicial</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newForm.quantidade}
                    onChange={(e) => setNewForm({ ...newForm, quantidade: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estoque Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newForm.quantidade_minima}
                    onChange={(e) => setNewForm({ ...newForm, quantidade_minima: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Localização no Armário / Prateleira</label>
                <input
                  type="text"
                  value={newForm.localizacao}
                  onChange={(e) => setNewForm({ ...newForm, localizacao: e.target.value })}
                  placeholder="Armário A, Prateleira 2"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
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
                  Cadastrar Consumível
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimentar Estoque */}
      {modalMovOpen && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base">Movimentar Estoque</h3>
              <button onClick={() => setModalMovOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4 text-xs">
              <p className="font-bold text-slate-800">{selectedItem.nome}</p>
              <p className="text-slate-500">Saldo disponível em estoque: <strong>{selectedItem.quantidade} {selectedItem.unidade_medida || selectedItem.unidade || 'un'}</strong></p>
            </div>

            <form onSubmit={handleMovSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Movimentação</label>
                <select
                  value={movForm.tipo}
                  onChange={(e) => setMovForm({ ...movForm, tipo: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="consumo">Consumo</option>
                  <option value="reposicao">Reposição</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantidade a Movimentar</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={movForm.quantidade}
                  onChange={(e) => setMovForm({ ...movForm, quantidade: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo / Observação (opcional)</label>
                <textarea
                  rows="2"
                  maxLength="500"
                  value={movForm.observacao}
                  onChange={(e) => setMovForm({ ...movForm, observacao: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  placeholder="Ex.: consumo em aula prática ou reposição do almoxarifado"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalMovOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-sm"
                >
                  Confirmar Movimentação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Histórico de Movimentações</h3>
                <p className="text-xs text-slate-500">{selectedItem.nome}</p>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar histórico">
                <X className="w-5 h-5" />
              </button>
            </div>
            {historyError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{historyError}</p>}
            {historyLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">Carregando histórico...</div>
            ) : historyError ? null : movementHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">Ainda não há movimentações registradas.</div>
            ) : (
              <div className="space-y-2">
                {movementHistory.map((entry) => (
                  <article key={entry.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="capitalize text-slate-800">{entry.tipo}</strong>
                      <time className="text-[11px] text-slate-500">
                        {entry.criado_em ? new Date(entry.criado_em).toLocaleString('pt-BR') : 'Data não informada'}
                      </time>
                    </div>
                    <p className="mt-1 text-slate-600">
                      Saldo: {entry.quantidade_anterior} → {entry.quantidade_resultante} {selectedItem.unidade_medida || selectedItem.unidade || 'un'}
                      {' '}· movimentado: {entry.quantidade_movimentada}
                    </p>
                    <p className="mt-1 text-slate-500">Responsável: {entry.usuario_nome || 'Usuário removido/não informado'}</p>
                    {entry.observacao && <p className="mt-1 text-slate-500">Motivo: {entry.observacao}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
