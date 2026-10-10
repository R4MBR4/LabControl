-- ========================================================
-- LabControl - Script de Criação e População do Banco de Dados
-- Sistema de Gestão e Rastreabilidade de Espaços e Equipamentos
-- Compatível com: MySQL 8.0+ / MariaDB 10.4+ (XAMPP)
-- ========================================================

CREATE DATABASE IF NOT EXISTS `labcontrol`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `labcontrol`;

-- Desativa temporariamente checagens para recriação limpa
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `notificacao`;
DROP TABLE IF EXISTS `auditoria_evento`;
DROP TABLE IF EXISTS `consumivel_movimentacao`;
DROP TABLE IF EXISTS `configuracao_sistema`;
DROP TABLE IF EXISTS `inventario_item`;
DROP TABLE IF EXISTS `inventario`;
DROP TABLE IF EXISTS `capacitacao`;
DROP TABLE IF EXISTS `consumivel`;
DROP TABLE IF EXISTS `manutencao`;
DROP TABLE IF EXISTS `ocorrencia`;
DROP TABLE IF EXISTS `utilizacao`;
DROP TABLE IF EXISTS `reserva`;
DROP TABLE IF EXISTS `equipamento_documento`;
DROP TABLE IF EXISTS `equipamento`;
DROP TABLE IF EXISTS `espaco`;
DROP TABLE IF EXISTS `usuario`;

SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------
-- 1. Tabela: usuario
-- --------------------------------------------------------
CREATE TABLE `usuario` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nome` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `senha` VARCHAR(255) NOT NULL,
  `perfil` VARCHAR(30) NOT NULL DEFAULT 'usuario',
  `matricula` VARCHAR(50) UNIQUE NULL,
  `departamento` VARCHAR(100) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ativo',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_usuario_email` (`email`),
  INDEX `idx_usuario_perfil` (`perfil`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. Tabela: espaco (Laboratórios e Salas Técnicas)
-- --------------------------------------------------------
CREATE TABLE `espaco` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nome` VARCHAR(100) NOT NULL,
  `codigo` VARCHAR(50) NOT NULL UNIQUE,
  `capacidade` INT NOT NULL DEFAULT 20,
  `localizacao` VARCHAR(150) NULL,
  `responsavel` VARCHAR(100) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'disponivel',
  `horario_abertura` TIME NOT NULL DEFAULT '07:00:00',
  `horario_fechamento` TIME NOT NULL DEFAULT '22:00:00',
  `dias_funcionamento` VARCHAR(50) NOT NULL DEFAULT '1,2,3,4,5,6',
  `descricao` TEXT NULL,
  `foto_url` LONGTEXT NULL,
  `regras_utilizacao` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_espaco_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. Tabela: equipamento
-- --------------------------------------------------------
CREATE TABLE `equipamento` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `espaco_id` INT NOT NULL,
  `nome` VARCHAR(100) NOT NULL,
  `codigo_patrimonio` VARCHAR(50) NOT NULL UNIQUE,
  `patrimonio_ufpi` VARCHAR(50) NULL,
  `codigo_labcontrol` VARCHAR(50) NULL UNIQUE,
  `categoria` VARCHAR(50) NULL,
  `marca` VARCHAR(100) NULL,
  `modelo` VARCHAR(100) NULL,
  `especificacoes` TEXT NULL,
  `numero_serie` VARCHAR(100) NULL,
  `data_aquisicao` DATE NULL,
  `valor_aquisicao` DECIMAL(12,2) NULL,
  `fornecedor` VARCHAR(160) NULL,
  `garantia_ate` DATE NULL,
  `garantia_detalhes` VARCHAR(500) NULL,
  `localizacao_detalhada` VARCHAR(150) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'disponivel',
  `inativo` TINYINT(1) NOT NULL DEFAULT 0,
  `inativo_em` DATETIME NULL,
  `inativo_por_usuario_id` INT NULL,
  `motivo_inativacao` TEXT NULL,
  `exige_capacitacao` TINYINT(1) NOT NULL DEFAULT 0,
  `observacoes` TEXT NULL,
  `foto_url` LONGTEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_equipamento_espaco` (`espaco_id`),
  INDEX `idx_equipamento_status` (`status`),
  INDEX `idx_equipamento_inativo` (`inativo`),
  INDEX `idx_equipamento_labcontrol` (`codigo_labcontrol`),
  INDEX `idx_equipamento_ufpi` (`patrimonio_ufpi`),
  CONSTRAINT `fk_equipamento_espaco`
    FOREIGN KEY (`espaco_id`) REFERENCES `espaco` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3.1 Tabela: equipamento_documento (Links de documentação técnica)
-- --------------------------------------------------------
CREATE TABLE `equipamento_documento` (
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

-- --------------------------------------------------------
-- 4. Tabela: reserva (Agendamentos com prevenção de conflitos)
-- --------------------------------------------------------
CREATE TABLE `reserva` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `espaco_id` INT NULL,
  `equipamento_id` INT NULL,
  `data_inicio` DATETIME NOT NULL,
  `data_fim` DATETIME NOT NULL,
  `finalidade` VARCHAR(255) NULL,
  `observacoes` TEXT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'confirmada',
  `tipo` VARCHAR(30) NOT NULL DEFAULT 'comum',
  `disciplina` VARCHAR(100) NULL,
  `turma` VARCHAR(50) NULL,
  `data_fim_original` DATETIME NULL,
  `prorrogada_ate` DATETIME NULL,
  `justificativa_prorrogacao` VARCHAR(255) NULL,
  `grupo_recorrencia_id` VARCHAR(64) NULL,
  `recorrente` TINYINT(1) NOT NULL DEFAULT 0,
  `regra_recorrencia` VARCHAR(100) NULL,
  `no_show` TINYINT(1) NOT NULL DEFAULT 0,
  `no_show_at` DATETIME NULL,
  `tolerancia_no_show_min` INT NOT NULL DEFAULT 15,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_reserva_datas` (`data_inicio`, `data_fim`),
  INDEX `idx_reserva_status` (`status`),
  INDEX `idx_reserva_tipo` (`tipo`),
  INDEX `idx_reserva_grupo_rec` (`grupo_recorrencia_id`),
  INDEX `idx_reserva_no_show` (`no_show`),
  CONSTRAINT `fk_reserva_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_reserva_espaco`
    FOREIGN KEY (`espaco_id`) REFERENCES `espaco` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_reserva_equipamento`
    FOREIGN KEY (`equipamento_id`) REFERENCES `equipamento` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 5. Tabela: utilizacao (Check-in e Check-out via QR Code)
-- --------------------------------------------------------
CREATE TABLE `utilizacao` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reserva_id` INT NULL,
  `usuario_id` INT NOT NULL,
  `equipamento_id` INT NOT NULL,
  `data_inicio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_fim` DATETIME NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'em_uso',
  `condicao_retirada` VARCHAR(255) DEFAULT 'Operacional sem avarias',
  `condicao_devolucao` VARCHAR(255) NULL,
  `foto_evidencia` LONGTEXT NULL,
  `foto_metadata` TEXT NULL,
  `houve_avaria` TINYINT(1) NOT NULL DEFAULT 0,
  `relato_avaria` TEXT NULL,
  `observacoes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_utilizacao_status` (`status`),
  CONSTRAINT `fk_utilizacao_reserva`
    FOREIGN KEY (`reserva_id`) REFERENCES `reserva` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_utilizacao_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_utilizacao_equipamento`
    FOREIGN KEY (`equipamento_id`) REFERENCES `equipamento` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 6. Tabela: ocorrencia (Avarias e defeitos relatados)
-- --------------------------------------------------------
CREATE TABLE `ocorrencia` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `equipamento_id` INT NULL,
  `espaco_id` INT NULL,
  `usuario_id` INT NOT NULL,
  `titulo` VARCHAR(150) NULL,
  `tipo` VARCHAR(50) NOT NULL DEFAULT 'defeito',
  `prioridade` VARCHAR(30) NOT NULL DEFAULT 'media',
  `gravidade` VARCHAR(30) NOT NULL DEFAULT 'media',
  `utilizacao_id` INT NULL,
  `descricao` TEXT NOT NULL,
  `foto_evidencia` LONGTEXT NULL,
  `foto_metadata` TEXT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'aberta',
  `data_registro` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `data_resolucao` DATETIME NULL,
  `decisao_admin` TEXT NULL,
  `data_decisao` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ocorrencia_status` (`status`),
  CONSTRAINT `fk_ocorrencia_equipamento`
    FOREIGN KEY (`equipamento_id`) REFERENCES `equipamento` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_ocorrencia_espaco`
    FOREIGN KEY (`espaco_id`) REFERENCES `espaco` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_ocorrencia_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 7. Tabela: manutencao (Ordens de serviço de manutenção)
-- --------------------------------------------------------
CREATE TABLE `manutencao` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `equipamento_id` INT NOT NULL,
  `ocorrencia_id` INT NULL,
  `tipo` VARCHAR(30) NOT NULL DEFAULT 'corretiva',
  `descricao` TEXT NOT NULL,
  `data_inicio` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `data_fim` DATETIME NULL,
  `responsavel` VARCHAR(100) DEFAULT 'Técnico Especialista',
  `custo` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(30) NOT NULL DEFAULT 'agendada',
  `laudo_tecnico` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_manutencao_status` (`status`),
  INDEX `idx_manutencao_ocorrencia` (`ocorrencia_id`),
  CONSTRAINT `fk_manutencao_equipamento`
    FOREIGN KEY (`equipamento_id`) REFERENCES `equipamento` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_manutencao_ocorrencia`
    FOREIGN KEY (`ocorrencia_id`) REFERENCES `ocorrencia` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 8. Tabela: consumivel (Estoque de insumos dos laboratórios)
-- --------------------------------------------------------
CREATE TABLE `consumivel` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `espaco_id` INT NULL,
  `nome` VARCHAR(100) NOT NULL,
  `categoria` VARCHAR(50) DEFAULT 'Geral',
  `quantidade` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `quantidade_minima` DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  `unidade` VARCHAR(20) NOT NULL DEFAULT 'un',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_consumivel_espaco`
    FOREIGN KEY (`espaco_id`) REFERENCES `espaco` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 8.1 Tabela: consumivel_movimentacao (Histórico transacional de movimentações)
-- --------------------------------------------------------
CREATE TABLE `consumivel_movimentacao` (
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

-- --------------------------------------------------------
-- 9. Tabela: capacitacao (Habilitação para equipamentos críticos)
-- --------------------------------------------------------
CREATE TABLE `capacitacao` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `equipamento_id` INT NOT NULL,
  `titulo` VARCHAR(100) NOT NULL,
  `data_conclusao` DATE NULL,
  `validade` DATE NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'ativo',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_capacitacao_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_capacitacao_equipamento`
    FOREIGN KEY (`equipamento_id`) REFERENCES `equipamento` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 10. Tabela: inventario (Sessões de inventário por laboratório)
-- --------------------------------------------------------
CREATE TABLE `inventario` (
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

-- --------------------------------------------------------
-- 11. Tabela: inventario_item (Itens conferidos e divergências)
-- --------------------------------------------------------
CREATE TABLE `inventario_item` (
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

-- --------------------------------------------------------
-- 12. Tabela: configuracao_sistema (Configurações administrativas)
-- --------------------------------------------------------
CREATE TABLE `configuracao_sistema` (
  `chave` VARCHAR(100) NOT NULL PRIMARY KEY,
  `valor` VARCHAR(255) NOT NULL,
  `atualizado_por_usuario_id` INT NULL,
  `atualizado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_config_sistema_usuario`
    FOREIGN KEY (`atualizado_por_usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 13. Tabela: auditoria_evento (Trilha histórica append-only)
-- --------------------------------------------------------
CREATE TABLE `auditoria_evento` (
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

-- --------------------------------------------------------
-- 14. Tabela: notificacao (Caixa de entrada interna por usuário)
-- --------------------------------------------------------
CREATE TABLE `notificacao` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `tipo` VARCHAR(40) NOT NULL,
  `titulo` VARCHAR(160) NOT NULL,
  `mensagem` VARCHAR(500) NOT NULL,
  `link` VARCHAR(255) NULL,
  `entidade` VARCHAR(50) NULL,
  `entidade_id` VARCHAR(100) NULL,
  `dedupe_key` VARCHAR(191) NULL,
  `lida_em` DATETIME NULL,
  `criada_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `uq_notificacao_dedupe_key` (`dedupe_key`),
  INDEX `idx_notificacao_usuario_data` (`usuario_id`, `criada_em`),
  INDEX `idx_notificacao_usuario_lida` (`usuario_id`, `lida_em`),
  CONSTRAINT `fk_notificacao_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `configuracao_sistema` (`chave`, `valor`)
VALUES ('tolerancia_no_show_minutos', '15');

-- ========================================================
-- SEEDS INICIAIS (DADOS DE TESTE REALISTAS)
-- Senhas:
--   admin@labcontrol.com -> admin123
--   aluno@labcontrol.com -> aluno123
--   professor@labcontrol.com -> admin123
-- ========================================================

INSERT INTO `usuario` (`id`, `nome`, `email`, `senha`, `perfil`, `matricula`, `departamento`, `status`) VALUES
(1, 'Administrador do Sistema', 'admin@labcontrol.com', '$2a$10$hOKKlNUyDUcoYubhHoWgkuBKXH0lH6Md3PmR0Q3b44ae5L3Bzfmam', 'admin', 'ADM-001', 'Coordenação de Laboratórios', 'ativo'),
(2, 'Prof. Carlos Eduardo Santos', 'professor@labcontrol.com', '$2a$10$hOKKlNUyDUcoYubhHoWgkuBKXH0lH6Md3PmR0Q3b44ae5L3Bzfmam', 'professor', 'DOC-102', 'Engenharia e Automação', 'ativo'),
(3, 'Mariana Lima de Souza', 'aluno@labcontrol.com', '$2a$10$ju7OeYcDZVaborHpkjGwAeV6jlQX2u7yhU6MAfQ8qbtyiZ7kgMZXW', 'aluno', 'DIS-2024-05', 'Ciência da Computação', 'ativo');

INSERT INTO `espaco` (`id`, `nome`, `codigo`, `capacidade`, `localizacao`, `status`, `descricao`) VALUES
(1, 'Laboratório de Informática 1', 'LAB-INF-01', 35, 'Bloco B - Sala 204', 'disponivel', 'Equipado com 35 estações de trabalho e projetor interativo.'),
(2, 'Espaço Maker & Prototipagem (FabLab)', 'MAKER-01', 20, 'Bloco C - Térreo', 'disponivel', 'Impressoras 3D, cortadora a laser, bancadas de marcenaria e eletrônica.'),
(3, 'Laboratório de Robótica e Automação', 'LAB-ROB-01', 25, 'Bloco A - Sala 102', 'disponivel', 'Bancadas industriais, braços robóticos e kits microcontrolados.'),
(4, 'Laboratório de Química Analítica', 'LAB-QUI-01', 20, 'Bloco D - 1º Andar', 'manutencao', 'Capela de exaustão, reagentes e balanças de precisão analítica.');

INSERT INTO `equipamento` (`id`, `espaco_id`, `nome`, `codigo_patrimonio`, `patrimonio_ufpi`, `codigo_labcontrol`, `categoria`, `marca`, `modelo`, `numero_serie`, `localizacao_detalhada`, `status`, `exige_capacitacao`) VALUES
(1, 2, 'Impressora 3D Creality K1 Speed', 'PAT-2024-001', 'UFPI-PAT-001', 'LC-EQ-0001', 'Fabricação Digital', 'Creality', 'Creality K1 600mm/s', 'CR-K1-99812', 'Bancada 01 - Fabricação Digital', 'disponivel', 1),
(2, 2, 'Cortadora e Gravadora a Laser CO2 60W', 'PAT-2024-002', 'UFPI-PAT-002', 'LC-EQ-0002', 'Corte e Usinagem', 'LaserMaster', 'LaserMaster 4060', 'LM-60W-3312', 'Área de Corte Fechada', 'em_uso', 1),
(3, 3, 'Osciloscópio Digital Tektronix 50MHz', 'PAT-2024-003', 'UFPI-PAT-003', 'LC-EQ-0003', 'Instrumentação', 'Tektronix', 'TBS1052B-EDU', 'TEK-50-8472', 'Bancada de Eletrônica 02', 'disponivel', 0),
(4, 3, 'Braço Robótico Dobot Magician', 'PAT-2024-004', 'UFPI-PAT-004', 'LC-EQ-0004', 'Robótica', 'Dobot', 'Dobot Basic V2', 'DOBOT-1029', 'Célula de Automação A', 'disponivel', 1),
(5, 4, 'Microscópio Óptico Binocular Nikon', 'PAT-2024-005', 'UFPI-PAT-005', 'LC-EQ-0005', 'Óptica', 'Nikon', 'Eclipse E100', 'NK-88219', 'Bancada Central de Óptica', 'manutencao', 0),
(6, 2, 'Estação de Solda Digital AFR 936', 'PAT-2024-006', 'UFPI-PAT-006', 'LC-EQ-0006', 'Eletrônica', 'AFR', 'AFR 936 ESD', 'AFR-7721', 'Bancada de Montagem Rápida', 'disponivel', 0);

INSERT INTO `reserva` (`id`, `usuario_id`, `espaco_id`, `equipamento_id`, `data_inicio`, `data_fim`, `finalidade`, `status`) VALUES
(1, 2, 2, 2, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR), 'Aula prática de Prototipagem Rápida', 'em_andamento'),
(2, 3, 3, 4, DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 3 HOUR), 'Pesquisa TCC - Controle Cinemático', 'confirmada'),
(3, 1, 1, NULL, DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 2 DAY), INTERVAL 4 HOUR), 'Treinamento Institucional de Docentes', 'pendente');

INSERT INTO `utilizacao` (`id`, `reserva_id`, `usuario_id`, `equipamento_id`, `data_inicio`, `data_fim`, `status`, `condicao_retirada`, `observacoes`) VALUES
(1, 1, 2, 2, DATE_SUB(NOW(), INTERVAL 30 MINUTE), NULL, 'em_uso', 'Operacional sem avarias', 'Check-in realizado via QR Code');

INSERT INTO `ocorrencia` (`id`, `equipamento_id`, `espaco_id`, `usuario_id`, `tipo`, `prioridade`, `descricao`, `status`, `data_registro`) VALUES
(1, 5, 4, 3, 'defeito', 'alta', 'Lente objetiva de 40x apresenta folga e desalinhamento ótico.', 'em_analise', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, 1, 2, 2, 'aviso', 'baixa', 'Bico extrusor precisará de troca preventiva nos próximos dias.', 'aberta', DATE_SUB(NOW(), INTERVAL 2 DAY));

INSERT INTO `manutencao` (`id`, `equipamento_id`, `tipo`, `descricao`, `data_inicio`, `data_fim`, `responsavel`, `custo`, `status`, `laudo_tecnico`) VALUES
(1, 5, 'corretiva', 'Realinhamento e calibração das lentes com assistência técnica autorizada', NOW(), NULL, 'Óptica Precision Lab', 350.00, 'em_andamento', 'Aguardando peças de reposição'),
(2, 2, 'preventiva', 'Limpeza dos espelhos ópticos e verificação do chiller de resfriamento', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY), 'Técnico Especialista Interno', 80.00, 'concluida', 'Manutenção realizada com sucesso');

INSERT INTO `consumivel` (`id`, `espaco_id`, `nome`, `categoria`, `quantidade`, `quantidade_minima`, `unidade`) VALUES
(1, 2, 'Filamento 3D PLA Preto 1.75mm (1kg)', 'Impressão 3D', 2.00, 5.00, 'kg'),
(2, 2, 'Álcool Isopropílico 99.8% (1L)', 'Limpeza e Químicos', 1.00, 4.00, 'L'),
(3, 2, 'Placa MDF Cru 3mm 60x40cm', 'Corte a Laser', 45.00, 15.00, 'un'),
(4, 3, 'Resistor 220 Ohms 1/4W (Pacote 100un)', 'Componentes Eletrônicos', 20.00, 5.00, 'pct');

INSERT INTO `capacitacao` (`id`, `usuario_id`, `equipamento_id`, `titulo`, `data_conclusao`, `validade`, `status`) VALUES
(1, 2, 1, 'Operação Autônoma de Impressoras 3D FDM', '2024-03-10', '2026-12-31', 'ativo'),
(2, 2, 2, 'Segurança e Corte em Máquinas Laser CO2', '2024-02-15', '2026-12-31', 'ativo'),
(3, 3, 4, 'Programação Básica de Braços Robóticos', '2024-04-20', '2026-12-31', 'ativo');
