// lib/avatar_equipado.dart
//
// Avatar com sobreposição em Stack SEM alignment central. Tudo é posicionado
// de forma ABSOLUTA a partir do canto superior esquerdo (0,0) de um container
// fixo (200x250 por padrão):
//   • Camada 1 (fundo): avatar PNG base, em Positioned(top: 20, left: 0).
//   • Camada 2 (meio): acessórios de ROSTO (óculos).
//   • Camada 3 (topo): acessórios de CABEÇA (chapéu/coroa).
//
// As coordenadas são absolutas, relativas ao tamanho de referência 200, e
// escalam com o container.
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Tipo do acessório → usado na Loja e para classificar itens.
enum TipoAcessorio { cabeca, rosto, corpo }

/// Posição absoluta de um acessório dentro do container (relativa a 200).
class AvatarSlot {
  final double top; // distância do topo
  final double left; // distância da esquerda
  final double width; // largura do acessório
  final double height; // altura do acessório

  const AvatarSlot(this.top, this.left, this.width, this.height);
}

/// Tamanho de referência usado para definir as coordenadas absolutas.
const double _tamanhoReferencia = 200;

/// Espaço extra acima do avatar (para o chapéu/coroa não cortar).
const double _espacoTopo = 50;

/// Coordenadas absolutas (no container 200x250) para cada tipo de acessório.
const AvatarSlot _slotCabeca = AvatarSlot(0, 25, 150, 100); // chapéu/coroa/touca
const AvatarSlot _slotRosto = AvatarSlot(85, 35, 130, 50); // óculos/máscaras

class AvatarEquipado extends StatelessWidget {
  /// Caminho do asset do avatar base (ex.: 'assets/images/avatars/pinguim.png').
  final String avatarAsset;

  /// Acessórios equipados (formato de [apenasEquipados]): cada item tem
  /// `asset` (caminho local do SVG) e opcionalmente `categoria`/`nome`.
  final List<Map<String, dynamic>> acessorios;

  /// Tamanho da base do avatar (quadrado). Acessórios escalam proporcionalmente.
  final double tamanho;

  const AvatarEquipado({
    super.key,
    required this.avatarAsset,
    this.acessorios = const [],
    this.tamanho = 200,
  });

  /// Nomes de arquivo SVG conhecidos em assets/images/loja/.
  static const Set<String> _assetsValidos = {
    'bone_anjo.svg',
    'bone_coelho.svg',
    'touca.svg',
    'chapeu_lampiao.svg',
    'oculos_nerd.svg',
    'oculos_matrix.svg',
    'coroa_luz.svg',
  };

  /// Converte o `url_imagem` da API (ex.: '/static/loja/chapeu_lampiao.svg')
  /// no caminho local do asset (ex.: 'assets/images/loja/chapeu_lampiao.svg').
  /// Retorna '' quando o arquivo não existe no app.
  static String caminhoLocal(String urlImagem) {
    final nome = urlImagem.split('/').last.trim();
    if (!_assetsValidos.contains(nome)) return '';
    return 'assets/images/loja/$nome';
  }

  /// Converte um item da API (listarItensLoja) no formato de acessório equipado.
  static Map<String, dynamic> paraEquipado(Map<String, dynamic> item) {
    final url = item['url_imagem'] as String? ?? '';
    return {
      'id_item': item['id_item'],
      'nome': item['nome'] as String? ?? '',
      'url_imagem': url,
      'categoria': item['categoria'],
      'asset': caminhoLocal(url),
    };
  }

  /// Filtra a lista de todos os itens da loja deixando só os equipados
  /// (com asset local resolvido), na ordem original.
  static List<Map<String, dynamic>> apenasEquipados(
    List<dynamic> todosItens,
    List<dynamic> meusItens,
  ) {
    final equipados = meusItens
        .where((m) => m['equipado'] == true)
        .map((m) => m['id_item'] as int)
        .toSet();

    return todosItens
        .where((i) => equipados.contains(i['id_item']))
        .map((i) => paraEquipado(i.cast<String, dynamic>()))
        .where((e) => (e['asset'] as String? ?? '').isNotEmpty)
        .toList();
  }

