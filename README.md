# LabControl – Plataforma de Gestão e Rastreabilidade de Espaços e Equipamentos Educacionais

O **LabControl** é um sistema web full-stack desenvolvido para controle, agendamento, check-in/check-out via QR Code e rastreabilidade total de espaços (laboratórios, salas especiais) e equipamentos acadêmicos.

> ⚠️ **Importante sobre o Banco de Dados:**
> Este sistema foi desenvolvido para **consumir o banco de dados MySQL existente** (`labcontrol`) via variáveis de ambiente.
> Scripts SQL de schema e evolução estão em `database/`. Eles não são executados automaticamente pelo servidor. `database/schema.sql` recria as tabelas-base e contém comandos `DROP`; **não o execute sobre uma base com dados que devam ser preservados**.
> Para uma base existente, aplique as migrações necessárias de forma controlada. A configuração administrativa da tolerância de no-show requer `database/migrations/07_configuracao_no_show.sql`.
> Tabelas consumidas: `usuario` · `espaco` · `equipamento` · `reserva` · `utilizacao` · `ocorrencia` · `manutencao` · `consumivel` · `capacitacao` · `inventario` · `inventario_item` · `configuracao_sistema`

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
│   │   ├── reservaController.js
│   │   ├── utilizacaoController.js
│   │   ├── ocorrenciaController.js
│   │   ├── manutencaoController.js
│   │   ├── consumivelController.js
│   │   ├── capacitacaoController.js
│   │   └── dashboardController.js
│   ├── middlewares/
│   │   └── auth.js            # Validação de JWT e permissão por perfil
│   ├── models/                # Camada DAO preparada para as 9 tabelas
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

2. **Equipamento em Manutenção Bloqueado:**
   Equipamentos em manutenção não podem ser reservados nem receber check-in.

3. **Capacitação Obrigatória:**
   Equipamentos que possuem a flag `exige_capacitacao` só aceitam reserva ou check-in se o usuário possuir habilitação válida registrada na tabela `capacitacao`.

4. **Registro Obrigatório da Condição no Check-out:**
   A finalização do check-out exige formalmente o relato do estado de conservação do equipamento devolvido. Se for relatada avaria, o sistema registra automaticamente a ocorrência e direciona o equipamento para manutenção.

5. **Estoque de Consumíveis Não-Negativo:**
   Validação atômica impede que saídas de estoque tornem o saldo negativo. Alertas visuais são emitidos sempre que `quantidade <= quantidade_minima`.

6. **Ciclo Completo de Manutenção:**
   O início da manutenção altera o status do equipamento para `manutencao`. Ao concluir a ordem de serviço com laudo técnico, o equipamento é automaticamente retornado ao status `disponivel`.

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
  - Análise e decisão sobre ocorrências
  - Abertura e conclusão de manutenções (bloqueio/desbloqueio)
  - Controle de consumíveis e movimentação de estoque
  - Concessão de capacitações técnicas para usuários
