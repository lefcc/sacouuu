// ─────────────────────────────────────────────────────────────────────────────
// views/personalizacao.js  —  Tela de Personalização (Avatares e Loja)
//
// Tudo vem do banco via API (/personalizacao/avatares e /personalizacao/itens-loja).
// NENHUM dado é hardcodeado aqui — a tela renderiza o que a API retorna.
// ─────────────────────────────────────────────────────────────────────────────

const PersonalizacaoView = (() => {

  let avatares = [];
  let itensLoja = [];

  // Base URL da API (local): usada para resolver imagens relativas como
  // "/uploads/personalizacao/xxx.png". No Electron (protocolo file://) caminhos
  // relativos não apontam para o backend, então prefixamos com a URL da API.
  let apiBaseUrl = 'http://localhost:8000';

  /**
   * Resolve a URL de uma imagem para carregamento no Electron.
   * - URLs absolutas (http/https/data) passam direto.
   * - URLs relativas (ex.: /uploads/...) ganham o prefixo da API.
   */
  const resolverImagem = (url) => {
    if (!url) return '';
    if (/^(https?:|data:)/.test(url)) return url;
    return apiBaseUrl + (url.startsWith('/') ? '' : '/') + url;
  };

  // Campo de imagem dos dados da API (novo endpoint usa `imagem_path`).
  const imagemDe = (item) => item.imagem_path || item.url_imagem || '';

  const obterBaseUrlApi = async () => {
    try {
      const res = await window.electronAPI.getApiBaseUrl();
      if (res?.baseUrl) apiBaseUrl = res.baseUrl;
    } catch { /* mantém o fallback localhost:8000 */ }
  };

  const init = async () => {
    await obterBaseUrlApi(); // resolve a URL da API antes de renderizar imagens
    await Promise.all([carregarAvatares(), carregarItens()]);
    registrarEventos();
  };

  // ── AVATARES ───────────────────────────────────────────────────────────────

  const carregarAvatares = async () => {
    const res = await window.electronAPI.getPersonalizacaoAvatares();
    avatares = res.success ? res.lista : [];
    renderizarAvatares();
  };

  const renderizarAvatares = () => {
    const lista = document.getElementById('avatars-list');
    if (!lista) return;

    if (avatares.length === 0) {
      lista.innerHTML = `<p style="color:var(--text-secondary);font-size:13px;padding:12px 0">
        Nenhum avatar cadastrado ainda.
      </p>`;
      return;
    }

    lista.innerHTML = avatares.map(a => `
      <div class="question-item" style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border)">
        <img src="${resolverImagem(imagemDe(a))}" alt="${escapeHTML(a.nome)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;background:var(--bg-secondary)">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text-primary)">${escapeHTML(a.nome)}</div>
          <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escapeHTML(a.descricao || 'Sem descrição')} · Ordem: ${a.ordem} · ${a.ativo ? 'Ativo' : 'Inativo'}
          </div>
        </div>
        <button class="btn-edit-question" data-id="${a.id}" style="padding:4px 10px;font-size:12px" title="Editar">✏️</button>
        <button class="btn-delete-question" data-id="${a.id}" style="padding:4px 10px;font-size:12px" title="Excluir avatar">🗑️</button>
      </div>
    `).join('');

    // Eventos de editar/excluir
    lista.querySelectorAll('.btn-edit-question').forEach(btn =>
      btn.addEventListener('click', () => abrirModalAvatar(Number(btn.dataset.id)))
    );
    lista.querySelectorAll('.btn-delete-question').forEach(btn =>
      btn.addEventListener('click', () => excluirAvatar(Number(btn.dataset.id)))
    );
  };

  const abrirModalAvatar = (id) => {
    const avatar = id ? avatares.find(a => a.id === id) : null;
    const titulo = avatar ? 'Editar Avatar' : 'Novo Avatar';

    Modal.abrir({
      titulo,
      labelBotao: avatar ? 'Salvar' : 'Criar',
      conteudo: `
        <div class="form-group">
          <label class="form-label">Nome</label>
          <input class="form-input" id="modal-avatar-nome" value="${avatar?.nome || ''}" placeholder="Ex: Pinguim">
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <input class="form-input" id="modal-avatar-desc" value="${avatar?.descricao || ''}" placeholder="Opcional">
        </div>
        <div class="form-group">
          <label class="form-label">URL da Imagem</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input class="form-input" id="modal-avatar-url" value="${avatar ? imagemDe(avatar) : ''}" placeholder="/uploads/personalizacao/avatar_xxx.png" style="flex:1">
            <button class="btn-upload-avatar" style="padding:6px 12px;font-size:12px;white-space:nowrap">📤 Upload</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Ordem</label>
          <input class="form-input" id="modal-avatar-ordem" type="number" min="0" value="${avatar?.ordem ?? 0}">
        </div>
      `,
      aoSalvar: async () => {
        const dados = {
          nome:       document.getElementById('modal-avatar-nome').value.trim(),
          descricao:  document.getElementById('modal-avatar-desc').value.trim() || null,
          imagem_path: document.getElementById('modal-avatar-url').value.trim(),
          ordem:      parseInt(document.getElementById('modal-avatar-ordem').value) || 0,
          ativo:      true,
        };
        if (!dados.nome || !dados.imagem_path) {
          Notificacao.erro('Preencha nome e URL da imagem.');
          return;
        }
        const res = avatar
          ? await window.electronAPI.updatePersonalizacaoAvatar({ id: avatar.id, ...dados })
          : await window.electronAPI.createPersonalizacaoAvatar(dados);
        if (res.success) {
          Modal.fechar();
          Notificacao.sucesso(avatar ? 'Avatar atualizado!' : 'Avatar criado!');
          await carregarAvatares();
        } else {
          Notificacao.erro('❌ ' + (res.erro || 'Erro ao salvar o avatar.'));
        }
      },
    });

    // Upload de imagem
    document.querySelector('.btn-upload-avatar')?.addEventListener('click', async () => {
      const selecionado = await window.electronAPI.selecionarArquivo({
        titulo: 'Selecionar imagem do avatar',
        filtros: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
      });
      if (!selecionado || selecionado.canceled || !selecionado.caminho) return;
      const res = await window.electronAPI.uploadPersonalizacaoImagem({ caminhoOrigem: selecionado.caminho, nomeArquivo: selecionado.nome });
      if (res.success) {
        document.getElementById('modal-avatar-url').value = res.imagem_path;
        Notificacao.sucesso('Imagem enviada!');
      } else {
        Notificacao.erro('❌ ' + (res.erro || 'Erro no upload.'));
      }
    });
  };

  const excluirAvatar = async (id) => {
    const avatar = avatares.find(a => a.id === id);
    if (!avatar) return;
    const confirmado = await window.electronAPI.confirm({
      title: 'Excluir Avatar',
      message: `Excluir o avatar "${avatar.nome}"?`,
      detail: 'O registro será removido do banco de dados.',
    });
    if (!confirmado) return;
    const res = await window.electronAPI.deletePersonalizacaoAvatar(id);
    if (res.success) {
      Notificacao.sucesso('🗑️ Avatar excluído.');
      await carregarAvatares();
    } else {
      Notificacao.erro('❌ ' + (res.erro || 'Erro ao excluir o avatar.'));
    }
  };

  // ── ITENS DA LOJA ──────────────────────────────────────────────────────────

  const carregarItens = async () => {
    const res = await window.electronAPI.getPersonalizacaoItens();
    itensLoja = res.success ? res.lista : [];
    renderizarItens();
  };

  const renderizarItens = () => {
    const lista = document.getElementById('store-items-list');
    if (!lista) return;

    if (itensLoja.length === 0) {
      lista.innerHTML = `<p style="color:var(--text-secondary);font-size:13px;padding:12px 0">
        Nenhum item cadastrado na loja ainda.
      </p>`;
      return;
    }

    lista.innerHTML = itensLoja.map(item => `
      <div class="question-item" style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border)">
        <img src="${resolverImagem(imagemDe(item))}" alt="${escapeHTML(item.nome)}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;background:var(--bg-secondary)">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text-primary)">${escapeHTML(item.nome)}</div>
          <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escapeHTML(item.descricao || 'Sem descrição')} · ${item.preco} moedas${item.trilha ? ` · Trilha ${escapeHTML(item.trilha)}` : ''} · ${item.ativo ? 'Ativo' : 'Inativo'}
          </div>
        </div>
        <button class="btn-edit-store-item" data-id="${item.id}" style="padding:4px 10px;font-size:12px" title="Editar">✏️</button>
        <button class="btn-delete-store-item" data-id="${item.id}" style="padding:4px 10px;font-size:12px" title="Excluir item">🗑️</button>
      </div>
    `).join('');

    lista.querySelectorAll('.btn-edit-store-item').forEach(btn =>
      btn.addEventListener('click', () => abrirModalItem(Number(btn.dataset.id)))
    );
    lista.querySelectorAll('.btn-delete-store-item').forEach(btn =>
      btn.addEventListener('click', () => excluirItem(Number(btn.dataset.id)))
    );
  };

  const abrirModalItem = (id) => {
    const item = id ? itensLoja.find(i => i.id === id) : null;
    const titulo = item ? 'Editar Item' : 'Novo Item';

    /**
     * Popula o select "Trilha Requerida" com as trilhas REAIS do banco
     * (GET /trilhas via getTrilhas). Se a API falhar/retornar vazio, exibe
     * uma opção padrão desabilitada.
     * @param {number|null} trilhaSelecionada - id da trilha já vinculada ao item
     */
    const carregarOpcoesTrilhas = async (trilhaSelecionada) => {
      const select = document.getElementById('modal-item-trilha');
      if (!select) return;

      let trilhas = [];
      try {
        const res = await window.electronAPI.getTrilhas();
        trilhas = res?.success ? (res.lista || []) : [];
      } catch { trilhas = []; }

      if (!trilhas.length) {
        select.innerHTML = `
          <option value="">Nenhuma</option>
          <option value="" disabled>Nenhuma trilha disponível</option>`;
        return;
      }

      select.innerHTML =
        '<option value="">Nenhuma</option>' +
        trilhas.map(t =>
          `<option value="${t.id_trilha}" ${Number(trilhaSelecionada) === Number(t.id_trilha) ? 'selected' : ''}>${t.nome_trilha}</option>`
        ).join('');
    };

    Modal.abrir({
      titulo,
      labelBotao: item ? 'Salvar' : 'Criar',
      conteudo: `
        <div class="form-group">
          <label class="form-label">Nome</label>
          <input class="form-input" id="modal-item-nome" value="${item?.nome || ''}" placeholder="Ex: Chapéu de Luz">
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <input class="form-input" id="modal-item-desc" value="${item?.descricao || ''}" placeholder="Opcional">
        </div>
        <div class="form-group">
          <label class="form-label">URL da Imagem</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input class="form-input" id="modal-item-url" value="${item ? imagemDe(item) : ''}" placeholder="/static/loja/item_xxx.png" style="flex:1">
            <button class="btn-upload-store-item" style="padding:6px 12px;font-size:12px;white-space:nowrap">📤 Upload</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Preço (moedas)</label>
          <input class="form-input" id="modal-item-preco" type="number" min="0" value="${item?.preco ?? 0}">
        </div>
        <div class="form-group">
          <label class="form-label">Trilha Requerida (vazio = sem requisito)</label>
          <select class="form-input" id="modal-item-trilha">
            <option value="">Nenhuma</option>
            <option value="" disabled>Carregando trilhas...</option>
          </select>
        </div>
      `,
      aoAbrir: () => carregarOpcoesTrilhas(item?.trilha),
      aoSalvar: async () => {
        const trilhaVal = document.getElementById('modal-item-trilha').value;
        const dados = {
          nome:       document.getElementById('modal-item-nome').value.trim(),
          descricao:  document.getElementById('modal-item-desc').value.trim() || null,
          imagem_path: document.getElementById('modal-item-url').value.trim(),
          preco:      parseInt(document.getElementById('modal-item-preco').value) || 0,
          trilha:     trilhaVal ? parseInt(trilhaVal) : null,
          ativo:      true,
        };
        if (!dados.nome || !dados.imagem_path) {
          Notificacao.erro('Preencha nome e URL da imagem.');
          return;
        }
        const res = item
          ? await window.electronAPI.updatePersonalizacaoItem({ id: item.id, ...dados })
          : await window.electronAPI.createPersonalizacaoItem(dados);
        if (res.success) {
          Modal.fechar();
          Notificacao.sucesso(item ? 'Item atualizado!' : 'Item criado!');
          await carregarItens();
        } else {
          Notificacao.erro('❌ ' + (res.erro || 'Erro ao salvar o item.'));
        }
      },
    });

    document.querySelector('.btn-upload-store-item')?.addEventListener('click', async () => {
      const selecionado = await window.electronAPI.selecionarArquivo({
        titulo: 'Selecionar imagem do item',
        filtros: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
      });
      if (!selecionado || selecionado.canceled || !selecionado.caminho) return;
      const res = await window.electronAPI.uploadPersonalizacaoImagem({ caminhoOrigem: selecionado.caminho, nomeArquivo: selecionado.nome });
      if (res.success) {
        document.getElementById('modal-item-url').value = res.imagem_path;
        Notificacao.sucesso('Imagem enviada!');
      } else {
        Notificacao.erro('❌ ' + (res.erro || 'Erro no upload.'));
      }
    });
  };

  const excluirItem = async (id) => {
    const item = itensLoja.find(i => i.id === id);
    if (!item) return;
    const confirmado = await window.electronAPI.confirm({
      title: 'Excluir Item',
      message: `Excluir o item "${item.nome}"?`,
      detail: 'O registro será removido do banco de dados.',
    });
    if (!confirmado) return;
    const res = await window.electronAPI.deletePersonalizacaoItem(id);
    if (res.success) {
      Notificacao.sucesso('🗑️ Item excluído.');
      await carregarItens();
    } else {
      Notificacao.erro('❌ ' + (res.erro || 'Erro ao excluir o item.'));
    }
  };

  // ── EVENTOS ────────────────────────────────────────────────────────────────

  const registrarEventos = () => {
    document.getElementById('btn-add-avatar')?.addEventListener('click', () => abrirModalAvatar(null));
    document.getElementById('btn-add-store-item')?.addEventListener('click', () => abrirModalItem(null));
  };

  return { init };
})();
