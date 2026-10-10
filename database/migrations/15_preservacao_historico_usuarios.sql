-- ============================================================
-- Migration 15: Preservação de Histórico e Integridade de Usuários
-- Impede deleção acidental em cascata de registros históricos e
-- assegura coluna de inativação lógica idempotente
-- ============================================================

USE `labcontrol`;

SET @dbname = DATABASE();

-- 1. Garante existência da coluna ativo na tabela usuario
SET @tablename = 'usuario';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'ativo') > 0,
  'SELECT 1',
  'ALTER TABLE `usuario` ADD COLUMN `ativo` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Sincroniza flag ativo com base no status existente
UPDATE `usuario` 
SET `ativo` = 0 
WHERE `status` = 'inativo';

-- 3. Atualização de constraints para RESTRICT na deleção física de usuário
-- (Garante que o banco bloqueie tentativa de remoção física de usuário com histórico)

-- reserva -> usuario
SET @dropReservaFk = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'reserva' AND CONSTRAINT_NAME = 'fk_reserva_usuario') > 0,
  'ALTER TABLE `reserva` DROP FOREIGN KEY `fk_reserva_usuario`;',
  'SELECT 1'
));
PREPARE stmt FROM @dropReservaFk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `reserva`
  ADD CONSTRAINT `fk_reserva_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- utilizacao -> usuario
SET @dropUtilizacaoFk = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'utilizacao' AND CONSTRAINT_NAME = 'fk_utilizacao_usuario') > 0,
  'ALTER TABLE `utilizacao` DROP FOREIGN KEY `fk_utilizacao_usuario`;',
  'SELECT 1'
));
PREPARE stmt FROM @dropUtilizacaoFk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `utilizacao`
  ADD CONSTRAINT `fk_utilizacao_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ocorrencia -> usuario
SET @dropOcorrenciaFk = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ocorrencia' AND CONSTRAINT_NAME = 'fk_ocorrencia_usuario') > 0,
  'ALTER TABLE `ocorrencia` DROP FOREIGN KEY `fk_ocorrencia_usuario`;',
  'SELECT 1'
));
PREPARE stmt FROM @dropOcorrenciaFk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `ocorrencia`
  ADD CONSTRAINT `fk_ocorrencia_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- capacitacao -> usuario
SET @dropCapacitacaoFk = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'capacitacao' AND CONSTRAINT_NAME = 'fk_capacitacao_usuario') > 0,
  'ALTER TABLE `capacitacao` DROP FOREIGN KEY `fk_capacitacao_usuario`;',
  'SELECT 1'
));
PREPARE stmt FROM @dropCapacitacaoFk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `capacitacao`
  ADD CONSTRAINT `fk_capacitacao_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
