import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import QRCodeModal from '../components/QRCodeModal';
import {
  Cpu,
  ArrowLeft,
  QrCode,
  Tag,
  Building2,
  Calendar,
  AlertTriangle,
  Wrench,
  Clock,
  CheckCircle2,
  ShieldAlert,
  User,
  PowerOff,
  MapPin,
  Barcode,
  Layers,
  Sparkles,
  Activity,
  Camera,
  Eye,
  X,
  FileText,
  ExternalLink,
  Plus,
  Trash2,
  ClipboardList,
  Save
} from 'lucide-react';

const AUDIT_ACTION_LABELS = {
  equipamento_criado: 'Equipamento cadastrado',
  equipamento_atualizado: 'Cadastro do equipamento atualizado',
  equipamento_local_alterado: 'Localização do equipamento alterada',
  equipamento_status_alterado: 'Status do equipamento alterado',
  equipamento_inativado: 'Equipamento inativado',
  equipamento_reativado: 'Equipamento reativado',
  equipamento_inativado_por_exclusao: 'Equipamento inativado para preservar o histórico',
  equipamento_excluido_sem_historico: 'Equipamento removido sem histórico associado',
  documento_tecnico_adicionado: 'Documento técnico associado',
  documento_tecnico_removido: 'Documento técnico removido',
  inventario_divergencia_detectada: 'Divergência de localização detectada no inventário',
  inventario_divergencia_decidida: 'Decisão administrativa sobre divergência de inventário',
  equipamento_nao_localizado_em_inventario: 'Equipamento não localizado no inventário',
  decisao_administrativa_registrada: 'Decisão administrativa da ocorrência',
  reserva_criada: 'Reserva criada',
  reserva_cancelada: 'Reserva cancelada',
  reserva_status_alterado: 'Status da reserva alterado',
  reserva_recorrente_criada: 'Reserva recorrente criada',
  reserva_recorrente_cancelada: 'Reserva recorrente cancelada',
  no_show_registrado: 'No-show registrado',
  no_show_automaticamente_registrado: 'No-show registrado automaticamente',
  tolerancia_no_show_alterada: 'Tolerância de no-show alterada',
  checkin_realizado: 'Check-in realizado',
  checkout_realizado: 'Check-out realizado',
  ocorrencia_registrada: 'Ocorrência registrada',
  manutencao_iniciada: 'Manutenção iniciada',
  manutencao_atualizada: 'Ordem de manutenção atualizada',
  manutencao_concluida: 'Manutenção concluída'
};

