-- ========================================================
-- LabControl - Migração 05: Gestão de Laboratórios e Modo Monitor
-- ========================================================

USE `labcontrol`;

SET @dbname = DATABASE();
SET @tablename = 'espaco';

-- responsavel
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'responsavel') > 0,
  'SELECT 1',
  'ALTER TABLE `espaco` ADD COLUMN `responsavel` VARCHAR(100) NULL AFTER `localizacao`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- foto_url
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'foto_url') > 0,
  'SELECT 1',
  'ALTER TABLE `espaco` ADD COLUMN `foto_url` LONGTEXT NULL AFTER `descricao`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- regras_utilizacao
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'regras_utilizacao') > 0,
  'SELECT 1',
  'ALTER TABLE `espaco` ADD COLUMN `regras_utilizacao` TEXT NULL AFTER `foto_url`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
