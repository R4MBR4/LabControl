# Registro Interno de Auditoria e Preparação — LabControl
**Data:** Outubro de 2026  
**Etapa:** Bloco 01 — Auditoria e Preparação  
**Repositório Base:** LabControl Fullstack  

---

## 1. Arquitetura e Estrutura do Sistema

```
LabControl/
├── backend/
│   ├── config/
│   │   └── db.js                  # Pool MySQL (mysql2/promise) e resolução adaptativa de colunas
│   ├── controllers/
│   │   ├── authController.js       # Login e revalidação de token (/me)
│   │   ├── capacitacaoController.js # Gestão e checagem de autorizações
│   │   ├── consumivelController.js  # Estoque e movimentação de insumos
│   │   ├── dashboardController.js   # Consolidação de métricas operacionais
│   │   ├── equipamentoController.js # CRUD, histórico e QR Code de equipamentos
│   │   ├── espacoController.js      # CRUD de laboratórios e salas
│   │   ├── manutencaoController.js  # Ordens de serviço e laudo técnico
│   │   ├── ocorrenciaController.js  # Chamados de avaria e parecer administrativo
│   │   ├── reservaController.js     # Reservas com bloqueio de conflitos
│   │   ├── usuarioController.js     # CRUD de contas de acesso
│   │   └── utilizacaoController.js  # Check-in e Check-out via QR Code
│   ├── middlewares/
│   │   └── auth.js                # JWT e verificação de perfil administrativo
│   ├── models/
│   │   ├── dbHelper.js            # Abstração de queries e validação de schema
│   │   └── [entidade]Model.js     # Camada DAO por tabela
│   ├── routes/                    # Roteadores Express RESTful
│   ├── server.js                  # Ponto de inicialização da API (porta 3001)
│   ├── migrate.js                 # Script de execução do schema.sql
│   └── package.json               # Dependências do backend
├── database/
│   └── schema.sql                 # DDL das 9 tabelas e dados seed iniciais
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx         # Cabeçalho responsivo com perfil e gaveta mobile
    │   │   ├── ProtectedRoute.jsx # Guard de rota autenticada e adminOnly
    │   │   ├── QRCodeModal.jsx    # Visualização, download e impressão de QR Code
    │   │   └── QRScanner.jsx      # Scanner com câmera e leitura de arquivo
    │   ├── context/
    │   │   └── AuthContext.jsx    # Gerenciamento de sessão, token e usuário
    │   ├── pages/                 # 11 páginas implementadas (SPA)
    │   ├── services/
    │   │   ├── api.js             # Instância Axios com interceptors e fallback
    │   │   └── mockData.js        # Fallback offline para demonstração
    │   ├── App.jsx                # Roteamento HashRouter e layout
    │   └── main.jsx               # Entrypoint React 18
    ├── vite.config.js             # Configuração Vite com proxy /api para 3001
    └── package.json               # Dependências do frontend
```

---

## 2. Inventário do Banco de Dados Atual (9 Tabelas)

| Tabela | Chave Primária | Foreign Keys | Índices Relevantes | Finalidade |
|---|---|---|---|---|
| `usuario` | `id` (AUTO_INCREMENT) | Nenhuma | `idx_usuario_email`, `idx_usuario_perfil` | Contas de acesso (admin, professor, aluno) |
| `espaco` | `id` (AUTO_INCREMENT) | Nenhuma | `idx_espaco_status`, `codigo` (UNIQUE) | Laboratórios, oficinas e salas técnicas |
| `equipamento` | `id` (AUTO_INCREMENT) | `fk_equipamento_espaco` $\rightarrow$ `espaco(id)` | `idx_equipamento_espaco`, `idx_equipamento_status`, `codigo_patrimonio` (UNIQUE) | Rastreabilidade e patrimônio dos equipamentos |
| `reserva` | `id` (AUTO_INCREMENT) | `fk_reserva_usuario`, `fk_reserva_espaco`, `fk_reserva_equipamento` | `idx_reserva_datas` (`data_inicio`, `data_fim`), `idx_reserva_status` | Agendamentos com prevenção de sobreposição |
| `utilizacao` | `id` (AUTO_INCREMENT) | `fk_utilizacao_reserva`, `fk_utilizacao_usuario`, `fk_utilizacao_equipamento` | `idx_utilizacao_status` | Registro de check-in e check-out via QR Code |
| `ocorrencia` | `id` (AUTO_INCREMENT) | `fk_ocorrencia_equipamento`, `fk_ocorrencia_espaco`, `fk_ocorrencia_usuario` | `idx_ocorrencia_status` | Relatos de defeitos e avarias com gravidade |
| `manutencao` | `id` (AUTO_INCREMENT) | `fk_manutencao_equipamento` $\rightarrow$ `equipamento(id)` | `idx_manutencao_status` | Ordens de manutenção preventiva e corretiva |
| `consumivel` | `id` (AUTO_INCREMENT) | `fk_consumivel_espaco` $\rightarrow$ `espaco(id)` | Nenhum | Controle de insumos com estoque mínimo |
| `capacitacao` | `id` (AUTO_INCREMENT) | `fk_capacitacao_usuario`, `fk_capacitacao_equipamento` | Nenhum | Habilitação prévia para equipamentos críticos |

