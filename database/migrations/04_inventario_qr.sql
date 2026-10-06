-- ========================================================
-- LabControl - Migração 04: Módulo de Inventário por QR Code
-- ========================================================

USE `labcontrol`;

-- 1. Tabela de Sessões de Inventário
CREATE TABLE IF NOT EXISTS `inventario` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `espaco_id` INT NOT NULL,
  `usuario_id` INT NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'em_andamento',
  `data_inicio` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `data_fim` DATETIME NULL,
  `total_esperados` INT NOT NULL DEFAULT 0,
  `total_conferidos` INT NOT NULL DEFAULT 0,
  `total_divergentes` INT NOT NULL DEFAULT 0,
  `total_nao_localizados` INT NOT NULL DEFAULT 0,
  `observacoes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_inventario_espaco` (`espaco_id`),
  INDEX `idx_inventario_status` (`status`),
  CONSTRAINT `fk_inventario_espaco`
    FOREIGN KEY (`espaco_id`) REFERENCES `espaco` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_inventario_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabela de Itens do Inventário
CREATE TABLE IF NOT EXISTS `inventario_item` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `inventario_id` INT NOT NULL,
  `equipamento_id` INT NOT NULL,
  `espaco_esperado_id` INT NOT NULL,
  `espaco_encontrado_id` INT NOT NULL,
  `status_conferencia` VARCHAR(30) NOT NULL DEFAULT 'conferido',
  `decisao_admin` VARCHAR(50) NULL,
  `decisao_usuario_id` INT NULL,
  `decisao_data` DATETIME NULL,
  `data_leitura` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_invitem_sessao` (`inventario_id`),
  INDEX `idx_invitem_equip` (`equipamento_id`),
  INDEX `idx_invitem_status` (`status_conferencia`),
  CONSTRAINT `fk_invitem_inventario`
    FOREIGN KEY (`inventario_id`) REFERENCES `inventario` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_invitem_equipamento`
    FOREIGN KEY (`equipamento_id`) REFERENCES `equipamento` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_invitem_espaco_esperado`
    FOREIGN KEY (`espaco_esperado_id`) REFERENCES `espaco` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_invitem_espaco_encontrado`
    FOREIGN KEY (`espaco_encontrado_id`) REFERENCES `espaco` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_invitem_decisao_usuario`
    FOREIGN KEY (`decisao_usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
