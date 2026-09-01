// Integração: exercita o caminho REAL de login do app (ApiService.login)
// contra a API Sacou rodando em http://localhost:8000.
//
// ATENÇÃO: exige a API no ar (venv/Scripts/python -m uvicorn app.main:app
// --host 0.0.0.0 --port 8000). Os logs `[API] ...` impressos aqui são os mesmos
// que o app exibe no console do Flutter durante o diagnóstico de login.
//
// Para rodar:
//   flutter test test/login_api_integration_test.dart
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_sacou/api_service.dart';

void main() {
  test('login com credenciais corretas retorna token e usuário', () async {
    final resultado =
        await ApiService.login('aluno@sacou.com', '123456');

    expect(resultado['access_token'], isA<String>());
    expect(resultado['access_token'], isNotEmpty);
    final usuario = resultado['usuario'] as Map<String, dynamic>;
    expect(usuario['email'], 'aluno@sacou.com');
    expect(usuario['perfil'], 'ALUNO');
  });

  test('login com senha errada lança 401 (E-mail ou senha incorretos)', () async {
    try {
      await ApiService.login('aluno@sacou.com', 'senhaErrada');
      fail('Deveria ter lançado exceção de 401');
    } catch (e) {
      expect(e.toString(), contains('E-mail ou senha incorretos'));
    }
  });

  test('login com e-mail inexistente lança 401', () async {
    try {
      await ApiService.login('naoexiste@email.com', '123456');
      fail('Deveria ter lançado exceção de 401');
    } catch (e) {
      expect(e.toString(), contains('E-mail ou senha incorretos'));
    }
  });
}
