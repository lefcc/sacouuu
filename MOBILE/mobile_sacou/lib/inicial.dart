import 'package:flutter/material.dart';
import 'package:mobile_sacou/cadastro.dart';
import 'package:mobile_sacou/menu_lateral.dart';

class Inicial extends StatelessWidget {
  const Inicial({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: MenuLateral(),
      appBar: AppBar(
        centerTitle: false,
        leading: Builder(
          builder: (BuildContext context) {
            return IconButton(
              icon: Image.asset('assets/images/iconeVerde.png'),
              padding: EdgeInsets.all(9.0),
              onPressed: () {
                Scaffold.of(context).openDrawer();
              },
            );
          },
        ),
        title: Text(
          "Página Inicial",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
      ),
      body: Center(
        child: SingleChildScrollView(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image.asset('assets/images/Logo.png', height: 100),
                SizedBox(height: 30),
                Image.asset('assets/images/Mascote.png', height: 90),
                SizedBox(height: 30),
                Text(
                  "O diferencial competitivo da sua escola. Educação financeira gamificada que prepara alunos para a tomada de decisão inteligente. Transforme a grade do Ensino Médio com um ecossistema prático que atrai pais exigentes e eleva o padrão da sua instituição.",
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18),
                ),
                SizedBox(height: 30),
                SizedBox(
                  height: 40,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => Cadastro()),
                      );
                    },
                    child: Text("Seja parceiro!"),
                  ),
                ),
                SizedBox(height: 80),
              ],
            ),
          ),
        ),
      ),
    );
  }
}