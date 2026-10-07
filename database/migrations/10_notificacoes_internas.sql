-- ============================================================
-- Migration 10: Notificações internas por usuário
-- ============================================================

CREATE TABLE IF NOT EXISTS `notificacao` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `tipo` VARCHAR(40) NOT NULL,
  `titulo` VARCHAR(160) NOT NULL,
  `mensagem` VARCHAR(500) NOT NULL,
  `link` VARCHAR(255) NULL,
  `entidade` VARCHAR(50) NULL,
  `entidade_id` VARCHAR(100) NULL,
  `lida_em` DATETIME NULL,
  `criada_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notificacao_usuario_data` (`usuario_id`, `criada_em`),
  INDEX `idx_notificacao_usuario_lida` (`usuario_id`, `lida_em`),
  CONSTRAINT `fk_notificacao_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
