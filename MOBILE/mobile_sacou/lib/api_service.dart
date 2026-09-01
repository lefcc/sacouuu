// lib/api_service.dart
//
// Cliente HTTP da API Sacou (FastAPI).
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiService {
  // URL da API via --dart-define (ex.: flutter run --dart-define=API_URL=http://localhost:8000).
  // ⚠️ DEFAULT PARA DEV WEB (localhost): http://localhost:8000.
  // ⚠️ SE O BUILD FOR PARA EMULADOR ANDROID, ajuste a variável para
  //    http://10.0.2.2:8000 (10.0.2.2 = localhost visto de dentro do emulador).
  // Em dispositivo físico, use o IP da máquina na rede (ex.: http://192.168.x.x:8000).
  static const String baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:8000',
  );

  /// Timeout de conexão: evita travar por minutos se a API estiver fora.
  static const Duration _timeout = Duration(seconds: 15);

  /// Oculta segredos (senha, token) nos logs de diagnóstico.
  static String _mascarar(Object? valor) {
    if (valor is Map) {
      final copia = <String, Object?>{};
      valor.forEach((k, v) {
        if (k == 'senha' || k == 'password' || k == 'nova_senha') {
          copia[k.toString()] = '***';
        } else {
          copia[k.toString()] = v;
        }
      });
      return copia.toString();
    }
    return valor.toString();
  }

  static Map<String, String> _cabecalhos([String? token]) => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  static Future<Map<String, dynamic>> _post(
    String rota,
    Map<String, dynamic> corpo, [
    String? token,
  ]) async {
    final url = '$baseUrl$rota';
    if (kDebugMode) debugPrint('[API] POST $url corpo=${_mascarar(corpo)}');
    final resposta = await http
        .post(
          Uri.parse(url),
          headers: _cabecalhos(token),
          body: jsonEncode(corpo),
        )
        .timeout(_timeout);
    return _tratarResposta(resposta);
  }

  static Future<Map<String, dynamic>> _put(
    String rota,
    Map<String, dynamic> corpo, [
    String? token,
  ]) async {
    final url = '$baseUrl$rota';
    if (kDebugMode) debugPrint('[API] PUT $url corpo=${_mascarar(corpo)}');
    final resposta = await http
        .put(
          Uri.parse(url),
          headers: _cabecalhos(token),
          body: jsonEncode(corpo),
        )
        .timeout(_timeout);
    return _tratarResposta(resposta);
  }

  static Future<Map<String, dynamic>> _get(String rota, String token) async {
    final url = '$baseUrl$rota';
    if (kDebugMode) debugPrint('[API] GET $url');
    final resposta = await http
        .get(
          Uri.parse(url),
          headers: _cabecalhos(token),
        )
        .timeout(_timeout);
    return _tratarResposta(resposta);
  }

  static Future<Map<String, dynamic>> _tratarResposta(http.Response resposta) async {
    final corpo = resposta.body.isEmpty ? {} : jsonDecode(resposta.body);
    final urlLog = resposta.request?.url.toString() ?? '(sem url)';
    if (resposta.statusCode >= 200 && resposta.statusCode < 300) {
      if (kDebugMode) debugPrint('[API] OK ${resposta.statusCode} $urlLog');
      return corpo is Map<String, dynamic> ? corpo : {'dados': corpo};
    }
    // Corpo completo só em debug (pode conter dados sensíveis).
    if (kDebugMode) {
      debugPrint('[API] ERRO ${resposta.statusCode} $urlLog corpo=${resposta.body}');
    }
    final mensagem = corpo is Map && corpo['detail'] != null
        ? corpo['detail'].toString()
        : 'Erro ${resposta.statusCode} ao falar com o servidor.';
    throw Exception(mensagem);
  }

  /// POST /auth/login — retorna token e dados do usuário.
  static Future<Map<String, dynamic>> login(String email, String senha) {
    return _post('/auth/login', {'email': email, 'senha': senha});
  }

  /// GET /trilhas — lista de trilhas com suas lições aninhadas.
  static Future<List<dynamic>> listarTrilhas(String token) async {
    final dados = await _get('/trilhas', token);
    if (dados.containsKey('dados')) return dados['dados'] as List;
    return [];
  }

  /// GET /licoes — lista de todas as aulas (conteúdo + quiz).
  static Future<List<dynamic>> listarLicoes(String token) async {
    final dados = await _get('/licoes', token);
    if (dados.containsKey('dados')) return dados['dados'] as List;
    return [];
  }

  /// GET /licoes/{id} — uma aula específica pelo id real (conteúdo + quiz).
  static Future<Map<String, dynamic>> listarLicao(String token, int licaoId) {
    return _get('/licoes/$licaoId', token);
  }

  /// GET /progresso/alunos/{id} — progresso, XP e moedas do aluno.
  static Future<Map<String, dynamic>> obterProgresso(
    String token,
    int alunoId,
  ) {
    return _get('/progresso/alunos/$alunoId', token);
  }

  /// POST /progresso/alunos/{id}/licoes/{licaoId} — envia as RESPOSTAS
  /// selecionadas; a correção (acertos) e a recompensa são feitas no servidor.
  static Future<Map<String, dynamic>> registrarProgresso(
    String token,
    int alunoId,
    int licaoId,
    List<int> respostasSelecionadas,
  ) {
    return _post(
      '/progresso/alunos/$alunoId/licoes/$licaoId',
      {
        'id_licao': licaoId,
        'respostas_selecionadas': respostasSelecionadas,
      },
      token,
    );
  }

  // ── Perfil / Avatares ──

  static Future<List<dynamic>> listarAvatares() async {
    final resposta = await http.get(
      Uri.parse('$baseUrl/perfil/avatares'),
      headers: _cabecalhos(),
    );
    final dados = jsonDecode(resposta.body);
    if (resposta.statusCode >= 200 && resposta.statusCode < 300) {
      return dados is List ? dados : [];
    }
    return [];
  }

  static Future<Map<String, dynamic>> obterPerfil(String token) {
    return _get('/perfil/me', token);
  }

  static Future<Map<String, dynamic>> selecionarAvatar(
    String token,
    int idAvatar,
  ) {
    return _post('/perfil/selecionar-avatar', {'id_avatar': idAvatar}, token);
  }

  // ── Loja ──

  static Future<List<dynamic>> listarItensLoja() async {
    final resposta = await http.get(
      Uri.parse('$baseUrl/loja/itens'),
      headers: _cabecalhos(),
    );
    final dados = jsonDecode(resposta.body);
    if (resposta.statusCode >= 200 && resposta.statusCode < 300) {
      return dados is List ? dados : [];
    }
    return [];
  }

  static Future<List<dynamic>> meusItensLoja(String token) async {
    final dados = await _get('/loja/meus-itens', token);
    if (dados.containsKey('dados')) return dados['dados'] as List;
    return [];
  }

  static Future<Map<String, dynamic>> comprarItemLoja(
    String token,
    int idItem,
  ) {
    return _post('/loja/comprar', {'id_item': idItem}, token);
  }

  static Future<Map<String, dynamic>> equiparItemLoja(
    String token,
    int idItem,
    bool equipado,
  ) {
    return _put('/loja/equipar/$idItem', {'equipado': equipado}, token);
  }
}