function formatEventDetails(details = {}) {
  return Object.entries(details).map(([key, value]) => {
    if (value === null || value === undefined || value === '') return null;
    if (key === 'alteracoes' && typeof value === 'object') {
      return Object.entries(value).map(([field, change]) => {
        if (!change || typeof change !== 'object') return `${field}: ${String(change)}`;
        return `${field}: ${change.anterior ?? '—'} → ${change.novo ?? '—'}`;
      }).join(' · ');
    }
    if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`;
    return `${key}: ${String(value)}`;
  }).filter(Boolean).join(' · ');
}

function formatDateOnly(value) {
  if (!value) return 'Não informado';
  const dateValue = String(value).slice(0, 10);
  const date = new Date(`${dateValue}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleDateString('pt-BR');
}

function technicalFormFromEquipment(equipment) {
  return {
    especificacoes: equipment.especificacoes || '',
    data_aquisicao: equipment.data_aquisicao ? String(equipment.data_aquisicao).slice(0, 10) : '',
    valor_aquisicao: equipment.valor_aquisicao ?? '',
    fornecedor: equipment.fornecedor || '',
    garantia_ate: equipment.garantia_ate ? String(equipment.garantia_ate).slice(0, 10) : '',
    garantia_detalhes: equipment.garantia_detalhes || ''
  };
}

function buildEquipmentTimeline(data) {
  const audit = data.auditoria || [];
  const auditedKeys = new Set(audit.map((event) => `${event.entidade}:${event.entidade_id}:${event.acao}`));
  const events = audit.map((event) => ({
    id: `audit-${event.id}`,
    date: event.criado_em,
    action: event.acao,
    label: AUDIT_ACTION_LABELS[event.acao] || event.acao.replaceAll('_', ' '),
    user: event.usuario_nome || 'Usuário removido ou não identificado',
    details: event.detalhes || {}
  }));
  const addLegacy = (entity, entityId, action, date, label, user, details) => {
    if (!date || auditedKeys.has(`${entity}:${entityId}:${action}`)) return;
    events.push({ id: `${entity}-${entityId}-${action}`, date, action, label, user, details });
  };

  (data.utilizacoes || []).forEach((item) => {
    const itemId = item.id || item.id_utilizacao;
    addLegacy('utilizacao', itemId, 'checkin_realizado', item.data_checkin || item.data_inicio,
      'Check-in realizado', item.usuario_nome, { reserva_id: item.reserva_id || null });
    if (item.data_checkout || item.data_fim) {
      addLegacy('utilizacao', itemId, 'checkout_realizado', item.data_checkout || item.data_fim,
        'Check-out realizado', item.usuario_nome, {
          condicao_devolucao: item.condicao_devolucao || item.condicao_final,
          houve_avaria: Boolean(item.houve_avaria)
        });
    }
  });
  (data.ocorrencias || []).forEach((item) => {
    const itemId = item.id || item.id_ocorrencia;
    addLegacy('ocorrencia', itemId, 'ocorrencia_registrada', item.data_registro || item.created_at,
      'Ocorrência registrada', item.usuario_nome, { titulo: item.titulo, gravidade: item.gravidade });
  });
  (data.manutencoes || []).forEach((item) => {
    const itemId = item.id || item.id_manutencao;
    addLegacy('manutencao', itemId, 'manutencao_iniciada', item.data_inicio || item.created_at,
      'Manutenção iniciada', item.responsavel, { tipo: item.tipo, descricao: item.descricao });
    if (item.data_fim) {
      addLegacy('manutencao', itemId, 'manutencao_concluida', item.data_fim,
        'Manutenção concluída', item.responsavel, { laudo_tecnico: item.laudo_tecnico });
    }
  });

  return events
    .filter((event) => event.date && !Number.isNaN(new Date(event.date).getTime()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function EquipamentoDetalhes() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeTab, setActiveTab] = useState('utilizacoes');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [documentForm, setDocumentForm] = useState({ titulo: '', tipo: 'manual', url: '', descricao: '' });
  const [documentError, setDocumentError] = useState('');
  const [savingDocument, setSavingDocument] = useState(false);
  const [technicalForm, setTechnicalForm] = useState({
    especificacoes: '',
    data_aquisicao: '',
    valor_aquisicao: '',
    fornecedor: '',
    garantia_ate: '',
    garantia_detalhes: ''
  });
  const [technicalError, setTechnicalError] = useState('');
  const [savingTechnicalData, setSavingTechnicalData] = useState(false);

  useEffect(() => {
    async function loadHistorico() {
      try {
        setLoading(true);
        setPageError('');
        const res = await api.get(`/equipamentos/${id}/historico`);
        setData(res.data);
        setTechnicalForm(technicalFormFromEquipment(res.data.equipamento));
      } catch (err) {
        console.error('[EquipamentoDetalhes] Erro:', err);
        setPageError(err.response?.status === 404
          ? ''
          : err.response?.data?.error || 'Não foi possível carregar o histórico do equipamento.');
      } finally {
        setLoading(false);
      }
    }
    loadHistorico();
  }, [id]);

  const saveTechnicalData = async (event) => {
    event.preventDefault();
    setTechnicalError('');
    setSavingTechnicalData(true);
    try {
      const response = await api.put(`/equipamentos/${id}`, {
        ...technicalForm,
        valor_aquisicao: technicalForm.valor_aquisicao === '' ? null : technicalForm.valor_aquisicao
      });
      setData((current) => ({ ...current, equipamento: response.data }));
      setTechnicalForm(technicalFormFromEquipment(response.data));
    } catch (error) {
      console.error('[EquipamentoDetalhes] Erro ao atualizar dados técnicos:', error);
      setTechnicalError(error.response?.data?.error || 'Não foi possível atualizar os dados técnicos.');
    } finally {
      setSavingTechnicalData(false);
    }
  };

  const addTechnicalDocument = async (event) => {
    event.preventDefault();
    setDocumentError('');
    setSavingDocument(true);
    try {
      const response = await api.post(`/equipamentos/${id}/documentos`, documentForm);
      setData((current) => ({
        ...current,
        documentos: [response.data, ...(current.documentos || []).filter((item) => item.id !== response.data.id)]
      }));
      setDocumentForm({ titulo: '', tipo: 'manual', url: '', descricao: '' });
    } catch (error) {
      console.error('[EquipamentoDetalhes] Erro ao associar documento:', error);
      setDocumentError(error.response?.data?.error || 'Não foi possível associar o documento técnico.');
    } finally {
      setSavingDocument(false);
    }
  };

  const removeTechnicalDocument = async (documento) => {
    if (!window.confirm(`Remover o documento "${documento.titulo}" deste equipamento?`)) return;
    setDocumentError('');
    setSavingDocument(true);
    try {
      await api.delete(`/equipamentos/${id}/documentos/${documento.id}`);
      setData((current) => ({
        ...current,
        documentos: (current.documentos || []).filter((item) => item.id !== documento.id)
      }));
    } catch (error) {
      console.error('[EquipamentoDetalhes] Erro ao remover documento:', error);
      setDocumentError(error.response?.data?.error || 'Não foi possível remover o documento técnico.');
    } finally {
      setSavingDocument(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data || !data.equipamento) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-lg font-bold text-slate-800">
          {pageError ? 'Erro ao carregar histórico' : 'Equipamento não encontrado'}
        </h2>
        {pageError && <p role="alert" className="mt-2 text-sm text-rose-700">{pageError}</p>}
        <Link to="/equipamentos" className="mt-4 inline-block text-xs font-semibold text-teal-600">
          ← Voltar para lista de equipamentos
        </Link>
      </div>
    );
  }

  const equip = data.equipamento;
  const timeline = buildEquipmentTimeline(data);
  const isInactive = equip.inativo === 1 || equip.inativo === true || (equip.status || '').toLowerCase() === 'inativo';
  const codigoLab = equip.codigo_labcontrol || `LC-EQ-${String(equip.id).padStart(4, '0')}`;
  const codigoUfpi = equip.patrimonio_ufpi || equip.codigo_patrimonio || equip.patrimonio || `UFPI-${equip.id}`;
  const status = (equip.status || 'disponivel').toLowerCase();
  const exigeCap = equip.exige_capacitacao === 1 || equip.exige_capacitacao === true;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Voltar */}
      <Link
        to="/equipamentos"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar aos Equipamentos
      </Link>

      {/* Banner de Alerta se o Equipamento Estiver Inativo */}
      {isInactive && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <PowerOff className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-900 text-sm">Registro de Equipamento Inativo</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-200 text-rose-800">
                  Inativo
                </span>
              </div>
              <p className="text-xs text-rose-800 mt-1">
                <strong>Motivo da Inativação:</strong>{' '}
                {equip.motivo_inativacao || 'Inativação administrativa registrada no sistema.'}
              </p>
              <div className="text-[11px] text-rose-600 mt-1 flex flex-wrap gap-3">
                {equip.inativo_em && (
                  <span>
                    Data da Inativação:{' '}
                    <strong>{new Date(equip.inativo_em).toLocaleString('pt-BR')}</strong>
                  </span>
                )}
                {equip.inativo_por_usuario_nome && (
                  <span>
                    Responsável: <strong>{equip.inativo_por_usuario_nome}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className="text-xs text-rose-700 font-semibold bg-white/70 px-3 py-1.5 rounded-xl border border-rose-200 shrink-0 text-center">
            Histórico 100% Preservado
          </span>
        </div>
      )}

      {/* Cartão de Informações do Equipamento */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start gap-5 flex-1">
          {/* Foto ou Ícone */}
          {equip.foto_url ? (
            <div className="w-28 h-28 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 shadow-xs">
              <img
                src={equip.foto_url}
                alt={equip.nome}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 shadow-xs">
              <Cpu className="w-8 h-8" />
            </div>
          )}

          <div className="space-y-2 flex-1">
            {/* Duplo Identificador */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                <Barcode className="w-3.5 h-3.5 text-teal-600" />
                {codigoLab}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                UFPI: {codigoUfpi}
              </span>
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
              {exigeCap && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-semibold">
                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                  Exige Capacitação
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-slate-900">{equip.nome}</h1>

            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dados técnicos cadastrados</p>
            <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-slate-500">
              {equip.marca && <span><strong>Marca:</strong> {equip.marca}</span>}
              {equip.modelo && <span><strong>Modelo:</strong> {equip.modelo}</span>}
              {equip.numero_serie && <span><strong>S/N:</strong> {equip.numero_serie}</span>}
              {equip.categoria && <span><strong>Categoria:</strong> {equip.categoria}</span>}
            </div>

            <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-slate-600 pt-1">
              {equip.espaco_nome && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Laboratório: <strong>{equip.espaco_nome}</strong>
                </span>
              )}
              {equip.localizacao_detalhada && (
                <span className="flex items-center gap-1 text-teal-700">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  Localização: <strong>{equip.localizacao_detalhada}</strong>
                </span>
              )}
            </div>

            {(equip.observacoes || equip.descricao) && (
              <p className="text-xs text-slate-600 pt-2 border-t border-slate-100 max-w-3xl">
                {equip.observacoes || equip.descricao}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 flex gap-2 self-start">
          <button
            onClick={() => setQrModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <QrCode className="w-4 h-4" />
            Visualizar / Imprimir QR Code
          </button>
        </div>
      </div>

      {/* Navegação de Abas do Histórico Unificado */}
      <div className="overflow-x-auto border-b border-slate-200">
        <nav className="flex min-w-max space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('dados-tecnicos')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'dados-tecnicos'
                ? 'border-teal-600 text-teal-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Dados técnicos</span>
          </button>

          <button
            onClick={() => setActiveTab('documentos')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'documentos'
                ? 'border-teal-600 text-teal-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documentos ({data.documentos?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('utilizacoes')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'utilizacoes'
                ? 'border-teal-600 text-teal-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Utilizações ({data.utilizacoes?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('ocorrencias')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'ocorrencias'
                ? 'border-teal-600 text-teal-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Ocorrências ({data.ocorrencias?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('manutencoes')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'manutencoes'
                ? 'border-teal-600 text-teal-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Manutenções ({data.manutencoes?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('auditoria')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'auditoria'
                ? 'border-teal-600 text-teal-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Histórico unificado ({timeline.length})</span>
          </button>
        </nav>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        {activeTab === 'dados-tecnicos' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Dados técnicos, aquisição e garantia</h3>
              <p className="mt-1 text-xs text-slate-500">
                Informações opcionais do equipamento e links para manuais e anexos na aba Documentos.
              </p>
            </div>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-[11px] font-semibold uppercase text-slate-400">Fornecedor</dt>
                <dd className="mt-1 text-sm text-slate-700">{equip.fornecedor || 'Não informado'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-slate-400">Data de aquisição</dt>
                <dd className="mt-1 text-sm text-slate-700">{formatDateOnly(equip.data_aquisicao)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-slate-400">Valor de aquisição</dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {equip.valor_aquisicao === null || equip.valor_aquisicao === undefined || equip.valor_aquisicao === ''
                    ? 'Não informado'
                    : Number(equip.valor_aquisicao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-slate-400">Garantia até</dt>
                <dd className="mt-1 text-sm text-slate-700">{formatDateOnly(equip.garantia_ate)}</dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-[11px] font-semibold uppercase text-slate-400">Detalhes da garantia</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{equip.garantia_detalhes || 'Não informado'}</dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-[11px] font-semibold uppercase text-slate-400">Especificações</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{equip.especificacoes || 'Não informado'}</dd>
              </div>
            </dl>

            {isAdmin && (
              <form onSubmit={saveTechnicalData} className="space-y-4 border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold text-slate-700">Editar dados técnicos</h4>
                {technicalError && (
                  <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    {technicalError}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-700">
                    Fornecedor
                    <input
                      maxLength={160}
                      value={technicalForm.fornecedor}
                      onChange={(event) => setTechnicalForm((current) => ({ ...current, fornecedor: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Data de aquisição
                    <input
                      type="date"
                      value={technicalForm.data_aquisicao}
                      onChange={(event) => setTechnicalForm((current) => ({ ...current, data_aquisicao: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Valor de aquisição (R$)
                    <input
                      type="number"
                      min="0"
                      max="9999999999.99"
                      step="0.01"
                      value={technicalForm.valor_aquisicao}
                      onChange={(event) => setTechnicalForm((current) => ({ ...current, valor_aquisicao: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Garantia até
                    <input
                      type="date"
                      value={technicalForm.garantia_ate}
                      onChange={(event) => setTechnicalForm((current) => ({ ...current, garantia_ate: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                    Detalhes da garantia
                    <input
                      maxLength={500}
                      value={technicalForm.garantia_detalhes}
                      onChange={(event) => setTechnicalForm((current) => ({ ...current, garantia_detalhes: event.target.value }))}
                      placeholder="Cobertura, condições ou contato"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">
                    Especificações
                    <textarea
                      maxLength={5000}
                      rows={4}
                      value={technicalForm.especificacoes}
                      onChange={(event) => setTechnicalForm((current) => ({ ...current, especificacoes: event.target.value }))}
                      placeholder="Características e especificações relevantes"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={savingTechnicalData}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingTechnicalData ? 'Salvando...' : 'Salvar dados técnicos'}
                </button>
              </form>
            )}
          </div>
        )}

        {activeTab === 'documentos' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Documentação técnica</h3>
              <p className="mt-1 text-xs text-slate-500">
                Manuais, fichas técnicas e outros documentos associados a este equipamento.
              </p>
            </div>

            {documentError && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {documentError}
              </p>
            )}

            {isAdmin && (
              <form onSubmit={addTechnicalDocument} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">
                  Título
                  <input
                    required
                    maxLength={160}
                    value={documentForm.titulo}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, titulo: event.target.value }))}
                    placeholder="Ex.: Manual de operação"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Tipo
                  <select
                    value={documentForm.tipo}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, tipo: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                  >
                    <option value="manual">Manual</option>
                    <option value="ficha_tecnica">Ficha técnica</option>
                    <option value="especificacao">Especificação</option>
                    <option value="documentacao">Documentação</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                  URL do documento
                  <input
                    required
                    type="url"
                    maxLength={2048}
                    value={documentForm.url}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://..."
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                  Descrição (opcional)
                  <input
                    maxLength={500}
                    value={documentForm.descricao}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, descricao: event.target.value }))}
                    placeholder="Observações sobre a versão ou conteúdo do documento"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={savingDocument}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Associar documento
                  </button>
                </div>
              </form>
            )}

            {!data.documentos?.length ? (
              <p className="py-8 text-center text-xs text-slate-400">Nenhum documento técnico associado.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.documentos.map((documento) => (
                  <li key={documento.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      <div className="min-w-0">
                        <a
                          href={documento.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-600"
                        >
                          <span className="break-words">{documento.titulo}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                          {({ manual: 'Manual', ficha_tecnica: 'Ficha técnica', especificacao: 'Especificação', documentacao: 'Documentação', outro: 'Outro' })[documento.tipo] || documento.tipo}
                          {documento.criado_em && ` · Adicionado em ${new Date(documento.criado_em).toLocaleDateString('pt-BR')}`}
                        </p>
                        {documento.descricao && <p className="mt-1 text-xs text-slate-600">{documento.descricao}</p>}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={savingDocument}
                        onClick={() => removeTechnicalDocument(documento)}
                        aria-label={`Remover ${documento.titulo}`}
                        title="Remover documento"
                        className="self-end rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 sm:self-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Aba 1: Utilizações */}
        {activeTab === 'utilizacoes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Registros de Check-in e Check-out</h3>
              <span className="text-xs text-slate-400">Total histórico: {data.utilizacoes?.length || 0}</span>
            </div>
            {data.utilizacoes?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Nenhum registro de utilização encontrado para este equipamento.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.utilizacoes.map((u) => {
                  const checkinDate = u.data_checkin ? new Date(u.data_checkin).toLocaleString('pt-BR') : '-';
                  const checkoutDate = u.data_checkout ? new Date(u.data_checkout).toLocaleString('pt-BR') : 'Em andamento';
                  return (
                    <div key={u.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-800">{u.usuario_nome || `Usuário #${u.usuario_id}`}</span>
                          <span className="text-[11px] text-slate-400">({u.usuario_email || 'N/A'})</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 space-x-3">
                          <span>Check-in: <strong className="text-slate-700">{checkinDate}</strong></span>
                          <span>•</span>
                          <span>Check-out: <strong className="text-slate-700">{checkoutDate}</strong></span>
                        </div>
                        <div className="mt-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <p><strong className="text-slate-700">Condição Inicial:</strong> {u.condicao_inicial || 'Normal'}</p>
                          <p className="mt-0.5"><strong className="text-slate-700">Condição na Devolução:</strong> {u.condicao_devolucao || u.condicao_final || 'Aguardando devolução'}</p>
                        </div>

                        {u.foto_evidencia && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-teal-700 flex items-center gap-1">
                              <Camera className="w-3.5 h-3.5 text-teal-600" />
                              Foto de Devolução Anexada
                            </span>
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({ photo: u.foto_evidencia, titulo: `Foto de Devolução - Utilização #${u.id}` })}
                              className="text-[11px] text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1 hover:underline"
                            >
                              <Eye className="w-3 h-3" />
                              Ver Foto
                            </button>
                          </div>
                        )}
                      </div>
                      <span className={`self-start md:self-auto px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.status === 'finalizado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {u.status || 'em_uso'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Aba 2: Ocorrências */}
        {activeTab === 'ocorrencias' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Ocorrências Reportadas</h3>
              <span className="text-xs text-slate-400">Total histórico: {data.ocorrencias?.length || 0}</span>
            </div>
            {data.ocorrencias?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Nenhuma avaria ou ocorrência registrada para este equipamento.
              </p>
            ) : (
              <div className="space-y-3">
                {data.ocorrencias.map((o) => (
                  <div key={o.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">{o.titulo}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        o.gravidade === 'alta' ? 'bg-rose-100 text-rose-800' :
                        o.gravidade === 'media' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        Gravidade {o.gravidade}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{o.descricao}</p>

                    {o.foto_evidencia && (
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-teal-600" />
                          Evidência Fotográfica Coletada por Câmera
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto({ photo: o.foto_evidencia, titulo: o.titulo || 'Evidência Fotográfica' })}
                          className="text-[11px] text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1 hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Visualizar
                        </button>
                      </div>
                    )}

                    {o.decisao_admin && (
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                        <strong className="text-purple-700">Parecer Administrativo:</strong> {o.decisao_admin}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                      <span>Registrado por: {o.usuario_nome || `Usuário #${o.usuario_id}`}</span>
                      <span>Status: {o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aba 3: Manutenções */}
        {activeTab === 'manutencoes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Histórico de Manutenções</h3>
              <span className="text-xs text-slate-400">Total histórico: {data.manutencoes?.length || 0}</span>
            </div>
            {data.manutencoes?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Nenhuma manutenção corretiva ou preventiva realizada neste equipamento.
              </p>
            ) : (
              <div className="space-y-3">
                {data.manutencoes.map((m) => (
                  <div key={m.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        Manutenção {m.tipo ? m.tipo.toUpperCase() : 'GERAL'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        m.status === 'concluida' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {m.status || 'em_andamento'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{m.descricao}</p>
                    {m.observacoes && (
                      <p className="text-xs text-slate-500 italic">Laudo/Obs: {m.observacoes}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200">
                      <span>Início: {m.data_inicio ? new Date(m.data_inicio).toLocaleDateString('pt-BR') : '-'}</span>
                      <span>Conclusão: {m.data_fim ? new Date(m.data_fim).toLocaleDateString('pt-BR') : 'Pendente'}</span>
                      <span>Custo: R$ {Number(m.custo || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'auditoria' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Histórico e trilha de auditoria</h3>
              <p className="mt-1 text-xs text-slate-500">
                Eventos registrados a partir da implantação da auditoria, junto ao histórico operacional já existente.
              </p>
            </div>
            {timeline.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Ainda não há eventos para este equipamento.</p>
            ) : (
              <ol className="relative ml-2 space-y-4 border-l border-slate-200 pl-5">
                {timeline.map((event) => (
                  <li key={event.id} className="relative rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="absolute -left-[1.62rem] top-4 h-3 w-3 rounded-full border-2 border-white bg-teal-500 shadow" />
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <h4 className="text-xs font-bold capitalize text-slate-900">{event.label}</h4>
                      <time className="shrink-0 text-[10px] text-slate-500">
                        {new Date(event.date).toLocaleString('pt-BR')}
                      </time>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">Responsável: {event.user || 'Não identificado'}</p>
                    {formatEventDetails(event.details) && (
                      <p className="mt-2 break-words text-[11px] leading-relaxed text-slate-500">
                        {formatEventDetails(event.details)}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      {/* Modal QR Code */}
      <QRCodeModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        equipamento={equip}
      />

      {/* Lightbox Modal para Evidências Fotográficas do Histórico */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {previewPhoto.titulo || 'Evidência Probatória do Histórico'}
                  </h3>
                  <span className="text-[11px] text-teal-600 font-medium">
                    Fotografia registrada via câmera em tempo real
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setPreviewPhoto(null)} 
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              <img
                src={previewPhoto.photo}
                alt="Evidência"
                className="w-full max-h-[65vh] object-contain"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
