import 'package:flutter/material.dart';
import 'package:mobile_sacou/api_service.dart';
import 'package:mobile_sacou/classe_usuario.dart';
import 'package:mobile_sacou/menu_lateral.dart';
import 'package:mobile_sacou/aulas.dart';

class TrilhaEnsino extends StatefulWidget {
  const TrilhaEnsino({super.key});

  @override
  State<TrilhaEnsino> createState() => _TrilhaEnsinoState();
}

class _TrilhaEnsinoState extends State<TrilhaEnsino> {
  bool _carregando = true;
  String? _erro;
  List<Map<String, dynamic>> _trilhas = [];

  @override
  void initState() {
    super.initState();
    _carregarTrilhas();
  }

  Future<void> _carregarTrilhas() async {
    setState(() {
      _carregando = true;
      _erro = null;
    });

    try {
      final token = tokenGlobal;
      if (token == null) throw Exception('Sessao expirada.');

      // Recarrega o progresso REAL (aulas concluídas) antes de renderizar.
      if (alunoIdGlobal != null) {
        try {
          final progresso = await ApiService.obterProgresso(token, alunoIdGlobal!);
          aplicarProgressoDaApi(progresso);
        } catch (_) {}
      }

      final dados = await ApiService.listarTrilhas(token);

      // Ajusta o progresso ao total REAL de aulas existentes (sem limite fixo).
      final licoes = <dynamic>[
        for (final t in dados)
          if (t is Map) ...(t['licoes'] as List? ?? const <dynamic>[]),
      ];
      redimensionarPeloTotalDeAulas(licoes);

      if (!mounted) return;

      setState(() {
        _trilhas = dados.cast<Map<String, dynamic>>();
        _carregando = false;
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

  Color _corTexto() => Theme.of(context).brightness == Brightness.dark
      ? const Color(0xFFEDE8FF)
      : const Color(0xFF1E1740);

  Color _corPrimaria() => Theme.of(context).brightness == Brightness.dark
      ? const Color(0xFF8B7BBF)
      : const Color(0xFF5F4C9A);

  Color _corSecundaria() => const Color(0xFF6FB755);

  Color _corCardBg() => Theme.of(context).brightness == Brightness.dark
      ? const Color(0xFF1E1A2E)
      : Colors.white;

  Color _corBorda() => Theme.of(context).brightness == Brightness.dark
      ? const Color(0xFF2A2440)
      : const Color(0xFFECE8F5);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const MenuLateral(),
      appBar: AppBar(
        centerTitle: false,
        leading: Builder(
          builder: (BuildContext context) {
            return IconButton(
              icon: Image.asset('assets/images/iconeVerde.png'),
              padding: const EdgeInsets.all(8.0),
              onPressed: () {
                Scaffold.of(context).openDrawer();
              },
            );
          },
        ),
        title: const Text(
          "Conteudo do Curso",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
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
              const Text("Nao deu pra carregar as trilhas.",
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(_erro!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: _corTexto())),
              const SizedBox(height: 24),
              ElevatedButton(
                  onPressed: _carregarTrilhas,
                  child: const Text("Tentar novamente")),
            ],
          ),
        ),
      );
    }

    if (_trilhas.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text("Nenhuma trilha por aqui ainda.",
              textAlign: TextAlign.center),
        ),
      );
    }

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Seu Progresso",
              style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: _corTexto()),
            ),
            const SizedBox(height: 20),
            ..._trilhas.map((trilha) {
              return _buildTrilhaCard(trilha);
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildTrilhaCard(Map<String, dynamic> trilha) {
    final nome = trilha['nome_trilha'] as String? ?? 'Trilha';
    final licoes =
        (trilha['licoes'] as List? ?? []).cast<Map<String, dynamic>>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          decoration: BoxDecoration(
            color: _corPrimaria(),
            borderRadius: BorderRadius.circular(8),
          ),
          width: double.infinity,
          child: Text(
            nome,
            style: TextStyle(
              color: Theme.of(context).brightness == Brightness.dark
                  ? const Color(0xFF13111E)
                  : Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        const SizedBox(height: 8),
        if (licoes.isEmpty)
          _buildTrilhaEmBreve()
        else
          ...licoes.asMap().entries.map((entry) {
            final licao = entry.value;
            final id = licao['id_licao'] as int? ?? 0;
            final titulo = licao['titulo'] as String? ?? '';
            final ordem = licao['ordem'] as int? ?? entry.key;

            final indexGlobal = _indiceGlobalPorId(id);
            final concluida = indexGlobal >= 0 &&
                    indexGlobal < aulasConcluidasGlobal.length
                ? aulasConcluidasGlobal[indexGlobal]
                : false;

            final isLocked = _verificarBloqueio(ordem - 1);
            final disponivel = _temConteudo(licao);

            return _buildAulaTile(id, titulo, concluida, isLocked, disponivel);
          }),
        const SizedBox(height: 30),
      ],
    );
  }

  /// Trilha sem aulas no banco → mostrada como indisponível ("Em breve").
  Widget _buildTrilhaEmBreve() {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: _corCardBg(),
        border: Border.all(color: _corBorda()),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.hourglass_empty, color: _corTexto().withValues(alpha: 0.3)),
          const SizedBox(width: 10),
          Text(
            "Em breve disponível",
            style: TextStyle(
              color: _corTexto().withValues(alpha: 0.3),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  /// Uma aula só é "disponível" se o banco entregou conteúdo e quiz reais.
  bool _temConteudo(Map<String, dynamic> licao) {
    final conteudo = licao['conteudo'];
    final perguntas = licao['perguntas'];
    return (conteudo is List && conteudo.isNotEmpty) &&
        (perguntas is List && perguntas.isNotEmpty);
  }

  /// Índice da aula no estado global de progresso (indexado por `id - 1`).
  /// Aceita QUALQUER id válido (> 0) retornado pela API — o limite real vem
  /// do tamanho de `aulasConcluidasGlobal` (ajustado pelo total de aulas do
  /// banco), nunca de um número fixo. Aula 13+ é processada normalmente.
  int _indiceGlobalPorId(int idLicao) {
    if (idLicao < 1) return -1;
    if (idLicao > aulasConcluidasGlobal.length) return -1;
    return idLicao - 1;
  }

  bool _verificarBloqueio(int indice) {
    if (indice <= 0) return false;
    if (indice - 1 < aulasConcluidasGlobal.length) {
      return !aulasConcluidasGlobal[indice - 1];
    }
    return true;
  }

  Widget _buildAulaTile(
      int id, String titulo, bool concluida, bool isLocked, bool disponivel) {
    final emBreve = !disponivel;
    // "Feito!" só para aulas que REALMENTE têm conteúdo e foram concluídas.
    // Uma aula que não existe no banco (sem conteúdo) nunca pode estar "Feita".
    final concluidaReal = concluida && !emBreve;
    final bloqueada = isLocked || emBreve;
    final corBorda = concluidaReal ? _corSecundaria() : _corBorda();
    final corIcone = bloqueada
        ? _corTexto().withValues(alpha: 0.3)
        : (concluidaReal ? _corSecundaria() : _corPrimaria());
    final corTitulo =
        bloqueada ? _corTexto().withValues(alpha: 0.3) : _corTexto();

    return InkWell(
      onTap: bloqueada
          ? null
          : () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => Aulas(aulaInicial: id),
                ),
              );
            },
      borderRadius: BorderRadius.circular(8),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: concluidaReal
              ? _corSecundaria().withValues(alpha: 0.08)
              : _corCardBg(),
          border: Border.all(color: corBorda),
          borderRadius: BorderRadius.circular(8),
        ),
        child: ListTile(
          leading: Icon(
            emBreve
                ? Icons.hourglass_empty
                : (isLocked
                    ? Icons.lock
                    : (concluidaReal
                        ? Icons.check_circle
                        : Icons.play_circle_outline)),
            color: corIcone,
          ),
          title: Text(
            titulo,
            style: TextStyle(
              color: corTitulo,
              fontWeight: FontWeight.w500,
              decoration: concluidaReal ? TextDecoration.lineThrough : null,
            ),
          ),
          trailing: emBreve
              ? Text("Em breve",
                  style: TextStyle(
                      color: _corTexto().withValues(alpha: 0.3),
                      fontSize: 12,
                      fontWeight: FontWeight.w500))
              : (concluidaReal
                  ? Text("Feito!",
                      style: TextStyle(
                          color: _corSecundaria(),
                          fontSize: 12,
                          fontWeight: FontWeight.w600))
                  : (isLocked
                      ? Text("Trancado",
                          style: TextStyle(
                              color: _corTexto().withValues(alpha: 0.3),
                              fontSize: 12,
                              fontWeight: FontWeight.w500))
                      : Icon(Icons.chevron_right, color: _corPrimaria()))),
        ),
      ),
    );
  }
}