---

## 3. Mapeamento de Rotas da API

* **`/api/auth`**:
  * `POST /login`: Autenticação e emissão de JWT.
  * `GET /me`: Revalidação da sessão ativa do usuário logado.
* **`/api/usuarios`**:
  * `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` (Admin).
* **`/api/espacos`**:
  * `GET /`, `GET /:id`: Acesso para usuários autenticados.
  * `POST /`, `PUT /:id`, `DELETE /:id`: Restritos a administradores.
* **`/api/equipamentos`**:
  * `GET /`, `GET /:id`, `GET /:id/historico`, `GET /:id/qrcode`: Consulta aberta a autenticados.
  * `POST /`, `PUT /:id`, `DELETE /:id`: Restritos a administradores.
* **`/api/reservas`**:
  * `GET /`, `GET /:id`, `POST /`: Solicitação e listagem com escopo por perfil.
  * `PUT /:id/cancelar`: Cancelamento pelo solicitante ou administrador.
  * `PUT /:id/status`: Atualização restrita.
* **`/api/utilizacoes`**:
  * `GET /`, `GET /:id`: Consulta de utilizações ativas ou concluídas.
  * `POST /checkin`: Registro de início de uso (bloqueia se em manutenção ou sem capacitação).
  * `POST /checkout`: Conclusão com condição obrigatória e gatilho de avaria.
* **`/api/ocorrencias`**:
  * `GET /`, `POST /`, `GET /:id`: Abertura e acompanhamento de chamados.
  * `PUT /:id/decidir`: Parecer do administrador e encaminhamento para manutenção.
  * `DELETE /:id`: Exclusão administrativa.
* **`/api/manutencoes`**:
  * `GET /`, `GET /:id`: Consulta de ordens de serviço.
  * `POST /`, `PUT /:id`: Registro (bloqueia o equipamento).
  * `PUT /:id/concluir`: Finalização com laudo técnico e retorno do equipamento para disponível.
* **`/api/consumiveis`**:
  * `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`: Gestão de insumos.
  * `POST /:id/movimentar`: Entrada e saída atômica com trava contra saldo negativo.
* **`/api/capacitacoes`**:
  * `GET /`, `GET /usuario/:userId`, `GET /verificar/:equipamentoId`: Validação de autorizações.
  * `POST /`, `PUT /:id`, `DELETE /:id`: Gestão por administradores.
* **`/api/dashboard`**:
  * `GET /metricas`: Totalizadores e alertas de estoque crítico.
* **`/tabelas`**:
  * `GET /`: Interface web para inspeção direta das tabelas no banco de dados.

---

## 4. Regras de Negócio Consolidadas no Código

1. **Prevenção Temporal de Conflitos (`reservaModel.js` - L87-125):**
   * Fórmula matemática: `(r.data_inicio < ? AND r.data_fim > ?)`.
   * Verifica sobreposição tanto para o equipamento quanto para o espaço físico.
2. **Interdição por Manutenção (`reservaController.js` - L88-93 / `utilizacaoController.js` - L59-62):**
   * Equipamento com `status = 'manutencao'` tem reservas e check-ins bloqueados com mensagem explicativa.
3. **Capacitação Técnica Obrigatória (`capacitacaoModel.js` - L44-64):**
   * Se `equipamento.exige_capacitacao == 1`, verifica se o usuário possui registro ativo e não expirado na tabela `capacitacao`.
4. **Condição Obrigatória no Check-out (`utilizacaoController.js` - L117-185):**
   * O check-out exige preenchimento textual da condição de devolução.
   * Se identificada avaria (ou marcado `houve_avaria`), gera ocorrência automática e move o equipamento para `manutencao`.
5. **Estoque Não-Negativo (`consumivelModel.js` - L60-80):**
   * Operação atômica que rejeita movimentações cujo saldo resultante seja menor que zero.
6. **Ciclo Completo de Manutenção (`manutencaoModel.js` - L59-115):**
   * Criação da manutenção move o equipamento para `manutencao`.
   * Conclusão com laudo registra `data_fim` e retorna o equipamento para `disponivel`.

---

## 5. Plano de Execução dos Próximos Blocos

* **Bloco 02 — Equipamentos:** Adicionar identificadores (Patrimônio UFPI vs Código LabControl interno), campos técnicos, fotos administrativas e fluxo de inativação lógica sem perda de histórico.
* **Bloco 03 — QR Code:** Geração em lote com seleção múltipla e folha imprimível completa.
* **Bloco 04 — Fotografias:** Captura estrita via câmera para evidência probatória (ocorrência/check-out) sem opção de galeria.
* **Bloco 05 — Inventário por QR:** Leitura sequencial por laboratório, confronto de localização e tela de decisão administrativa.
* **Bloco 06 a 16:** Seguir rigorosamente a ordem incremental da especificação.
