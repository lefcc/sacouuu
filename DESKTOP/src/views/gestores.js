// ─────────────────────────────────────────────────────────────────────────────
// views/gestores.js  —  Gestores Master do Sistema
//
// Cadastro de Gestores da Plataforma (perfil GESTOR_PLATAFORMA) com segurança:
//   • Senha nunca trafega em texto puro para o banco (a API hasheia em bcrypt)
//   • Validação no frontend: email válido, senha ≥ 6 chars e com ≥ 1 número,
//     e confirmação de senha idêntica
//   • Exibe mensagem de sucesso/erro retornada pela API (409 = email duplicado)
// ─────────────────────────────────────────────────────────────────────────────

const GestoresView = (() => {

  let todosGestores = [];

  // ── INICIALIZAÇÃO ─────────────────────────────────────────────────────────

  const carregarGestores = async () => {
    console.log('[GESTORES] Iniciando carregamento da lista...');
    const resultado = await window.electronAPI.getGestores();
    console.log('[GESTORES] Dados recebidos do backend:', resultado);
    todosGestores = resultado.success ? resultado.lista : [];
    renderizarTabela(todosGestores);
  };

  const init = async () => {
    await carregarGestores();
    registrarEventos();
  };

  // ── RENDERIZAÇÃO DA TABELA ────────────────────────────────────────────────

  const renderizarTabela = (dados) => {
    const corpo = document.getElementById('gestores-tbody');
    if (!corpo) return;

    // Usa o array recebido (o mais recente); fallback para o estado global.
    const lista = dados ?? todosGestores;
    // Limpa explicitamente o tbody antes de redesenhá-lo.
    corpo.innerHTML = '';

    if (lista.length === 0) {
      corpo.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:var(--text-secondary);padding:28px 0">
            Nenhum gestor cadastrado ainda.
          </td>
        </tr>`;
    } else {
      corpo.innerHTML = lista.map(g => {
        const ativo = !!g.status_ativo;
        return `
        <tr data-id="${g.id_usuario}">
          <td><strong>${escapeHTML(g.nome_completo)}</strong></td>
          <td style="color:var(--text-secondary);font-size:12px;font-family:monospace">${escapeHTML(g.email)}</td>
          <td style="color:var(--text-secondary);font-size:12px;font-family:monospace">${escapeHTML(g.perfil)}</td>
          <td>
            <span class="badge ${ativo ? 'active' : 'inactive'}">
              ${ativo ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td>
            <div class="actions-cell">
              <button class="action-btn ${ativo ? 'danger' : ''} btn-arquivar-gestor"
                data-id="${g.id_usuario}" data-nome="${escapeHTML(g.nome_completo)}" data-ativo="${ativo}"
                title="${ativo ? 'Arquivar gestor' : 'Reativar gestor'}">
                ${ativo ? '🗑️ Arquivar' : '↩️ Reativar'}
              </button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    const contador = document.getElementById('gestores-count');
    if (contador) {
      contador.textContent =
        `${lista.length} gestor${lista.length !== 1 ? 'es' : ''} cadastrado${lista.length !== 1 ? 's' : ''}`;
    }
  };

  // ── ARQUIVAR / REATIVAR ────────────────────────────────────────────────────

  const arquivarGestor = async (id, nome, ativo) => {
    const acao = ativo ? 'arquivar' : 'reativar';
    const confirmado = await window.electronAPI.confirm({
      title: ativo ? 'Arquivar Gestor' : 'Reativar Gestor',
      message: `Deseja ${acao} o gestor "${nome}"?`,
      detail: ativo
        ? 'O gestor deixará de acessar o sistema (ação reversível).'
        : 'O gestor voltará a acessar o sistema.',
    });
    if (!confirmado) return;

    const resultado = await window.electronAPI.arquivarGestor(id, ativo);
    // Só avança se o backend respondeu HTTP 200 com o gestor ATUALIZADO.
    if (resultado.success && resultado.gestor) {
      const atualizado = resultado.gestor;
      const idx = todosGestores.findIndex(g => g.id_usuario == id);
      if (idx !== -1) {
        // Estado local recebe o valor AUTORITATIVO do servidor.
        todosGestores[idx] = {
          ...todosGestores[idx],
          status_ativo: atualizado.status_ativo,
          arquivado: atualizado.arquivado,
        };
      }
      renderizarTabela(todosGestores); // re-render imediato (Inativo/Reativar)

      Notificacao.sucesso(ativo ? '🗂️ Gestor arquivado.' : '✅ Gestor reativado.');
      console.log('[GESTORES] Arquivamento bem-sucedido, recarregando lista...');
      try {
        await carregarGestores();
        console.log('[GESTORES] Lista recarregada com sucesso');
      } catch (e) {
        console.error('[GESTORES] Erro ao recarregar lista:', e);
        Notificacao.erro('Erro ao recarregar lista: ' + e.message);
      }
    } else {
      // Sem HTTP 200 real: NÃO mostra sucesso.
      Notificacao.erro('❌ ' + (resultado.erro || 'Erro ao alterar o gestor.'));
    }
  };

  // ── REGISTRO DE EVENTOS ───────────────────────────────────────────────────

  const registrarEventos = () => {
    document.getElementById('btn-add-gestor')?.addEventListener('click', abrirModalCadastro);

    // Delegação de eventos: botões Arquivar/Reativar (linhas recriadas via innerHTML).
    document.getElementById('gestores-tbody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-arquivar-gestor');
      if (!btn) return;
      arquivarGestor(
        Number(btn.dataset.id),
        btn.dataset.nome || 'gestor',
        btn.dataset.ativo === 'true',
      );
    });
  };

  // ── VALIDAÇÃO DO FRONTEND ─────────────────────────────────────────────────

  const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  /**
   * Valida o formulário de cadastro. Retorna uma string com o erro, ou null se ok.
   */
  const validarFormulario = (nome, email, senha, confirmar) => {
    if (!nome.trim()) return 'Informe o nome do gestor.';
    if (!email.trim()) return 'Informe o e-mail do gestor.';
    if (!validarEmail(email.trim())) return 'E-mail inválido.';
    if (senha.length < 6) return 'A senha deve ter no mínimo 6 caracteres.';
    if (!/\d/.test(senha)) return 'A senha deve conter pelo menos 1 número.';
    if (senha !== confirmar) return 'As senhas não coincidem.';
    return null;
  };

  // ── CADASTRAR (CREATE) ────────────────────────────────────────────────────

  const abrirModalCadastro = () => {
    Modal.abrir({
      titulo: '+ Cadastrar Gestor Master',
      labelBotao: 'Cadastrar',
      conteudo: `
        <div class="form-group">
          <label class="form-label">Nome *</label>
          <input class="form-input" id="g-nome" placeholder="Ex: João Silva">
        </div>
        <div class="form-group">
          <label class="form-label">E-mail *</label>
          <input class="form-input" id="g-email" type="email" placeholder="Ex: joao@sacou.com">
        </div>
        <div class="form-group">
          <label class="form-label">Senha *</label>
          <input class="form-input" id="g-senha" type="password" placeholder="Mínimo 6 caracteres e 1 número">
        </div>
        <div class="form-group">
          <label class="form-label">Confirmar Senha *</label>
          <input class="form-input" id="g-confirmar" type="password" placeholder="Repita a senha">
        </div>
        <p style="color:var(--text-secondary);font-size:12px;line-height:1.5;margin:0">
          🔒 A senha é criptografada com bcrypt antes de ir ao banco (LGPD).
        </p>
      `,
      aoSalvar: async () => {
        const nome      = document.getElementById('g-nome')?.value || '';
        const email     = document.getElementById('g-email')?.value || '';
        const senha     = document.getElementById('g-senha')?.value || '';
        const confirmar = document.getElementById('g-confirmar')?.value || '';

        const erro = validarFormulario(nome, email, senha, confirmar);
        if (erro) {
          Notificacao.erro(erro);
          return;
        }

        const resultado = await window.electronAPI.createGestor({
          nome: nome.trim(), email: email.trim(), senha,
        });

        if (resultado.success) {
          todosGestores.push(resultado.gestor);
          renderizarTabela();
          Modal.fechar();
          Notificacao.sucesso('✅ Gestor Master cadastrado com sucesso!');
        } else {
          Notificacao.erro('❌ ' + (resultado.erro || 'Erro ao cadastrar gestor.'));
        }
      },
    });
  };

  return { init, getDados: () => todosGestores };

})();
