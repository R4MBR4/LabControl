-- ============================================================
-- Migration 11: Documentos técnicos associados a equipamentos
-- ============================================================

CREATE TABLE IF NOT EXISTS `equipamento_documento` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `equipamento_id` INT NOT NULL,
  `titulo` VARCHAR(160) NOT NULL,
  `tipo` VARCHAR(40) NOT NULL,
  `url` VARCHAR(2048) NOT NULL,
  `descricao` VARCHAR(500) NULL,
  `criado_por_usuario_id` INT NULL,
  `criado_em` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_equipamento_documento_equipamento` (`equipamento_id`, `criado_em`),
  CONSTRAINT `fk_equipamento_documento_equipamento`
    FOREIGN KEY (`equipamento_id`) REFERENCES `equipamento` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_equipamento_documento_usuario`
    FOREIGN KEY (`criado_por_usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
