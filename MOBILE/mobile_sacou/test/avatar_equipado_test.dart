// Testes do sistema de avatar com Stack (Cabeça + Rosto).
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_sacou/avatar_equipado.dart';

void main() {
  group('AvatarEquipado - lógica de tipo', () {
    test('tipoDe usa a categoria da API com fallback pelo nome', () {
      expect(AvatarEquipado.tipoDe({'categoria': 'CABECA'}), TipoAcessorio.cabeca);
      expect(AvatarEquipado.tipoDe({'categoria': 'ROSTO'}), TipoAcessorio.rosto);
      expect(AvatarEquipado.tipoDe({'categoria': 'CORPO'}), TipoAcessorio.corpo);
      // Fallback por nome quando a API não envia categoria
      expect(AvatarEquipado.tipoDe({'nome': 'Óculos de Nerd'}), TipoAcessorio.rosto);
      expect(AvatarEquipado.tipoDe({'nome': 'Coroa de Luz'}), TipoAcessorio.cabeca);
      expect(AvatarEquipado.tipoDe({'nome': 'Boné Anjo'}), TipoAcessorio.cabeca);
    });

    test('caminhoLocal resolve o asset local e ignora desconhecidos', () {
      expect(
        AvatarEquipado.caminhoLocal('/static/loja/chapeu_lampiao.svg'),
        'assets/images/loja/chapeu_lampiao.svg',
      );
      expect(AvatarEquipado.caminhoLocal('/static/loja/desconhecido.svg'), '');
    });

    test('apenasEquipados filtra somente itens equipados com asset resolvido', () {
      final todos = [
        {'id_item': 2, 'nome': 'Boné Anjo', 'url_imagem': '/static/loja/bone_anjo.svg'},
        {'id_item': 5, 'nome': 'Óculos de Nerd', 'url_imagem': '/static/loja/oculos_nerd.svg'},
        {'id_item': 6, 'nome': 'Chapéu Lampião', 'url_imagem': '/static/loja/chapeu_lampiao.svg'},
        {'id_item': 99, 'nome': 'Item estranho', 'url_imagem': '/static/loja/nao_existe.svg'},
      ];
      final meus = [
        {'id_item': 2, 'equipado': false},
        {'id_item': 5, 'equipado': true},
        {'id_item': 6, 'equipado': true},
        {'id_item': 99, 'equipado': true},
      ];

      final equipados = AvatarEquipado.apenasEquipados(todos, meus);

      expect(equipados.length, 2); // item 99 não tem asset local → fica de fora
      expect(equipados.map((e) => e['id_item']).toSet(), {5, 6});
      expect(equipados.every((e) => (e['asset'] as String).isNotEmpty), isTrue);
    });
  });

  group('AvatarEquipado - Stack absoluto (sem alignment)', () {
    testWidgets('avatar base fica posicionado no fundo (top 20, left 0)',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: AvatarEquipado(
            avatarAsset: 'assets/images/avatars/elefante.png',
            acessorios: [],
            tamanho: 200,
          ),
        ),
      ));
      await tester.pump();
      tester.takeException();

      final avatar = find.byType(AvatarEquipado);
      expect(
        find.descendant(
          of: avatar,
          matching: find.byWidgetPredicate(
            (w) => w is Image &&
                w.image is AssetImage &&
                (w.image as AssetImage).assetName ==
                    'assets/images/avatars/elefante.png',
          ),
        ),
        findsOneWidget,
      );

      final posicoes = tester
          .widgetList<Positioned>(
            find.descendant(of: avatar, matching: find.byType(Positioned)),
          )
          .toList();
      // Sem acessórios → apenas a camada base.
      expect(posicoes.length, 1);
      expect(posicoes[0].top, 20);
      expect(posicoes[0].left, 0);
      expect(posicoes[0].width, 200);
      expect(posicoes[0].height, 200);
    });

    testWidgets('renderiza só o chapéu com coordenadas absolutas de CABEÇA',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: AvatarEquipado(
            avatarAsset: 'assets/images/avatars/pinguim.png',
            acessorios: [
              {'asset': 'assets/images/loja/chapeu_lampiao.svg', 'nome': 'Chapéu Lampião'},
            ],
            tamanho: 200,
          ),
        ),
      ));
      await tester.pump();
      tester.takeException();

      final avatar = find.byType(AvatarEquipado);
      expect(find.descendant(of: avatar, matching: find.byType(SvgPicture)), findsOneWidget);

      final posicoes = tester
          .widgetList<Positioned>(
            find.descendant(of: avatar, matching: find.byType(Positioned)),
          )
          .toList();
      // CABECA (absoluto): top 0, left 25, width 150, height 100
      expect(posicoes[1].top, 0);
      expect(posicoes[1].left, 25);
      expect(posicoes[1].width, 150);
      expect(posicoes[1].height, 100);
    });

    testWidgets('renderiza só os óculos com coordenadas absolutas de ROSTO',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: AvatarEquipado(
            avatarAsset: 'assets/images/avatars/pinguim.png',
            acessorios: [
              {'asset': 'assets/images/loja/oculos_nerd.svg', 'nome': 'Óculos de Nerd'},
            ],
            tamanho: 200,
          ),
        ),
      ));
      await tester.pump();
      tester.takeException();

      final avatar = find.byType(AvatarEquipado);
      expect(find.descendant(of: avatar, matching: find.byType(SvgPicture)), findsOneWidget);

      final posicoes = tester
          .widgetList<Positioned>(
            find.descendant(of: avatar, matching: find.byType(Positioned)),
          )
          .toList();
      // ROSTO (absoluto): top 85, left 35, width 130, height 50
      expect(posicoes[1].top, 85);
      expect(posicoes[1].left, 35);
      expect(posicoes[1].width, 130);
      expect(posicoes[1].height, 50);
    });

    testWidgets('renderiza chapéu E óculos simultaneamente', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: AvatarEquipado(
            avatarAsset: 'assets/images/avatars/pinguim.png',
            acessorios: [
              {'asset': 'assets/images/loja/chapeu_lampiao.svg', 'nome': 'Chapéu Lampião'},
              {'asset': 'assets/images/loja/oculos_nerd.svg', 'nome': 'Óculos de Nerd'},
            ],
            tamanho: 200,
          ),
        ),
      ));
      await tester.pump();
      tester.takeException();

      final avatar = find.byType(AvatarEquipado);
      expect(find.descendant(of: avatar, matching: find.byType(SvgPicture)), findsNWidgets(2));

      final posicoes = tester
          .widgetList<Positioned>(
            find.descendant(of: avatar, matching: find.byType(Positioned)),
          )
          .toList();
      // [0] base, [1] ROSTO (meio), [2] CABECA (topo).
      expect(posicoes[1].top, 85);
      expect(posicoes[1].left, 35);
      expect(posicoes[1].width, 130);
      expect(posicoes[1].height, 50);
      expect(posicoes[2].top, 0);
      expect(posicoes[2].left, 25);
      expect(posicoes[2].width, 150);
      expect(posicoes[2].height, 100);
    });
  });
}
