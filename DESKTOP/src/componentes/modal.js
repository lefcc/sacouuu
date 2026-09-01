// ─────────────────────────────────────────────────────────────────────────────
// componentes/modal.js  —  Janela pop-up reutilizável para formulários
//
// Imagine o modal como uma "caixa" que aparece sobre a tela pedindo uma ação.
// Em vez de criar um modal diferente pra cada coisa (cadastrar escola, editar
// questão, confirmar saída...), temos UM só que se adapta ao que for preciso.
//
// Como usar em qualquer parte do projeto:
//
//   Modal.abrir({
//     titulo: 'Cadastrar Escola',
//     conteudo: '<div>...campos do formulário...</div>',
//     aoSalvar: () => { /* o que acontece ao clicar Salvar */ },
//     labelBotao: 'Salvar'  // opcional, padrão é 'Salvar'
//   });
//
//   Modal.fechar();  // fecha sem fazer nada
// ─────────────────────────────────────────────────────────────────────────────

const Modal = (() => {

  // Seleciona os elementos fixos do modal que existem no HTML
  const fundo     = document.querySelector('#modal-overlay');   // fundo escuro
  const tituloEl  = document.querySelector('#modal-title-text');
  const corpoEl   = document.querySelector('#modal-body');
  const btnSalvar = document.querySelector('#modal-save');
  const btnCancel = document.querySelector('#modal-cancel');
  const btnFechar = document.querySelector('#modal-close');     // o X do canto

  // Guarda a função de salvamento atual — muda toda vez que o modal abre
  let funcaoSalvar = null;

  /**
   * Abre o modal com o título, conteúdo e comportamento desejados.
   * @param {string}   titulo      - Texto do cabeçalho
   * @param {string}   conteudo    - HTML interno (formulário, mensagem, etc.)
   * @param {function} aoSalvar    - Função executada ao clicar no botão principal
   * @param {string}   labelBotao  - Texto do botão principal (padrão: 'Salvar')
   * @param {function} aoAbrir     - Callback após o conteúdo ser montado
   *                                 (ex.: para validar campos e habilitar/desabilitar o botão)
   */
  const abrir = ({ titulo, conteudo, aoSalvar, labelBotao = 'Salvar', aoAbrir,
                   // compatibilidade com nomes antigos do código
                   bodyHTML, onSave, saveLabel }) => {
    // Suporte aos nomes antigos para não quebrar escolas.js e outros
    const _conteudo  = conteudo  || bodyHTML  || '';
    const _aoSalvar  = aoSalvar  || onSave    || null;
    const _label     = labelBotao || saveLabel || 'Salvar';

    tituloEl.textContent   = titulo;
    corpoEl.innerHTML      = _conteudo;
    btnSalvar.textContent  = _label;
    funcaoSalvar           = _aoSalvar;
    // Sempre volta o botão ao estado habilitado ao abrir o modal
    btnSalvar.disabled     = false;

    // Adiciona a classe .open → o CSS cuida da animação de entrada
    fundo.classList.add('open');

    // Callback após montar o conteúdo (validação em tempo real, etc.)
    if (typeof aoAbrir === 'function') aoAbrir(corpoEl);

    // Depois da animação (220ms), coloca o cursor no primeiro campo do formulário
    setTimeout(() => {
      const primeiroCampo = corpoEl.querySelector('input, textarea, select');
      if (primeiroCampo) primeiroCampo.focus();
    }, 220);
  };

  /**
   * Fecha o modal sem executar nenhuma ação.
   * Remove a classe .open → CSS anima a saída.
   */
  const fechar = () => {
    fundo.classList.remove('open');
    funcaoSalvar = null;
  };

  // Clique no botão "Salvar" → executa a função configurada no abrir()
  btnSalvar.addEventListener('click', () => {
    if (funcaoSalvar) funcaoSalvar();
  });

  // Cancelar ou X → fecha sem fazer nada
  btnCancel.addEventListener('click', fechar);
  btnFechar.addEventListener('click', fechar);

  // Clique fora da caixa branca (no fundo escuro) → também fecha
  fundo.addEventListener('click', (e) => {
    if (e.target === fundo) fechar();
  });

  // Tecla Escape → fecha (comportamento padrão esperado pelo usuário)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fechar();
  });

  // Expõe os dois métodos para o resto do app usar
  // open/close são mantidos para compatibilidade com código existente
  return {
    abrir,
    fechar,
    open:  (opts) => abrir(opts),
    close: ()     => fechar(),
  };

})();
