-- ============================================================
-- Migration 12: Histórico transacional de movimentações de consumíveis
-- ============================================================

CREATE TABLE IF NOT EXISTS `consumivel_movimentacao` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `consumivel_id` INT NULL,
  `consumivel_nome` VARCHAR(100) NOT NULL,
  `tipo` VARCHAR(20) NOT NULL,
  `quantidade_anterior` DECIMAL(10,2) NOT NULL,
  `quantidade_movimentada` DECIMAL(10,2) NOT NULL,
  `quantidade_resultante` DECIMAL(10,2) NOT NULL,
  `usuario_id` INT NULL,
  `observacao` VARCHAR(500) NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_consumivel_movimentacao_item_data` (`consumivel_id`, `criado_em`),
  INDEX `idx_consumivel_movimentacao_usuario_data` (`usuario_id`, `criado_em`),
  CONSTRAINT `fk_consumivel_movimentacao_item`
    FOREIGN KEY (`consumivel_id`) REFERENCES `consumivel` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_consumivel_movimentacao_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `consumivel_movimentacao`
  (consumivel_id, consumivel_nome, tipo, quantidade_anterior, quantidade_movimentada,
   quantidade_resultante, usuario_id, observacao)
SELECT c.id, c.nome, 'entrada', 0, c.quantidade, c.quantidade, NULL,
       'Saldo inicial registrado na implantação do histórico de consumíveis'
FROM `consumivel` c
WHERE c.quantidade > 0
  AND NOT EXISTS (
    SELECT 1
    FROM `consumivel_movimentacao` m
    WHERE m.consumivel_id = c.id
      AND m.observacao = 'Saldo inicial registrado na implantação do histórico de consumíveis'
  );
