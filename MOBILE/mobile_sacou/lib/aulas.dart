import 'package:flutter/material.dart';
import 'package:mobile_sacou/api_service.dart';
import 'package:mobile_sacou/classe_usuario.dart';
import 'package:mobile_sacou/menu_lateral.dart';
import 'package:audioplayers/audioplayers.dart';

class Aulas extends StatefulWidget {
  final int? aulaInicial;

  const Aulas({super.key, this.aulaInicial});

  @override
  State<Aulas> createState() => _AulasState();
}

class _AulasState extends State<Aulas> {
  int _aulaAtual = 0;
  int _faseAbas = 0;
  int _moedasGlobais = moedasGlobais;

  bool _mascoteFalando = false;
  bool _audioTocando = false;
  bool _carregando = true;
  bool _enviandoQuiz = false;
  String? _erro;

  List<Map<String, dynamic>> _licoes = [];
  List<int> _respostasSelecionadas = [];
  final Map<int, bool> _aulasConcluidas = {};

  // Nomes reais das trilhas vindos do banco (GET /trilhas), indexados por
  // id_trilha. Populado dinamicamente — nunca um mapa fixo no código.
  final Map<int, String> _nomesTrilhas = {};

  AudioPlayer? _audioPlayer;

  @override
  void initState() {
    super.initState();
    _carregarConteudo();
  }

  @override
  void dispose() {
    _audioPlayer?.dispose();
    super.dispose();
  }

  bool _temConteudoValido(Map<String, dynamic> licao) {
    final conteudo = licao['conteudo'];
    final perguntas = licao['perguntas'];
    return (conteudo is List && conteudo.isNotEmpty) &&
        (perguntas is List && perguntas.isNotEmpty);
  }

