# Sacou — Aplicativo Mobile ($acou?)

Aplicativo **Flutter** do ecossistema Sacou: educação financeira gamificada para o
Ensino Médio, com trilhas de aprendizado, aulas narradas em áudio, quiz, sistema de
moedas, loja e avatar.

Projeto: `mobile_sacou` (pacote `mobile_sacou`). Faz parte do Projeto Integrador do
COTIL e se comunica com a API **FastAPI** (backend) para autenticação, trilhas,
lições, progresso, perfil e loja.

---

## Pré-requisitos

| Requisito | Versão |
|---|---|
| Flutter SDK | canal `stable` |
| Dart SDK | `^3.11.4` |
| Chrome | para execução web |
| Android Studio + Emulador (opcional) | para execução nativa Android |
| Backend Sacou (FastAPI) em execução | `http://localhost:8000` |

Verifique o ambiente:

```bash
flutter doctor
```

---

## ⚠️ Restrição crítica: o dev server web DEVE rodar na porta 3000

Por política de segurança do backend, o **CORS libera apenas** as origens
`localhost:5173`, `127.0.0.1:5173`, `localhost:3000` e `127.0.0.1:3000`
(`CORS_ORIGINS` em `BACKEND/.env`).

A porta `5173` é reservada ao frontend web (Vite/React). Para o **Flutter Web**,
qualquer outra porta que não a **3000** fará o navegador **bloquear as chamadas à
API**.

**Execute o app web sempre fixando a porta 3000:**

```bash
flutter run -d chrome --web-port=3000
```

> Em build nativo (Android/iOS/desktop) o CORS não se aplica. Nesses casos o
> endereço da API é definido via `--dart-define` (ver abaixo).

---

## Instalação

```bash
flutter pub get
```

---

## Execução

### Web (navegador)

```bash
flutter run -d chrome --web-port=3000
```

### Emulador Android

Dentro do emulador, o host da máquina é acessado como `10.0.2.2`:

```bash
flutter run --dart-define=API_URL=http://10.0.2.2:8000
```

> Tráfego HTTP (cleartext) só é permitido para `10.0.2.2`, `localhost` e
> `127.0.0.1` (`android/app/src/main/res/xml/network_security_config.xml`).
> Produção exige HTTPS.

### Dispositivo físico

Use o IP da máquina na rede local:

```bash
flutter run --dart-define=API_URL=http://192.168.0.10:8000
```

> Se acessar por IP, adicione a origem correspondente ao `CORS_ORIGINS` no
> `BACKEND/.env` (ex.: `http://192.168.0.10:3000`).

---

## Variáveis de ambiente

O app **não usa arquivo `.env`**. O endereço da API é injetado em tempo de build
via `--dart-define` (ver `lib/api_service.dart`):

| Variável | Padrão | Descrição |
|---|---|---|
| `API_URL` | `http://localhost:8000` | URL base da API Sacou (FastAPI) |

Exemplos:

```bash
flutter run -d chrome --web-port=3000 --dart-define=API_URL=http://localhost:8000
flutter run --dart-define=API_URL=http://10.0.2.2:8000
```

---

## Comandos úteis

```bash
flutter pub get     # instala as dependências
flutter run         # executa o app
flutter analyze     # análise estática (flutter_lints)
flutter test        # testes
```

---

## Dependências (`pubspec.yaml`)

| Dependência | Versão | Uso |
|---|---|---|
| `http` | `^1.2.0` | cliente HTTP para a API |
| `audioplayers` | `^6.7.1` | narração em áudio das aulas |
| `url_launcher` | `^6.3.0` | abertura de e-mail (parceria) |
| `flutter_svg` | `^2.0.10` | ícones SVG da loja |
| `cupertino_icons` | `^1.0.8` | ícones iOS |
| `flutter_lints` (dev) | `^6.0.0` | análise estática |

Fontes configuradas: `cherry` e `pacifico`.

---

## Acesso de teste

O perfil `ALUNO` é o único que acessa o app mobile. Credenciais criadas pelo seed
do backend (`python -m app.seed`):

| E-mail | Senha |
|---|---|
| `aluno@sacou.com` | `123456` |

---

## Notas

- **Sessão em memória**: o token JWT (`tokenGlobal`) e o progresso não são
  persistidos em disco. Ao fechar o app, é necessário logar novamente.
- **Testes**: `test/widget_test.dart` é o smoke test padrão do template Flutter e
  não está alinhado ao app real — pode falhar ao rodar `flutter test`.
