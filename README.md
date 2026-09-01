# Sacou — Educação Financeira para o Ensino Médio

**Sacou** é um ecossistema educacional gamificado de educação financeira criado no
**Projeto Integrador do COTIL — Colégio Técnico de Limeira**. O projeto une três
interfaces em torno de um único objetivo: ensinar acúmulo de capital e prevenção de
endividamento de forma leve, divertida e gamificada.

- 📱 **Mobile (Flutter)** — aplicativo do aluno: aulas narradas por áudio, quiz gamificado,
  trilhas de aprendizado, moedas, loja e avatar.
- 🌐 **Web (React + Vite + Tailwind)** — painel de gestão escolar: landing page, login
  seguro por perfil, dashboard da escola, gestão de turmas e alunos (arquivamento),
  usuários, relatórios e financeiro.
- 🖥️ **Desktop (Electron)** — painel administrativo: dashboard com gráficos, gestão de
  escolas, conteúdo (trilhas/aulas/questões), financeiro (contratos e faturas) e
  personalização (avatares e loja).
- ⚙️ **Backend (FastAPI + MySQL)** — API única que alimenta as três interfaces.

---

## Tecnologias Utilizadas

| Camada | Tecnologia |
|---|---|
| **Backend** | Python 3.14, FastAPI, Uvicorn, SQLAlchemy 2.0, PyMySQL |
| **Banco de dados** | MySQL 8 (schema `db_sacou`) |
| **Autenticação** | JWT (python-jose), senhas com **bcrypt** (passlib) |
| **Validação** | Pydantic v2 |
| **Web** | React 19, Vite 6, Tailwind CSS, Axios, React Router |
| **Mobile** | Flutter (Dart) |
| **Desktop** | Electron 43, Chart.js |

---

## Arquitetura de Segurança

O sistema trata dados sensíveis de educação e foi construído com segurança como
requisito nº 1.

### 1. RBAC (Controle de Acesso Baseado em Perfil)
Todos os usuários vivem em uma **tabela única `usuario`**, com o perfil canônico na
coluna `perfil`:

| Perfil | Descrição |
|---|---|
| `DEV` | Desenvolvedor da plataforma (acesso total, sem escola vinculada) |
| `GESTOR_PLATAFORMA` | Gestão global da plataforma (acesso total, sem escola vinculada) |
| `ADMIN_ESCOLA` | Coordenador de uma escola (gerencia turmas, alunos e usuários da própria escola) |
| `VISUALIZADOR_ESCOLA` | Professor — acesso somente leitura (não vê botões de edição) |
| `ALUNO` | Acessa apenas o aplicativo mobile |

O backend expõe a dependência `require_role(allowed_roles)` do FastAPI, aplicada em
todas as rotas sensíveis.

### 2. Isolamento Horizontal de Dados
Toda query de dados de uma escola **filtra por `escola_id`**. Um `ADMIN_ESCOLA` da
Escola A **jamais** lê ou modifica dados da Escola B — o backend retorna
**HTTP 403 Forbidden** em tentativas de acesso cruzado (`garantir_acesso_escola`).

### 3. Soft Delete (Arquivamento)
Nenhum dado é apagado fisicamente:
- **Escolas, turmas e usuários** usam a coluna `arquivado` (booleano).
- Escolas também preservam `data_exclusao` como histórico.
- Endpoints de arquivamento (`PATCH /turmas/{id}`, `PATCH /alunos/{id}`,
  `PUT /escolas/{id}/arquivar`) apenas alternam o flag.

### 4. Autenticação JWT
- Login gera token JWT com expiração (`TOKEN_EXPIRA_MINUTOS` no `.env`).
- Todas as rotas exigem `Authorization: Bearer <token>`.
- Senhas hasheadas com **bcrypt** (salt automático). Hashes legados `pbkdf2_sha256`
  continuam sendo validados durante a migração.
- O frontend injeta o token via interceptor do Axios e, em **401/403**, limpa a
  sessão e redireciona para `/login`.

### 5. Outras proteções
- Consultas 100% via **ORM SQLAlchemy** com parâmetros vinculados (sem concatenação
  de SQL → proteção contra SQL Injection).
