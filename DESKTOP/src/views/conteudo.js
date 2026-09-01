// ─────────────────────────────────────────────────────────────────────────────
// views/conteudo.js  —  Gestão de Conteúdo
//
// Trilhas > Aulas > (Conteúdo, Áudio, Vídeo, Questões).
// Botões: + Nova Trilha, + Aula, + Questão, Editar, Excluir.
// ─────────────────────────────────────────────────────────────────────────────

const ConteudoView = (() => {

  let trilhas = [];
  let licaoSel = null;
  let expandTrilhas = {};

  const init = async () => {
    await carregarTrilhas();
    renderizar();
    registrarEventos();
  };

  const carregarTrilhas = async () => {
    const res = await window.electronAPI.getTrilhas();
    trilhas = res.success ? res.lista : [];
    trilhas.forEach(t => {
      if (expandTrilhas[t.id_trilha] === undefined) expandTrilhas[t.id_trilha] = true;
    });
    if (licaoSel) {
      let found = false;
      for (const t of trilhas) {
        const l = (t.licoes || []).find(x => x.id_licao === licaoSel.id_licao);
        if (l) { licaoSel = l; found = true; break; }
      }
      if (!found) licaoSel = null;
    }
  };

  // ── RENDERIZAÇÃO ──────────────────────────────────────────────────────────

  const renderizar = () => {
    const lista = document.getElementById('questions-list');
    if (!lista) return;

    if (trilhas.length === 0) {
      lista.innerHTML = '<div style="text-align:center;padding:20px 0">' +
        '<p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">Nenhuma trilha encontrada.</p>' +
        '<button class="btn-add" id="btn-add-trilha-inline">+ Nova Trilha</button></div>';
      lista.querySelector('#btn-add-trilha-inline')?.addEventListener('click', () => abrirModalTrilha(null));
      return;
    }

    let html = '';
    trilhas.forEach(trilha => {
      const expandido = expandTrilhas[trilha.id_trilha];
      let licoesHtml = '';
      (trilha.licoes || []).forEach(l => {
        const sel = licaoSel && licaoSel.id_licao === l.id_licao;
        const nP = (l.perguntas || []).length;
        licoesHtml +=
          '<div class="licao-item' + (sel ? ' licao-sel' : '') + '" data-licao-id="' + l.id_licao + '">' +
            '<div class="licao-info">' +
              '<span class="licao-ordem">' + (l.ordem || '–') + '</span>' +
              '<span class="licao-titulo">' + escapeHTML(l.titulo) + '</span>' +
              '<span class="licao-badge">' + nP + ' pergunta' + (nP !== 1 ? 's' : '') + '</span>' +
            '</div>' +
            '<button class="btn-sm btn-del-licao-inline" data-id="' + l.id_licao + '" title="Excluir" onclick="event.stopPropagation()">🗑️</button>' +
          '</div>';
      });

      html +=
        '<div class="trilha-group">' +
          '<div class="trilha-header" data-trilha-id="' + trilha.id_trilha + '">' +
            '<span class="trilha-chevron">' + (expandido ? '▾' : '▸') + '</span>' +
            '<span class="trilha-nome">' + escapeHTML(trilha.nome_trilha) + '</span>' +
            '<span class="trilha-count">' + (trilha.licoes || []).length + ' aula' + ((trilha.licoes || []).length !== 1 ? 's' : '') + '</span>' +
            '<button class="btn-sm btn-add-licao-trilha" data-trilha-id="' + trilha.id_trilha + '" title="Nova aula" onclick="event.stopPropagation()">+ Aula</button>' +
            '<button class="btn-sm btn-edit-trilha" data-trilha-id="' + trilha.id_trilha + '" title="Editar trilha" onclick="event.stopPropagation()">✏️</button>' +
            '<button class="btn-sm btn-del-trilha" data-trilha-id="' + trilha.id_trilha + '" title="Excluir trilha" onclick="event.stopPropagation()">🗑️</button>' +
          '</div>' +
          (expandido ? '<div class="trilha-licoes">' + licoesHtml + '</div>' : '') +
        '</div>';
    });
    lista.innerHTML = html;

    // Eventos
    lista.querySelectorAll('.trilha-header').forEach(el =>
      el.addEventListener('click', () => {
        expandTrilhas[Number(el.dataset.trilhaId)] = !expandTrilhas[Number(el.dataset.trilhaId)];
        renderizar();
      })
    );
    lista.querySelectorAll('.licao-item').forEach(el =>
      el.addEventListener('click', () => {
        const id = Number(el.dataset.licaoId);
        for (const t of trilhas) {
          const f = (t.licoes || []).find(l => l.id_licao === id);
          if (f) { licaoSel = f; break; }
        }
        renderizar();
        renderizarDetalhes();
      })
    );
    lista.querySelectorAll('.btn-add-licao-trilha').forEach(btn =>
      btn.addEventListener('click', () => {
        const tid = Number(btn.dataset.trilhaId);
        const tr = trilhas.find(t => t.id_trilha === tid);
        abrirModalLicao(null, tid, tr ? tr.nome_trilha : '');
      })
    );
    lista.querySelectorAll('.btn-edit-trilha').forEach(btn =>
      btn.addEventListener('click', () => {
        const tr = trilhas.find(t => t.id_trilha === Number(btn.dataset.trilhaId));
        if (tr) abrirModalTrilha(tr);
      })
    );
    lista.querySelectorAll('.btn-del-trilha').forEach(btn =>
      btn.addEventListener('click', async () => {
        const tr = trilhas.find(t => t.id_trilha === Number(btn.dataset.trilhaId));
        if (!tr) return;
        const ok = await window.electronAPI.confirm({
          title: 'Excluir Trilha',
          message: 'Excluir a trilha "' + tr.nome_trilha + '"?',
          detail: (tr.licoes || []).length > 0 ? 'Remova todas as aulas antes de excluir.' : 'Esta ação não pode ser desfeita.',
        });
        if (!ok) return;
        const res = await window.electronAPI.deleteTrilha(tr.id_trilha);
        if (res.success) {
          Notificacao.erro('Trilha excluída.');
          if (licaoSel && tr.licoes && tr.licoes.find(l => l.id_licao === licaoSel.id_licao)) licaoSel = null;
          await carregarTrilhas(); renderizar(); renderizarDetalhes();
        } else { Notificacao.erro(res.erro); }
      })
    );
    lista.querySelectorAll('.btn-del-licao-inline').forEach(btn =>
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        let licao = null;
        for (const t of trilhas) { licao = (t.licoes || []).find(l => l.id_licao === id); if (licao) break; }
        if (!licao) return;
        const ok = await window.electronAPI.confirm({ title: 'Excluir Aula', message: 'Excluir "' + licao.titulo + '" e suas questões?' });
        if (!ok) return;
        const res = await window.electronAPI.deleteLesson(id);
        if (res.success) {
          Notificacao.erro('Aula excluída.');
          if (licaoSel && licaoSel.id_licao === id) licaoSel = null;
          await carregarTrilhas(); renderizar(); renderizarDetalhes();
        } else { Notificacao.erro(res.erro); }
      })
    );
  };

  // ── DETALHES DA AULA ─────────────────────────────────────────────────────

  const renderizarDetalhes = () => {
    const area = document.getElementById('mascot-list');
    if (!area) return;

    if (!licaoSel) {
      area.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;padding:20px 0;text-align:center">Selecione uma aula na lista ao lado para ver seus detalhes.</p>';
      return;
    }

    const l = licaoSel;
    const conteudoLinhas = (l.conteudo || []).join('\n');
    let perguntasHtml = '';
    (l.perguntas || []).forEach((p, i) => {
      let altsHtml = '';
      (p.alternativas || []).forEach(a => {
        altsHtml += '<div class="pergunta-alt' + (a.eh_correta ? ' alt-correta' : '') + '">' +
          '<span class="alt-radio">' + (a.eh_correta ? '●' : '○') + '</span><span>' + escapeHTML(a.texto) + '</span></div>';
      });
      perguntasHtml +=
        '<div class="pergunta-item" data-id="' + p.id_pergunta + '">' +
          '<div class="pergunta-header">' +
            '<span class="pergunta-num">' + (i + 1) + '</span>' +
            '<span class="pergunta-texto">' + escapeHTML(p.enunciado) + '</span>' +
          '</div>' +
          '<div class="pergunta-alts">' + altsHtml + '</div>' +
          (p.explicacao_feedback ? '<div class="pergunta-feedback">💡 ' + escapeHTML(p.explicacao_feedback) + '</div>' : '') +
          '<div class="pergunta-actions">' +
            '<button class="btn-sm btn-edit-pergunta" data-id="' + p.id_pergunta + '" title="Editar">✏️</button>' +
            '<button class="btn-sm btn-del-pergunta" data-id="' + p.id_pergunta + '" title="Excluir">🗑️</button>' +
          '</div>' +
        '</div>';
    });

    const audioHtml = l.audio_url
      ? '<audio controls src="' + escapeHTML(l.audio_url) + '" style="max-width:100%;height:32px"></audio><span class="detalhe-asset-path">' + escapeHTML(l.audio_url) + '</span>'
      : '<em style="color:var(--text-secondary)">Nenhum áudio configurado</em>';
    const videoHtml = l.url_imagem
      ? '<span class="detalhe-asset-path">' + escapeHTML(l.url_imagem) + '</span>'
      : '<em style="color:var(--text-secondary)">Nenhum vídeo/imagem configurado</em>';
    const conteudoHtml = conteudoLinhas
      ? '<div class="detalhe-conteudo">' + escapeHTML(conteudoLinhas) + '</div>'
      : '<div class="detalhe-conteudo"><em style="color:var(--text-secondary)">Nenhum conteúdo definido</em></div>';
    const perguntasCount = (l.perguntas || []).length;
    const perguntasListaHtml = perguntasCount === 0
      ? '<p style="color:var(--text-secondary);font-size:12px;padding:8px 0">Nenhuma questão nesta aula.</p>'
      : perguntasHtml;

    area.innerHTML =
      '<div class="detalhe-licao">' +
        '<div class="detalhe-header">' +
          '<h3 style="margin:0;color:var(--text-primary)">' + escapeHTML(l.titulo) + '</h3>' +
          '<div class="detalhe-actions">' +
            '<button class="btn-sm btn-edit-licao" title="Editar aula">✏️ Editar</button>' +
            '<button class="btn-sm btn-del-licao" title="Excluir aula">🗑️ Excluir</button>' +
          '</div>' +
        '</div>' +
        '<div class="detalhe-campo"><label class="detalhe-label">Conteúdo da Aula</label>' + conteudoHtml + '</div>' +
        '<div class="detalhe-campo"><label class="detalhe-label">Áudio (narração do mascote)</label><div class="detalhe-asset">' + audioHtml + '</div></div>' +
        '<div class="detalhe-campo"><label class="detalhe-label">Vídeo / Imagem do Mascote</label><div class="detalhe-asset">' + videoHtml + '</div></div>' +
        '<div class="detalhe-campo"><label class="detalhe-label">Recompensa</label><span class="detalhe-meta">Moedas máx: ' + (l.recompensa_moedas_max || 30) + '</span></div>' +
        '<div class="detalhe-secao">' +
          '<div class="detalhe-secao-header">' +
            '<label class="detalhe-label" style="margin:0">Questões (' + perguntasCount + ')</label>' +
            '<button class="btn-sm btn-add-pergunta" title="Nova questão">+ Questão</button>' +
          '</div>' +
          '<div id="detalhe-perguntas">' + perguntasListaHtml + '</div>' +
        '</div>' +
      '</div>';

    area.querySelector('.btn-edit-licao')?.addEventListener('click', () => abrirModalLicao(licaoSel));
    area.querySelector('.btn-del-licao')?.addEventListener('click', async () => {
      const ok = await window.electronAPI.confirm({ title: 'Excluir Aula', message: 'Excluir "' + licaoSel.titulo + '" e todas as questões?' });
      if (!ok) return;
      const res = await window.electronAPI.deleteLesson(licaoSel.id_licao);
      if (res.success) { licaoSel = null; Notificacao.erro('Aula excluída.'); await carregarTrilhas(); renderizar(); renderizarDetalhes(); }
      else Notificacao.erro(res.erro);
    });
    area.querySelector('.btn-add-pergunta')?.addEventListener('click', () => abrirModalPergunta(null, licaoSel.id_licao));

    area.querySelectorAll('.btn-edit-pergunta').forEach(btn =>
      btn.addEventListener('click', () => {
        const p = (licaoSel.perguntas || []).find(x => x.id_pergunta === Number(btn.dataset.id));
        if (p) abrirModalPergunta(p, licaoSel.id_licao);
      })
    );
    area.querySelectorAll('.btn-del-pergunta').forEach(btn =>
      btn.addEventListener('click', async () => {
        const p = (licaoSel.perguntas || []).find(x => x.id_pergunta === Number(btn.dataset.id));
        if (!p) return;
        const ok = await window.electronAPI.confirm({ title: 'Excluir Questão', message: 'Excluir "' + p.enunciado.slice(0, 50) + '..."?' });
        if (!ok) return;
        const res = await window.electronAPI.deleteQuestion(p.id_pergunta);
        if (res.success) { Notificacao.erro('Questão excluída.'); await carregarTrilhas(); renderizar(); renderizarDetalhes(); }
        else Notificacao.erro(res.erro);
      })
    );
  };

  // ── MODAL: TRILHA ─────────────────────────────────────────────────────────

  const abrirModalTrilha = (trilha) => {
    const isNew = !trilha;
    Modal.abrir({
      titulo: isNew ? '+ Nova Trilha' : 'Editar Trilha',
      labelBotao: isNew ? 'Criar' : 'Salvar',
      conteudo: '<div class="form-group">' +
        '<label class="form-label">Nome da Trilha *</label>' +
        '<input class="form-input" id="f-trilha-nome" value="' + escapeHTML(trilha ? trilha.nome_trilha : '') + '" placeholder="Ex: Mentalidade Financeira">' +
        '</div>',
      aoSalvar: async () => {
        const nome = document.getElementById('f-trilha-nome').value.trim();
        if (!nome) { Notificacao.erro('Preencha o nome.'); return; }
        if (isNew) {
          const res = await window.electronAPI.createTrilha({ nome_trilha: nome });
          if (res.success) { Modal.fechar(); Notificacao.sucesso('Trilha criada!'); await carregarTrilhas(); renderizar(); }
          else Notificacao.erro(res.erro);
        } else {
          const res = await window.electronAPI.updateTrilha({ id: trilha.id_trilha, nome_trilha: nome });
          if (res.success) { Modal.fechar(); Notificacao.sucesso('Trilha atualizada!'); await carregarTrilhas(); renderizar(); }
          else Notificacao.erro(res.erro);
        }
      },
    });
  };

  // ── MODAL: LIÇÃO ──────────────────────────────────────────────────────────

  const abrirModalLicao = (licao, trilhaIdFixa, trilhaNome) => {
    const isNew = !licao;
    const opcoesTrilhas = trilhas.map(t =>
      '<option value="' + t.id_trilha + '" ' + ((licao && licao.id_trilha === t.id_trilha) || t.id_trilha === trilhaIdFixa ? 'selected' : '') + '>' + escapeHTML(t.nome_trilha) + '</option>'
    ).join('');

    const conteudoVal = licao ? (licao.conteudo || []).join('\n') : '';
    const audioVal = licao ? (licao.audio_url || '') : '';
    const videoVal = licao ? (licao.url_imagem || '') : '';
    const disableTrilha = (!isNew || trilhaIdFixa) ? 'disabled' : '';

    Modal.abrir({
      titulo: isNew ? '+ Nova Aula' : 'Editar: ' + licao.titulo,
      labelBotao: isNew ? 'Criar Aula' : 'Salvar',
      conteudo:
        '<div class="form-group"><label class="form-label">Trilha *</label>' +
        '<select class="form-input" id="f-licao-trilha" ' + disableTrilha + '>' + opcoesTrilhas + '</select></div>' +
        '<div class="form-group"><label class="form-label">Título da Aula *</label>' +
        '<input class="form-input" id="f-licao-titulo" value="' + escapeHTML(licao ? licao.titulo : '') + '" placeholder="Ex: O que são Juros?"></div>' +
        '<div class="form-group"><label class="form-label">Ordem</label>' +
        '<input class="form-input" id="f-licao-ordem" type="number" min="1" value="' + (licao ? licao.ordem : 1) + '"></div>' +
        '<div class="form-group"><label class="form-label">Conteúdo da Aula (texto que o aluno lê)</label>' +
        '<textarea class="form-input" id="f-licao-conteudo" style="min-height:120px;resize:vertical" placeholder="Separe parágrafos por quebra de linha.">' + escapeHTML(conteudoVal) + '</textarea></div>' +
        '<div class="form-group"><label class="form-label">Áudio (narração do mascote)</label>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<input class="form-input" id="f-licao-audio" value="' + escapeHTML(audioVal) + '" placeholder="/static/audios/audio_xxx.mp3" style="flex:1">' +
        '<button class="btn-upload-media" data-tipo="audio" style="padding:6px 12px;font-size:12px;white-space:nowrap">📤 Upload</button></div></div>' +
        '<div class="form-group"><label class="form-label">Vídeo / Imagem do Mascote</label>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<input class="form-input" id="f-licao-video" value="' + escapeHTML(videoVal) + '" placeholder="/static/videos/video_xxx.mp4" style="flex:1">' +
        '<button class="btn-upload-media" data-tipo="video" style="padding:6px 12px;font-size:12px;white-space:nowrap">📤 Upload</button></div></div>' +
        '<div class="form-group" style="display:flex;gap:12px">' +
        '<div style="flex:1"><label class="form-label">Recompensa em Moedas</label>' +
        '<input class="form-input" id="f-licao-moedas" type="number" min="0" value="' + (licao ? (licao.recompensa_moedas_max || 30) : 30) + '"></div></div>',
      aoSalvar: async () => {
        const dados = {
          titulo: document.getElementById('f-licao-titulo').value.trim(),
          conteudo_video: document.getElementById('f-licao-conteudo').value,
          conteudo_audio: document.getElementById('f-licao-audio').value.trim() || null,
          url_imagem: document.getElementById('f-licao-video').value.trim() || null,
          recompensa_moedas_max: parseInt(document.getElementById('f-licao-moedas').value) || 30,
          ordem: parseInt(document.getElementById('f-licao-ordem').value) || 1,
        };
        if (!dados.titulo) { Notificacao.erro('Preencha o título.'); return; }

        // Feedback visual: desabilita o botão e mostra "Salvando..." durante a requisição
        const btnSalvar = document.getElementById('modal-save');
        const rotuloOriginal = btnSalvar ? btnSalvar.textContent : '';
        if (btnSalvar) { btnSalvar.textContent = 'Salvando...'; btnSalvar.disabled = true; }

        try {
          if (isNew) {
            dados.id_trilha = trilhaIdFixa || Number(document.getElementById('f-licao-trilha').value);
            const res = await window.electronAPI.createLesson(dados);
            if (res.success) { Modal.fechar(); Notificacao.sucesso('Aula criada!'); expandTrilhas[dados.id_trilha] = true; await carregarTrilhas(); renderizar(); }
            else Notificacao.erro(res.erro);
          } else {
            dados.id = licao.id_licao;
            const res = await window.electronAPI.updateLesson(dados);
            if (res.success) { Modal.fechar(); Notificacao.sucesso('Aula atualizada!'); await carregarTrilhas(); renderizar(); renderizarDetalhes(); }
            else Notificacao.erro(res.erro);
          }
        } finally {
          if (btnSalvar && document.getElementById('modal-save')) {
            btnSalvar.textContent = rotuloOriginal;
            btnSalvar.disabled = false;
          }
        }
      },
    });

    document.querySelectorAll('.btn-upload-media').forEach(btn =>
      btn.addEventListener('click', async () => {
        const tipo = btn.dataset.tipo;
        const selecionado = await window.electronAPI.selecionarArquivo({
          titulo: tipo === 'audio' ? 'Selecionar áudio' : 'Selecionar vídeo/imagem',
          filtros: tipo === 'audio'
            ? [{ name: 'Áudios', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }]
            : [{ name: 'Vídeos/Imagens', extensions: ['mp4', 'webm', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
        });
        if (!selecionado || selecionado.canceled || !selecionado.caminho) return;
        const res = await window.electronAPI.uploadMedia({
          caminhoOrigem: selecionado.caminho,
          nomeArquivo: selecionado.nome,
          tipo,
        });
        if (res.success) {
          document.getElementById(tipo === 'audio' ? 'f-licao-audio' : 'f-licao-video').value = res.url;
          Notificacao.sucesso('Arquivo enviado!');
        } else Notificacao.erro(res.erro);
      })
    );
  };

  // ── MODAL: PERGUNTA ──────────────────────────────────────────────────────

  const abrirModalPergunta = (pergunta, idLicao) => {
    const isNew = !pergunta;
    const alts = pergunta ? pergunta.alternativas.slice() : [];
    while (alts.length < 4) alts.push({ texto: '', eh_correta: false });
    const corretaIdx = alts.findIndex(a => a.eh_correta);

    let altsHtml = '';
    alts.forEach((a, i) => {
      altsHtml +=
        '<div class="alt-row">' +
          '<input type="radio" name="f-alt-correta" value="' + i + '" ' + (i === corretaIdx ? 'checked' : '') + ' class="alt-radio-input">' +
          '<input class="form-input alt-input" id="f-alt-' + i + '" value="' + escapeHTML(a.texto || '') + '" placeholder="Alternativa ' + String.fromCharCode(65 + i) + '">' +
        '</div>';
    });

    Modal.abrir({
      titulo: isNew ? '+ Nova Questão' : 'Editar Questão',
      labelBotao: isNew ? 'Criar' : 'Salvar',
      conteudo:
        '<div class="form-group"><label class="form-label">Enunciado *</label>' +
        '<textarea class="form-input" id="f-perg-enunciado" style="min-height:70px;resize:vertical" placeholder="Digite a pergunta...">' + escapeHTML(pergunta ? pergunta.enunciado : '') + '</textarea></div>' +
        '<div class="form-group"><label class="form-label">Alternativas (marque a correta)</label>' +
        '<div class="alternativas-editor">' + altsHtml + '</div></div>' +
        '<div class="form-group"><label class="form-label">Explicação / Feedback (opcional)</label>' +
        '<textarea class="form-input" id="f-perg-feedback" style="min-height:50px;resize:vertical" placeholder="Texto quando o aluno acerta ou erra...">' + escapeHTML(pergunta ? (pergunta.explicacao_feedback || '') : '') + '</textarea></div>',
      aoSalvar: async () => {
        const enunciado = document.getElementById('f-perg-enunciado').value.trim();
        if (!enunciado) { Notificacao.erro('Digite o enunciado.'); return; }
        const ci = Number(document.querySelector('input[name="f-alt-correta"]:checked')?.value ?? 0);
        const alternativas = [];
        for (let i = 0; i < 4; i++) {
          const txt = document.getElementById('f-alt-' + i).value.trim();
          if (txt) alternativas.push({ texto: txt, eh_correta: i === ci });
        }
        if (alternativas.length < 2) { Notificacao.erro('Preencha pelo menos 2 alternativas.'); return; }
        const dados = {
          id_licao: idLicao, enunciado,
          explicacao_feedback: document.getElementById('f-perg-feedback').value.trim() || null,
          alternativas,
        };
        if (isNew) {
          const res = await window.electronAPI.createQuestion(dados);
          if (res.success) { Modal.fechar(); Notificacao.sucesso('Questão criada!'); await carregarTrilhas(); renderizar(); renderizarDetalhes(); }
          else Notificacao.erro(res.erro);
        } else {
          dados.id = pergunta.id_pergunta;
          const res = await window.electronAPI.updateQuestion(dados);
          if (res.success) { Modal.fechar(); Notificacao.sucesso('Questão atualizada!'); await carregarTrilhas(); renderizar(); renderizarDetalhes(); }
          else Notificacao.erro(res.erro);
        }
      },
    });
  };

  // ── EVENTOS ───────────────────────────────────────────────────────────────

  const registrarEventos = () => {
    document.getElementById('btn-add-question')?.addEventListener('click', () => abrirModalTrilha(null));

    document.getElementById('mascot-list')?.addEventListener('click', () => {});
  };

  return { init };
})();

const ContentView = ConteudoView;
