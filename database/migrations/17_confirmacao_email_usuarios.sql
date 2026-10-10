-- ============================================================
-- Migration 17: Confirmação de E-mail Institucional e Ciclo de Vida de Contas
-- Adiciona suporte a confirmação de e-mail com token temporário e controle de ativação
-- ============================================================

USE `labcontrol`;

SET @dbname = DATABASE();
SET @tablename = 'usuario';

-- 1. Garante existência da coluna email_confirmado na tabela usuario (padrão 1 para legados)
SET @preparedStatement1 = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'email_confirmado') > 0,
  'SELECT 1',
  'ALTER TABLE `usuario` ADD COLUMN `email_confirmado` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;'
));
PREPARE stmt1 FROM @preparedStatement1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- 2. Garante existência da coluna token_confirmacao
SET @preparedStatement2 = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'token_confirmacao') > 0,
  'SELECT 1',
  'ALTER TABLE `usuario` ADD COLUMN `token_confirmacao` VARCHAR(255) NULL AFTER `email_confirmado`;'
));
PREPARE stmt2 FROM @preparedStatement2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 3. Garante existência da coluna token_confirmacao_expira
SET @preparedStatement3 = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'token_confirmacao_expira') > 0,
  'SELECT 1',
  'ALTER TABLE `usuario` ADD COLUMN `token_confirmacao_expira` DATETIME NULL AFTER `token_confirmacao`;'
));
PREPARE stmt3 FROM @preparedStatement3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- 4. Assegura índice no token para buscas rápidas
SET @indexStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND INDEX_NAME = 'idx_usuario_token_confirmacao') > 0,
  'SELECT 1',
  'ALTER TABLE `usuario` ADD INDEX `idx_usuario_token_confirmacao` (`token_confirmacao`);'
));
PREPARE stmtIndex FROM @indexStatement;
EXECUTE stmtIndex;
DEALLOCATE PREPARE stmtIndex;

-- 5. Atualiza usuários já existentes para manterem-se confirmados
UPDATE `usuario`
SET `email_confirmado` = 1
WHERE `email_confirmado` IS NULL;
