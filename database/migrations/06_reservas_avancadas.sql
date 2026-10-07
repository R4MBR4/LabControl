-- ============================================================
-- Migration 06: Reservas Avançadas, Recorrência e No-Show
-- Permite busca detalhada, visualização em calendário,
-- séries recorrentes com cancelamento pontual e marcação de no-show
-- ============================================================

ALTER TABLE `reserva` MODIFY `espaco_id` INT NULL;

ALTER TABLE `reserva` ADD COLUMN `observacoes` TEXT NULL;

ALTER TABLE `reserva` ADD COLUMN `grupo_recorrencia_id` VARCHAR(64) NULL;

ALTER TABLE `reserva` ADD COLUMN `recorrente` TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE `reserva` ADD COLUMN `regra_recorrencia` VARCHAR(100) NULL;

ALTER TABLE `reserva` ADD COLUMN `no_show` TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE `reserva` ADD COLUMN `no_show_at` DATETIME NULL;

ALTER TABLE `reserva` ADD COLUMN `tolerancia_no_show_min` INT NOT NULL DEFAULT 15;

CREATE INDEX `idx_reserva_grupo_rec` ON `reserva` (`grupo_recorrencia_id`);

CREATE INDEX `idx_reserva_no_show` ON `reserva` (`no_show`);
