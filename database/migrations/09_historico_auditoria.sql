-- ============================================================
-- Migration 09: Trilha append-only de auditoria operacional
-- ============================================================

CREATE TABLE IF NOT EXISTS `auditoria_evento` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `equipamento_id` INT NULL,
  `entidade` VARCHAR(50) NOT NULL,
  `entidade_id` VARCHAR(100) NULL,
  `acao` VARCHAR(100) NOT NULL,
  `usuario_id` INT NULL,
  `detalhes` TEXT NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_auditoria_equipamento_data` (`equipamento_id`, `criado_em`),
  INDEX `idx_auditoria_entidade` (`entidade`, `entidade_id`),
  INDEX `idx_auditoria_usuario_data` (`usuario_id`, `criado_em`),
  CONSTRAINT `fk_auditoria_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
