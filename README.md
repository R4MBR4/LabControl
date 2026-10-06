# LabControl – Plataforma de Gestão e Rastreabilidade de Espaços e Equipamentos Educacionais

O **LabControl** é um sistema web full-stack desenvolvido para controle, agendamento, check-in/check-out via QR Code e rastreabilidade total de espaços (laboratórios, salas especiais) e equipamentos acadêmicos.

> ⚠️ **Importante sobre o Banco de Dados:**
> Este sistema foi desenvolvido para **consumir o banco de dados MySQL existente** (`labcontrol`) via variáveis de ambiente.
> Scripts SQL de schema e evolução estão em `database/`. Eles não são executados automaticamente pelo servidor. `database/schema.sql` recria as tabelas-base e contém comandos `DROP`; **não o execute sobre uma base com dados que devam ser preservados**.
> Para uma base existente, aplique as migrações necessárias de forma controlada. A tolerância de no-show requer `database/migrations/07_configuracao_no_show.sql`; o vínculo entre ordens de manutenção e ocorrências requer `database/migrations/08_vinculo_ocorrencia_manutencao.sql`; a trilha de auditoria requer `database/migrations/09_historico_auditoria.sql`; as notificações internas requerem `database/migrations/10_notificacoes_internas.sql`; os documentos técnicos requerem `database/migrations/11_documentos_tecnicos.sql`; o histórico de consumíveis requer `database/migrations/12_historico_consumiveis.sql`.
> Tabelas consumidas: `usuario` · `espaco` · `equipamento` · `equipamento_documento` · `reserva` · `utilizacao` · `ocorrencia` · `manutencao` · `consumivel` · `capacitacao` · `inventario` · `inventario_item` · `configuracao_sistema` · `auditoria_evento` · `notificacao`

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Front-end** | React (Vite) + Tailwind CSS + Lucide Icons + qrcode.react + html5-qrcode |
| **Back-end** | Node.js + Express.js + JWT (JSON Web Token) + Bcrypt |
| **Banco de Dados** | MySQL (Conexão direta via `mysql2/promise` com Pool de Conexões) |
| **QR Code** | Geração dinâmica de etiquetas SVG/PNG e Leitor via Câmera/Arquivo |

---

## 📁 Estrutura de Pastas

```
LabControl/
├── backend/
│   ├── config/
│   │   └── db.js              # Pool MySQL e resolução adaptativa de colunas
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── usuarioController.js
│   │   ├── espacoController.js
│   │   ├── equipamentoController.js
│   │   ├── integracaoController.js # Importação e exportação CSV
│   │   ├── reservaController.js
│   │   ├── utilizacaoController.js
│   │   ├── ocorrenciaController.js
│   │   ├── manutencaoController.js
│   │   ├── consumivelController.js
│   │   ├── capacitacaoController.js
│   │   └── dashboardController.js
│   ├── middlewares/
│   │   └── auth.js            # Validação de JWT e permissão por perfil
│   ├── models/                # Camada DAO por entidade, incluindo trilha de auditoria
│   ├── routes/                # Rotas RESTful completas
│   ├── .env.example
│   ├── package.json
│   └── server.js              # Ponto de entrada da API Express
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── QRCodeModal.jsx # Geração e impressão de etiquetas QR Code
│   │   │   ├── ImportacaoExportacaoCSV.jsx # Prévia de importação e exportações CSV
│   │   │   └── QRScanner.jsx   # Leitor via câmera ou imagem
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Espacos.jsx
│   │   │   ├── Equipamentos.jsx
│   │   │   ├── EquipamentoDetalhes.jsx # Histórico e rastreabilidade unificada
│   │   │   ├── Reservas.jsx    # Prevenção de conflito e checagem de capacitação
│   │   │   ├── CheckinCheckout.jsx # Leitura de QR Code e condição obrigatória
│   │   │   ├── Ocorrencias.jsx
│   │   │   ├── Manutencao.jsx  # Ciclo: Bloqueio -> Reparo -> Desbloqueio
│   │   │   ├── Consumiveis.jsx # Estoque não-negativo e alerta mínimo
│   │   │   ├── Capacitacoes.jsx
│   │   │   └── Usuarios.jsx
│   │   ├── services/
│   │   │   └── api.js         # Cliente Axios com interceptors de JWT
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── .env.example
└── README.md
```

---

## ⚙️ Regras de Negócio Implementadas

