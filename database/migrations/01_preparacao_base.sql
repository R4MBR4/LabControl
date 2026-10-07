-- ========================================================
-- LabControl - Migração 01: Baseline e Preparação do Sistema
-- Compatível com MySQL 8.0+ / MariaDB 10.4+ / TiDB Cloud
-- ========================================================

-- Garante existência da base de dados
CREATE DATABASE IF NOT EXISTS `labcontrol`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `labcontrol`;

-- Verificação da integridade das 9 tabelas base:
-- 1. usuario
-- 2. espaco
-- 3. equipamento
-- 4. reserva
-- 5. utilizacao
-- 6. ocorrencia
-- 7. manutencao
-- 8. consumivel
-- 9. capacitacao
-- (As definições canônicas de criação constam em database/schema.sql)
