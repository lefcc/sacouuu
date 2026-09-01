# BACKEND — API Sacou

API REST do ecossistema de educação financeira **$acou** usando **Python + FastAPI + MySQL**.
Atende as 3 interfaces: **mobile** (Flutter), **web** (React) e **desktop** (Electron).

## Estrutura

```
BACKEND/
├── app/
│   ├── main.py            # Aplicação FastAPI (CORS, estáticos, rotas)
│   ├── config.py          # Lê .env
│   ├── database.py        # Engine/Sessão SQLAlchemy (MySQL)
│   ├── models.py          # Modelos espelhando o schema_sacou.sql
│   ├── schemas.py         # Schemas Pydantic (entrada/saída)
│   ├── security.py        # Hash de senha (pbkdf2) + JWT
│   ├── deps.py            # Dependências de autenticação/perfil
│   ├── seed.py            # Seed: trilhas, 12 aulas, perguntas e usuários demo
│   └── routers/
│       ├── auth.py        # POST /auth/login, GET /auth/me
│       ├── licoes.py      # GET /licoes, /licoes/{id}, /trilhas  (mobile)
│       ├── conteudo.py    # CRUD de aulas/perguntas               (desktop)
│       ├── progresso.py   # Progresso/XP/moedas do aluno          (mobile)
│       └── escolas.py     # Escolas, turmas, usuários             (web)
├── static/audios/         # Áudios das aulas servidos pela API
├── requirements.txt
├── .env.example           # Copie para .env e ajuste
└── test_smoke.py          # Smoke test (roda com SQLite, sem MySQL)
```

## Configuração

1. **MySQL**: inicie o serviço e crie o banco:

   ```sql
   CREATE DATABASE db_sacou CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Copie `.env.example` para `.env` e ajuste a `DATABASE_URL` (usuário/senha do MySQL).
   O script de seed cria as tabelas sozinho (coluna extra `URL_IMAGEM` também).

3. Instale as dependências:

   ```bash
   python -m venv venv
   venv\Scripts\activate          # Windows
   pip install -r requirements.txt
   ```

4. Rode o seed (cria trilhas, 12 aulas, perguntas e usuários demo):

   ```bash
   python -m app.seed
   ```

5. Suba a API:

   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

Documentação interativa (Swagger): `http://localhost:8000/docs`

## Usuários de demonstração

| Perfil       | E-mail                 | Senha         |
|--------------|------------------------|---------------|
| Admin        | `admin@sacou.com`      | `admin123`    |
| Aluno (app)  | `aluno@sacou.com`      | `123456`      |
| Professor    | `professor@sacou.com`  | `professor123`|
| Coordenador  | `coordenador@sacou.com`| `coord123`    |

## Principais endpoints

| Método | Rota                                    | Uso                          |
|--------|-----------------------------------------|------------------------------|
| POST   | `/auth/login`                           | Login → token JWT            |
| GET    | `/trilhas`                              | Trilhas + aulas (mobile)     |
| GET    | `/licoes/{id}`                          | Conteúdo da aula + quiz      |
| GET    | `/progresso/alunos/{id}`                | Progresso/XP/moedas do aluno |
| POST   | `/progresso/alunos/{id}/licoes/{id}`    | Registrar resultado do quiz  |
| POST   | `/conteudo/licoes`                      | Criar aula (desktop)         |
| PUT    | `/conteudo/licoes/{id}`                 | Editar aula (desktop)        |
| DELETE | `/conteudo/licoes/{id}`                 | Excluir aula (desktop)       |
| POST   | `/conteudo/perguntas`                   | Criar pergunta (desktop)     |
| PUT    | `/conteudo/perguntas/{id}`              | Editar pergunta (desktop)    |
| DELETE | `/conteudo/perguntas/{id}`              | Excluir pergunta (desktop)   |
| GET    | `/escolas`                              | Lista de escolas (web)       |
| POST   | `/escolas`                              | Criar escola (web)           |
| POST   | `/escolas/{id}/turmas`                  | Criar turma (web)            |
| POST   | `/escolas/{id}/usuarios`                | Criar usuário da escola (web)|

Todos os endpoints exigem `Authorization: Bearer <token>`, exceto `/auth/login` e `/health`.

## Deploy (servidor/cloud)

- **Railway/Render**: exponha o app na porta da variável `API_PORT`, ajuste
  `DATABASE_URL` para o MySQL gerenciado e `API_BASE_URL` para a URL pública
  (usada nos links de áudio/imagem).
- **CORS**: em produção, troque `allow_origins=["*"]` em `app/main.py` pela lista
  de domínios reais.

## Testes

```bash
python test_smoke.py   # roda com SQLite em memória, não precisa de MySQL
```