  /// Remove acentos (óculos → oculos) para comparações por nome.
  static String _semAcentos(String texto) {
    const com = 'áàâãäéèêëíìîïóòôõöúùûüç';
    const sem = 'aaaaaeeeeiiiiooooouuuuc';
    final buffer = StringBuffer();
    for (final ch in texto.split('')) {
      final idx = com.indexOf(ch);
      buffer.write(idx >= 0 ? sem[idx] : ch);
    }
    return buffer.toString();
  }

  /// Determina o tipo do acessório: usa a `categoria` vinda da API
  /// (CABECA/ROSTO/CORPO) com fallback pelo nome do item.
  static TipoAcessorio tipoDe(Map<String, dynamic> acessorio) {
    final categoria = (acessorio['categoria'] as String? ?? '').toUpperCase();
    switch (categoria) {
      case 'CABECA':
        return TipoAcessorio.cabeca;
      case 'ROSTO':
        return TipoAcessorio.rosto;
      case 'CORPO':
        return TipoAcessorio.corpo;
    }
    final nome = _semAcentos((acessorio['nome'] as String? ?? '').toLowerCase());
    if (nome.contains('oculo')) return TipoAcessorio.rosto;
    return TipoAcessorio.cabeca;
  }

  /// Nome do avatar a partir do asset (ex.: 'assets/images/avatars/pinguim.png'
  /// → 'pinguim').
  String get avatarNome =>
      avatarAsset.split('/').last.replaceAll('.png', '');

  /// Acessórios equipados da categoria ROSTO (óculos/máscaras).
  List<Map<String, dynamic>> get _itensRosto =>
      acessorios.where((a) => tipoDe(a) == TipoAcessorio.rosto).toList();

  /// Acessórios equipados da categoria CABEÇA (chapéus/coroas/toucas).
  List<Map<String, dynamic>> get _itensCabeca =>
      acessorios.where((a) => tipoDe(a) == TipoAcessorio.cabeca).toList();

  Widget _buildAcessorio(Map<String, dynamic> acessorio, AvatarSlot slot) {
    final asset = (acessorio['asset'] as String? ?? '').trim();
    final nome = acessorio['nome'] as String? ?? '?';
    if (asset.isEmpty) return const SizedBox.shrink();

    final top = slot.top;
    final left = slot.left;
    final width = slot.width;
    final height = slot.height;

    debugPrint(
      'Renderizando acessório $nome com top: $top, left: $left, width: $width, height: $height',
    );

    return Positioned(
      top: tamanho * top / _tamanhoReferencia,
      left: tamanho * left / _tamanhoReferencia,
      width: tamanho * width / _tamanhoReferencia,
      height: tamanho * height / _tamanhoReferencia,
      child: SizedBox(
        width: tamanho * width / _tamanhoReferencia,
        height: tamanho * height / _tamanhoReferencia,
        child: SvgPicture.asset(
          asset,
          fit: BoxFit.contain,
          placeholderBuilder: (_) => const SizedBox.shrink(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const corPrimaria = Color(0xFF5F4C9A);

    return SizedBox(
      width: tamanho,
      height: tamanho + _espacoTopo,
      // Sem alignment central: tudo é posicionado absolutamente.
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // ── Camada 1 (fundo): avatar PNG base, descido 20px p/ o chapéu ──
          Positioned(
            top: 20 * tamanho / _tamanhoReferencia,
            left: 0,
            width: tamanho,
            height: tamanho,
            child: Image.asset(
              avatarAsset,
              fit: BoxFit.contain,
              errorBuilder: (_, _, _) => Container(
                width: tamanho,
                height: tamanho,
                decoration: BoxDecoration(
                  color: corPrimaria.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.person, size: tamanho * 0.45, color: corPrimaria),
              ),
            ),
          ),

          // ── Camada 2 (meio): acessórios de ROSTO (óculos) ──
          ..._itensRosto.map((a) => _buildAcessorio(a, _slotRosto)),

          // ── Camada 3 (topo): acessórios de CABEÇA (chapéu/coroa) ──
          ..._itensCabeca.map((a) => _buildAcessorio(a, _slotCabeca)),
        ],
      ),
    );
  }
}
