-- ========================================================
-- LabControl - Migração 03: Evidências Fotográficas por Câmera
-- ========================================================

USE `labcontrol`;

SET @dbname = DATABASE();

-- 1. Novas colunas em ocorrencia
SET @tablename = 'ocorrencia';

-- titulo
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'titulo') > 0,
  'SELECT 1',
  'ALTER TABLE `ocorrencia` ADD COLUMN `titulo` VARCHAR(150) NULL AFTER `usuario_id`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- gravidade
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'gravidade') > 0,
  'SELECT 1',
  'ALTER TABLE `ocorrencia` ADD COLUMN `gravidade` VARCHAR(30) NULL DEFAULT "media" AFTER `prioridade`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- utilizacao_id
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'utilizacao_id') > 0,
  'SELECT 1',
  'ALTER TABLE `ocorrencia` ADD COLUMN `utilizacao_id` INT NULL AFTER `espaco_id`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- foto_evidencia
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'foto_evidencia') > 0,
  'SELECT 1',
  'ALTER TABLE `ocorrencia` ADD COLUMN `foto_evidencia` LONGTEXT NULL AFTER `descricao`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- foto_metadata
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'foto_metadata') > 0,
  'SELECT 1',
  'ALTER TABLE `ocorrencia` ADD COLUMN `foto_metadata` TEXT NULL AFTER `foto_evidencia`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- decisao_admin
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'decisao_admin') > 0,
  'SELECT 1',
  'ALTER TABLE `ocorrencia` ADD COLUMN `decisao_admin` TEXT NULL AFTER `data_resolucao`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- data_decisao
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'data_decisao') > 0,
  'SELECT 1',
  'ALTER TABLE `ocorrencia` ADD COLUMN `data_decisao` DATETIME NULL AFTER `decisao_admin`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 2. Novas colunas em utilizacao
SET @tablename = 'utilizacao';

-- foto_evidencia
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'foto_evidencia') > 0,
  'SELECT 1',
  'ALTER TABLE `utilizacao` ADD COLUMN `foto_evidencia` LONGTEXT NULL AFTER `condicao_devolucao`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- foto_metadata
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'foto_metadata') > 0,
  'SELECT 1',
  'ALTER TABLE `utilizacao` ADD COLUMN `foto_metadata` TEXT NULL AFTER `foto_evidencia`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- houve_avaria
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'houve_avaria') > 0,
  'SELECT 1',
  'ALTER TABLE `utilizacao` ADD COLUMN `houve_avaria` TINYINT(1) NOT NULL DEFAULT 0 AFTER `foto_metadata`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- relato_avaria
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'relato_avaria') > 0,
  'SELECT 1',
  'ALTER TABLE `utilizacao` ADD COLUMN `relato_avaria` TEXT NULL AFTER `houve_avaria`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
