import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import QRCodeModal from '../components/QRCodeModal';
import BatchQRCodeModal from '../components/BatchQRCodeModal';
import QRPostInstallTester from '../components/QRPostInstallTester';
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
  Filter,
  Camera,
  Upload,
  AlertTriangle,
  RotateCcw,
  PowerOff,
  MapPin,
  Barcode,
  CheckSquare,
  Square,
  Printer,
  ShieldCheck
} from 'lucide-react';

export default function Equipamentos() {
  const { user, isAdmin } = useAuth();
  const [equipamentos, setEquipamentos] = useState([]);
  const [espacos, setEspacos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewFilter, setViewFilter] = useState('ativos'); // 'ativos', 'inativos', 'todos'

  // Modais de QR Code
  const [selectedQR, setSelectedQR] = useState(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);

  // Seleção Múltipla para Lote
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEquip, setEditingEquip] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    patrimonio_ufpi: '',
    codigo_labcontrol: '',
    marca: '',
    modelo: '',
    numero_serie: '',
    espaco_id: '',
    localizacao_detalhada: '',
    status: 'disponivel',
    exige_capacitacao: false,
    observacoes: '',
    foto_url: ''
  });

  // Câmera no cadastro administrativo
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Modal de Inativação
  const [inativarModalOpen, setInativarModalOpen] = useState(false);
  const [equipParaInativar, setEquipParaInativar] = useState(null);
  const [motivoInativacao, setMotivoInativacao] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [resEquip, resEsp] = await Promise.all([
        api.get('/equipamentos?incluir_inativos=true'),
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
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('[Camera] Erro ao acessar webcam:', err);
      alert('Não foi possível acessar a câmera do dispositivo. Verifique as permissões.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setFormData((prev) => ({ ...prev, foto_url: dataUrl }));
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('A foto deve ter no máximo 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData((prev) => ({ ...prev, foto_url: event.target?.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleOpenModal = (equip = null) => {
    stopCamera();
    if (equip) {
      setEditingEquip(equip);
      setFormData({
        nome: equip.nome || '',
        categoria: equip.categoria || equip.tipo || '',
        patrimonio_ufpi: equip.patrimonio_ufpi || equip.codigo_patrimonio || equip.patrimonio || '',
        codigo_labcontrol: equip.codigo_labcontrol || equip.codigo || '',
        marca: equip.marca || '',
        modelo: equip.modelo || '',
        numero_serie: equip.numero_serie || '',
        espaco_id: equip.espaco_id || equip.id_espaco || '',
        localizacao_detalhada: equip.localizacao_detalhada || '',
        status: equip.status || 'disponivel',
        exige_capacitacao: equip.exige_capacitacao === 1 || equip.exige_capacitacao === true,
        observacoes: equip.observacoes || equip.descricao || '',
        foto_url: equip.foto_url || ''
      });
    } else {
      setEditingEquip(null);
      const randSeq = Math.floor(1000 + Math.random() * 9000);
      setFormData({
        nome: '',
        categoria: '',
        patrimonio_ufpi: `UFPI-PAT-${randSeq}`,
        codigo_labcontrol: `LC-EQ-${randSeq}`,
        marca: '',
        modelo: '',
        numero_serie: '',
        espaco_id: espacos[0]?.id || espacos[0]?.id_espaco || '',
        localizacao_detalhada: '',
        status: 'disponivel',
        exige_capacitacao: false,
        observacoes: '',
        foto_url: ''
      });
    }
    setError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    stopCamera();
    setModalOpen(false);
    setEditingEquip(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...formData,
        codigo_patrimonio: formData.patrimonio_ufpi,
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

  // Fluxo de Inativação
  const handleOpenInativar = (equip) => {
    setEquipParaInativar(equip);
    setMotivoInativacao('');
    setInativarModalOpen(true);
  };

  const handleConfirmInativar = async (e) => {
    e.preventDefault();
    if (!motivoInativacao.trim()) {
      alert('Informe o motivo da inativação do equipamento.');
      return;
    }
    try {
      const id = equipParaInativar.id || equipParaInativar.id_equipamento;
      await api.post(`/equipamentos/${id}/inativar`, {
        motivo: motivoInativacao.trim()
      });
      setSuccess(`Equipamento "${equipParaInativar.nome}" inativado com sucesso. Histórico preservado.`);
      setInativarModalOpen(false);
      setEquipParaInativar(null);
      loadData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao inativar equipamento');
    }
  };

  // Reativação
  const handleReativar = async (equip) => {
    if (!window.confirm(`Deseja reativar o equipamento "${equip.nome}"? Ele voltará ao status Disponível.`)) return;
    try {
      const id = equip.id || equip.id_equipamento;
      await api.post(`/equipamentos/${id}/reativar`);
      setSuccess(`Equipamento "${equip.nome}" reativado com sucesso!`);
      loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao reativar equipamento');
    }
  };

  // Exclusão Segura
  const handleDelete = async (equip) => {
    const id = equip.id || equip.id_equipamento;
    if (!window.confirm(`Deseja excluir o equipamento "${equip.nome}"? Caso possua histórico, ele será automaticamente inativado para proteger os registros.`)) {
      return;
    }
    try {
      const res = await api.delete(`/equipamentos/${id}`);
      setSuccess(res.data?.message || 'Ação concluída com sucesso!');
      loadData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao processar remoção');
    }
  };

  // Seleção Múltipla para Lote
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((e) => e.id || e.id_equipamento));
    }
  };

  // Filtragem dos equipamentos
  const filtered = equipamentos.filter((e) => {
    const isInactive = e.inativo === 1 || e.inativo === true || (e.status || '').toLowerCase() === 'inativo';

    // Filtro da aba (ativos / inativos / todos)
    if (viewFilter === 'ativos' && isInactive) return false;
    if (viewFilter === 'inativos' && !isInactive) return false;

    // Filtro de status específico
    if (statusFilter && (e.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }

    // Busca textual ampla
    if (search.trim()) {
      const term = search.toLowerCase();
      const match =
        e.nome?.toLowerCase().includes(term) ||
        (e.patrimonio_ufpi || e.codigo_patrimonio || '').toLowerCase().includes(term) ||
        (e.codigo_labcontrol || '').toLowerCase().includes(term) ||
        (e.marca || '').toLowerCase().includes(term) ||
        (e.modelo || '').toLowerCase().includes(term) ||
        (e.categoria || e.tipo || '').toLowerCase().includes(term) ||
        (e.espaco_nome || '').toLowerCase().includes(term);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Equipamentos & Instrumentos</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
              {filtered.length} listados
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Rastreabilidade por QR Code, etiquetas em lote, duplo identificador e inativação segura
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setTestModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-sm transition"
            title="Escanear e validar etiquetas físicas já impressas"
          >
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Testar Etiquetas</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Novo</span>
            </button>
          )}
        </div>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Controles, Filtros e Alternador Ativos/Inativos */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Busca Textual */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, patrimônio UFPI, código LabControl, marca, modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Alternador de Visualização (Ativos vs Inativos) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200">
            <button
              onClick={() => setViewFilter('ativos')}
              className={`px-3 py-1 rounded-lg transition ${
                viewFilter === 'ativos' ? 'bg-white text-teal-700 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Ativos ({equipamentos.filter((e) => !(e.inativo === 1 || e.inativo === true || e.status === 'inativo')).length})
            </button>
            <button
              onClick={() => setViewFilter('inativos')}
              className={`px-3 py-1 rounded-lg transition ${
                viewFilter === 'inativos' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Inativos ({equipamentos.filter((e) => e.inativo === 1 || e.inativo === true || e.status === 'inativo').length})
            </button>
            <button
              onClick={() => setViewFilter('todos')}
              className={`px-3 py-1 rounded-lg transition ${
                viewFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Todos ({equipamentos.length})
            </button>
          </div>

          {/* Filtro por Status */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-transparent focus:outline-none text-slate-700 font-medium"
            >
              <option value="">Status Geral</option>
              <option value="disponivel">Disponível</option>
              <option value="em_uso">Em Uso</option>
              <option value="manutencao">Em Manutenção</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Barra de Ações em Lote e Seleção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-xs text-xs gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleToggleSelectAll}
            className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-teal-700 transition"
          >
            {selectedIds.length > 0 && selectedIds.length === filtered.length ? (
              <CheckSquare className="w-4 h-4 text-teal-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {selectedIds.length === filtered.length && filtered.length > 0
                ? 'Desmarcar Todos'
                : 'Selecionar Todos da Tela'}
            </span>
          </button>

          {selectedIds.length > 0 && (
            <span className="text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
              {selectedIds.length} selecionado(s)
            </span>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBatchModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold transition shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Gerar Etiquetas QR ({selectedIds.length})</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      {/* Grid de Equipamentos */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">
          Nenhum equipamento encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((equip) => {
            const equipId = equip.id || equip.id_equipamento;
            const isSelected = selectedIds.includes(equipId);
            const status = (equip.status || 'disponivel').toLowerCase();
            const isInactive = equip.inativo === 1 || equip.inativo === true || status === 'inativo';
            const codigoLab = equip.codigo_labcontrol || `LC-EQ-${String(equipId).padStart(4, '0')}`;
            const codigoUfpi = equip.patrimonio_ufpi || equip.codigo_patrimonio || equip.patrimonio || `UFPI-${equipId}`;
            const exigeCap = equip.exige_capacitacao === 1 || equip.exige_capacitacao === true;

            return (
              <div
                key={equipId}
                className={`bg-white rounded-2xl border transition flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  isSelected ? 'ring-2 ring-teal-500 border-teal-500' : isInactive ? 'border-slate-300 bg-slate-50/60 opacity-90' : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Imagem de Capa do Equipamento (se houver) */}
                  {equip.foto_url ? (
                    <div className="h-36 w-full overflow-hidden bg-slate-100 border-b border-slate-100 relative">
                      <img
                        src={equip.foto_url}
                        alt={equip.nome}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-xs shadow-xs text-slate-800">
                        {status}
                      </span>
                    </div>
                  ) : null}

                  <div className="p-5">
                    {/* Checkbox de Seleção + Identificadores */}
                    <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Checkbox de seleção para lote */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(equipId)}
                          className="text-slate-400 hover:text-teal-600 transition"
                          title="Selecionar para etiquetas em lote"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-teal-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>

                        {/* Código LabControl */}
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                          <Barcode className="w-3 h-3 text-teal-600" />
                          {codigoLab}
                        </span>

                        {/* Patrimônio UFPI */}
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          <Tag className="w-3 h-3 text-slate-500" />
                          UFPI: {codigoUfpi}
                        </span>
                      </div>

                      {!equip.foto_url && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isInactive
                              ? 'bg-slate-200 text-slate-700 border border-slate-300'
                              : status === 'disponivel'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : status === 'manutencao'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : status === 'em_uso'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {status}
                        </span>
                      )}
                    </div>

                    {/* Nome, Marca e Modelo */}
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{equip.nome}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {equip.marca ? `${equip.marca} • ` : ''}
                      {equip.modelo || equip.categoria || equip.tipo || 'Equipamento Geral'}
                      {equip.numero_serie ? ` • S/N: ${equip.numero_serie}` : ''}
                    </p>

                    {/* Alerta de Inativação */}
                    {isInactive && (
                      <div className="mt-2.5 p-2 bg-rose-50/80 border border-rose-200 rounded-xl text-[11px] text-rose-900">
                        <div className="flex items-center gap-1.5 font-bold">
                          <PowerOff className="w-3.5 h-3.5 text-rose-600" />
                          <span>Equipamento Inativo</span>
                        </div>
                        <p className="text-[10px] text-rose-700 mt-0.5">
                          {equip.motivo_inativacao || 'Inativação administrativa registrada no sistema.'}
                        </p>
                        {equip.inativo_em && (
                          <span className="text-[9px] text-rose-500 block mt-0.5">
                            Em: {new Date(equip.inativo_em).toLocaleDateString('pt-BR')}
                            {equip.inativo_por_usuario_nome ? ` por ${equip.inativo_por_usuario_nome}` : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {equip.observacoes && !isInactive && (
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">{equip.observacoes}</p>
                    )}

                    {/* Metadados: Localização e Capacitação */}
                    <div className="space-y-1.5 pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
                      {equip.espaco_nome && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">Espaço: {equip.espaco_nome}</span>
                        </div>
                      )}

                      {equip.localizacao_detalhada && (
                        <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">Local: {equip.localizacao_detalhada}</span>
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
                </div>

                {/* Ações do Card */}
                <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedQR(equip)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-semibold transition"
                      title="Ver QR Code Individual do Equipamento"
                    >
                      <QrCode className="w-3.5 h-3.5 text-teal-600" />
                      <span>QR Code</span>
                    </button>

                    <Link
                      to={`/equipamentos/${equipId}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium transition"
                      title="Ver Histórico Completo de Rastreabilidade"
                    >
                      <History className="w-3.5 h-3.5 text-slate-400" />
                      <span>Histórico</span>
                    </Link>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      {isInactive ? (
                        <button
                          onClick={() => handleReativar(equip)}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                          title="Reativar Equipamento"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reativar</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenInativar(equip)}
                          className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                          title="Inativar Equipamento (preserva histórico)"
                        >
                          <PowerOff className="w-4 h-4 text-amber-600" />
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenModal(equip)}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                        title="Editar Equipamento"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(equip)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Excluir (inativa se houver histórico)"
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

      {/* Modal QR Code Individual */}
      <QRCodeModal
        isOpen={!!selectedQR}
        onClose={() => setSelectedQR(null)}
        equipamento={selectedQR}
      />

      {/* Modal Etiquetas QR em Lote */}
      <BatchQRCodeModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        equipamentos={equipamentos.filter((e) => selectedIds.includes(e.id || e.id_equipamento))}
      />

      {/* Modal Teste Pós-Instalação */}
      <QRPostInstallTester
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        equipamentos={equipamentos}
      />

      {/* Modal Inativar Equipamento */}
      {inativarModalOpen && equipParaInativar && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <PowerOff className="w-4 h-4" />
                <span>Inativar Equipamento</span>
              </div>
              <button
                onClick={() => setInativarModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Você está inativando o equipamento <strong>{equipParaInativar.nome}</strong> (
              {equipParaInativar.codigo_labcontrol || equipParaInativar.patrimonio_ufpi}).
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 mb-4 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Regra de Inativação do LabControl:
              </p>
              <p>• O equipamento não poderá receber novas reservas ou utilizações normais.</p>
              <p>• Todo o histórico de utilizações, ocorrências e manutenções será 100% preservado.</p>
              <p>• O equipamento continuará disponível para consulta e auditoria administrativa.</p>
            </div>

            <form onSubmit={handleConfirmInativar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo da Inativação <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  value={motivoInativacao}
                  onChange={(e) => setMotivoInativacao(e.target.value)}
                  placeholder="Ex: Equipamento danificado sem peça de reposição / Substituído por modelo mais recente / Baixa patrimonial..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInativarModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  Confirmar Inativação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Equipamento Completo */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
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
              {/* Identificadores Oficiais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Patrimônio UFPI (Identificador Oficial) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.patrimonio_ufpi}
                    onChange={(e) => setFormData({ ...formData, patrimonio_ufpi: e.target.value })}
                    placeholder="Ex: UFPI-PAT-2024-001"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                  <span className="text-[10px] text-slate-400">Número da plaqueta patrimonial oficial</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código LabControl (Gerado Internamente)
                  </label>
                  <input
                    type="text"
                    value={formData.codigo_labcontrol}
                    onChange={(e) => setFormData({ ...formData, codigo_labcontrol: e.target.value })}
                    placeholder="Ex: LC-EQ-0001"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50"
                  />
                  <span className="text-[10px] text-slate-400">Identificador unívoco do sistema para QR Code</span>
                </div>
              </div>

              {/* Nome do Equipamento */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Equipamento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Impressora 3D Creality K1 Speed"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              {/* Categoria, Marca, Modelo, Série */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
                  <input
                    type="text"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    placeholder="Ex: Fabricação Digital"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    placeholder="Ex: Creality"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                    placeholder="Ex: K1 600mm/s"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Número de Série</label>
                  <input
                    type="text"
                    value={formData.numero_serie}
                    onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })}
                    placeholder="Ex: CR-K1-99812"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Laboratório e Localização Detalhada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Laboratório / Espaço Vinculado <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.espaco_id}
                    onChange={(e) => setFormData({ ...formData, espaco_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="">Selecione o espaço institucional...</option>
                    {espacos.map((esp) => (
                      <option key={esp.id || esp.id_espaco} value={esp.id || esp.id_espaco}>
                        {esp.nome} ({esp.codigo || 'Sem código'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Localização Detalhada no Espaço
                  </label>
                  <input
                    type="text"
                    value={formData.localizacao_detalhada}
                    onChange={(e) => setFormData({ ...formData, localizacao_detalhada: e.target.value })}
                    placeholder="Ex: Bancada 01, Armário B - Gaveta 3"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Status Operacional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <option value="inativo">Inativo</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.exige_capacitacao}
                      onChange={(e) => setFormData({ ...formData, exige_capacitacao: e.target.checked })}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-700">Exige Capacitação Obrigatória</span>
                      <p className="text-[10px] text-slate-500">Usuários sem habilitação válida não poderão reservar</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Fotografia Administrativa: Câmera OU Galeria */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-teal-600" />
                    Fotografia do Equipamento (Câmera ou Galeria)
                  </span>
                  {formData.foto_url && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, foto_url: '' })}
                      className="text-[11px] text-rose-600 hover:underline font-semibold"
                    >
                      Remover Foto
                    </button>
                  )}
                </div>

                {/* Pré-visualização da foto atual */}
                {formData.foto_url && (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200">
                    <img
                      src={formData.foto_url}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded-md border border-slate-200"
                    />
                    <div className="text-xs text-slate-600">
                      <span className="text-emerald-700 font-semibold block">Foto anexada com sucesso</span>
                      <span className="text-[10px] text-slate-400">Pronta para armazenamento cadastral</span>
                    </div>
                  </div>
                )}

                {/* Área da Câmera Aberta */}
                {cameraActive && (
                  <div className="space-y-2 bg-black rounded-xl p-2 flex flex-col items-center">
                    <video
                      ref={videoRef}
                      playsInline
                      className="w-full max-w-sm rounded-lg border border-slate-700 bg-black"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-4 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg transition"
                      >
                        Capturar Agora
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg transition"
                      >
                        Fechar Câmera
                      </button>
                    </div>
                  </div>
                )}

                {/* Botões de Ação para Foto */}
                {!cameraActive && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition"
                    >
                      <Camera className="w-3.5 h-3.5 text-teal-600" />
                      Usar Câmera
                    </button>

                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      Escolher da Galeria / Arquivo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Observações / Especificações */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações Técnicas / Restrições Operacionais
                </label>
                <textarea
                  rows="2"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações sobre calibração, limitações, instruções de segurança..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                ></textarea>
              </div>

              {/* Botões de Submissão */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
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
