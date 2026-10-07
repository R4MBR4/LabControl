const reservaModel = require('../models/reservaModel');
const auditoriaModel = require('../models/auditoriaModel');
const notificacaoModel = require('../models/notificacaoModel');
const { pool } = require('../models/dbHelper');

const DEFAULT_INTERVAL_MS = 60_000;

function createNoShowScheduler({
  connectionPool = pool,
  reservas = reservaModel,
  auditoria = auditoriaModel,
  notificacoes = notificacaoModel,
  intervalMs = DEFAULT_INTERVAL_MS,
  logger = console
} = {}) {
  if (!Number.isInteger(intervalMs) || intervalMs < 1_000) {
    throw new Error('O intervalo do verificador de no-show deve ser um número inteiro de pelo menos 1000 ms.');
  }

  let interval = null;
  let checkInProgress = false;

  async function checkOnce() {
    if (checkInProgress) return { skipped: true, totalMarcados: 0, reservas: [] };
    checkInProgress = true;

    let connection;
    let transactionStarted = false;
    try {
      connection = await connectionPool.getConnection();
      await connection.beginTransaction();
      transactionStarted = true;

      const tolerancia = await reservas.getToleranciaNoShow(connection);
      const result = await reservas.verificarNoShowsAutomaticos(tolerancia, connection);
      for (const reserva of result.reservas) {
        await auditoria.registrarEvento({
          entidade: 'reserva',
          entidade_id: reserva.id,
          acao: 'no_show_automaticamente_registrado',
          usuario_id: null,
          detalhes: {
            origem: 'agendador_automatico',
            tolerancia_minutos: tolerancia,
            data_inicio: reserva.data_inicio,
            registrado_em: new Date().toISOString()
          }
        }, connection);
        await notificacoes.createForRole('admin', {
          tipo: 'reserva_no_show',
          titulo: 'Reserva marcada como no-show',
          mensagem: `A reserva #${reserva.id} ultrapassou a tolerância sem utilização.`,
          link: '/reservas',
          entidade: 'reserva',
          entidade_id: reserva.id,
          dedupe_key: `reserva_no_show_admin:${reserva.id}`
        }, connection);
        if (reserva.usuario_id) {
          await notificacoes.createForUser({
            usuario_id: reserva.usuario_id,
            tipo: 'reserva_no_show',
            titulo: 'No-show registrado na reserva',
            mensagem: `A reserva #${reserva.id} foi registrada como no-show.`,
            link: '/reservas',
            entidade: 'reserva',
            entidade_id: reserva.id,
            dedupe_key: `reserva_no_show_usuario:${reserva.id}`
          }, connection);
        }
      }

      const proximas = await notificacoes.getReservasProximas(connection);
      for (const reserva of proximas) {
        await notificacoes.createForUser({
          usuario_id: reserva.usuario_id,
          tipo: 'reserva_proxima',
          titulo: 'Reserva próxima',
          mensagem: `Sua reserva${reserva.finalidade ? ` "${reserva.finalidade}"` : ''} começa às ${new Date(reserva.data_inicio).toLocaleString('pt-BR')}.`,
          link: '/reservas',
          entidade: 'reserva',
          entidade_id: reserva.id,
          dedupe_key: `reserva_proxima:${reserva.id}:${reserva.usuario_id}`
        }, connection);
      }

      await connection.commit();
      transactionStarted = false;
      if (result.totalMarcados > 0) {
        logger.info(`[No-show] ${result.totalMarcados} reserva(s) marcada(s) automaticamente.`);
      }
      return { ...result, tolerancia_no_show_min: tolerancia };
    } catch (error) {
      if (connection && transactionStarted) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
      checkInProgress = false;
    }
  }

  function runScheduledCheck() {
    checkOnce().catch((error) => {
      logger.error('[No-show] Falha na verificação automática; uma nova tentativa ocorrerá no próximo ciclo:', error);
    });
  }

  function start() {
    if (interval) return;
    runScheduledCheck();
    interval = setInterval(runScheduledCheck, intervalMs);
  }

  function stop() {
    if (!interval) return;
    clearInterval(interval);
    interval = null;
  }

  return { start, stop, checkOnce };
}

const configuredInterval = process.env.NO_SHOW_CHECK_INTERVAL_MS === undefined
  ? DEFAULT_INTERVAL_MS
  : Number(process.env.NO_SHOW_CHECK_INTERVAL_MS);

const noShowScheduler = createNoShowScheduler({ intervalMs: configuredInterval });

module.exports = {
  DEFAULT_INTERVAL_MS,
  createNoShowScheduler,
  startNoShowScheduler: noShowScheduler.start,
  stopNoShowScheduler: noShowScheduler.stop
};
