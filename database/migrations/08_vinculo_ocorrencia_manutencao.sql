-- ============================================================
-- Migration 08: Vincula uma ordem de manutenção à ocorrência de origem
-- ============================================================

ALTER TABLE `manutencao`
  ADD COLUMN `ocorrencia_id` INT NULL AFTER `equipamento_id`,
  ADD INDEX `idx_manutencao_ocorrencia` (`ocorrencia_id`),
  ADD CONSTRAINT `fk_manutencao_ocorrencia`
    FOREIGN KEY (`ocorrencia_id`) REFERENCES `ocorrencia` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
