import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
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
  Sparkles
} from 'lucide-react';

export default function EquipamentoDetalhes() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('utilizacoes');
  const [qrModalOpen, setQrModalOpen] = useState(false);

  useEffect(() => {
    async function loadHistorico() {
      try {
        setLoading(true);
        const res = await api.get(`/equipamentos/${id}/historico`);
        setData(res.data);
      } catch (err) {
        console.error('[EquipamentoDetalhes] Erro:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistorico();
  }, [id]);

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
        <h2 className="text-lg font-bold text-slate-800">Equipamento não encontrado</h2>
        <Link to="/equipamentos" className="mt-4 inline-block text-xs font-semibold text-teal-600">
          ← Voltar para lista de equipamentos
        </Link>
      </div>
    );
  }

  const equip = data.equipamento;
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
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 text-xs font-semibold">
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
        </nav>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
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
      </div>

      {/* Modal QR Code */}
      <QRCodeModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        equipamento={equip}
      />
    </div>
  );
}