- **Auditoria (LGPD)**: colunas `created_at` / `updated_at` em `usuario`, `turma` e
  `escola`.
- Sem logging de senhas, tokens, CPFs ou PII.

---

## Instalação e Execução

### 1. Pré-requisitos
- Python 3.12+
- Node.js 18+
- MySQL 8 rodando na porta 3306
- Flutter (para o app mobile) — opcional
- npm (para Electron) — opcional

### 2. Banco de Dados (MySQL)
```bash
# Crie o banco com o schema (na pasta raiz do projeto)
mysql -u root -p -e "CREATE DATABASE db_sacou CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p db_sacou < schema_sacou.sql
```

### 3. Backend (FastAPI)
```bash
cd BACKEND

# Criar e ativar o ambiente virtual
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Configurar o .env (copie o exemplo e ajuste a senha do MySQL)
cp .env.example .env

# Semear dados de demonstração (trilhas, aulas, usuários, loja, avatares)
python -m app.seed

# Rodar a API (Swagger em http://localhost:8000/docs)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> **Nota:** a migração do schema para o modelo unificado de usuário está em
> `migracao_unificar_usuario.py` e `migracao_auditoria_softdelete.py` — rode-as uma
> única vez em bancos antigos:
> ```bash
> python migracao_unificar_usuario.py
> python migracao_auditoria_softdelete.py
> ```

### 4. Frontend Web (React + Vite)
```bash
cd WEB

npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm run build      # build de produção (gera a pasta dist/)
```

### 5. Mobile (Flutter) — opcional
```bash
cd MOBILE/mobile_sacou
flutter pub get
flutter run        # use --dart-define=API_URL=http://10.0.2.2:8000 no emulador Android
```

### 6. Desktop (Electron) — opcional
```bash
cd DESKTOP
npm install
npm start
```

### 7. Testes do Backend
```bash
cd BACKEND
python test_smoke.py    # roda com SQLite, não precisa do MySQL
```

---

## Perfis de Teste (Seed)

As credenciais abaixo são criadas pelo `python -m app.seed`:

| Perfil | E-mail | Senha | Acesso |
|---|---|---|---|
| **DEV** | `dev@sacou.com` | `dev123` | Plataforma (total) |
| **GESTOR_PLATAFORMA** | `admin@sacou.com` | `admin123` | Plataforma (total) |
| **ADMIN_ESCOLA** | `coordenador@sacou.com` | `coord123` | Painel Web (gerencia a escola) |
| **VISUALIZADOR_ESCOLA** | `professor@sacou.com` | `professor123` | Painel Web (somente leitura) |
| **ALUNO** | `aluno@sacou.com` | `123456` | Aplicativo Mobile |

> **Importante:** o perfil `ALUNO` **não** acessa o painel web — o login é bloqueado
> com a mensagem *"Alunos devem acessar o sistema através do aplicativo mobile."*

---

## Estrutura do Repositório

```
Sacou/
├── BACKEND/              # API FastAPI + migrações + seed + teste smoke
│   ├── app/
│   │   ├── routers/      # auth, licoes, conteudo, progresso, perfil,
│   │   │                 # escolas, loja, turmas, alunos
│   │   ├── deps.py       # require_role + isolamento por escola
│   │   ├── security.py   # bcrypt + JWT
│   │   ├── models.py     # modelos SQLAlchemy (usuário unificado)
│   │   └── seed.py       # dados de demonstração
│   └── test_smoke.py
├── WEB/                  # Painel Web React/Vite/Tailwind
├── MOBILE/mobile_sacou/  # App Flutter do aluno
├── DESKTOP/              # Painel Administrativo Electron
├── SGV/                  # Logos e ícones da marca
└── schema_sacou.sql      # Schema MySQL
```

---

## Projeto Integrador COTIL

Desenvolvido por:
- **Maria Avelino** — Front-End (Desktop)
- **Letícia Campos** — Back-End (Mobile, Banco de Dados, Regra de Negócio)
- **João Allegre** — Front-End (Web)

Contato: **sacoueducacao@gmail.com**