1. **Prevenção de Conflito de Horário:**
   O sistema impede matematicamente (`data_inicio < nova_fim AND data_fim > nova_inicio`) o agendamento simultâneo para o mesmo espaço ou equipamento.
   Reservas confirmadas sem utilização são verificadas automaticamente pelo backend no início e a cada 60 segundos, respeitando a tolerância administrativa. O intervalo pode ser ajustado por `NO_SHOW_CHECK_INTERVAL_MS` (mínimo de 1000 ms); a verificação manual continua disponível e nenhuma punição é aplicada automaticamente.
   A agenda consulta eventos pelo intervalo visível, inclui reservas que atravessam os limites do dia/semana/mês e preserva os filtros de recurso, laboratório, status e período. Reservas de espaço e de equipamento (com o laboratório vinculado) são identificadas separadamente; cancelamentos aparecem como histórico, mas não ocupam horários disponíveis.
   Ao detectar conflito numa reserva simples, a tela mantém os dados preenchidos e oferece próximos horários livres, outros espaços disponíveis ou equipamentos da mesma categoria quando elegíveis. As opções são verificadas contra as reservas reais.

2. **Equipamento em Manutenção Bloqueado:**
   Equipamentos em manutenção não podem ser reservados nem receber check-in.

3. **Capacitação Obrigatória:**
   Equipamentos que possuem a flag `exige_capacitacao` só aceitam reserva ou check-in se o usuário possuir habilitação válida registrada na tabela `capacitacao`.

4. **Registro Obrigatório da Condição no Check-out:**
   A finalização do check-out exige formalmente o relato do estado de conservação do equipamento devolvido. Se for relatada avaria, a evidência é obrigatória e o check-out, a ocorrência e o bloqueio do equipamento são persistidos na mesma transação.

5. **Estoque de Consumíveis Não-Negativo:**
   Validação transacional e bloqueio do registro impedem saldo negativo ou perda de movimentos concorrentes. Entradas, saídas, consumo, reposição e saldo inicial ficam no histórico com quantidade anterior/movimentada/resultante, usuário, data/hora e observação opcional. A migration 12 cria o histórico e registra o saldo de abertura dos itens existentes.

6. **Ciclo Completo de Manutenção:**
   O encaminhamento administrativo cria uma ordem de serviço vinculada à ocorrência. A conclusão exige laudo técnico; o equipamento só retorna a `disponivel` quando não há outra manutenção aberta nem inativação ativa. Ocorrências e ordens não podem ser excluídas pela API.

7. **Importação e exportação CSV:**
   Administradores podem validar equipamentos em lote antes de inserir. A prévia informa linhas válidas, patrimônios duplicados, laboratórios inexistentes e outros erros; a importação é transacional e recusa o arquivo inteiro enquanto houver linhas inválidas. Os CSVs podem ser exportados para equipamentos, laboratórios, reservas, utilizações, ocorrências, manutenções, consumíveis e inventários (incluindo seus itens); fotos e evidências são omitidas.

   Colunas obrigatórias para importar equipamentos: `patrimonio_ufpi`, `nome` e `laboratorio` (nome ou código do espaço). O catálogo sugerido de categorias inclui “Outro” e as categorias já usadas no banco; valores desconhecidos são sinalizados na prévia e exigem mapeamento ou confirmação explícita para manter o texto original. Status aceitos: `disponivel`, `em_uso`, `manutencao` ou `inativo`. Arquivos CSV são limitados a 10 MB.

8. **Experiência de uso:**
   A busca global na barra superior pesquisa equipamentos, espaços, reservas, ocorrências e consumíveis; administradores também pesquisam manutenções e inventários. Os resultados respeitam as permissões de cada perfil. Erros de carregamento nas principais listas exibem orientação e ação para tentar novamente; a lista de espaços combina busca textual com filtro por status.

9. **Relatórios operacionais:**
   A página administrativa `/relatorios` reúne relatórios de equipamentos/inventário, utilizações, reservas, no-shows, movimentações de consumíveis, capacitações, ocorrências, manutenção e posição atual do estoque. Os relatórios oferecem filtros de período, situação, laboratório, equipamento e usuário quando os dados possuem esses vínculos; todos preservam a exportação CSV dos registros filtrados. O relatório de movimentações usa `GET /api/consumiveis/historico` (restrito a administradores) e o histórico criado na migration 12. Nenhuma nova migration foi adicionada neste bloco.

