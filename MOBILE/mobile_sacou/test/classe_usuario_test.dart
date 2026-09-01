// Testes do estado global de progresso (classe_usuario.dart).
//
// Objetivo: garantir que aulasConcluidasGlobal NÃO tem tamanho fixo de 12
// e cresce dinamicamente conforme o total REAL de aulas do banco (ex.: 13),
// sem lançar "Index out of range".
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_sacou/classe_usuario.dart';

void main() {
  setUp(() {
    aulasConcluidasGlobal = [];
  });

  test('inicia vazio (fallback seguro, sem número fixo)', () {
    expect(aulasConcluidasGlobal, isEmpty);
  });

  test('redimensiona para o total real de aulas (13)', () {
    redimensionarAulasConcluidas(13);
    expect(aulasConcluidasGlobal.length, 13);
    expect(aulasConcluidasGlobal.every((c) => !c), isTrue);
  });

  test('redimensiona pelo total de lições carregadas da API', () {
    final licoes = <dynamic>[
      for (int i = 1; i <= 13; i++) {'id_licao': i},
    ];
    redimensionarPeloTotalDeAulas(licoes);
    expect(aulasConcluidasGlobal.length, 13);
  });

  test('aplicarProgressoDaApi cresce a lista pelo maior id concluído (13)', () {
    aplicarProgressoDaApi({
      'moedas_total': 120,
      'nivel_atual': 2,
      'licoes_concluidas': [1, 2, 3, 4, 5, 6, 7, 8, 13],
    });

    expect(aulasConcluidasGlobal.length, 13);
    // Aulas 1..8 concluídas.
    for (int i = 0; i < 8; i++) {
      expect(aulasConcluidasGlobal[i], isTrue);
    }
    // Aula 13 concluída (índice 12) — sem range error.
    expect(aulasConcluidasGlobal[12], isTrue);
  });

  test('marcar a Aula 13 como concluída não estoura o array', () {
    redimensionarAulasConcluidas(13);
    aulasConcluidasGlobal[12] = true; // id 13 -> índice 12
    expect(aulasConcluidasGlobal[12], isTrue);
    expect(aulasConcluidasGlobal.length, 13);
  });

  test('preserva conclusões existentes ao crescer (retrocompatibilidade)', () {
    redimensionarAulasConcluidas(12);
    aulasConcluidasGlobal[0] = true; // Aula 1 feita
    redimensionarAulasConcluidas(13); // banco ganhou uma 13ª aula

    expect(aulasConcluidasGlobal.length, 13);
    expect(aulasConcluidasGlobal[0], isTrue); // Aula 1 continua feita
    expect(aulasConcluidasGlobal[12], isFalse); // Aula 13 nova, não feita
  });
}
