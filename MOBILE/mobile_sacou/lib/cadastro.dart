import 'package:flutter/material.dart';
import 'package:mobile_sacou/menu_lateral.dart';
import 'package:url_launcher/url_launcher.dart';

class Cadastro extends StatefulWidget {
  const Cadastro({super.key});

  @override
  State<Cadastro> createState() => _CadastroState();
}

class _CadastroState extends State<Cadastro> {
  TextEditingController nomeInstituicaoController = TextEditingController();
  TextEditingController bairroController = TextEditingController();
  TextEditingController cidadeController = TextEditingController();
  TextEditingController estadoController = TextEditingController();
  TextEditingController nomeContatoController = TextEditingController();
  TextEditingController telefoneController = TextEditingController();
  TextEditingController emailController = TextEditingController();

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
              child: Text("OK"),
            ),
          ],
        );
      },
    );
  }

  void enviarEmail() async {
    String emailDestino = 'sacoueducacao@gmail.com';
    String assunto = Uri.encodeComponent('Interesse de Parceria - Sacou');
    
    String corpoEmail = Uri.encodeComponent(
      'Dados da Instituição de Ensino:\nNome da Escola: ${nomeInstituicaoController.text}\nBairro: ${bairroController.text}\nCidade: ${cidadeController.text}\nEstado: ${estadoController.text}\n\nDados do Responsável:\nNome: ${nomeContatoController.text}\nTelefone: ${telefoneController.text}\nE-mail: ${emailController.text}'
    );

    Uri emailUri = Uri.parse('mailto:$emailDestino?subject=$assunto&body=$corpoEmail');

    if (await canLaunchUrl(emailUri)) {
      await launchUrl(emailUri);
    } else {
      mostrarAlerta("Erro", "Não foi possível abrir o e-mail.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true, // evita que o teclado cubra o botão Enviar
      drawer: MenuLateral(),
      appBar: AppBar(
        centerTitle: false,
        leading: Builder(
          builder: (BuildContext context) {
            return IconButton(
              icon: Image.asset('assets/images/iconeVerde.png'),
              padding: EdgeInsets.all(8.0),
              onPressed: () {
                Scaffold.of(context).openDrawer();
              },
            );
          },
        ),
        title: Text(
          "Seja um Parceiro",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
        child: Center(
          child: Column(
            children: [
              SizedBox(height: 30,),

              SizedBox(
                width: 350,
                child: TextField(
                  controller: nomeInstituicaoController,
                  decoration: InputDecoration(
                    labelText: "Nome da Instituição *",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(20))
                  ),
                ),
              ),
              SizedBox(height: 15,),

              SizedBox(
                width: 350,
                child: TextField(
                  controller: bairroController,
                  decoration: InputDecoration(
                    labelText: "Bairro",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(20))
                  ),
                ),
              ),
              SizedBox(height: 15,),

              SizedBox(
                width: 350,
                child: TextField(
                  controller: cidadeController,
                  decoration: InputDecoration(
                    labelText: "Cidade",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(20))
                  ),
                ),
              ),
              SizedBox(height: 15,),

              SizedBox(
                width: 350,
                child: TextField(
                  controller: estadoController,
                  decoration: InputDecoration(
                    labelText: "UF (Estado)",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(20))
                  ),
                ),
              ),
              SizedBox(height: 15,),

              SizedBox(
                width: 350,
                child: TextField(
                  controller: nomeContatoController,
                  decoration: InputDecoration(
                    labelText: "Nome do Responsável *", // Atualizado
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(20))
                  ),
                ),
              ),
              SizedBox(height: 15,),

              SizedBox(
                width: 350,
                child: TextField(
                  controller: telefoneController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: "Telefone de Contato *",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(20))
                  ),
                ),
              ),
              SizedBox(height: 15,),

              SizedBox(
                width: 350,
                child: TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: "E-mail *",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(20))
                  ),
                ),
              ),
              SizedBox(height: 30,),

              SizedBox(
                width: 300,
                child: ElevatedButton(
                  onPressed: () {
                    // Validação bloqueando caso o nome do contato também esteja vazio
                    if (nomeInstituicaoController.text == "" || nomeContatoController.text == "" || telefoneController.text == "" || emailController.text == "") {
                      mostrarAlerta("Campos Obrigatórios", "Os campos Nome da Instituição, Nome do Responsável, Telefone de Contato e E-mail são obrigatórios.");
                    } else {
                      enviarEmail();
                    }
                    
                    setState(() {});
                  },
                  child: Text("Enviar Interesse"),
                ),
              ),
              SizedBox(height: 40,),
            ],
          ),
        ),
        ),
      ),
    );
  }
}