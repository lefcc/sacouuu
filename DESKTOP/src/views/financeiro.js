// ─────────────────────────────────────────────────────────────────────────────
// views/financeiro.js  —  Página Unificada de Gestão Financeira por Escola
//
// Antes existiam 2 modais (Contrato e Faturas) + 1 página geral, tudo
// fragmentado. Agora tudo vive em UMA página acessada pelo botão "💰 Financeiro"
// da tabela de escolas:
//
//   Seção 1  → Contrato (Setup + Por Aluno + status + Editar Contrato)
//   Seção 2  → Gerar Fatura do Mês (com preview do valor antes de confirmar)
//   Seção 3  → Histórico de Faturas (Mês | Valor | Vencimento | Status | Ações)
//
// A página recebe o `escola_id` via window.SacouFinanceiro (state do router),
// tem um botão "← Voltar" que retorna para a Gestão de Escolas.
// ─────────────────────────────────────────────────────────────────────────────

const FinanceiroView = (() => {

  // Escola atualmente em exibição ({ id, name })
  let escolaAtual = null;

  // Contrato carregado (para preencher o modal de edição)
  let contratoAtual = null;

  // Faturas carregadas da escola
  let faturas = [];

  // Arquivos de contrato anexados à escola
  let arquivos = [];

  // ── UTILITÁRIOS ───────────────────────────────────────────────────────────

  const formatarValor = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const formatarData = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
  };

  const formatarMes = (mes) => {
    // 'YYYY-MM' → 'AGOSTO/2026' (legível)
    if (!mes) return '—';
    const [ano, m] = mes.split('-');
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const nome = nomes[Number(m) - 1] || m;
    return `${nome}/${ano}`;
  };

  // ── CARREGAMENTO DE DADOS ─────────────────────────────────────────────────

  /**
   * Busca contrato + faturas da escola e repinta as 3 seções da página.
   */
  const carregarDados = async () => {
    if (!escolaAtual) return;

    const resContrato = await window.electronAPI.getContratoEscola(escolaAtual.id);
    contratoAtual = resContrato.success ? resContrato.contrato : null;

    const resFaturas = await window.electronAPI.getFaturasEscola(escolaAtual.id);
    faturas = resFaturas.success ? resFaturas.lista : [];

    const resArquivos = await window.electronAPI.getContratoArquivos(escolaAtual.id);
    arquivos = resArquivos.success ? resArquivos.lista : [];

    renderizarContrato();
    renderizarFaturas();
    renderizarDocumentos();
    atualizarPreview();
  };

  // ── SEÇÃO 1: CONTRATO (card) ──────────────────────────────────────────────

  /**
   * Renderiza o card do contrato com Setup, Por Aluno, status e botão de editar.
   */
  const renderizarContrato = () => {
    const card = document.getElementById('fin-contrato-card');
    if (!card) return;

    if (!contratoAtual) {
      card.innerHTML = `
        <div class="fin-vazio">
          <span style="font-size:30px">📄</span>
          <p>Esta escola ainda não possui contrato.</p>
          <button class="btn-add" id="btn-editar-contrato">✏️ Criar Contrato</button>
        </div>`;
      registrarBotaoEditarContrato();
      return;
    }

    const ativo = !!contratoAtual.ativo;
    card.innerHTML = `
      <div class="fin-contrato-linha">
        <div class="fin-contrato-item">
          <span class="fin-contrato-label">Setup</span>
          <span class="fin-contrato-valor">R$ ${formatarValor(contratoAtual.valor_setup)}</span>
        </div>
        <div class="fin-contrato-item">
          <span class="fin-contrato-label">Por Aluno</span>
          <span class="fin-contrato-valor">R$ ${formatarValor(contratoAtual.valor_por_aluno)}</span>
        </div>
        <div class="fin-contrato-item">
          <span class="fin-contrato-label">Status</span>
          <span class="badge-fatura ${ativo ? 'pago' : 'vencido'}">${ativo ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>
      <button class="btn-add" id="btn-editar-contrato">✏️ Editar Contrato</button>`;

    registrarBotaoEditarContrato();
  };

  /**
   * Liga o botão "Editar Contrato" (criado dinamicamente) ao modal.
   */
  const registrarBotaoEditarContrato = () => {
    document.getElementById('btn-editar-contrato')?.addEventListener('click', abrirModalEditarContrato);
  };

  /**
   * Abre o modal de edição do contrato com os campos pré-preenchidos.
   * Ao salvar chama PUT /financeiro/contratos/{escola_id} e atualiza o card.
   */
  const abrirModalEditarContrato = () => {
    if (!escolaAtual) return;

    Modal.abrir({
      titulo: `✏️ Editar Contrato — ${escolaAtual.name}`,
      labelBotao: 'Salvar Contrato',
      conteudo: `
        <div class="form-group">
          <label class="form-label">Valor de Setup (R$) *</label>
          <input class="form-input" id="f-setup" type="number" min="0" step="0.01"
            value="${contratoAtual ? contratoAtual.valor_setup : ''}" placeholder="Ex: 500,00">
        </div>
        <div class="form-group">
          <label class="form-label">Valor por Aluno (R$) *</label>
          <input class="form-input" id="f-por-aluno" type="number" min="0" step="0.01"
            value="${contratoAtual ? contratoAtual.valor_por_aluno : ''}" placeholder="Ex: 10,00">
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="f-contrato-ativo" ${contratoAtual ? (contratoAtual.ativo ? 'checked' : '') : 'checked'}>
          <label class="form-label" for="f-contrato-ativo" style="margin:0">Contrato ativo</label>
        </div>
        <p style="color:var(--text-secondary);font-size:12px;line-height:1.5;margin:0">
          A fatura do mês calcula: <strong>Setup (na 1ª fatura)</strong> +
          <strong>alunos ativos × valor por aluno</strong>.
        </p>
      `,
      aoSalvar: async () => {
        const valorSetup = parseFloat(document.getElementById('f-setup')?.value);
        const valorAluno = parseFloat(document.getElementById('f-por-aluno')?.value);
        const ativo      = document.getElementById('f-contrato-ativo')?.checked ?? true;

        if (isNaN(valorSetup) || isNaN(valorAluno) || valorSetup < 0 || valorAluno < 0) {
          Notificacao.erro('Informe valores válidos para Setup e Valor por Aluno.');
          return;
        }

        // PUT /financeiro/contratos/{escola_id} atualiza contrato existente;
        // POST /financeiro/contratos cria quando ainda não existe.
        const resultado = contratoAtual
          ? await window.electronAPI.updateContratoEscola(escolaAtual.id, {
              valor_setup: valorSetup,
              valor_por_aluno: valorAluno,
              ativo,
            })
          : await window.electronAPI.saveContratoEscola({
              escola_id: escolaAtual.id,
              valor_setup: valorSetup,
              valor_por_aluno: valorAluno,
              ativo,
            });

        if (resultado.success) {
          Modal.fechar();
          await carregarDados();
          Notificacao.sucesso('✅ Contrato salvo com sucesso!');
        } else {
          Notificacao.erro('❌ ' + (resultado.erro || 'Erro ao salvar o contrato.'));
        }
      },
    });
  };

  // ── SEÇÃO 2: GERAR FATURA DO MÊS (preview + geração) ──────────────────────

  /**
   * Recalcula o preview do valor da fatura sempre que o mês mudar.
   * O preview vem do backend (GET /financeiro/faturas/preview) com a MESMA
   * regra de cálculo usada na geração — o usuário confirma antes de gravar.
   */
  const atualizarPreview = async () => {
    const previewEl = document.getElementById('fin-preview');
    const mesEl     = document.getElementById('fin-mes');
    if (!previewEl || !mesEl) return;

    const mes = mesEl.value;
    if (!escolaAtual || !mes) {
      previewEl.innerHTML = '';
      return;
    }

    previewEl.innerHTML = '<span class="fin-preview-carregando">Calculando preview...</span>';

    const res = await window.electronAPI.previewFatura({ escola_id: escolaAtual.id, mes_referencia: mes });
    if (!res.success) {
      previewEl.innerHTML = `
        <span class="fin-preview-erro">⚠️ ${res.erro || 'Não foi possível calcular o preview.'}</span>`;
      return;
    }

    const p = res.preview;
    const alunos = p.qtd_alunos;
    const porAluno = formatarValor(p.valor_por_aluno);

    if (p.ja_existe) {
      previewEl.innerHTML = `
        <span class="fin-preview-erro">⚠️ Já existe fatura para ${formatarMes(p.mes_referencia)}.</span>`;
      return;
    }

    // Monta a "conta" exibida: inclui o Setup apenas na 1ª fatura.
    const parcelas = [];
    if (p.inclui_setup) {
      parcelas.push(`Setup R$ ${formatarValor(p.valor_setup)}`);
    }
    if (alunos > 0) {
      parcelas.push(`${alunos} aluno${alunos !== 1 ? 's' : ''} × R$ ${porAluno}`);
    }
    if (parcelas.length === 0) parcelas.push('R$ 0,00');

    previewEl.innerHTML = `
      <span class="fin-preview-texto">
        💡 ${parcelas.join(' + ')} = <strong>R$ ${formatarValor(p.valor_total)}</strong>
      </span>`;
  };

  /**
   * Gera a fatura do mês confirmada (POST /financeiro/faturas/gerar).
   */
  const gerarFatura = async () => {
    const mesEl = document.getElementById('fin-mes');
    const mes   = mesEl?.value;
    if (!escolaAtual) { Notificacao.erro('Selecione uma escola primeiro.'); return; }
    if (!mes) { Notificacao.erro('Informe o mês de referência.'); return; }

    const resultado = await window.electronAPI.gerarFatura({ escola_id: escolaAtual.id, mes_referencia: mes });
    if (resultado.success) {
      await carregarDados();
      Notificacao.sucesso('✅ Fatura gerada com sucesso!');
    } else {
      Notificacao.erro('❌ ' + (resultado.erro || 'Erro ao gerar fatura.'));
    }
  };

  // ── SEÇÃO 3: HISTÓRICO DE FATURAS ─────────────────────────────────────────

  /**
   * Monta a tabela de faturas (Mês | Valor | Vencimento | Status | Ações).
   * A coluna Status usa badge colorido; o botão alterna para Pago/Em aberto.
   */
  const renderizarFaturas = () => {
    const corpo = document.getElementById('faturas-tbody');
    if (!corpo) return;

    if (faturas.length === 0) {
      corpo.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:24px">
        Nenhuma fatura gerada ainda.
      </td></tr>`;
      return;
    }

    corpo.innerHTML = faturas.map(f => {
      const pago = f.status === 'PAGO';
      return `
        <tr data-id="${f.id_fatura}" data-status="${f.status}">
          <td><strong>${formatarMes(f.mes_referencia)}</strong></td>
          <td>R$ ${formatarValor(f.valor_total)}</td>
          <td>${formatarData(f.data_vencimento)}</td>
          <td>
            <span class="badge-fatura ${pago ? 'pago' : 'pendente'}">
              ${pago ? 'Pago' : 'Em aberto'}
            </span>
          </td>
          <td>
            <button class="action-btn btn-toggle-status" data-id="${f.id_fatura}" data-status="${f.status}">
              ${pago ? '↩️ Reabrir' : '✓ Marcar Pago'}
            </button>
          </td>
        </tr>`;
    }).join('');
  };

  /**
   * Alterna o status da fatura (PATCH /financeiro/faturas/{id}) e atualiza
   * a tabela instantaneamente, sem recarregar a página.
   * @param {number} id - ID da fatura
   * @param {string} statusAtual - 'PAGO' ou 'EM_ABERTO'
   */
  const alternarStatusFatura = async (id, statusAtual) => {
    const novo = statusAtual === 'PAGO' ? 'EM_ABERTO' : 'PAGO';
    const res = await window.electronAPI.updateFaturaStatus(id, novo);
    if (res.success) {
      await carregarDados();
      Notificacao.sucesso(novo === 'PAGO' ? '✅ Fatura marcada como paga!' : '✅ Fatura reaberta.');
    } else {
      Notificacao.erro('❌ ' + (res.erro || 'Erro ao atualizar status.'));
    }
  };

  // ── SEÇÃO 4: DOCUMENTOS DO CONTRATO ───────────────────────────────────────

  /**
   * Monta a lista de documentos anexados (ícone + nome + data + ações).
   * Cada item tem "Baixar/Abrir" e "Excluir".
   */
  const renderizarDocumentos = () => {
    const lista = document.getElementById('fin-docs-lista');
    if (!lista) return;

    if (arquivos.length === 0) {
      lista.innerHTML = '<p class="fin-vazio">Nenhum documento anexado ainda.</p>';
      return;
    }

    lista.innerHTML = arquivos.map(a => {
      const ehPdf = (a.nome_original || '').toLowerCase().endsWith('.pdf');
      return `
        <div class="fin-doc-item" data-id="${a.id_arquivo}">
          <div class="fin-doc-icone">${ehPdf ? '📄' : '🖼️'}</div>
          <div class="fin-doc-info">
            <span class="fin-doc-nome" title="${a.nome_original}">${a.nome_original}</span>
            <span class="fin-doc-data">Anexado em ${formatarData(a.data_upload)}</span>
          </div>
          <div class="fin-doc-item-acoes">
            <button class="action-btn btn-doc-download" data-id="${a.id_arquivo}">⬇️ Baixar/Abrir</button>
            <button class="action-btn danger btn-doc-delete" data-id="${a.id_arquivo}">🗑️ Excluir</button>
          </div>
        </div>`;
    }).join('');
  };

  /**
   * Abre o seletor de arquivos do SO, envia via FormData para a API e
   * atualiza a lista na hora (o arquivo aparece imediatamente).
   */
  const anexarArquivo = async () => {
    if (!escolaAtual) { Notificacao.erro('Selecione uma escola primeiro.'); return; }

    const selecionado = await window.electronAPI.selectContratoArquivo();
    if (!selecionado || selecionado.canceled || !selecionado.caminho) return;

    const resultado = await window.electronAPI.uploadContratoArquivo({
      escolaId: escolaAtual.id,
      caminhoOrigem: selecionado.caminho,
      nomeArquivo: selecionado.nome,
    });

    if (resultado.success) {
      await carregarDados();
      Notificacao.sucesso('✅ Documento anexado com sucesso!');
    } else {
      Notificacao.erro('❌ ' + (resultado.erro || 'Erro ao anexar o arquivo.'));
    }
  };

  /**
   * Baixa o arquivo para uma pasta temporária e abre no leitor padrão do SO.
   * @param {number} id - ID do arquivo
   */
  const baixarArquivo = async (id) => {
    const arquivo = arquivos.find(a => a.id_arquivo === id);
    if (!arquivo) return;

    const resultado = await window.electronAPI.downloadContratoArquivo({
      arquivoId: id,
      nomeArquivo: arquivo.nome_original,
    });

    if (resultado.success) {
      await window.electronAPI.abrirArquivo(resultado.caminho);
    } else {
      Notificacao.erro('❌ ' + (resultado.erro || 'Erro ao baixar o arquivo.'));
    }
  };

  /**
   * Pede confirmação e exclui o documento (registro + arquivo físico no servidor).
   * @param {number} id - ID do arquivo
   */
  const excluirArquivo = async (id) => {
    const arquivo = arquivos.find(a => a.id_arquivo === id);
    if (!arquivo) return;

    const confirmado = await window.electronAPI.confirm({
      title: 'Excluir Documento',
      message: `Excluir "${arquivo.nome_original}"?`,
      detail: 'O arquivo será removido do histórico e apagado dos uploads.',
    });
    if (!confirmado) return;

    const resultado = await window.electronAPI.deleteContratoArquivo(id);
    if (resultado.success) {
      arquivos = arquivos.filter(a => a.id_arquivo !== id);
      renderizarDocumentos();
      Notificacao.sucesso('🗑️ Documento excluído.');
    } else {
      Notificacao.erro('❌ ' + (resultado.erro || 'Erro ao excluir o documento.'));
    }
  };

  // ── NAVEGAÇÃO E EVENTOS ───────────────────────────────────────────────────

  /**
   * Abre a página unificada de gestão financeira de uma escola específica.
   * Chamado pelo botão "💰 Financeiro" da tabela de escolas.
   * @param {number} escolaId - ID da escola
   * @param {string} escolaNome - Nome da escola
   */
  const abrirFinanceiroPorEscola = (escolaId, escolaNome) => {
    escolaAtual = { id: escolaId, name: escolaNome };

    const titulo = document.getElementById('fin-titulo');
    if (titulo) titulo.textContent = `Gestão Financeira — ${escolaNome}`;

    const mesEl = document.getElementById('fin-mes');
    if (mesEl) mesEl.value = new Date().toISOString().slice(0, 7);

    carregarDados();
  };

  /**
   * Inicializa a página e liga os eventos.
   */
  const init = async () => {
    registrarEventos();
  };

  const registrarEventos = () => {
    // "← Voltar" → retorna para a Gestão de Escolas
    document.getElementById('btn-voltar-escolas')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('sacou:voltar-escolas'));
    });

    // Mudou o mês → recalcula o preview do valor da fatura
    document.getElementById('fin-mes')?.addEventListener('change', atualizarPreview);

    // Gerar fatura confirmada
    document.getElementById('btn-gerar-fatura')?.addEventListener('click', gerarFatura);

    // Alternar status (Marcar Pago / Reabrir) nas linhas de faturas
    document.getElementById('faturas-tbody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-toggle-status');
      if (!btn) return;
      alternarStatusFatura(Number(btn.dataset.id), btn.dataset.status);
    });

    // Anexar arquivo de contrato (abre o seletor de arquivos do SO)
    document.getElementById('btn-anexar-contrato')?.addEventListener('click', anexarArquivo);

    // Baixar/Abrir e Excluir na lista de documentos
    document.getElementById('fin-docs-lista')?.addEventListener('click', (e) => {
      const item = e.target.closest('.fin-doc-item');
      if (!item) return;
      const id = Number(item.dataset.id);

      if (e.target.closest('.btn-doc-download')) baixarArquivo(id);
      if (e.target.closest('.btn-doc-delete'))   excluirArquivo(id);
    });
  };

  // Expõe os métodos públicos
  return { init, abrirFinanceiroPorEscola };

})();
