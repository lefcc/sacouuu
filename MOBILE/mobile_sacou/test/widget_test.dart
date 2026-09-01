// Smoke test do app Sacou
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_sacou/main.dart';

void main() {
  testWidgets('App inicia na Página Inicial', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());
    await tester.pump();

    // Imagens de assets não carregam no ambiente de teste; ignora o aviso.
    tester.takeException();

    expect(find.text('Página Inicial'), findsOneWidget);
    expect(find.text('Seja parceiro!'), findsOneWidget);
  });
}