10. **Planta esquemática dos espaços:**
   Os detalhes de cada espaço exibem uma planta 2D somente para visualização, posicionando marcadores conforme a localização cadastrada e permitindo abrir o detalhe de cada equipamento. A planta vetorial de demonstração funciona sem imagem oficial e não permite arrastar ou editar posições. Dimensões, imagem substituta e coordenadas por localização ficam em `frontend/src/config/plantasEspacos.js`; localizações ainda não mapeadas usam posições de demonstração determinísticas.

11. **Notificações internas:**
   A barra superior mostra a caixa pessoal de notificações, a contagem de itens não lidos e oferece leitura individual ou em lote. Novas reservas e ocorrências avisam administradores; alterações administrativas de reservas e decisões sobre ocorrências avisam o solicitante. Aplicar `database/migrations/10_notificacoes_internas.sql` em bases existentes.

12. **PWA (cache do aplicativo):**
   A aplicação pode ser instalada em navegadores compatíveis e mantém o shell frontend disponível após um primeiro carregamento online, usando o manifesto e o service worker em `frontend/public/`. As chamadas à API não são armazenadas em cache; operações offline e sincronização serão tratadas na Fase 15.

13. **Dados técnicos e documentos:**
   Os detalhes do equipamento apresentam os dados técnicos cadastrados (categoria, marca, modelo, número de série, localização e observações) e uma aba de documentos vinculados por título, tipo, URL e descrição opcional. Usuários autenticados podem consultar e abrir os links; somente administradores podem associar ou remover registros. Os arquivos continuam hospedados na origem indicada pelo link; a tabela separada `equipamento_documento` permite acrescentar armazenamento de arquivos futuramente.

14. **OCR de patrimônio pela câmera:**
   Durante uma sessão de inventário, o administrador pode capturar a etiqueta do equipamento pela câmera e reconhecer códigos UFPI, PAT ou LabControl. O OCR é executado no navegador e não envia a imagem ao backend. O primeiro uso requer conexão para carregar o mecanismo e os dados de reconhecimento; cada código reconhecido precisa ser revisado e confirmado no fluxo normal do inventário. A leitura não altera automaticamente patrimônio ou localização.

15. **Decisões de divergência de inventário:**
   Administradores podem abrir os detalhes do equipamento diretamente pela divergência. As decisões de transferir ou manter a localização ficam na auditoria com equipamento, espaços anterior/novo, responsável e data/hora; a transferência e seus eventos de auditoria são gravados na mesma transação. Não é necessária migration adicional: as colunas de decisão e a tabela `auditoria_evento` já existem.

---

## 🚀 Como Executar o Projeto

### 1. Pré-requisitos
- **Node.js** v18+ instalado.
- **MySQL** rodando na máquina ou servidor com a base `labcontrol` previamente criada e configurada.

### 2. Configurar Variáveis de Ambiente no Back-end
Dentro da pasta `backend/`, verifique ou crie o arquivo `.env`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_do_mysql
DB_NAME=labcontrol
DB_PORT=3306
JWT_SECRET=labcontrol_secret_token_academico_2026
PORT=3001
```

### 3. Iniciar o Back-end
Abra um terminal na pasta `backend/`:
```bash
cd backend
npm install
npm start
```
O servidor estará rodando em: `http://localhost:3001` (com health check em `/api/health`).

### 4. Iniciar o Front-end
Abra outro terminal na pasta `frontend/`:
```bash
cd frontend
npm install
npm run dev
```
O aplicativo React estará acessível em: `http://localhost:3000` (ou porta indicada pelo Vite).

---

## 👥 Perfis de Usuário e Acesso

- **Usuário (Aluno / Professor / Pesquisador):**
  - Autenticação e perfil
  - Consulta de espaços e equipamentos
  - Visualização do histórico consolidado por equipamento
  - Agendamento e cancelamento de reservas
  - Check-in e Check-out via QR Code
  - Registro de ocorrências
  - Consulta de suas capacitações técnicas

- **Administrador (Gestor de Laboratórios):**
  - Todas as funcionalidades de Usuário
  - Cadastro, edição e exclusão de espaços e equipamentos
  - Geração e impressão de etiquetas de QR Code
  - Gestão de usuários e permissões
  - Painel com indicadores básicos (dashboard)
  - Trilha de auditoria com autor, data, ação e detalhes das alterações operacionais
  - Análise e decisão sobre ocorrências
  - Abertura e conclusão de manutenções (bloqueio/desbloqueio)
  - Controle de consumíveis e movimentação de estoque
  - Concessão de capacitações técnicas para usuários
