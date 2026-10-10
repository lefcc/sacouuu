# Sacou — Educação Financeira para o Ensino Médio

**Sacou** é um ecossistema educacional gamificado de educação financeira criado no **Projeto Integrador do COTIL — Colégio Técnico de Limeira**. O projeto une três interfaces em torno de um único objetivo: ensinar acúmulo de capital e prevenção de endividamento de forma leve, divertida e gamificada, com foco em segurança e performance.

- 📱 **Mobile (Flutter)** — aplicativo do aluno: aulas narradas, quiz gamificado, trilhas, moedas, loja e avatar.
- 🌐 **Web (React + Vite + Tailwind)** — painel de gestão escolar: dashboard, gestão de turmas/alunos, usuários, financeiro e **novo módulo de acompanhamento de desempenho com indicador de risco de evasão**.
- 🖥️ **Desktop (Electron)** — painel administrativo: gestão de escolas, conteúdo (trilhas/aulas/questões), financeiro (contratos/faturas) e personalização.
- ⚙️ **Backend (FastAPI + MySQL)** — API única, fonte da verdade, que alimenta as três interfaces com segurança e integridade.

---

## Tecnologias Utilizadas

| Camada | Tecnologia |
|---|---|
| **Backend** | Python 3.12+, FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2 |
| **Banco de dados** | MySQL 8 (schema `db_sacou`) |
| **Autenticação** | JWT (python-jose), senhas com **bcrypt** (passlib) |
| **Web** | React 19, Vite 6, Tailwind CSS, Axios, React Router |
| **Mobile** | Flutter (Dart) |
| **Desktop** | Electron, Chart.js, Vanilla JS (com isolamento de processos) |

---

## 🛡️ Arquitetura de Segurança e Decisões Técnicas (Diferenciais)

O sistema trata dados sensíveis de educação e foi construído com segurança e performance como requisitos nº 1, atendendo a padrões de mercado:

### 1. RBAC e Isolamento Horizontal
Todos os usuários vivem em uma tabela unificada, com perfis canônicos (`DEV`, `GESTOR_PLATAFORMA`, `ADMIN_ESCOLA`, `VISUALIZADOR_ESCOLA`, `ALUNO`). O backend aplica `require_role` e `garantir_acesso_escola` em todas as rotas, retornando **HTTP 403** em qualquer tentativa de acesso cruzado entre escolas.

### 2. Quiz "Server-Authoritative" (Prevenção de Fraude)
O aplicativo mobile envia apenas os índices das respostas selecionadas. O Backend consulta o gabarito no banco, calcula a nota e aplica as moedas. O cliente nunca calcula ou armazena o resultado, impedindo trapaças por engenharia reversa.

### 3. Performance e Prevenção de N+1
Consultas complexas (como o novo Relatório de Desempenho do Aluno) utilizam agregação SQL nativa (`func.avg`, `func.count`, `func.max` com `GROUP BY`) em uma única query, evitando o problema N+1 e garantindo escalabilidade.

### 4. Precisão Financeira e Transações ACID
O módulo financeiro utiliza o tipo `Decimal` (Numeric no MySQL) para evitar erros de arredondamento binário. Compras na loja utilizam bloqueio pessimista (`FOR UPDATE`) para prevenir race conditions e saldo negativo.

### 5. Isolamento no Desktop (Electron)
O aplicativo Desktop roda com `nodeIntegration: false` e `contextIsolation: true`. O acesso ao sistema de arquivos é estritamente controlado via `preload.js` e whitelist de diretórios, prevenindo ataques de RCE (Remote Code Execution).

### 6. Soft Delete e Auditoria (LGPD)
Nenhum dado é apagado fisicamente. Escolas, turmas e usuários utilizam flags `arquivado` e `data_exclusao`, mantendo o histórico e a integridade referencial.

---

## Instalação e Execução

### 1. Pré-requisitos
- Python 3.12+
- Node.js 18+
- MySQL 8 rodando na porta 3306
- Flutter (para o app mobile)
- npm (para Web e Desktop)

### 2. Banco de Dados (MySQL)
```bash
mysql -u root -p -e "CREATE DATABASE db_sacou CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p db_sacou < schema_sacou.sql
```

### 3. Backend (FastAPI)
```bash
cd BACKEND
python -m venv venv
# Windows: venv\Scripts\activate | Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Ajuste a senha do MySQL e JWT_SECRET

# Semear dados de demonstração
python -m app.seed

# Rodar a API (Swagger em http://localhost:8000/docs)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Nota: Se o banco for antigo, rode as migrações: python migracao_unificar_usuario.py e python migracao_auditoria_softdelete.py.


### 4. Frontend Web (React + Vite)
```bash
cd WEB
npm install
npm run dev        # desenvolvimento em http://localhost:5173
```

### 5. Mobile (Flutter)
⚠️ Atenção à Porta: Por política de CORS do backend, o Flutter Web deve rodar na porta 3000.
```bash
cd MOBILE/mobile_sacou
flutter pub get

# Para Web (Chrome):
flutter run -d chrome --web-port=3000 --dart-define=API_URL=http://localhost:8000

# Para Emulador Android:
flutter run --dart-define=API_URL=http://10.0.2.2:8000
```

📌 Para detalhes completos de configuração, segurança mobile e variáveis de ambiente, consulte o README específico em: MOBILE/mobile_sacou/README.md

### 6. Desktop (Electron)
```bash
cd DESKTOP
npm install
npm start
```

### 7. Testes do Backend
```bash
cd BACKEND
python test_smoke.py    # Valida fluxos críticos via SQLite, sem depender do MySQL
```

## Perfis de Teste (Seed)

| Perfil | E-mail | Senha | Acesso |
|---|---|---|---|
| **DEV** | `dev@sacou.com` | `dev123` | Plataforma (acesso total) |
| **GESTOR_PLATAFORMA** | `admin@sacou.com` | `admin123` | Plataforma (acesso total) |
| **ADMIN_ESCOLA** | `coordenador@sacou.com` | `coord123` | Painel Web (gerencia a escola) |
| **VISUALIZADOR_ESCOLA** | `professor@sacou.com` | `professor123` | Painel Web (somente leitura) |
| **ALUNO** | `aluno@sacou.com` | `123456` | Aplicativo Mobile |

> **Importante:** O perfil `ALUNO` **não** acessa o painel web. O login é bloqueado com a mensagem *"Alunos devem acessar o sistema através do aplicativo mobile."*

## Estrutura do Repositório
```bash
Sacou/
├── BACKEND/              # API FastAPI + migrações + seed + teste smoke
│   ├── app/
│   │   ├── routers/      # auth, licoes, conteudo, progresso, escolas, loja, desempenho
│   │   ├── deps.py       # require_role + isolamento por escola
│   │   ├── security.py   # bcrypt + JWT
│   │   ├── models.py     # modelos SQLAlchemy (usuário unificado)
│   │   └── seed.py       # dados de demonstração
│   └── test_smoke.py
├── WEB/                  # Painel Web React/Vite/Tailwind
├── MOBILE/
│   └── mobile_sacou/     # App Flutter do aluno (possui README.md próprio e detalhado)
├── DESKTOP/              # Painel Administrativo Electron
├── SGV/                  # Logos e ícones da marca
└── schema_sacou.sql      # Schema MySQL
```

## Projeto Integrador COTIL
Contato: sacoueducacao@gmail.com