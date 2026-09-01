import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:mobile_sacou/api_service.dart';
import 'package:mobile_sacou/avatar_equipado.dart';
import 'package:mobile_sacou/classe_usuario.dart';
import 'package:mobile_sacou/menu_lateral.dart';
import 'package:mobile_sacou/aulas.dart';
import 'package:mobile_sacou/trilha_ensino.dart';
import 'package:mobile_sacou/loja.dart';

class BoasVindas extends StatefulWidget {
  const BoasVindas({super.key});

  @override
  State<BoasVindas> createState() => _BoasVindasState();
}

class _BoasVindasState extends State<BoasVindas> {
  int _totalAulas = 0;
  final Set<int> _idsAulasDisponiveis = {};

  @override
  void initState() {
    super.initState();
    _carregarEquipados();
    _carregarDados();
  }

  /// Lê da API quais acessórios o aluno equipou e atualiza o estado global.
  Future<void> _carregarEquipados() async {
    final token = tokenGlobal;
    if (token == null) return;
    try {
      final itens = await ApiService.listarItensLoja();
      final meus = await ApiService.meusItensLoja(token);
      if (mounted) {
        setState(() {
          itensEquipadosGlobal.value = AvatarEquipado.apenasEquipados(itens, meus);
        });
      }
    } catch (_) {
      // Sem acesso à API: mantém o estado atual sem quebrar a tela.
    }
  }

  /// Busca o progresso REAL (moedas, nível, aulas concluídas) e a lista real
  /// de aulas disponíveis na API para preencher os cards do Dashboard.
  Future<void> _carregarDados() async {
    final token = tokenGlobal;
    if (token == null || alunoIdGlobal == null) return;
    try {
      final progresso = await ApiService.obterProgresso(token, alunoIdGlobal!);
      if (kDebugMode) {
        debugPrint('[MOEDAS] JSON do GET /progresso no Dashboard: $progresso');
      }
      aplicarProgressoDaApi(progresso);
      debugPrint('[MOEDAS] valor exibido no card Grana (moedasGlobais): $moedasGlobais');

      final licoes = await ApiService.listarLicoes(token);
      // Ajusta o progresso ao total REAL de aulas (sem limite fixo de 12).
      redimensionarPeloTotalDeAulas(licoes);
      final disponiveis = licoes
          .where((l) => _temConteudo(l))
          .map((l) => l['id_licao'] as int? ?? 0)
          .where((id) => id >= 1)
          .toSet();

      if (mounted) {
        setState(() {
          _idsAulasDisponiveis
            ..clear()
            ..addAll(disponiveis);
          _totalAulas = _idsAulasDisponiveis.length;
        });
      }
    } catch (_) {
      // Sem acesso à API: mantém o estado atual sem quebrar a tela.
    }
  }

  /// Uma aula só conta como "disponível" se o banco entregou conteúdo real.
  bool _temConteudo(Map<String, dynamic> licao) {
    final conteudo = licao['conteudo'];
    final perguntas = licao['perguntas'];
    return (conteudo is List && conteudo.isNotEmpty) &&
        (perguntas is List && perguntas.isNotEmpty);
  }

