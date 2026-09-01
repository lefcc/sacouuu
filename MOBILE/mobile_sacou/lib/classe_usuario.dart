// lib/classe_usuario.dart
import 'package:flutter/foundation.dart';

class Usuario {
  String _nome;
  String _senha;

  String get nome => _nome;
  set nome(value) => _nome = value;

  String get senha => _senha;
  set senha(value) => _senha = value;

  Usuario(this._nome, this._senha);
}

bool usuarioLogado = false;

// Sessão autenticada vinda da API (FastAPI)
String? tokenGlobal;
int? alunoIdGlobal;
String? emailGlobal;
String? nomeGlobal;

int aulaAtualGlobal = 0;
int moedasGlobais = 0;
int nivelAtualGlobal = 1;

// Perfil do aluno
bool avatarConfiguradoGlobal = false;
int? avatarIdGlobal;

/// Acessórios equipados do aluno (SVGs da loja) — reativo: o widget
/// AvatarEquipado se atualiza automaticamente quando este notifier muda.
final ValueNotifier<List<Map<String, dynamic>>> itensEquipadosGlobal =
    ValueNotifier<List<Map<String, dynamic>>>([]);

List<bool> aulasConcluidasGlobal = [];

/// Ajusta o tamanho da lista de progresso para o total REAL de aulas do banco.
/// Nunca usa um número fixo: preserva as conclusões existentes e completa com
/// `false` para as aulas novas.
void redimensionarAulasConcluidas(int totalAulas) {
  if (totalAulas <= 0) return;
  final atual = aulasConcluidasGlobal;
  if (atual.length == totalAulas) return;
  aulasConcluidasGlobal = List<bool>.generate(
    totalAulas,
    (i) => i < atual.length ? atual[i] : false,
  );
}

/// Redimensiona o progresso pelo MAIOR id de aula carregado da API
/// (ex.: a lista de GET /licoes ou as lições aninhadas de GET /trilhas).
void redimensionarPeloTotalDeAulas(List<dynamic> licoes) {
  int maiorId = 0;
  for (final l in licoes) {
    if (l is! Map) continue;
    final id = l['id_licao'];
    if (id is int && id > maiorId) maiorId = id;
  }
  if (maiorId > 0) redimensionarAulasConcluidas(maiorId);
}

/// Aplica o progresso retornado pela API no estado global.
void aplicarProgressoDaApi(Map<String, dynamic> progresso) {
  if (kDebugMode) {
    // Só em debug: evita logar o payload completo em release.
    debugPrint('[MOEDAS] JSON completo do progresso: $progresso');
  }
  final campoMoedas = progresso['moedas_total'];
  debugPrint('[MOEDAS] campo lido (moedas_total): $campoMoedas');
  if (progresso.containsKey('moedas_total')) {
    moedasGlobais = progresso['moedas_total'] as int? ?? moedasGlobais;
  }
  debugPrint('[MOEDAS] moedasGlobais após aplicar: $moedasGlobais');
  if (progresso.containsKey('nivel_atual')) {
    nivelAtualGlobal = progresso['nivel_atual'] as int? ?? nivelAtualGlobal;
  }
  final concluidas = progresso['licoes_concluidas'];
  if (concluidas is List) {
    final ids = concluidas.whereType<int>().toList();
    // Cresce a lista para caber o maior id concluído (nunca um número fixo).
    final maiorId = ids.fold(0, (int maxId, int id) => id > maxId ? id : maxId);
    if (maiorId > aulasConcluidasGlobal.length) {
      redimensionarAulasConcluidas(maiorId);
    }
    for (final id in ids) {
      if (id >= 1 && id <= aulasConcluidasGlobal.length) {
        aulasConcluidasGlobal[id - 1] = true;
      }
    }
  }
}
