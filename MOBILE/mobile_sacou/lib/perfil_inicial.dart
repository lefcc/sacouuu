import 'package:flutter/material.dart';
import 'package:mobile_sacou/api_service.dart';
import 'package:mobile_sacou/classe_usuario.dart';
import 'package:mobile_sacou/boas_vindas.dart';

class PerfilInicial extends StatefulWidget {
  const PerfilInicial({super.key});

  @override
  State<PerfilInicial> createState() => _PerfilInicialState();
}

class _PerfilInicialState extends State<PerfilInicial> {
  List<Map<String, dynamic>> _avatares = [];
  int? _selecionado;
  bool _carregando = true;
  bool _salvando = false;

  @override
  void initState() {
    super.initState();
    _carregarAvatares();
  }

  Future<void> _carregarAvatares() async {
    try {
      final dados = await ApiService.listarAvatares();
      if (mounted) {
        setState(() {
          _avatares = dados.cast<Map<String, dynamic>>();
          _carregando = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _carregando = false);
    }
  }

  Future<void> _confirmar() async {
    if (_selecionado == null || tokenGlobal == null) return;
    setState(() => _salvando = true);
    try {
      await ApiService.selecionarAvatar(tokenGlobal!, _selecionado!);
      avatarIdGlobal = _selecionado;
      avatarConfiguradoGlobal = true;
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const BoasVindas()),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao salvar: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  String _caminhoAvatar(int id, String nome) {
    // 1) Prefere o nome REAL vindo da API (ex.: 'Elefante' -> 'elefante.png'),
    //    imune a mudanças de ID no banco.
    final nomeNormalizado = nome.trim().toLowerCase();
    if (nomeNormalizado == 'elefante' ||
        nomeNormalizado == 'pinguim' ||
        nomeNormalizado == 'polvo') {
      return 'assets/images/avatars/$nomeNormalizado.png';
    }
    // 2) Fallback por ID: IDs reais do banco (4/5/6) e os antigos (1/2/3).
    const nomes = {
      1: 'elefante', 2: 'pinguim', 3: 'polvo',
      4: 'elefante', 5: 'pinguim', 6: 'polvo',
    };
    return 'assets/images/avatars/${nomes[id] ?? 'pinguim'}.png';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final corPrimaria = isDark ? const Color(0xFF8B7BBF) : const Color(0xFF5F4C9A);
    final corTexto = isDark ? const Color(0xFFEDE8FF) : const Color(0xFF1E1740);

    return Scaffold(
      appBar: AppBar(
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            // Vindo do menu lateral, volta para a tela anterior. No fluxo de
            // onboarding (após login) não há tela anterior — vai ao dashboard.
            final navigator = Navigator.of(context);
            if (navigator.canPop()) {
              navigator.pop();
            } else {
              navigator.pushReplacement(
                MaterialPageRoute(builder: (_) => const BoasVindas()),
              );
            }
          },
        ),
        title: const Text(
          'Meu Avatar',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
      ),
      body: SafeArea(
        child: _carregando
            ? const Center(child: CircularProgressIndicator())
            : SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: Column(
                  children: [
                    const SizedBox(height: 20),
                    Image.asset('assets/images/Logo.png', height: 70),
                    const SizedBox(height: 24),
                    Text(
                      'Escolha seu avatar',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'cherry',
                        color: corPrimaria,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Essa sera sua identidade no Sacou',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 15, color: corTexto.withValues(alpha: 0.7)),
                    ),
                    const SizedBox(height: 32),
                    if (_avatares.isEmpty)
                      const Text('Nenhum avatar disponivel.')
                    else
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: _avatares.map((a) {
                          final id = a['id_avatar'] as int;
                          final selecionado = _selecionado == id;
                          final nome = a['nome'] as String? ?? '';
                          final caminho = _caminhoAvatar(id, nome);
                          debugPrint('Carregando avatar ID $id: caminho = $caminho');
                          return GestureDetector(
                            onTap: () => setState(() => _selecionado = id),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: selecionado ? corPrimaria.withValues(alpha: 0.15) : Colors.transparent,
                                border: Border.all(
                                  color: selecionado ? corPrimaria : Colors.transparent,
                                  width: 3,
                                ),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Column(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child: Image.asset(caminho, width: 90, height: 90, fit: BoxFit.cover,
                                      errorBuilder: (_, _, _) => Container(
                                        width: 90, height: 90,
                                        color: corPrimaria.withValues(alpha: 0.2),
                                        child: Icon(Icons.person, size: 50, color: corPrimaria),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(nome, style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: selecionado ? corPrimaria : corTexto,
                                  )),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    const SizedBox(height: 40),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _selecionado == null || _salvando ? null : _confirmar,
                        child: _salvando
                            ? const SizedBox(
                                height: 20, width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Confirmar'),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