  String _saudacao() {
    final hora = DateTime.now().hour;
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  int _aulasConcluidasCount() {
    // Só conta aulas que REALMENTE existem (disponíveis) e foram concluídas.
    if (_idsAulasDisponiveis.isEmpty) {
      return aulasConcluidasGlobal.where((c) => c).length;
    }
    var count = 0;
    for (final id in _idsAulasDisponiveis) {
      if (id >= 1 &&
          id <= aulasConcluidasGlobal.length &&
          aulasConcluidasGlobal[id - 1]) {
        count++;
      }
    }
    return count;
  }

  @override
  Widget build(BuildContext context) {
    final nome = nomeGlobal ?? 'Aluno';
    final primeiroNome = nome.split(' ').first;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final corPrimaria = isDark ? const Color(0xFF8B7BBF) : const Color(0xFF5F4C9A);
    final corSecundaria = const Color(0xFF6FB755);
    final corTextoSec = isDark ? const Color(0xFF9080B8) : const Color(0xFF7C6FA0);
    final corCardBg = isDark ? const Color(0xFF1E1A2E) : Colors.white;
    final corBorda = isDark ? const Color(0xFF2A2440) : const Color(0xFFECE8F5);
    final corDourado = isDark ? const Color(0xFFF2B705) : const Color(0xFFB8860B);

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
        title: Image.asset('assets/images/LogoPadrao.png', width: 100),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('\u{1FA99}', style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 4),
                  Text(
                    '$moedasGlobais',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFFF2B705),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            children: [
              const SizedBox(height: 30),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Image.asset('assets/images/Logo.png', height: 80),
                    const SizedBox(width: 16),
                    Image.asset('assets/images/Mascote.png', height: 110),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                "${_saudacao()}, $primeiroNome!",
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  fontFamily: "cherry",
                  color: corPrimaria,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                "Bora continuar construindo sua mentalidade milionaria?",
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: corTextoSec,
                ),
              ),
              const SizedBox(height: 30),

              if (avatarIdGlobal != null)
                _buildAvatar(),

              const SizedBox(height: 30),

              Row(
                children: [
                  _buildStatCard(
                    icon: Icons.attach_money,
                    label: 'Grana',
                    value: '$moedasGlobais',
                    corIcone: corSecundaria,
                    corValor: corDourado,
                    corLabel: corTextoSec,
                    corCardBg: corCardBg,
                    corBorda: corBorda,
                  ),
                  const SizedBox(width: 12),
                  _buildStatCard(
                    icon: Icons.school,
                    label: 'Aulas',
                    value: _totalAulas == 0
                        ? 'Carregando...'
                        : '${_aulasConcluidasCount()}/$_totalAulas',
                    corIcone: corSecundaria,
                    corValor: corDourado,
                    corLabel: corTextoSec,
                    corCardBg: corCardBg,
                    corBorda: corBorda,
                  ),
                  const SizedBox(width: 12),
                  _buildStatCard(
                    icon: Icons.star,
                    label: 'Nivel',
                    value: '$nivelAtualGlobal',
                    corIcone: corPrimaria,
                    corValor: corDourado,
                    corLabel: corTextoSec,
                    corCardBg: corCardBg,
                    corBorda: corBorda,
                  ),
                ],
              ),
              const SizedBox(height: 32),

              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: () {
                    // Ao voltar das aulas, recarrega o progresso real do aluno.
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const Aulas()),
                    ).then((_) => _carregarDados());
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: corSecundaria,
                  ),
                  child: const Text("Bora Estudar"),
                ),
              ),
              const SizedBox(height: 12),

              SizedBox(
                height: 50,
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => TrilhaEnsino()),
                    ).then((_) => _carregarDados());
                  },
                  child: const Text("Ver as Aulas"),
                ),
              ),
              const SizedBox(height: 12),

              SizedBox(
                height: 50,
                child: OutlinedButton.icon(
                  onPressed: () {
                    // Ao voltar da loja, recarrega os acessórios equipados e
                    // o saldo real de moedas (compra desconta no backend).
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const Loja()),
                    ).then((_) {
                      _carregarEquipados();
                      _carregarDados();
                    });
                  },
                  icon: const Icon(Icons.store, size: 20),
                  label: const Text("Loja"),
                ),
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required String label,
    required String value,
    required Color corIcone,
    required Color corValor,
    required Color corLabel,
    required Color corCardBg,
    required Color corBorda,
  }) {
    return Expanded(
      flex: 1,
      child: Container(
        constraints: const BoxConstraints(minHeight: 90),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: corCardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: corBorda),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: corIcone, size: 24),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: corValor,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: corLabel,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Avatar do aluno com os acessórios equipados sobrepostos (Stack).
  /// A troca de avatar acontece fora da tela inicial (perfil/loja).
  Widget _buildAvatar() {
    // IDs reais do banco (4/5/6) + os antigos (1/2/3).
    const nomeMap = {
      1: 'elefante', 2: 'pinguim', 3: 'polvo',
      4: 'elefante', 5: 'pinguim', 6: 'polvo',
    };
    final nomeArquivo = nomeMap[avatarIdGlobal] ?? 'pinguim';
    final caminhoAvatar = 'assets/images/avatars/$nomeArquivo.png';

    // Reativo: quando os acessórios mudam (equipar/desequipar na loja),
    // o avatar se atualiza sozinho.
    return ValueListenableBuilder<List<Map<String, dynamic>>>(
      valueListenable: itensEquipadosGlobal,
      builder: (context, acessorios, _) => AvatarEquipado(
        avatarAsset: caminhoAvatar,
        acessorios: acessorios,
        tamanho: 200,
      ),
    );
  }
}
