-- ========================================================
-- LabControl - Migração 02: Evolução do Módulo de Equipamentos
-- ========================================================

USE `labcontrol`;

-- 1. Adição de novas colunas na tabela equipamento (idempotente)
SET @dbname = DATABASE();
SET @tablename = 'equipamento';

-- patrimonio_ufpi
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'patrimonio_ufpi') > 0,
  'SELECT 1',
  'ALTER TABLE `equipamento` ADD COLUMN `patrimonio_ufpi` VARCHAR(50) NULL AFTER `codigo_patrimonio`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- codigo_labcontrol
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'codigo_labcontrol') > 0,
  'SELECT 1',
  'ALTER TABLE `equipamento` ADD COLUMN `codigo_labcontrol` VARCHAR(50) NULL AFTER `patrimonio_ufpi`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- marca
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'marca') > 0,
  'SELECT 1',
  'ALTER TABLE `equipamento` ADD COLUMN `marca` VARCHAR(100) NULL AFTER `categoria`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- localizacao_detalhada
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'localizacao_detalhada') > 0,
  'SELECT 1',
  'ALTER TABLE `equipamento` ADD COLUMN `localizacao_detalhada` VARCHAR(150) NULL AFTER `numero_serie`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- observacoes
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'observacoes') > 0,
  'SELECT 1',
  'ALTER TABLE `equipamento` ADD COLUMN `observacoes` TEXT NULL AFTER `exige_capacitacao`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- foto_url
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'foto_url') > 0,
  'SELECT 1',
  'ALTER TABLE `equipamento` ADD COLUMN `foto_url` LONGTEXT NULL AFTER `observacoes`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inativo
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'inativo') > 0,
  'SELECT 1',
  'ALTER TABLE `equipamento` ADD COLUMN `inativo` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inativo_em
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'inativo_em') > 0,
  'SELECT 1',
  'ALTER TABLE `equipamento` ADD COLUMN `inativo_em` DATETIME NULL AFTER `inativo`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inativo_por_usuario_id
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'inativo_por_usuario_id') > 0,
  'SELECT 1',
  'ALTER TABLE `equipamento` ADD COLUMN `inativo_por_usuario_id` INT NULL AFTER `inativo_em`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- motivo_inativacao
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'motivo_inativacao') > 0,
  'SELECT 1',
  'ALTER TABLE `equipamento` ADD COLUMN `motivo_inativacao` TEXT NULL AFTER `inativo_por_usuario_id`;'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. População de compatibilidade retroativa para registros existentes
UPDATE `equipamento` 
SET `patrimonio_ufpi` = `codigo_patrimonio` 
WHERE `patrimonio_ufpi` IS NULL AND `codigo_patrimonio` IS NOT NULL;

UPDATE `equipamento` 
SET `codigo_labcontrol` = CONCAT('LC-EQ-', LPAD(`id`, 4, '0')) 
WHERE `codigo_labcontrol` IS NULL;
