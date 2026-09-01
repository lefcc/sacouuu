import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:mobile_sacou/api_service.dart';
import 'package:mobile_sacou/avatar_equipado.dart';
import 'package:mobile_sacou/classe_usuario.dart';
import 'package:mobile_sacou/menu_lateral.dart';

class Loja extends StatefulWidget {
  const Loja({super.key});

  @override
  State<Loja> createState() => _LojaState();
}

class _LojaState extends State<Loja> {
  List<Map<String, dynamic>> _itens = [];
  Set<int> _meusItens = {};
  Set<int> _equipados = {};
  bool _carregando = true;
  bool _erro = false;
  String _mensagemErro = '';

  @override
  void initState() {
    super.initState();
    _carregarDados();
  }

  Future<void> _carregarDados() async {
    setState(() {
      _carregando = true;
      _erro = false;
    });
    try {
      final token = tokenGlobal;
      final itensFuture = ApiService.listarItensLoja();
      final meusFuture = token != null ? ApiService.meusItensLoja(token) : Future.value(<dynamic>[]);

      final resultados = await Future.wait([itensFuture, meusFuture]);
      final itens = resultados[0].cast<Map<String, dynamic>>();
      final meus = resultados[1].cast<Map<String, dynamic>>();

      if (mounted) {
        setState(() {
          _itens = itens;
          _meusItens = meus.map((m) => m['id_item'] as int).toSet();
          _equipados = meus.where((m) => m['equipado'] == true).map((m) => m['id_item'] as int).toSet();
          _carregando = false;
        });
        // Mantém o estado global dos acessórios equipados em sincronia com a API.
        itensEquipadosGlobal.value = AvatarEquipado.apenasEquipados(itens, meus);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _carregando = false;
          _erro = true;
          _mensagemErro = 'Falha ao conectar. Verifique sua internet.';
        });
      }
    }
  }

  Future<void> _comprar(int idItem, int preco) async {
    final token = tokenGlobal;
    if (token == null) return;
    if (moedasGlobais < preco) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Moedas insuficientes!')),
      );
      return;
    }

    try {
      await ApiService.comprarItemLoja(token, idItem);
      setState(() {
        moedasGlobais -= preco;
        _meusItens.add(idItem);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Item comprado!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e')),
        );
      }
    }
  }

  Future<void> _equipar(int idItem, bool equipar) async {
    final token = tokenGlobal;
    if (token == null) return;

    try {
      if (equipar) {
        // Apenas UM item de cada tipo: desequipa os outros equipados do mesmo
        // tipo (CABECA/ROSTO/CORPO) antes de equipar o novo.
        final item = _itens.firstWhere(
          (i) => i['id_item'] == idItem,
          orElse: () => <String, dynamic>{},
        );
        final tipoAlvo = AvatarEquipado.tipoDe(AvatarEquipado.paraEquipado(item));

        for (final outro in List.of(itensEquipadosGlobal.value)) {
          if (outro['id_item'] != idItem &&
              AvatarEquipado.tipoDe(outro) == tipoAlvo) {
            await ApiService.equiparItemLoja(token, outro['id_item'] as int, false);
            _equipados.remove(outro['id_item']);
          }
        }

        await ApiService.equiparItemLoja(token, idItem, true);
        _equipados.add(idItem);
      } else {
        await ApiService.equiparItemLoja(token, idItem, false);
        _equipados.remove(idItem);
      }

      setState(() {});
      // Re-sincroniza o estado global com os itens equipados atuais.
      itensEquipadosGlobal.value = AvatarEquipado.apenasEquipados(
        _itens,
        _equipados.map((id) => {'id_item': id, 'equipado': true}).toList(),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final corPrimaria = isDark ? const Color(0xFF8B7BBF) : const Color(0xFF5F4C9A);
    final corSecundaria = const Color(0xFF6FB755);
    final corTexto = isDark ? const Color(0xFFEDE8FF) : const Color(0xFF1E1740);
    final corCardBg = isDark ? const Color(0xFF1E1A2E) : Colors.white;
    final corBorda = isDark ? const Color(0xFF2A2440) : const Color(0xFFECE8F5);

    return Scaffold(
      drawer: const MenuLateral(),
      appBar: AppBar(
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Loja', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Center(
              child: Text('\u{1F4B0} $moedasGlobais',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: _carregando
          ? const Center(child: CircularProgressIndicator())
          : _erro
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.cloud_off, size: 60, color: Colors.redAccent),
                        const SizedBox(height: 16),
                        Text(_mensagemErro,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 16)),
                        const SizedBox(height: 24),
                        ElevatedButton(
                          onPressed: _carregarDados,
                          child: const Text('Tentar Novamente'),
                        ),
                      ],
                    ),
                  ),
                )
              : _itens.isEmpty
              ? const Center(child: Text('Nenhum item disponivel na loja.'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 0.75,
                    ),
                    itemCount: _itens.length,
                    itemBuilder: (context, index) {
                      final item = _itens[index];
                      final id = item['id_item'] as int;
                      final nome = item['nome'] as String? ?? '';
                      final preco = item['preco'] as int? ?? 0;
                      final url = '${ApiService.baseUrl}${item['url_imagem']}';
                      final possuo = _meusItens.contains(id);
                      final equipado = _equipados.contains(id);
                      final podeComprar = moedasGlobais >= preco;

                      return Container(
                        decoration: BoxDecoration(
                          color: corCardBg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: equipado ? corSecundaria : corBorda,
                            width: equipado ? 2 : 1,
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: SvgPicture.network(
                                url,
                                width: 80, height: 80, fit: BoxFit.contain,
                                errorBuilder: (_, _, _) => Container(
                                  width: 80, height: 80,
                                  color: corPrimaria.withValues(alpha: 0.15),
                                  child: Icon(Icons.store, size: 40, color: corPrimaria),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              child: Text(nome,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontWeight: FontWeight.w600, color: corTexto, fontSize: 13)),
                            ),
                            const SizedBox(height: 4),
                            if (!possuo)
                              SizedBox(
                                height: 44,
                                child: ElevatedButton(
                                  onPressed: podeComprar ? () => _comprar(id, preco) : null,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: corSecundaria,
                                    foregroundColor: corPrimaria,
                                    padding: const EdgeInsets.symmetric(horizontal: 12),
                                  ),
                                  child: Text('\u{1FA99} $preco',
                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                ),
                              )
                            else
                              SizedBox(
                                height: 44,
                                child: OutlinedButton(
                                  onPressed: () => _equipar(id, !equipado),
                                  child: Text(equipado ? 'Desequipar' : 'Equipar',
                                      style: const TextStyle(fontSize: 12)),
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
        ),
    );
  }
}
