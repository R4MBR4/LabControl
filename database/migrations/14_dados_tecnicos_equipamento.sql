-- ============================================================
-- Migration 14: Dados técnicos, aquisição e garantia
-- ============================================================

ALTER TABLE `equipamento`
  ADD COLUMN `especificacoes` TEXT NULL,
  ADD COLUMN `data_aquisicao` DATE NULL,
  ADD COLUMN `valor_aquisicao` DECIMAL(12,2) NULL,
  ADD COLUMN `fornecedor` VARCHAR(160) NULL,
  ADD COLUMN `garantia_ate` DATE NULL,
  ADD COLUMN `garantia_detalhes` VARCHAR(500) NULL;
