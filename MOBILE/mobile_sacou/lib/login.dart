import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_sacou/api_service.dart';
import 'package:mobile_sacou/classe_usuario.dart';
import 'package:mobile_sacou/menu_lateral.dart';
import 'package:mobile_sacou/boas_vindas.dart';
import 'package:mobile_sacou/perfil_inicial.dart';

class Login extends StatefulWidget {
  const Login({super.key});

  @override
  State<Login> createState() => _LoginState();
}

class _LoginState extends State<Login> {
  TextEditingController emailController = TextEditingController();
  TextEditingController senhaController = TextEditingController();
  GlobalKey<FormState> cadastrokey = GlobalKey<FormState>();
  bool _carregando = false;

  // O alerta agora só existe para informar erros.
  void mostrarAlerta(String titulo, String mensagem) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(titulo),
          content: Text(mensagem),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text("OK"),
            ),
          ],
        );
      },
    );
  }

  Future<void> _entrar() async {
    if (!cadastrokey.currentState!.validate()) return;

    setState(() => _carregando = true);
    try {
      final resultado = await ApiService.login(
        emailController.text.trim(),
        senhaController.text,
      );

      final usuario = resultado['usuario'] as Map<String, dynamic>;
      tokenGlobal = resultado['access_token'] as String?;
      emailGlobal = usuario['email'] as String?;
      nomeGlobal = usuario['nome_completo'] as String?;
      alunoIdGlobal = usuario['id_usuario'] as int?;

      if (kDebugMode) {
        // Só em modo debug: NUNCA logar o payload completo do login em release
        // (contém o access_token).
        debugPrint('[MOEDAS] JSON completo do LOGIN: $resultado');
        debugPrint(
          '[MOEDAS] campo do login (usuario.moedas_total): ${usuario['moedas_total']}',
        );
      }

      if (!mounted) return;

      // 1. Ativa a sessão globalmente
      usuarioLogado = true;

      // 2. Carrega o progresso do aluno vindo da API
      if (alunoIdGlobal != null && tokenGlobal != null) {
        try {
          final progresso = await ApiService.obterProgresso(
            tokenGlobal!,
            alunoIdGlobal!,
          );
          aplicarProgressoDaApi(progresso);
          debugPrint('[MOEDAS] moedasGlobais após login: $moedasGlobais');
        } catch (e) {
          debugPrint('[MOEDAS] falha ao carregar progresso no login: $e');
        }

        try {
          final perfil = await ApiService.obterPerfil(tokenGlobal!);
          avatarConfiguradoGlobal = perfil['avatar_configurado'] ?? false;
          avatarIdGlobal = perfil['id_avatar'] as int?;
        } catch (_) {}
      }

      if (!mounted) return;

      // 3. Navegação: avatar não configurado → tela de perfil; senão → boas-vindas
      final tela = avatarConfiguradoGlobal ? const BoasVindas() : const PerfilInicial();
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => tela),
        (Route<dynamic> route) => false,
      );
    } catch (e) {
      debugPrint('[LOGIN] Falha ao entrar: $e');
      if (mounted) {
        mostrarAlerta("Ops!", "Deu ruim pra entrar. Verifica teu e-mail e senha, e se a API ta rodando.");
      }
    } finally {
      if (mounted) setState(() => _carregando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true, // evita que o teclado cubra o botão Entrar
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
        title: const Text(
          "Acesso",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
      ),
      body: SafeArea(
        child: Form(
        key: cadastrokey,
        child: Center(
          child: SingleChildScrollView(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image.asset(
                  'assets/images/Piscando-removebg.png',
                  height: 150,
                ),
                const SizedBox(height: 20),
                const Text("Login", style: TextStyle(fontFamily: "pacifico", fontSize: 22)),
                const SizedBox(height: 40),
                SizedBox(
                  width: 300,
                  child: TextFormField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    inputFormatters: <TextInputFormatter>[
                      FilteringTextInputFormatter.singleLineFormatter,
                    ],
                    decoration: const InputDecoration(labelText: "E-mail"),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return "O campo E-mail é obrigatório";
                      }
                      if (!value.contains('@')) {
                        return "Informe um e-mail válido";
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: 300,
                  child: TextFormField(
                    controller: senhaController,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: "Senha"),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return "O campo Senha é obrigatório";
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(height: 40),
                SizedBox(
                  width: 300,
                  child: ElevatedButton(
                    onPressed: _carregando ? null : _entrar,
                    child: _carregando
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text("Entrar"),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      ),
    );
  }
}
