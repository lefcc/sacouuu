// ─────────────────────────────────────────────────────────────────────────────
// views/escolas.js  —  Tela de Gestão de Escolas (CRUD completo)
//
// CRUD = Create (Criar), Read (Ler), Update (Editar), Delete (Excluir)
// São as 4 operações básicas de qualquer sistema de cadastro.
//
// Fluxo geral:
//   init() → carrega lista do JSON → renderizarTabela() → ouvir eventos
//   Clicar "+ Cadastrar" → abrirModalCadastro() → salvar → renderizarTabela()
//   Clicar "Editar"  → abrirModalEdicao(id) → salvar → renderizarTabela()
//   Clicar "Excluir" → confirmarExclusao(id) → remover → renderizarTabela()
// ─────────────────────────────────────────────────────────────────────────────

const EscolasView = (() => {

  // Guarda a lista completa de escolas em memória
  // (evita buscar do JSON toda vez que filtrar ou paginar)
  let todasEscolas = [];

  // Indica se a tela está mostrando as escolas arquivadas (soft delete)
  let modoArquivadas = false;

  // IDs das escolas com a linha expandida (acordeão de coordenadores)
  const linhasExpandidas = new Set();

  // Configurações de paginação — quantas linhas por página e qual página está ativa
  const LINHAS_POR_PAGINA = 8;
  let paginaAtual   = 1;
  let textoBusca    = '';  // texto digitado no campo de busca

  // ── INICIALIZAÇÃO ─────────────────────────────────────────────────────────

  /**
   * Busca as escolas da API (ativas ou arquivadas) e repinta a tela.
   */
  const carregarEscolas = async () => {
    todasEscolas = await window.electronAPI.getSchools(modoArquivadas);
    paginaAtual  = 1;

    renderizarTabela();          // monta a tabela HTML com os dados
    atualizarContador();         // atualiza o número no badge da sidebar
  };

  /**
   * Ponto de entrada: carrega dados e prepara a tela.
   * Chamada uma vez pelo app.js quando o app inicia.
   */
  const init = async () => {
    await carregarEscolas();
    registrarEventos();          // liga os botões e campos a funções
  };

  /**
   * Alterna entre "Escolas Ativas" e "Escolas Arquivadas".
   * Recarrega a lista com o parâmetro ?arquivado=true/false.
   */
  const alternarModoArquivadas = async () => {
    modoArquivadas = !modoArquivadas;
    const btn = document.getElementById('btn-toggle-arquivadas');
    if (btn) {
      btn.textContent = modoArquivadas ? '👁️ Ver Ativas' : '🗄️ Ver Arquivadas';
      btn.classList.toggle('btn-active', modoArquivadas);
    }
    await carregarEscolas();
  };

  // Exposto para o app.js poder abrir o modal de cadastro via atalho de menu
  const abrirModalCadastro = () => abrirModalAdicionar();

  // ── FILTRO E BUSCA ────────────────────────────────────────────────────────

  /**
   * Retorna a lista de escolas filtrada pelo texto de busca atual.
   * Filtra por nome, código e coordenador ao mesmo tempo.
   */
  const escolasFiltradas = () => {
    const busca = textoBusca.toLowerCase();
    return todasEscolas.filter(escola =>
      escola.name.toLowerCase().includes(busca)        ||
      escola.code.toLowerCase().includes(busca)        ||
      (escola.cnpj || '').replace(/\D/g, '').includes(busca.replace(/\D/g, ''))
    );
  };

  /**
   * Filtro robusto aplicado DIRETAMENTE nas linhas renderizadas da tabela
   * (por nome, case-insensitive). Garante o funcionamento da busca mesmo que
   * o estado interno esteja defasado — mostra apenas as escolas cujo nome
   * contém o termo digitado.
   *
   * Se o valor do campo de busca divergir do estado (textoBusca), sincroniza
   * o estado e RESETA a paginação para a 1ª página. Assim a busca nunca deixa
   * o usuário preso em uma página vazia ao procurar uma escola que está nas
   * páginas seguintes (mesmo quando o evento 'input' não dispara, ex.:
   * preenchimento automático do campo).
   */
  const aplicarFiltroNomeNaTabela = () => {
    const input = document.getElementById('search-schools');
    const termo = (input?.value || '').toLowerCase().trim();

    // SEMPRE que o termo de busca muda, volta para a página 1 e re-renderiza.
    if (termo !== textoBusca.toLowerCase().trim()) {
      textoBusca  = input.value;
      paginaAtual = 1;
      renderizarTabela();
      return;
    }

    document.querySelectorAll('#schools-tbody tr.escola-row').forEach(tr => {
      const nome = tr.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
      tr.style.display = nome.includes(termo) ? '' : 'none';
    });
  };

  // ── RENDERIZAÇÃO DA TABELA ────────────────────────────────────────────────

  /**
   * Monta a tabela HTML com as escolas da página atual.
   * É chamada sempre que algo muda: busca, paginação, CRUD.
   */
  const renderizarTabela = () => {
    const corpo = document.getElementById('schools-tbody');
    const dados = escolasFiltradas();     // lista já filtrada pela busca
    const total = dados.length;

    // Calcula o "fatiamento" da página: ex. página 2 com 8 por página = índices 8 a 15
    const inicio = (paginaAtual - 1) * LINHAS_POR_PAGINA;
    const pagina = dados.slice(inicio, inicio + LINHAS_POR_PAGINA);

    // Monta uma linha <tr> para cada escola da página
    corpo.innerHTML = pagina.map(escola => {
      const arquivada = !!escola.arquivada;
      const statusLabel = arquivada ? 'Arquivada' : (escola.status === 'active' ? 'Ativa' : 'Inativa');
      const expandida = linhasExpandidas.has(escola.id);
      return `
      <tr class="escola-row" data-id="${escola.id}">
        <td>
          <button class="btn-expand ${expandida ? 'open' : ''}" data-id="${escola.id}" title="Coordenadores da escola">${expandida ? '▾' : '▸'}</button>
        </td>
        <td style="white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis" title="${escapeHTML(escola.name)}"><strong>${escapeHTML(escola.name)}</strong></td>
        <td style="color:var(--text-secondary);font-size:12px;font-family:monospace">${escapeHTML(escola.cnpj || '—')}</td>
        <td style="color:var(--text-secondary);font-size:12px;font-family:monospace">${escapeHTML(escola.code)}</td>
        <td>
          <div class="coord-prof-cell">
            <span class="coord-prof-num">${escola.totalCoordenadores ?? 0} <span class="coord-prof-rotulo">Coord</span></span>
            <span class="coord-prof-num">${escola.totalProfessores ?? 0} <span class="coord-prof-rotulo">Prof</span></span>
          </div>
        </td>
        <td><strong>${escola.students}</strong></td>
        <td>
          <span class="badge ${arquivada || escola.status !== 'active' ? 'inactive' : 'active'}">
            ${statusLabel}
          </span>
        </td>
        <td>
          <div class="actions-cell">
            ${arquivada
              ? `<button class="action-btn btn-reativar" data-id="${escola.id}">↩️ Desarquivar</button>`
              : `<button class="action-btn btn-edit"          data-id="${escola.id}">✏️ Editar</button>
                 <button class="action-btn danger btn-delete" data-id="${escola.id}">🗑️ Arquivar</button>`}
            <button class="action-btn btn-financeiro" data-id="${escola.id}" data-name="${escapeHTML(escola.name)}" title="Gestão financeira da escola">💰 Financeiro</button>
          </div>
        </td>
      </tr>
      ${expandida ? `
      <tr class="escola-expanded-row" data-id="${escola.id}">
        <td colspan="8">
          <div class="coord-wrap">
            <!-- Seção 1: Coordenadores -->
            <div class="membros-secao">
              <div class="coord-head">
                <span class="coord-title">👥 Coordenadores</span>
                <button class="btn-add btn-add-membro" data-escola="${escola.id}" data-perfil="ADMIN_ESCOLA" style="padding:5px 12px;font-size:12px">+ Adicionar Coordenador</button>
              </div>
              <div id="coord-conteudo-${escola.id}">
                <p style="color:var(--text-secondary);font-size:12px;padding:8px 0">Carregando coordenadores...</p>
              </div>
            </div>
            <!-- Seção 2: Professores -->
            <div class="membros-secao">
              <div class="coord-head">
                <span class="coord-title">👨‍🏫 Professores</span>
                <button class="btn-add btn-add-membro" data-escola="${escola.id}" data-perfil="VISUALIZADOR_ESCOLA" style="padding:5px 12px;font-size:12px">+ Adicionar Professor</button>
              </div>
              <div id="prof-conteudo-${escola.id}">
                <p style="color:var(--text-secondary);font-size:12px;padding:8px 0">Carregando professores...</p>
              </div>
            </div>
          </div>
        </td>
      </tr>` : ''}
    `;
    }).join('');

    // Carrega coordenadores e professores das linhas expandidas (refetch a cada render)
    linhasExpandidas.forEach(id => {
      const coord = document.getElementById(`coord-conteudo-${id}`);
      const prof  = document.getElementById(`prof-conteudo-${id}`);
      if (coord || prof) carregarMembros(id);
    });

    // Atualiza o rodapé: "Exibindo 8 de 24 resultados"
    document.getElementById('schools-count').textContent =
      `Exibindo ${Math.min(pagina.length, LINHAS_POR_PAGINA)} de ${total} resultado${total !== 1 ? 's' : ''}`;

    renderizarPaginacao(total);

    // Reaplica o filtro de nome após qualquer re-render (busca, paginação, CRUD).
    aplicarFiltroNomeNaTabela();
  };

  /**
   * Monta os botões de paginação abaixo da tabela.
   * @param {number} total - Total de registros filtrados
   */
  const renderizarPaginacao = (total) => {
    const totalPaginas = Math.ceil(total / LINHAS_POR_PAGINA) || 1;
    const paginacao    = document.getElementById('pagination-schools');

    // Botão anterior, números de página, botão próximo
    paginacao.innerHTML = `
      <button class="page-btn" id="pag-anterior">‹</button>
      ${Array.from({ length: totalPaginas }, (_, i) =>
        `<button class="page-btn ${i + 1 === paginaAtual ? 'active' : ''}" data-pagina="${i + 1}">${i + 1}</button>`
      ).join('')}
      <button class="page-btn" id="pag-proximo">›</button>
    `;

    // Navegar para a página anterior
    paginacao.querySelector('#pag-anterior').addEventListener('click', () => {
      if (paginaAtual > 1) { paginaAtual--; renderizarTabela(); }
    });

    // Navegar para a próxima página
    paginacao.querySelector('#pag-proximo').addEventListener('click', () => {
      if (paginaAtual < totalPaginas) { paginaAtual++; renderizarTabela(); }
    });

    // Clicar em um número de página específico
    paginacao.querySelectorAll('[data-pagina]').forEach(btn =>
      btn.addEventListener('click', () => {
        paginaAtual = Number(btn.dataset.pagina);
        renderizarTabela();
      })
    );
  };

  /**
   * Atualiza o número no badge roxo da sidebar ao lado de "Gestão de Escolas".
   */
  const atualizarContador = () => {
    const badge = document.getElementById('badge-schools');
    if (badge) badge.textContent = todasEscolas.length;
  };

  // ── REGISTRO DE EVENTOS ───────────────────────────────────────────────────

  /**
   * Liga todos os elementos interativos às suas funções.
   * Chamado uma vez no init().
   */
  const registrarEventos = () => {
    // Campo de busca: filtra à medida que o usuário digita
    document.getElementById('search-schools')?.addEventListener('input', (e) => {
      textoBusca  = e.target.value;
      paginaAtual = 1;  // volta para a 1ª página ao filtrar
      renderizarTabela();
    });

    // Máscara automática de CNPJ: formata enquanto o usuário digita
    // Usa delegação no document para funcionar dentro do modal (que é dinâmico)
    document.addEventListener('input', (e) => {
      if (e.target.id !== 'f-cnpj') return;
      // Remove tudo que não é número
      let v = e.target.value.replace(/\D/g, '').slice(0, 14);
      // Aplica a máscara progressivamente: 00.000.000/0001-00
      if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
      else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
      else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
      else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,3})/, '$1.$2');
      e.target.value = v;
    });

    // Botão "+ Cadastrar" no topo da tabela
    document.getElementById('btn-add-school')?.addEventListener('click', abrirModalAdicionar);

    // Botão "Ver Arquivadas / Ver Ativas" no topo da tabela
    document.getElementById('btn-toggle-arquivadas')?.addEventListener('click', alternarModoArquivadas);

    // Delegação de eventos na tabela: detecta clique nos botões Editar, Arquivar e Desarquivar
    // Em vez de adicionar listener em cada botão (ineficiente), monitoramos o <tbody>
    // e verificamos qual botão foi clicado pelo .closest()
    document.getElementById('schools-tbody')?.addEventListener('click', (e) => {

      // Ações da linha principal da tabela
      if (e.target.closest('.btn-edit'))       abrirModalEdicao(Number(e.target.closest('.btn-edit').dataset.id));
      if (e.target.closest('.btn-delete'))     confirmarArquivamento(Number(e.target.closest('.btn-delete').dataset.id));
      if (e.target.closest('.btn-reativar'))   confirmarArquivamento(Number(e.target.closest('.btn-reativar').dataset.id));
      if (e.target.closest('.btn-financeiro')) abrirFinanceiroEscola(Number(e.target.closest('.btn-financeiro').dataset.id));
      if (e.target.closest('.btn-expand'))     alternarExpansao(Number(e.target.closest('.btn-expand').dataset.id));

      // Botões "+ Adicionar Coordenador" / "+ Adicionar Professor"
      const btnAdd = e.target.closest('.btn-add-membro');
      if (btnAdd) {
        abrirModalAdicionarMembro(Number(btnAdd.dataset.escola), btnAdd.dataset.perfil);
        return;
      }

      // Ações dentro das sub-tabelas de coordenadores/professores
      const btnEditar = e.target.closest('.btn-editar-coord, .btn-editar-prof');
      if (btnEditar) {
        const escolaId = Number(e.target.closest('.escola-expanded-row')?.dataset.id);
        const perfil = btnEditar.classList.contains('btn-editar-prof') ? 'VISUALIZADOR_ESCOLA' : 'ADMIN_ESCOLA';
        abrirModalEditarMembro(Number(btnEditar.dataset.id), escolaId, perfil);
        return;
      }

      const btnArquivar = e.target.closest('.btn-arquivar-coord, .btn-arquivar-prof');
      if (btnArquivar) {
        const escolaId = Number(e.target.closest('.escola-expanded-row')?.dataset.id);
        const ehProf = btnArquivar.classList.contains('btn-arquivar-prof');
        arquivarMembro(
          Number(btnArquivar.dataset.id),
          escolaId,
          btnArquivar.dataset.arquivado === 'true',
          ehProf ? 'Professor' : 'Coordenador'
        );
        return;
      }
    });
  };

  // ── CADASTRAR (CREATE) ────────────────────────────────────────────────────

  /**
   * Valida o formato de e-mail.
   */
  const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  /**
   * Abre o modal com o formulário de cadastro de nova escola + coordenador.
   * O coordenador recebe as credenciais (e-mail/senha) para logar no Web.
   */
  const abrirModalAdicionar = () => {
    Modal.abrir({
      titulo: '+ Cadastrar Nova Escola',
      conteudo: `
        <div class="form-group">
          <label class="form-label">Nome da Escola *</label>
          <input class="form-input" id="f-nome" placeholder="Ex: Escola Municipal Alfa" required>
        </div>
        <div class="form-group">
          <label class="form-label">CNPJ *</label>
          <input class="form-input" id="f-cnpj" placeholder="00.000.000/0001-00" maxlength="18" required>
        </div>
        <div class="form-group" style="border-top:1px solid var(--border);padding-top:14px">
          <label class="form-label">👤 Coordenador da Escola (obrigatório)</label>
        </div>
        <div class="form-group">
          <label class="form-label">Nome do Coordenador *</label>
          <input class="form-input" id="f-coordenador-nome" placeholder="Nome completo do coordenador" required>
        </div>
        <div class="form-group">
          <label class="form-label">E-mail do Coordenador *</label>
          <input class="form-input" id="f-coordenador-email" type="email" placeholder="coordenador@escola.com" required>
        </div>
        <div class="form-group">
          <label class="form-label">Senha do Coordenador *</label>
          <input class="form-input" id="f-coordenador-senha" type="password" placeholder="Mínimo 6 caracteres" required>
        </div>
        <p style="color:var(--text-secondary);font-size:12px;line-height:1.5;margin:0">
          🔑 O coordenador é obrigatório. Ele usará essas credenciais para acessar
          o painel Web e gerenciar a escola (criar professores e alunos).
        </p>
      `,
      aoAbrir: (corpo) => {
        // Botão "Salvar" fica desabilitado até todos os campos obrigatórios
        // (escola + coordenador) estarem preenchidos corretamente.
        const atualizar = () => {
          const nome  = corpo.querySelector('#f-nome');
          const cnpj  = corpo.querySelector('#f-cnpj');
          const cNome = corpo.querySelector('#f-coordenador-nome');
          const cMail = corpo.querySelector('#f-coordenador-email');
          const cSen  = corpo.querySelector('#f-coordenador-senha');
          const salvar = document.getElementById('modal-save');
          if (!salvar || !nome || !cnpj || !cNome || !cMail || !cSen) return;

          const cnpjOk   = (cnpj.value || '').replace(/\D/g, '').length === 14;
          const emailOk  = validarEmail(cMail.value.trim());
          const senhaOk  = cSen.value.length >= 6;
          salvar.disabled = !(nome.value.trim() && cnpjOk && cNome.value.trim() && emailOk && senhaOk);
        };
        ['#f-nome', '#f-cnpj', '#f-coordenador-nome', '#f-coordenador-email', '#f-coordenador-senha']
          .forEach(sel => corpo.querySelector(sel)?.addEventListener('input', atualizar));
        atualizar();
      },
      aoSalvar: async () => {
        // Lê os valores dos campos do formulário dentro do modal
        const nome        = document.getElementById('f-nome')?.value.trim();
        const cnpj        = document.getElementById('f-cnpj')?.value.trim();
        const coordNome   = document.getElementById('f-coordenador-nome')?.value.trim();
        const coordEmail  = document.getElementById('f-coordenador-email')?.value.trim();
        const coordSenha  = document.getElementById('f-coordenador-senha')?.value || '';

        // Validações obrigatórias
        if (!nome) {
          Notificacao.erro('Informe o nome da escola.');
          return;
        }

        const digitosCNPJ = (cnpj || '').replace(/\D/g, '');
        if (!cnpj || digitosCNPJ.length !== 14) {
          Notificacao.erro('CNPJ inválido! Digite os 14 dígitos.');
          return;
        }

        if (!coordNome) {
          Notificacao.erro('Informe o nome do coordenador.');
          return;
        }
        if (!coordEmail || !validarEmail(coordEmail)) {
          Notificacao.erro('E-mail do coordenador inválido.');
          return;
        }
        if (coordSenha.length < 6) {
          Notificacao.erro('A senha do coordenador deve ter no mínimo 6 caracteres.');
          return;
        }

        // Envia para o main.js salvar na API (cria escola + coordenador em transação)
        const resultado = await window.electronAPI.createSchool({
          nome_escola: nome,
          cnpj,
          coordenador_nome: coordNome,
          coordenador_email: coordEmail,
          coordenador_senha: coordSenha,
        });

        if (resultado.success) {
          const codigoGerado = resultado.codigo || `ESC${String(resultado.id).padStart(4, '0')}`;
          // Adiciona à lista local em memória (sem precisar recarregar tudo)
          todasEscolas.push({
            id: resultado.id, name: nome, code: codigoGerado,
            cnpj, students: 0, status: 'active',
            totalCoordenadores: 1, totalProfessores: 0,
          });

          renderizarTabela();
          atualizarContador();
          // Mantém os seletores de escola (Visão Geral / Financeiro) atualizados
          if (window.popularSelectoresEscola) window.popularSelectoresEscola();
          Modal.fechar();
          Notificacao.sucesso(`✅ Escola e coordenador cadastrados! Código: ${codigoGerado}`);
        } else {
          Notificacao.erro('❌ ' + (resultado.erro || 'Erro ao cadastrar a escola.'));
        }
      },
    });
  };

  // ── EDITAR (UPDATE) ───────────────────────────────────────────────────────

  /**
   * Abre o modal com os dados da escola já preenchidos para edição.
   * @param {number} id - ID da escola a editar
   */
  const abrirModalEdicao = (id) => {
    const escola = todasEscolas.find(e => e.id === id);
    if (!escola) return;

    Modal.abrir({
      titulo:    '✏️ Editar Escola',
      labelBotao: 'Atualizar',
      conteudo: `
        <div class="form-group">
          <label class="form-label">Nome da Escola *</label>
          <input class="form-input" id="f-nome" value="${escapeHTML(escola.name)}">
        </div>
        <div class="form-group">
          <label class="form-label">CNPJ</label>
          <input class="form-input" id="f-cnpj" value="${escapeHTML(escola.cnpj || '')}" placeholder="00.000.000/0001-00" maxlength="18">
        </div>
        <div class="form-group">
          <label class="form-label">Código (gerado automaticamente)</label>
          <input class="form-input" value="${escapeHTML(escola.code)}" disabled>
        </div>
        <p style="color:var(--text-secondary);font-size:12px;line-height:1.5;margin:0">
          Coordenador e Status são gerenciados em suas seções próprias:
          o coordenador, pela lista expandida da escola; o status, pelo botão
          Arquivar/Reativar.
        </p>
      `,
      aoSalvar: async () => {
        const nome = document.getElementById('f-nome')?.value.trim();
        const cnpj = document.getElementById('f-cnpj')?.value.trim();

        if (!nome) {
          Notificacao.erro('Preencha o nome da escola!');
          return;
        }

        const digitosCNPJ = cnpj.replace(/\D/g, '');
        if (cnpj && digitosCNPJ.length !== 14) {
          Notificacao.erro('CNPJ inválido! Digite os 14 dígitos.');
          return;
        }

        // Envia a atualização para o main.js via IPC (mantém o código atual)
        const resultado = await window.electronAPI.updateSchool({
          id, name: nome, cnpj: cnpj || '—',
        });

        if (resultado.success) {
          // Atualiza o registro na lista local sem recarregar tudo
          const indice = todasEscolas.findIndex(e => e.id === id);
          todasEscolas[indice] = { ...todasEscolas[indice], name: nome, cnpj: cnpj || '—' };

          renderizarTabela();
          Modal.fechar();
          Notificacao.sucesso('✅ Escola atualizada com sucesso!');
        } else {
          Notificacao.erro('❌ ' + (resultado.erro || 'Erro ao atualizar a escola.'));
        }
      },
    });
  };

  // ── ARQUIVAR (SOFT DELETE) ────────────────────────────────────────────────

  /**
   * Pede confirmação e ARQUIVA (ou reativa) a escola se confirmado.
   * Nenhuma escola é apagada do banco — o endpoint PUT /escolas/{id}/arquivar
   * apenas marca a escola como arquivada (data_exclusao). Ação é reversível.
   * Usa o dialog nativo do sistema operacional via IPC (não o window.confirm do browser).
   * @param {number} id - ID da escola a arquivar/reativar
   */
  const confirmarArquivamento = async (id) => {
    const escola = todasEscolas.find(e => e.id === id);
    if (!escola) return;

    const arquivar = !escola.arquivada;

    // Abre um dialog nativo do sistema operacional para confirmação
    const confirmado = await window.electronAPI.confirm({
      title:   arquivar ? 'Arquivar Escola' : 'Reativar Escola',
      message: arquivar ? `Deseja arquivar "${escola.name}"?` : `Deseja reativar "${escola.name}"?`,
      detail:  arquivar
        ? 'A escola ficará oculta das listas, mas nenhum dado será apagado.'
        : 'A escola voltará a aparecer nas listas.',
    });

    if (!confirmado) return;  // usuário cancelou

    const resultado = await window.electronAPI.deleteSchool(id);
    if (resultado.success) {
      if (arquivar && !modoArquivadas) {
        // Modo "ativas": remove da lista local (a escola saiu da visão ativa)
        todasEscolas = todasEscolas.filter(e => e.id !== id);
      } else {
        // Modo "arquivadas" (desarquivar): recarrega da API para refletir o novo estado
        await carregarEscolas();
      }
      paginaAtual  = 1;  // volta para a primeira página

      renderizarTabela();
      atualizarContador();
      Notificacao.sucesso(arquivar ? '🗂️ Escola arquivada.' : '✅ Escola reativada.');
    }
  };

  /**
   * Retorna a lista de escolas em memória.
   * Usado pelo app.js para passar para a VisaoGeralView.
   */
  const getDados = () => todasEscolas;

  // ── GESTÃO FINANCEIRA SaaS (página unificada por escola) ───────────────────

  /**
   * Abre a Gestão Financeira unificada da escola (passa escola_id via
   * window.SacouFinanceiro).
   * @param {number} id - ID da escola
   */
  const abrirFinanceiroEscola = (id) => {
    const escola = todasEscolas.find(e => e.id === id);
    if (!escola) return;
    if (window.SacouFinanceiro?.abrirFinanceiroPorEscola) {
      window.SacouFinanceiro.abrirFinanceiroPorEscola(id, escola.name);
    }
  };

  // ── MEMBROS DA ESCOLA (expansão de linha: coordenadores + professores) ─────

  /**
   * Expande/colapsa a linha da escola mostrando coordenadores e professores.
   * @param {number} escolaId - ID da escola
   */
  const alternarExpansao = (escolaId) => {
    if (linhasExpandidas.has(escolaId)) linhasExpandidas.delete(escolaId);
    else linhasExpandidas.add(escolaId);
    renderizarTabela();
  };

  /**
   * Busca coordenadores (ADMIN_ESCOLA) e professores (VISUALIZADOR_ESCOLA)
   * da escola via GET /escolas/{id}/usuarios?perfil=... e renderiza as duas
   * sub-seções da linha expandida.
   * @param {number} escolaId - ID da escola
   */
  const carregarMembros = async (escolaId) => {
    const temCoord = document.getElementById(`coord-conteudo-${escolaId}`);
    const temProf  = document.getElementById(`prof-conteudo-${escolaId}`);
    if (!temCoord && !temProf) return;

    const [resCoords, resProfs] = await Promise.all([
      window.electronAPI.getUsuariosEscola(escolaId, 'ADMIN_ESCOLA'),
      window.electronAPI.getUsuariosEscola(escolaId, 'VISUALIZADOR_ESCOLA'),
    ]);

    if (!resCoords.success) Notificacao.erro('❌ ' + (resCoords.erro || 'Erro ao carregar coordenadores.'));
    if (!resProfs.success) Notificacao.erro('❌ ' + (resProfs.erro || 'Erro ao carregar professores.'));

    renderizarMembros(escolaId, 'coord', resCoords.success ? resCoords.lista : []);
    renderizarMembros(escolaId, 'prof', resProfs.success ? resProfs.lista : []);
  };

  /**
   * Renderiza a sub-tabela de uma seção (coordenadores ou professores).
   * @param {number} escolaId - ID da escola
   * @param {string} chave - 'coord' ou 'prof' (define o container e as classes dos botões)
   * @param {Array} lista - Usuários (id_usuario, nome_completo, email, arquivado)
   */
  const renderizarMembros = (escolaId, chave, lista) => {
    const container = document.getElementById(`${chave}-conteudo-${escolaId}`);
    if (!container) return;

    const ehCoord = chave === 'coord';
    const rotulo  = ehCoord ? 'Coordenador' : 'Professor';
    const sufixo  = ehCoord ? 'coord' : 'prof';

    if (!lista.length) {
      container.innerHTML = `<p style="color:var(--text-secondary);font-size:12.5px;padding:6px 0">
        Nenhum ${rotulo.toLowerCase()} cadastrado.
      </p>`;
      return;
    }

    container.innerHTML = `
      <div class="table-wrap">
        <table class="data-table coord-table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Status</th><th>Ações</th></tr>
          </thead>
          <tbody>
            ${lista.map(m => `
              <tr data-id="${m.id_usuario}">
                <td><strong>${escapeHTML(m.nome_completo)}</strong></td>
                <td style="color:var(--text-secondary);font-size:12px;font-family:monospace">${escapeHTML(m.email)}</td>
                <td>
                  <span class="badge ${m.arquivado ? 'inactive' : 'active'}">
                    ${m.arquivado ? 'Arquivado' : 'Ativo'}
                  </span>
                </td>
                <td>
                  <div class="actions-cell">
                    <button class="action-btn btn-editar-${sufixo}" data-id="${m.id_usuario}" title="Editar ${rotulo.toLowerCase()}">✏️ Editar</button>
                    ${m.arquivado
                      ? `<button class="action-btn btn-arquivar-${sufixo}" data-id="${m.id_usuario}" data-arquivado="false" title="Reativar">↩️ Reativar</button>`
                      : `<button class="action-btn danger btn-arquivar-${sufixo}" data-id="${m.id_usuario}" data-arquivado="true" title="Arquivar ${rotulo.toLowerCase()}">🗑️ Arquivar</button>`}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  /**
   * Abre o modal para adicionar um coordenador (ADMIN_ESCOLA) ou professor
   * (VISUALIZADOR_ESCOLA) à escola.
   * @param {number} escolaId - ID da escola
   * @param {string} perfil - 'ADMIN_ESCOLA' ou 'VISUALIZADOR_ESCOLA'
   */
  const abrirModalAdicionarMembro = (escolaId, perfil) => {
    const ehCoordenador = perfil === 'ADMIN_ESCOLA';
    const rotulo = ehCoordenador ? 'Coordenador' : 'Professor';
    const escola = todasEscolas.find(e => e.id === escolaId);

    Modal.abrir({
      titulo: `+ Adicionar ${rotulo}`,
      labelBotao: 'Criar',
      conteudo: `
        <div class="form-group">
          <label class="form-label">Nome do ${rotulo} *</label>
          <input class="form-input" id="f-membro-nome" placeholder="Nome completo" required>
        </div>
        <div class="form-group">
          <label class="form-label">E-mail do ${rotulo} *</label>
          <input class="form-input" id="f-membro-email" type="email" placeholder="email@escola.com" required>
        </div>
        <div class="form-group">
          <label class="form-label">Senha *</label>
          <input class="form-input" id="f-membro-senha" type="password" placeholder="Mínimo 6 caracteres" required>
        </div>
        ${escola ? `<p style="color:var(--text-secondary);font-size:12px;line-height:1.5;margin:0">Escola: <strong>${escapeHTML(escola.name)}</strong></p>` : ''}
      `,
      aoAbrir: (corpo) => {
        // Salvar só habilita com todos os campos preenchidos corretamente.
        const atualizar = () => {
          const nome  = corpo.querySelector('#f-membro-nome');
          const email = corpo.querySelector('#f-membro-email');
          const senha = corpo.querySelector('#f-membro-senha');
          const salvar = document.getElementById('modal-save');
          if (!salvar || !nome || !email || !senha) return;
          salvar.disabled = !(nome.value.trim() && validarEmail(email.value.trim()) && senha.value.length >= 6);
        };
        ['#f-membro-nome', '#f-membro-email', '#f-membro-senha']
          .forEach(sel => corpo.querySelector(sel)?.addEventListener('input', atualizar));
        atualizar();
      },
      aoSalvar: async () => {
        const nome  = document.getElementById('f-membro-nome')?.value.trim();
        const email = document.getElementById('f-membro-email')?.value.trim();
        const senha = document.getElementById('f-membro-senha')?.value || '';

        if (!nome || !validarEmail(email) || senha.length < 6) {
          Notificacao.erro('Preencha todos os campos corretamente.');
          return;
        }

        // POST /usuarios com perfil e escola_id
        const resultado = await window.electronAPI.createUsuario({
          nome_completo: nome,
          email,
          senha,
          perfil,
          escola_id: escolaId,
        });

        if (resultado.success) {
          Modal.fechar();
          Notificacao.sucesso(`✅ ${rotulo} cadastrado!`);
          if (ehCoordenador) {
            // Ajusta o contador da tabela principal (já re-renderiza e recarrega membros)
            ajustarContagemCoordenadores(escolaId, +1);
          } else {
            ajustarContagemProfessores(escolaId, +1);
          }
        } else {
          Notificacao.erro('❌ ' + (resultado.erro || `Erro ao cadastrar ${rotulo.toLowerCase()}.`));
        }
      },
    });
  };

  /**
   * Abre o modal de edição de um coordenador/professor (nome, e-mail e senha opcional).
   * @param {number} membroId - ID do usuário
   * @param {number} escolaId - ID da escola
   * @param {string} perfil - 'ADMIN_ESCOLA' ou 'VISUALIZADOR_ESCOLA'
   */
  const abrirModalEditarMembro = async (membroId, escolaId, perfil) => {
    const ehCoordenador = perfil === 'ADMIN_ESCOLA';
    const rotulo = ehCoordenador ? 'Coordenador' : 'Professor';

    const res = await window.electronAPI.getUsuariosEscola(escolaId, perfil);
    const lista = res.success ? res.lista : [];
    const membro = lista.find(m => m.id_usuario === membroId);
    if (!membro) { Notificacao.erro(`${rotulo} não encontrado.`); return; }

    Modal.abrir({
      titulo: `✏️ Editar ${rotulo}`,
      labelBotao: 'Salvar',
      conteudo: `
        <div class="form-group">
          <label class="form-label">Nome Completo *</label>
          <input class="form-input" id="c-nome" value="${escapeHTML(membro.nome_completo)}">
        </div>
        <div class="form-group">
          <label class="form-label">E-mail *</label>
          <input class="form-input" id="c-email" type="email" value="${escapeHTML(membro.email)}">
        </div>
        <div class="form-group">
          <label class="form-label">Nova Senha (opcional)</label>
          <input class="form-input" id="c-senha" type="password" placeholder="Deixe vazio para manter a atual">
        </div>
      `,
      aoSalvar: async () => {
        const nome  = document.getElementById('c-nome')?.value.trim();
        const email = document.getElementById('c-email')?.value.trim();
        const senha = document.getElementById('c-senha')?.value || '';

        if (!nome || !email) {
          Notificacao.erro('Informe nome e e-mail.');
          return;
        }
        if (email && !validarEmail(email)) {
          Notificacao.erro('E-mail inválido.');
          return;
        }
        if (senha && senha.length < 6) {
          Notificacao.erro('A senha deve ter no mínimo 6 caracteres.');
          return;
        }

        // PUT /usuarios/{id}
        const resultado = await window.electronAPI.updateCoordenador({
          id: membroId, nome_completo: nome, email,
          senha: senha || undefined,
        });
        if (resultado.success) {
          Modal.fechar();
          Notificacao.sucesso(`✅ ${rotulo} atualizado!`);
          await carregarMembros(escolaId); // atualiza a sub-tabela
        } else {
          Notificacao.erro('❌ ' + (resultado.erro || 'Erro ao atualizar.'));
        }
      },
    });
  };

  /**
   * Atualiza a contagem de coordenadores ativos de uma escola na memória.
   * @param {number} escolaId - ID da escola
   * @param {number} delta - +1 ou -1
   */
  const ajustarContagemCoordenadores = (escolaId, delta) => {
    const escola = todasEscolas.find(e => e.id === escolaId);
    if (escola) {
      escola.totalCoordenadores = Math.max(0, (escola.totalCoordenadores || 0) + delta);
    }
    renderizarTabela();
  };

  /**
   * Atualiza a contagem de professores ativos de uma escola na memória.
   * @param {number} escolaId - ID da escola
   * @param {number} delta - +1 ou -1
   */
  const ajustarContagemProfessores = (escolaId, delta) => {
    const escola = todasEscolas.find(e => e.id === escolaId);
    if (escola) {
      escola.totalProfessores = Math.max(0, (escola.totalProfessores || 0) + delta);
    }
    renderizarTabela();
  };

  /**
   * Arquivar/reativar um coordenador ou professor (PATCH /usuarios/{id}).
   * Atualiza a sub-tabela instantaneamente.
   * @param {number} membroId - ID do usuário
   * @param {number} escolaId - ID da escola
   * @param {boolean} arquivado - alvo: true para arquivar, false para reativar
   * @param {string} rotulo - 'Coordenador' ou 'Professor' (mensagens)
   */
  const arquivarMembro = async (membroId, escolaId, arquivado, rotulo) => {
    const confirmado = await window.electronAPI.confirm({
      title:   arquivado ? `Arquivar ${rotulo}` : `Reativar ${rotulo}`,
      message: arquivado
        ? `Deseja arquivar este ${rotulo.toLowerCase()}? Ele deixará de acessar.`
        : `Deseja reativar este ${rotulo.toLowerCase()}?`,
      detail: 'Ação reversível pela mesma lista.',
    });
    if (!confirmado) return;

    const res = await window.electronAPI.arquivarCoordenador(membroId, arquivado);
    if (res.success) {
      if (rotulo === 'Coordenador') {
        ajustarContagemCoordenadores(escolaId, arquivado ? -1 : +1);
      } else {
        ajustarContagemProfessores(escolaId, arquivado ? -1 : +1);
      }
      Notificacao.sucesso(arquivado ? `🗂️ ${rotulo} arquivado.` : `✅ ${rotulo} reativado.`);
      await carregarMembros(escolaId);
    } else {
      Notificacao.erro('❌ ' + (res.erro || `Erro ao ${arquivado ? 'arquivar' : 'reativar'}.`));
    }
  };

  // Expõe os métodos públicos
  return { init, refresh: carregarEscolas, getDados, abrirModalCadastro };

})();

// Alias para compatibilidade com o código antigo que usa "SchoolsView"
const SchoolsView = EscolasView;
