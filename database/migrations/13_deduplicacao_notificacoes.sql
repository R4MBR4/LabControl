-- ============================================================
-- Migration 13: Chaves idempotentes para eventos notificados
-- ============================================================

ALTER TABLE `notificacao`
  ADD COLUMN `dedupe_key` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `uq_notificacao_dedupe_key` (`dedupe_key`);
