# AGENTS.md — Mapem do Projeto: mobile_sacou

## Visão Geral

Aplicativo **Flutter** chamado **"$acou?"** — ecossistema digital gamificado de **educação financeira** para o Ensino Médio. O app ensina acúmulo de capital e prevenção de endividamento por meio de 3 trilhas de aprendizado (Mentalidade Financeira, Renda Fixa e Renda Variável), com aulas narradas por áudio, quiz gamificado e sistema de moedas.

O projeto pertence ao Projeto Integrador do COTIL, desenvolvido por:
- **Maria Avelino** — Front-End (desktop)
- **Letícia Campos** — Back-End (mobile, banco de dados, regra de negócio)
- **João Allegre** — Front-End (web)

## Estrutura do Projeto

```
mobile_sacou/
├── android/ ios/ web/ linux/ macos/ windows/   # Plataformas Flutter
├── assets/
│   ├── audios/          # Narrações das aulas (audioAula1.mp3 a audioAula4.mp3)
│   ├── fonts/           # CherryBombOne-Regular.ttf, Pacifico-Regular.ttf
│   ├── images/          # Logo, mascote, ícones e fotos dos devs
│   └── videos/          # mascoteFalando.mp4
├── lib/                 # Código-fonte (todos os arquivos na raiz, sem subpastas)
├── test/                # Testes Flutter (widget_test.dart — smoke test padrão)
├── pubspec.yaml         # Dependências e assets
└── analysis_options.yaml # flutter_lints padrão
```

## Arquivos de `lib/`

| Arquivo | Descrição |
|---|---|
| `main.dart` | Entry point. `MaterialApp` com temas claro/escuro (creme `0xFFF9E8C8` + roxo `0xFF5F4C9A`, verde `0xFF6FB755`). Home = `Inicial`. |
| `inicial.dart` | Página inicial (vitrine do produto + botão "Seja parceiro!"). |
| `menu_lateral.dart` | Drawer com itens condicionados a `usuarioLogado`. Menu visitante vs. menu aluno. |
| `login.dart` | Login com credenciais **hardcoded** em `listaTds` (ex.: `admin/123456`). Valida via `Form`. |
| `cadastro.dart` | Formulário de parceria que abre o app de e-mail (`url_launcher`) para `sacoueducacao@gmail.com`. |
| `parceiros.dart` | Lista de instituições parceiras (`Classe Parceiro`) com filtros por nome/bairro/cidade/UF. |
| `projeto.dart` | Página institucional "O Projeto". |
| `desenvolvedores.dart` | Cards dos desenvolvedores. |
| `aulas.dart` | **Núcleo gamificado.** 4 aulas (trilha 1), áudio via `audioplayers`, quiz 3 perguntas, 4 fases (`_faseAbas` 0=conteúdo, 1=quiz, 2=sucesso, 3=falha), recompensa de moedas (15 ou 30). |
| `trilha_ensino.dart` | Grade curricular (12 aulas / 3 trilhas) com bloqueio progressivo baseado em `aulasConcluidasGlobal`. |
| `classe_usuario.dart` | Modelo `Usuario` + **estado global**: `usuarioLogado`, `aulaAtualGlobal`, `moedasGlobais`, `aulasConcluidasGlobal`. |
| `classe_parceiro.dart` | Modelo `Parceiro` (nomeInstituicao, bairro, cidade, estado). |

## Dependências (`pubspec.yaml`)

- `url_launcher: ^6.3.0` — abrir `mailto:` de parceria
- `audioplayers: ^6.7.1` — narração de áudio das aulas
- `cupertino_icons: ^1.0.8`
- Dev: `flutter_test`, `flutter_lints: ^6.0.0`

Fontes configuradas: `cherry` e `pacifico`.

## Comandos

```bash
flutter run              # rodar o app
flutter analyze          # análise estática (flutter_lints)
flutter test             # testes
flutter pub get          # instalar dependências
```

## Convenções e Padrões do Código

- **Sem subpastas em `lib/`**: arquivos soltos na raiz de `lib/`.
- Navegação: `Navigator.push` / `pushReplacement` / `pushAndRemoveUntil` com `MaterialPageRoute`.
- Drawer repetido em cada tela com o `leading` = `Image.asset('assets/images/iconeVerde.png')` que abre o `MenuLateral`.
- **Estado global via variáveis globais** em `classe_usuario.dart` (não usa Provider/Riverpod/etc.). Ex.: `usuarioLogado`, `moedasGlobais`, `aulasConcluidasGlobal`.
- Comentários em português. Strings de UI em português.
- Nomes de classes em `PascalCase`, widgets privados com `_` (ex.: `_InicialState`).
- Textos de validação: mensagens em pt-BR dentro dos `validator`s.
- Sem comentários de bloco desnecessários; preservar estilo existente.

## Notas Importantes

- **Autenticação real via API**: `login.dart` chama `POST /auth/login` (FastAPI) e guarda o token na variável global `tokenGlobal` — ver "Decisões de Arquitetura" abaixo sobre persistência.
- **Moedas/progresso não persistidos**: estado global vive só em memória; ao fechar o app, tudo é perdido (decisão documentada abaixo).
- **Fase de aulas**: `aulas.dart` consome as lições reais de `GET /licoes`; aulas sem conteúdo publicado no banco aparecem como "em breve".
- Aula de áudio: o player toca `assets/audios/audioAulaN.mp3` conforme `_aulaAtual + 1`.
- O teste padrão (`widget_test.dart`) é o smoke test de contador do template Flutter — **não está alinhado** ao app real (busca `Counter`/`Icons.add`). Pode falhar ao rodar `flutter test`.
- AppBar com `surfaceTintColor: transparent` e `scrolledUnderElevation: 0` para travar a cor da AppBar.

## Decisões de Arquitetura

### Persistência de Sessão

- **Decisão:** o app **NÃO persiste** token ou dados de usuário em storage local (AsyncStorage/SharedPreferences/arquivos). O JWT vive **apenas em memória** (`tokenGlobal` em `classe_usuario.dart`). Ao fechar o app, o usuário precisa **fazer login novamente**.
- **Justificativa (segurança):** nada sensível é gravado em disco → imune à extração de token em dispositivos **rooted/jailbroken**; e **simplicidade**: app educacional sem necessidade real de uso offline.
- **Futuro (se necessário):** implementar `flutter_secure_storage` (iOS Keychain / Android Keystore) para o token + cache de leitura com **indicador de stale**, mantendo HTTPS obrigatório (`API_URL` via `--dart-define`, default `https://api.sacou.com`).
- **Tráfego de rede:** cleartext (HTTP) permitido **apenas** para dev local (`10.0.2.2`, `localhost`, `127.0.0.1`) via `res/xml/network_security_config.xml`; produção exige HTTPS.
