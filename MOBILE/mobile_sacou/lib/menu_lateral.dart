import 'package:flutter/material.dart';
import 'package:mobile_sacou/inicial.dart';
import 'package:mobile_sacou/cadastro.dart';
import 'package:mobile_sacou/login.dart';
import 'package:mobile_sacou/classe_usuario.dart';
import 'package:mobile_sacou/boas_vindas.dart';
import 'package:mobile_sacou/perfil_inicial.dart';
import 'package:mobile_sacou/trilha_ensino.dart';
import 'package:mobile_sacou/loja.dart';

class MenuLateral extends StatelessWidget {
  const MenuLateral({super.key});

  // Função auxiliar para aplicar o estilo padrão
  Widget _criarItem(BuildContext context, String titulo, IconData? icone, Widget tela) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final corItem = isDark ? const Color(0xFFEDE8FF) : const Color(0xFF5F4C9A);
    return ListTile(
      leading: icone != null ? Icon(icone, color: corItem) : null,
      title: Text(
        titulo,
        style: TextStyle(
          color: corItem,
          fontWeight: FontWeight.bold,
        ),
      ),
      onTap: () {
        Navigator.pop(context);
        Navigator.push(context, MaterialPageRoute(builder: (context) => tela));
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final corDrawer = isDark ? const Color(0xFF1E1A2E) : const Color(0xFFF7F6FB);
    final corDrawerHeader = isDark ? const Color(0xFF261F3A) : const Color(0xFF5F4C9A);

    return Drawer(
      backgroundColor: corDrawer,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          DrawerHeader(
            decoration: BoxDecoration(color: corDrawerHeader),
            child: InkWell(
              onTap: () {
                Navigator.pop(context);
                Navigator.pushReplacement(context, MaterialPageRoute(builder: (context) => usuarioLogado ? const BoasVindas() : const Inicial()));
              },
              child: Column(
                children: [
                  Image.asset("assets/images/LogoPadrao.png", height: 120, width: 120),
                ],
              ),
            ),
          ),

          // MENU VISITANTES (deslogado) — apenas Início, Cadastro e Login
          if (!usuarioLogado) ...[
            _criarItem(context, 'Início', Icons.home, const Inicial()),
            _criarItem(context, 'Cadastro', Icons.person_add, const Cadastro()),
            _criarItem(context, 'Login', Icons.login, const Login()),
          ],

          // MENU ALUNOS LOGADOS — apenas Início, Trilhas, Loja, Avatar e Sair
          if (usuarioLogado) ...[
            _criarItem(context, 'Início', Icons.home, const BoasVindas()),
            _criarItem(context, 'Trilhas', Icons.menu_book, TrilhaEnsino()),
            _criarItem(context, 'Loja', Icons.store, const Loja()),
            _criarItem(context, 'Avatar', Icons.face, const PerfilInicial()),

            const Divider(),

            ListTile(
              leading: const Icon(Icons.logout, color: Colors.redAccent),
              title: const Text(
                'Sair',
                style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
              ),
              onTap: () {
                // Limpa 100% do estado da sessão (JWT + dados) antes de sair,
                // para não vazar moedas/nome/token de um usuário para outro.
                tokenGlobal = null;
                emailGlobal = '';
                nomeGlobal = '';
                alunoIdGlobal = null;
                moedasGlobais = 0;
                nivelAtualGlobal = 1;
                aulasConcluidasGlobal = [];
                avatarConfiguradoGlobal = false;
                avatarIdGlobal = null;
                itensEquipadosGlobal.value = [];
                usuarioLogado = false;
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (context) => const Inicial()),
                  (r) => false,
                );
              },
            ),
          ]
        ]
      ),
    );
  }
}