  Future<void> _carregarConteudo() async {
    setState(() {
      _carregando = true;
      _erro = null;
    });

    try {
      final token = tokenGlobal;
      if (token == null) throw Exception('Sessao expirada.');

      if (alunoIdGlobal != null) {
        try {
          final progresso =
              await ApiService.obterProgresso(token, alunoIdGlobal!);
          aplicarProgressoDaApi(progresso);
          _moedasGlobais = moedasGlobais;
        } catch (_) {}
      }

      final licoes = await ApiService.listarLicoes(token);
      // Ajusta o progresso ao total REAL de aulas (sem limite fixo de 12).
      redimensionarPeloTotalDeAulas(licoes);
      final filtradas = licoes
          .where((l) => _temConteudoValido(l))
          .cast<Map<String, dynamic>>()
          .toList();

      // Busca os nomes REAIS das trilhas (id_trilha -> nome_trilha) via API.
      // Falha aqui nunca quebra o player: só deixa o fallback 'Trilha <id>'.
      try {
        final trilhas = await ApiService.listarTrilhas(token);
        _nomesTrilhas.clear();
        for (final t in trilhas) {
          if (t is Map && t['id_trilha'] is int && t['nome_trilha'] is String) {
            _nomesTrilhas[t['id_trilha']] = t['nome_trilha'];
          }
        }
      } catch (_) {}

      if (!mounted) return;

      int proximaAula = 0;

      if (widget.aulaInicial != null) {
        // Player aberto a partir da Trilha: localiza a aula pelo ID REAL.
        // Se a aula não estiver entre as disponíveis (ex.: ainda sem conteúdo
        // publicado), NÃO voltamos para a Aula 1 — mostramos um erro claro.
        final idx = filtradas.indexWhere(
            (l) => (l['id_licao'] as int? ?? 0) == widget.aulaInicial);
        if (idx >= 0) {
          proximaAula = idx;
        } else {
          final mensagem = await _mensagemAulaIndisponivel(token);
          if (!mounted) return;
          setState(() {
            _carregando = false;
            _erro = mensagem;
          });
          return;
        }
      } else {
        for (int i = 0; i < filtradas.length; i++) {
          final id = filtradas[i]['id_licao'] as int? ?? 0;
          if (id >= 1 && id <= aulasConcluidasGlobal.length) {
            if (!aulasConcluidasGlobal[id - 1]) {
              proximaAula = i;
              break;
            }
          }
          if (i == filtradas.length - 1) proximaAula = filtradas.length - 1;
        }
      }

      for (final l in filtradas) {
        final id = l['id_licao'] as int? ?? 0;
        _aulasConcluidas[id] =
            (id >= 1 && id <= aulasConcluidasGlobal.length) &&
                aulasConcluidasGlobal[id - 1];
      }

      if (!mounted) return;

      setState(() {
        _licoes = filtradas;
        _aulaAtual = proximaAula;
        _carregando = false;
        _prepararRespostas();
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _carregando = false;
          _erro = e.toString();
        });
      }
    }
  }

  /// Busca a aula pelo id real na API para diferenciar "não existe" de
  /// "existe, mas ainda sem conteúdo publicado".
  Future<String> _mensagemAulaIndisponivel(String token) async {
    try {
      final licao = await ApiService.listarLicao(token, widget.aulaInicial!);
      if (licao['id_licao'] != null) {
        return 'Conteúdo desta aula ainda não está disponível.';
      }
    } catch (_) {
      // 404 ou falha de rede → a aula não existe no banco.
    }
    return 'Aula não encontrada.';
  }

  void _prepararRespostas() {
    if (_licoes.isEmpty) return;
    final perguntas = _licoes[_aulaAtual]['perguntas'] as List? ?? [];
    _respostasSelecionadas = List.generate(perguntas.length, (_) => -1);
  }

  Map<String, dynamic> get _aulaAtualMap =>
      _licoes.isEmpty ? {} : _licoes[_aulaAtual];

  /// Nome REAL da trilha vindo do banco (populado via GET /trilhas).
  /// Sem mapa fixo: se a API não respondeu, usa um fallback neutro.
  String _nomeTrilha(int id) {
    return _nomesTrilhas[id] ?? 'Trilha $id';
  }

  Color _corFundo() => Theme.of(context).brightness == Brightness.dark
      ? const Color(0xFF1E1A2E)
      : Colors.white;

  Color _corTexto() => Theme.of(context).brightness == Brightness.dark
      ? const Color(0xFFEDE8FF)
      : const Color(0xFF1E1740);

  Color _corPrimaria() => Theme.of(context).brightness == Brightness.dark
      ? const Color(0xFF8B7BBF)
      : const Color(0xFF5F4C9A);

  Color _corSecundaria() => const Color(0xFF6FB755);

  // ── AUDIO ────────────────────────────────────────────────────────────────

  String? _ajustarAudioUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    final apiBase = Uri.parse(ApiService.baseUrl);
    final audioUri = Uri.parse(url);
    if (audioUri.host == apiBase.host) return url;
    return url.replaceFirst(audioUri.host, apiBase.host);
  }

  void _tocarAudio() async {
    try {
      if (_audioPlayer == null) {
        _audioPlayer = AudioPlayer();
        _audioPlayer!.onPlayerComplete.listen((_) {
          if (mounted) {
            setState(() {
              _mascoteFalando = false;
              _audioTocando = false;
            });
          }
        });
      }

      final audioUrl =
          _ajustarAudioUrl(_aulaAtualMap['audio_url'] as String?);

      setState(() {
        _mascoteFalando = true;
        _audioTocando = true;
      });

      if (audioUrl != null && audioUrl.isNotEmpty) {
        await _audioPlayer!.play(UrlSource(audioUrl));
      } else {
        // Fallback pelo ID REAL da lição (não pela posição na lista):
        // assets/audios/audio_licao_<id>.mp3 (ex.: audio_licao_13.mp3).
        final licaoId = _aulaAtualMap['id_licao'] as int? ?? (_aulaAtual + 1);
        await _audioPlayer!
            .play(AssetSource('audios/audio_licao_$licaoId.mp3'));
      }
    } catch (e) {
      debugPrint("Erro ao tocar audio: $e");
      if (mounted) {
        setState(() {
          _mascoteFalando = false;
          _audioTocando = false;
        });
      }
    }
  }

  void _pausarAudio() async {
    try {
      await _audioPlayer?.pause();
      if (mounted) {
        setState(() {
          _audioTocando = false;
        });
      }
    } catch (e) {}
  }

  void _pararAudioEAvancar() async {
    try {
      await _audioPlayer?.stop();
    } catch (e) {}
    setState(() {
      _mascoteFalando = false;
      _audioTocando = false;
      _faseAbas = 1;
    });
  }

  // ── QUIZ / RESULTADO ───────────────────────────────────────────────────
  Future<void> _processarResultadoQuiz() async {
    final token = tokenGlobal;
    final alunoId = alunoIdGlobal;
    final licaoId = _aulaAtualMap['id_licao'] as int?;
    if (token == null || alunoId == null || licaoId == null) return;
    if (_enviandoQuiz) return; // trava extra contra duplo clique

    setState(() => _enviandoQuiz = true);
    try {
      // Envia SOMENTE os índices das alternativas selecionadas. A correção
      // (acertos), a aprovação e a recompensa são calculadas no SERVIDOR.
      final respostas = List<int>.from(_respostasSelecionadas);
      final resultado = await ApiService.registrarProgresso(
        token,
        alunoId,
        licaoId,
        respostas,
      );
      if (!mounted) return;

      final aprovado = resultado['status_aprovacao'] == true;
      setState(() {
        _moedasGlobais = resultado['moedas_total'] as int? ?? _moedasGlobais;
        moedasGlobais = _moedasGlobais;
        _faseAbas = aprovado ? 2 : 3;
      });
      if (aprovado) {
        _aulasConcluidas[licaoId] = true;
        if (licaoId >= 1 && licaoId <= aulasConcluidasGlobal.length) {
          aulasConcluidasGlobal[licaoId - 1] = true;
        }
      }
    } catch (e) {
      debugPrint("Erro ao salvar progresso: $e");
      if (mounted) setState(() => _faseAbas = 3);
    } finally {
      if (mounted) setState(() => _enviandoQuiz = false);
    }
  }

  void _proximaAula() {
    if (_aulaAtual < _licoes.length - 1) {
      _aulaAtual++;
      _faseAbas = 0;
      _prepararRespostas();
      _audioPlayer?.stop();
      setState(() {
        _mascoteFalando = false;
        _audioTocando = false;
      });
    } else {
      setState(() {
        _faseAbas = 4;
      });
    }
  }

  void _tentarNovamente() {
    setState(() {
      _faseAbas = 0;
      _mascoteFalando = false;
      _audioTocando = false;
    });
    _prepararRespostas();
    _audioPlayer?.stop();
  }

  // ── TELAS ──────────────────────────────────────────────────────────────
  Widget _buildConteudo() {
    final conteudo =
        List<String>.from(_aulaAtualMap['conteudo'] as List? ?? []);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: _mascoteFalando
              ? Image.asset('assets/images/mascoteFalando.gif', height: 180)
              : Image.asset('assets/images/Mascote.png', height: 180),
        ),
        const SizedBox(height: 15),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 220,
              child: ElevatedButton.icon(
                onPressed: _audioTocando ? _pausarAudio : _tocarAudio,
                icon: Icon(_audioTocando ? Icons.pause : Icons.play_arrow),
                label: Text(_audioTocando ? "Pausar" : "Ouvir"),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _audioTocando
                      ? _corPrimaria()
                      : _corSecundaria(),
                  foregroundColor: _audioTocando ? Colors.white : null,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 30),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _corFundo(),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: conteudo.map((item) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6.0),
                child: Text("• $item",
                    style: TextStyle(fontSize: 16, color: _corTexto())),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 30),
        ElevatedButton(
            onPressed: _pararAudioEAvancar, child: const Text("Ir para o Quiz")),
      ],
    );
  }

  Widget _buildQuiz() {
    final perguntas = _aulaAtualMap['perguntas'] as List? ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text("Quiz da Aula",
            style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: _corTexto())),
        const SizedBox(height: 15),
        ...List.generate(perguntas.length, (indexPergunta) {
          final pergunta = perguntas[indexPergunta];
          final alternativas = (pergunta['alternativas'] as List? ?? []);
          return Card(
            margin: const EdgeInsets.symmetric(vertical: 8),
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("${indexPergunta + 1}. ${pergunta['enunciado']}",
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: _corTexto())),
                  const SizedBox(height: 12),
                  ...List.generate(alternativas.length, (indexOpcao) {
                    bool isSelected =
                        _respostasSelecionadas[indexPergunta] == indexOpcao;
                    return InkWell(
                      onTap: () => setState(() =>
                          _respostasSelecionadas[indexPergunta] = indexOpcao),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        child: Row(
                          children: [
                            Icon(
                              isSelected
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_unchecked,
                              color: isSelected
                                  ? _corPrimaria()
                                  : _corTexto().withValues(alpha: 0.3),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                                child: Text(
                                    alternativas[indexOpcao]['texto'].toString(),
                                    style: TextStyle(color: _corTexto()))),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
          );
        }),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _enviandoQuiz ? null : _processarResultadoQuiz,
          child: _enviandoQuiz
              ? const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2)),
                    SizedBox(width: 10),
                    Text('Processando...'),
                  ],
                )
              : const Text('Enviar Respostas'),
        ),
      ],
    );
  }

  Widget _buildSucesso() {
    return Column(
      children: [
        const Icon(Icons.check_circle, color: Color(0xFF6FB755), size: 80),
        const Text("Top demais!",
            style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF6FB755))),
        const SizedBox(height: 8),
        Text("Voce ganhou moedas!",
            style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: _corTexto().withValues(alpha: 0.7))),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: _proximaAula,
          child: Text(
              _aulaAtual < _licoes.length - 1 ? "Proxima Aula" : "Ver Trilha"),
        ),
      ],
    );
  }

  Widget _buildFalha() {
    return Column(
      children: [
        const Icon(Icons.cancel, color: Colors.redAccent, size: 80),
        const Text("Eita! Quase la",
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text("Nao desiste! Voce consegue!",
            style: TextStyle(
                fontSize: 14, color: _corTexto().withValues(alpha: 0.6))),
        const SizedBox(height: 16),
        ElevatedButton(
            onPressed: _tentarNovamente, child: const Text("Tentar de Novo")),
      ],
    );
  }

  Widget _buildFim() {
    return Column(
      children: [
        const Icon(Icons.emoji_events, color: Color(0xFF6FB755), size: 80),
        const Text("Show! Voce concluiu todas as aulas disponiveis!",
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context);
          },
          child: const Text("Voltar ao Inicio"),
        ),
      ],
    );
  }

  Widget _buildFaseAtual() {
    if (_faseAbas == 0) return _buildConteudo();
    if (_faseAbas == 1) return _buildQuiz();
    if (_faseAbas == 2) return _buildSucesso();
    if (_faseAbas == 3) return _buildFalha();
    return _buildFim();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const MenuLateral(),
      appBar: AppBar(
        centerTitle: false,
        leading: Builder(
          builder: (context) => IconButton(
            icon: Image.asset('assets/images/iconeVerde.png'),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        title: const Text("Area de Estudos",
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Center(
              child: Text("💰 $_moedasGlobais",
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 18)),
            ),
          ),
        ],
      ),
      body: SafeArea(child: _buildCorpo()),
    );
  }

  Widget _buildCorpo() {
    if (_carregando) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_erro != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.cloud_off, size: 60, color: _corPrimaria()),
              const SizedBox(height: 16),
              const Text("Nao deu pra carregar as aulas.",
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(_erro!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: _corTexto())),
              const SizedBox(height: 24),
              ElevatedButton(
                  onPressed: _carregarConteudo,
                  child: const Text("Tentar novamente")),
            ],
          ),
        ),
      );
    }

    if (_licoes.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
              "Nenhuma aula por aqui ainda. Fala com a coordenacao!",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16)),
        ),
      );
    }

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_aulaAtualMap['titulo'].toString(),
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: _corTexto())),
            const SizedBox(height: 10),
            Text(
              _nomeTrilha(_aulaAtualMap['id_trilha'] as int? ?? 0),
              style: TextStyle(
                  fontSize: 14, color: _corTexto().withValues(alpha: 0.6)),
            ),
            const SizedBox(height: 20),
            _buildFaseAtual(),
          ],
        ),
      ),
    );
  }
}
