-- ============================================================
-- Migration 16: Regras de Uso, Horário de Funcionamento e Extensões
-- Fase B: Regras de Uso
-- 1. Horário de funcionamento e dias de operação para espaços
-- 2. Suporte a tipos de reserva (comum, aula), disciplina e turma
-- 3. Rastreamento formal de prorrogações/extensões de reserva
-- ============================================================

-- 1. Horário de funcionamento dos espaços
ALTER TABLE `espaco`
  ADD COLUMN `horario_abertura` TIME NOT NULL DEFAULT '07:00:00',
  ADD COLUMN `horario_fechamento` TIME NOT NULL DEFAULT '22:00:00',
  ADD COLUMN `dias_funcionamento` VARCHAR(50) NOT NULL DEFAULT '1,2,3,4,5,6';

-- 2. Tipo de reserva, aula/turma e campos de extensão auditável
ALTER TABLE `reserva`
  ADD COLUMN `tipo` VARCHAR(30) NOT NULL DEFAULT 'comum',
  ADD COLUMN `disciplina` VARCHAR(100) NULL,
  ADD COLUMN `turma` VARCHAR(50) NULL,
  ADD COLUMN `data_fim_original` DATETIME NULL,
  ADD COLUMN `prorrogada_ate` DATETIME NULL,
  ADD COLUMN `justificativa_prorrogacao` VARCHAR(255) NULL;

CREATE INDEX `idx_reserva_tipo` ON `reserva` (`tipo`);
