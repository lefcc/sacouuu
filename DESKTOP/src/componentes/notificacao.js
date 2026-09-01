/**
 * componentes/notificacao.js  —  Sistema de mensagens rápidas (Toast)
 *
 * Um "toast" é aquela mensagenzinha que aparece rapidinho na tela
 * tipo "Salvo com sucesso!" e some sozinha depois de alguns segundos.
 *
 * Como usar em qualquer parte do projeto:
 *   Notificacao.sucesso('Escola cadastrada!')  → mensagem verde
 *   Notificacao.erro('Preencha os campos!')    → mensagem vermelha
 *   Notificacao.info('Filtro aplicado')        → mensagem neutra
 */

const Notificacao = (() => {

  // Pega o elemento HTML da notificação (fica lá no index.html esperando)
  const caixinha = document.getElementById('toast');

  // Guarda o timer para poder cancelar se uma nova mensagem aparecer antes
  let timerAtual = null;

  /**
   * Mostra a notificação na tela.
   * @param {string} mensagem - O texto que vai aparecer
   * @param {string} tipo - '' para neutro, 'green' para sucesso, 'red' para erro
   */
  const mostrar = (mensagem, tipo = '') => {
    // Cancela qualquer timer anterior para não desaparecer cedo demais
    clearTimeout(timerAtual);

    // Coloca o texto e adiciona as classes CSS de animação
    caixinha.textContent = mensagem;
    caixinha.className = 'toast show' + (tipo ? ' toast-' + tipo : '');

    // Depois de 2,8 segundos, remove a classe 'show' → notificação some
    timerAtual = setTimeout(() => {
      caixinha.className = 'toast';
    }, 2800);
  };

  // Atalhos para não precisar lembrar os tipos sempre
  return {
    mostrar,
    sucesso: (msg) => mostrar(msg, 'green'),
    erro:    (msg) => mostrar(msg, 'red'),
    info:    (msg) => mostrar(msg, ''),
  };

})();

// Mantém o nome antigo (Toast) funcionando para não quebrar código existente
// Isso se chama "alias" - dois nomes para o mesmo objeto
const Toast = Notificacao;
