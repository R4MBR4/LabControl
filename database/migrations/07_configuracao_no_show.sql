-- ============================================================
-- Migration 07: Configuração administrativa da tolerância no-show
-- ============================================================

CREATE TABLE IF NOT EXISTS `configuracao_sistema` (
  `chave` VARCHAR(100) NOT NULL PRIMARY KEY,
  `valor` VARCHAR(255) NOT NULL,
  `atualizado_por_usuario_id` INT NULL,
  `atualizado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_config_sistema_usuario`
    FOREIGN KEY (`atualizado_por_usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `configuracao_sistema` (`chave`, `valor`)
VALUES ('tolerancia_no_show_minutos', '15');
