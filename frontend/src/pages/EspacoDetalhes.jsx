import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import {
  Building2,
  ArrowLeft,
  MapPin,
  Users,
  User,
  QrCode,
  Cpu,
  CalendarCheck,
  ClipboardCheck,
  ShieldAlert,
  Clock,
  Tv,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';

export default function EspacoDetalhes() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('equipamentos');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/espacos/${id}/detalhes`);
      setData(res.data);
    } catch (err) {
      console.error('[EspacoDetalhes] Erro:', err);
      setError('Erro ao carregar detalhes do laboratório');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data || !data.espaco) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-rose-600 text-sm">{error || 'Laboratório não encontrado'}</p>
        <Link to="/espacos" className="inline-flex items-center gap-1.5 text-xs text-teal-600 font-semibold hover:underline">
          <ArrowLeft className="w-4 h-4" /> Voltar para Espaços
        </Link>
      </div>
    );
  }

  const { espaco, equipamentos, reservas, utilizacaoAtual, inventarios } = data;
  const emUso = utilizacaoAtual?.reservaEmAndamento || (utilizacaoAtual?.equipamentosEmUso?.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center justify-between">
        <Link
          to="/espacos"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Lista de Espaços
        </Link>

        {/* Botão de Acesso ao Modo Monitor */}
        <div className="flex items-center gap-2">
          <Link
            to={`/espacos/${id}/monitor`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition"
          >
            <Tv className="w-4 h-4 text-teal-400" />
            Abrir no Modo Monitor (Painel de Exibição)
          </Link>
          <button
            onClick={() => setQrModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            <QrCode className="w-4 h-4 text-teal-600" />
            QR Code do Espaço
          </button>
        </div>
      </div>

      {/* Cartão Principal do Laboratório */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row gap-6">
        {/* Foto do Espaço ou Placeholder */}
        <div className="w-full md:w-56 h-44 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center relative">
          {espaco.foto_url ? (
            <img src={espaco.foto_url} alt={espaco.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center text-slate-400 gap-1">
              <Building2 className="w-12 h-12 text-slate-300" />
              <span className="text-[10px] font-semibold">Sem foto cadastrada</span>
            </div>
          )}
          <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            espaco.status === 'disponivel' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            espaco.status === 'manutencao' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
            'bg-slate-100 text-slate-600'
          }`}>
            {espaco.status}
          </span>
        </div>

        {/* Informações Textuais */}
        <div className="flex-1 space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                {espaco.codigo}
              </span>
              <span className="text-xs text-slate-400">Capacidade: {espaco.capacidade || 20} pessoas</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{espaco.nome}</h1>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {espaco.descricao || 'Ambiente dedicado ao ensino, pesquisa e atividades acadêmicas orientadas.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Localização: <strong>{espaco.localizacao || 'Campus Universitário'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Responsável: <strong>{espaco.responsavel || 'Coordenação de Laboratórios'}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Ocupação em Tempo Real */}
      <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-4 ${
        emUso
          ? 'bg-amber-50/70 border-amber-200 text-amber-900'
          : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full animate-ping ${emUso ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
          <div>
            <h4 className="font-bold text-sm">
              {emUso ? 'Laboratório Atualmente em Utilização' : 'Laboratório Livre para Uso'}
            </h4>
            <p className="text-[11px] opacity-80 mt-0.5">
              {utilizacaoAtual?.reservaEmAndamento ? (
                <>Reserva ativa: "{utilizacaoAtual.reservaEmAndamento.finalidade}" por {utilizacaoAtual.reservaEmAndamento.usuario_nome}</>
              ) : utilizacaoAtual?.equipamentosEmUso?.length > 0 ? (
                <>{utilizacaoAtual.equipamentosEmUso.length} equipamento(s) com check-in ativo neste ambiente</>
              ) : (
                'Nenhuma reserva ou check-in em andamento no momento.'
              )}
            </p>
          </div>
        </div>

        <Link
          to={`/espacos/${id}/monitor`}
          target="_blank"
          className="shrink-0 px-3 py-1.5 rounded-xl bg-white text-slate-800 text-[11px] font-bold border border-slate-200 hover:bg-slate-50 transition shadow-2xs flex items-center gap-1.5"
        >
          <Tv className="w-3.5 h-3.5 text-teal-600" />
          Ver no Modo Monitor
        </Link>
      </div>

      {/* Navegação de Abas */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('equipamentos')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'equipamentos'
                ? 'border-teal-600 text-teal-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Equipamentos Alocados ({equipamentos?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('reservas')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'reservas'
                ? 'border-teal-600 text-teal-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Agenda e Reservas ({reservas?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('inventario')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'inventario'
                ? 'border-teal-600 text-teal-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Histórico de Inventário ({inventarios?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('regras')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'regras'
                ? 'border-teal-600 text-teal-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Regras e Diretrizes</span>
          </button>
        </nav>
      </div>

      {/* Conteúdo das Abas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        {/* Aba 1: Equipamentos */}
        {activeTab === 'equipamentos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Equipamentos Pertencentes ao Laboratório</h3>
              <span className="text-xs text-slate-400">Total: {equipamentos?.length || 0}</span>
            </div>

            {equipamentos?.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">
                Nenhum equipamento cadastrado neste laboratório.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {equipamentos.map((eq) => {
                  const status = (eq.status || 'disponivel').toLowerCase();
                  return (
                    <div
                      key={eq.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:border-teal-400 transition space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-slate-900">{eq.nome}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            status === 'disponivel' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            status === 'em_uso' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 space-y-0.5 mt-2">
                          <p>Patrimônio: <strong>{eq.codigo_patrimonio}</strong></p>
                          {eq.codigo_labcontrol && <p>LabControl: <strong>{eq.codigo_labcontrol}</strong></p>}
                          {eq.localizacao_detalhada && <p className="text-teal-700 font-medium">Bancada: {eq.localizacao_detalhada}</p>}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex justify-end">
                        <Link
                          to={`/equipamentos/${eq.id}`}
                          className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
                        >
                          Ver Rastreabilidade &rarr;
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Aba 2: Agenda e Reservas */}
        {activeTab === 'reservas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Próximos Agendamentos e Histórico</h3>
              <span className="text-xs text-slate-400">Total: {reservas?.length || 0}</span>
            </div>

            {reservas?.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">
                Nenhuma reserva registrada para este laboratório.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {reservas.map((r) => {
                  const inicio = new Date(r.data_inicio).toLocaleString('pt-BR');
                  const fim = new Date(r.data_fim).toLocaleString('pt-BR');
                  return (
                    <div key={r.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{r.finalidade || 'Sessão de Uso'}</span>
                          <span className="text-[11px] text-slate-400">• Solicitante: {r.usuario_nome}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{inicio} às {fim.split(' ')[1]}</span>
                          {r.equipamento_nome && (
                            <span className="text-teal-700 font-medium">• Equipamento: {r.equipamento_nome}</span>
                          )}
                        </div>
                      </div>
                      <span className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        r.status === 'confirmada' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        r.status === 'em_andamento' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        r.status === 'cancelada' ? 'bg-slate-100 text-slate-500' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Aba 3: Histórico de Inventário */}
        {activeTab === 'inventario' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Conferências de Inventário Físico</h3>
              <Link
                to="/inventario"
                className="text-xs text-teal-600 hover:text-teal-700 font-semibold hover:underline"
              >
                Ir para Módulo de Inventário &rarr;
              </Link>
            </div>

            {inventarios?.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">
                Nenhuma sessão de inventário realizada neste laboratório ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {inventarios.map((inv) => (
                  <div key={inv.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">Sessão #{inv.id}</span>
                        <span className="text-[11px] text-slate-400">
                          Responsável: {inv.usuario_nome || 'Admin'} • {new Date(inv.data_inicio).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex gap-4 mt-1">
                        <span>Esperados: <strong>{inv.total_esperados}</strong></span>
                        <span className="text-emerald-700">Conferidos: <strong>{inv.total_conferidos}</strong></span>
                        <span className="text-amber-700">Divergentes: <strong>{inv.total_divergentes}</strong></span>
                        <span className="text-rose-700">Não Localizados: <strong>{inv.total_nao_localizados}</strong></span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      inv.status === 'concluido' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aba 4: Regras e Diretrizes */}
        {activeTab === 'regras' && (
          <div className="space-y-4 max-w-3xl">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-teal-600" />
              Diretrizes de Segurança e Protocolos do Laboratório
            </h3>

            <div className="prose prose-xs text-slate-600 space-y-2 text-xs leading-relaxed">
              {espaco.regras_utilizacao ? (
                <p className="whitespace-pre-line">{espaco.regras_utilizacao}</p>
              ) : (
                <>
                  <p>1. O uso dos equipamentos exige capacitação técnica prévia e agendamento confirmado no LabControl.</p>
                  <p>2. É obrigatório o registro de Check-in na retirada e a declaração detalhada da condição física no Check-out.</p>
                  <p>3. Qualquer falha mecânica, elétrica ou descalibração deve ser reportada imediatamente via módulo de Ocorrências com evidência fotográfica.</p>
                  <p>4. Mantenha as bancadas limpas e os insumos guardados nos locais apropriados após a utilização.</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal QR Code do Espaço */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">QR Code do Laboratório</h3>
              <button onClick={() => setQrModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl inline-block shadow-inner mx-auto">
              <QRCodeSVG
                value={`LABCONTROL:ESPACO:${espaco.id}:${espaco.codigo}`}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <div>
              <h4 className="font-bold text-slate-800 text-sm">{espaco.nome}</h4>
              <p className="text-xs font-mono text-teal-700">{espaco.codigo}</p>
              <p className="text-[11px] text-slate-400 mt-1">{espaco.localizacao}</p>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Imprimir QR
              </button>
              <button
                onClick={() => setQrModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
