import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { api } from '../api/api';

const perfilTraduzido = {
  ADMIN: 'Administrador',
  COORDENADOR: 'Coordenador',
  PROFESSOR: 'Professor',
  ALUNO: 'Aluno',
};

const UsuariosPage = () => {
  const { escolaAtual, usuario } = useSchool();
  const idEscola = escolaAtual?.id_escola;
  // Professor (VISUALIZADOR_ESCOLA) não pode gerenciar coordenadores/professores.
  const ehProfessor = usuario?.perfil === 'VISUALIZADOR_ESCOLA' || usuario?.tipo_perfil === 'PROFESSOR';

  const [usuarios, setUsuarios] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [pesquisa, setPesquisa] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tipoPerfil, setTipoPerfil] = useState('ALUNO');
  const [idTurma, setIdTurma] = useState('');
  const [salvando, setSalvando] = useState(false);

  // ── Edição ───────────────────────────────────────────────────────────────
  const [editando, setEditando] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPerfil, setEditPerfil] = useState('ADMIN_ESCOLA');
  const [editSenha, setEditSenha] = useState('');
  const [alterarSenha, setAlterarSenha] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  // Erro isolado do modal de edição — não polui o banner principal da página.
  const [erroModal, setErroModal] = useState('');

  // ── Arquivamento ─────────────────────────────────────────────────────────
  const [arquivandoId, setArquivandoId] = useState(null);

  const carregarDados = async () => {
    if (!idEscola) return;
    setCarregando(true);
    setErro('');
    try {
      const [lista, listaTurmas] = await Promise.all([
        api.escola.usuarios.listar(idEscola),
        api.escola.turmas.listar(idEscola),
      ]);
      setUsuarios(lista.data);
      setTurmas(listaTurmas.data);
      if (listaTurmas.data.length > 0) setIdTurma(String(listaTurmas.data[0].id_turma));
    } catch {
      setErro('Não foi possível carregar os usuários.');
    } finally {
      setCarregando(false);
    }
  };

  // Intencional: recarrega apenas quando o idEscola muda (carregarDados é
  // chamado manualmente após CRUD).
  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEscola]);

  const handleCadastrar = async (e) => {
    e.preventDefault();
    if (!idEscola) return;
    if (!senha || senha.trim() === '') {
      setErro('A senha é obrigatória para criar um usuário.');
      return;
    }
    if (senha.length < 6 || !/\d/.test(senha)) {
      setErro('A senha deve ter no mínimo 6 caracteres e conter pelo menos 1 número.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await api.escola.usuarios.criar(idEscola, {
        nome_completo: nome,
        email,
        senha,
        tipo_perfil: tipoPerfil,
        id_escola: idEscola,
        id_turma: tipoPerfil === 'ALUNO' ? Number(idTurma) : null,
      });
      setNome('');
      setEmail('');
      setSenha('');
      setMostrarForm(false);
      await carregarDados();
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Erro ao cadastrar o usuário.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicao = (user) => {
    setEditando(user);
    setEditNome(user.nome_completo);
    setEditEmail(user.email);
    setEditPerfil(user.perfil === 'VISUALIZADOR_ESCOLA' ? 'VISUALIZADOR_ESCOLA' : 'ADMIN_ESCOLA');
    setEditSenha('');
    setAlterarSenha(false);
    setErroModal('');
  };

  const fecharEdicao = () => {
    setEditando(null);
    setEditNome('');
    setEditEmail('');
    setEditSenha('');
    setAlterarSenha(false);
    setErroModal('');
  };

  const handleEditar = async (e) => {
    e.preventDefault();
    if (!editando) return;
    setSalvandoEdicao(true);
    setErroModal('');
    try {
      const dados = {
        nome_completo: editNome,
        email: editEmail,
      };
      if (editando.perfil !== 'ALUNO') dados.perfil = editPerfil;
      if (alterarSenha && editSenha) dados.senha = editSenha;
      await api.escola.usuarios.editar(editando.id_usuario, dados);
      fecharEdicao();
      await carregarDados();
    } catch (err) {
      setErroModal(err?.response?.data?.detail || 'Erro ao editar o usuário.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleArquivar = async (user) => {
    if (!user) return;
    const alvoArquivado = user.arquivado;
    setArquivandoId(user.id_usuario);
    setErro('');
    try {
      await api.escola.usuarios.arquivar(user.id_usuario, !alvoArquivado);
      await carregarDados();
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Erro ao arquivar o usuário.');
    } finally {
      setArquivandoId(null);
    }
  };

  const usuariosFiltrados = usuarios.filter(user =>
    user.nome_completo.toLowerCase().includes(pesquisa.toLowerCase()) ||
    user.email.toLowerCase().includes(pesquisa.toLowerCase()) ||
    (user.nome_turma || '').toLowerCase().includes(pesquisa.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-title font-bold text-brand-dark dark:text-white">
          Gerenciar Usuários - {escolaAtual?.nome_instituicao || 'Escola'}
        </h1>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="bg-brand-purple text-white px-6 py-2 rounded-xl font-title hover:bg-opacity-90 transition-all shadow-md"
        >
          {mostrarForm ? 'Cancelar' : '+ Cadastrar Usuário'}
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-body font-semibold rounded-xl p-4">
          {erro}
        </div>
      )}

      {mostrarForm && (
        <form onSubmit={handleCadastrar} className="bg-white dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border grid grid-cols-1 md:grid-cols-3 gap-4 items-end animate-fadeIn">
          <div>
            <label className="block text-sm font-semibold mb-1">Nome</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple" required />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@email.com" className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple" required />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Senha *</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres e 1 número"
              autoComplete="new-password"
              required
              className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Perfil</label>
            <select value={tipoPerfil} onChange={(e) => setTipoPerfil(e.target.value)} className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple">
              <option value="ALUNO">Aluno</option>
              <option value="PROFESSOR">Professor</option>
              <option value="COORDENADOR">Coordenador</option>
            </select>
          </div>
          {tipoPerfil === 'ALUNO' && (
            <div>
              <label className="block text-sm font-semibold mb-1">Turma</label>
              <select value={idTurma} onChange={(e) => setIdTurma(e.target.value)} className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple">
                {turmas.length === 0 && <option value="">Nenhuma turma</option>}
                {turmas.map(t => (
                  <option key={t.id_turma} value={t.id_turma}>{t.nome_serie} - {t.nome_turma}</option>
                ))}
              </select>
              <p className="text-xs text-brand-muted font-body mt-1">
                Opcional: Selecione uma turma para vincular o aluno imediatamente. Caso contrário, ele poderá ser adicionado depois na página de Turmas.
              </p>
            </div>
          )}
          <div className="col-span-1">
            <button type="submit" disabled={salvando} className="w-full bg-brand-green text-white p-3 rounded-xl font-title font-bold hover:bg-opacity-95 disabled:opacity-60">
              {salvando ? 'Salvando...' : 'Salvar Usuário'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border p-6">
        <div className="mb-6 flex items-center bg-brand-input-bg dark:bg-brand-dark-input rounded-xl p-3 border-2 border-transparent focus-within:border-brand-purple transition-all">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-brand-muted mr-3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            type="text"
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            placeholder="Buscar por nome, e-mail ou turma..."
            className="w-full bg-transparent outline-none font-body text-brand-dark dark:text-white"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-brand-beige dark:bg-brand-dark-surface/80">
              <tr>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Nome</th>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">E-mail</th>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Perfil</th>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Turma</th>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Status</th>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border dark:divide-brand-dark-border">
              {carregando ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-brand-muted font-body">Carregando usuarios...</td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-brand-muted font-body">Nenhum usuario encontrado.</td>
                </tr>
              ) : (
                usuariosFiltrados.map((user) => {
                  const podeGerenciar = !(ehProfessor && (user.perfil === 'ADMIN_ESCOLA' || user.perfil === 'VISUALIZADOR_ESCOLA'));
                  const podeEditar = !ehProfessor && podeGerenciar;
                  return (
                    <tr key={user.id_usuario} className="hover:bg-brand-beige dark:hover:bg-brand-dark-surface/50 transition-colors">
                      <td className="p-4 font-body font-medium flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-purple/10 text-brand-purple flex items-center justify-center font-bold text-xs">
                          {user.nome_completo.charAt(0)}
                        </div>
                        {user.nome_completo}
                      </td>
                      <td className="p-4 font-body text-brand-muted dark:text-brand-muted-dark">{user.email}</td>
                      <td className="p-4 font-body text-brand-muted dark:text-brand-muted-dark">{perfilTraduzido[user.tipo_perfil] || user.tipo_perfil}</td>
                      <td className="p-4 font-body text-brand-muted dark:text-brand-muted-dark">{user.nome_turma}</td>
                      <td className="p-4 font-body">
                        {user.arquivado || !user.status_ativo ? (
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">Arquivado</span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">Ativo</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          {podeEditar && (
                            <button
                              onClick={() => abrirEdicao(user)}
                              className="px-3 py-1.5 rounded-lg font-body text-sm text-brand-purple border border-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
                            >
                              Editar
                            </button>
                          )}
                          {podeGerenciar && (
                            <button
                              onClick={() => handleArquivar(user)}
                              disabled={arquivandoId === user.id_usuario}
                              className={`px-3 py-1.5 rounded-lg font-body text-sm transition-colors text-white disabled:opacity-60 ${
                                user.arquivado || !user.status_ativo
                                  ? 'bg-brand-green hover:opacity-90'
                                  : 'bg-red-400 hover:bg-red-500'
                              }`}
                            >
                              {arquivandoId === user.id_usuario
                                ? '...'
                                : user.arquivado || !user.status_ativo
                                  ? 'Reativar'
                                  : 'Arquivar'}
                            </button>
                          )}
                          {!podeGerenciar && (
                            <span className="text-xs text-brand-muted">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edição */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-xl border border-brand-border dark:border-brand-dark-border w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-title font-bold text-brand-dark dark:text-white">Editar Usuário</h2>
              <button onClick={fecharEdicao} className="text-brand-muted hover:text-brand-dark dark:hover:text-white" aria-label="Fechar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <form onSubmit={handleEditar} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nome</label>
                <input
                  type="text"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">E-mail</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Perfil (Cargo)</label>
                {editando.perfil === 'ALUNO' ? (
                  <input
                    type="text"
                    value="Aluno"
                    disabled
                    className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none opacity-60"
                  />
                ) : (
                  <select
                    value={editPerfil}
                    onChange={(e) => setEditPerfil(e.target.value)}
                    className="w-full p-3 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple"
                  >
                    <option value="ADMIN_ESCOLA">Coordenador</option>
                    <option value="VISUALIZADOR_ESCOLA">Professor</option>
                  </select>
                )}
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alterarSenha}
                    onChange={(e) => setAlterarSenha(e.target.checked)}
                    className="w-4 h-4 accent-brand-purple"
                  />
                  Alterar senha
                </label>
                <p className="text-xs text-brand-muted font-body mt-1">
                  Deixe em branco para manter a senha atual.
                </p>
                {alterarSenha && (
                  <input
                    type="password"
                    value={editSenha}
                    onChange={(e) => setEditSenha(e.target.value)}
                    placeholder="Nova senha (mínimo 6 caracteres)"
                    autoComplete="new-password"
                    className="w-full p-3 mt-2 rounded-xl border-2 border-brand-border dark:bg-brand-dark-input dark:text-white outline-none focus:border-brand-purple"
                  />
                )}
              </div>

              {erroModal && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-body font-semibold rounded-xl p-3">
                  {erroModal}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharEdicao}
                  className="px-5 py-2.5 rounded-xl font-body text-sm font-semibold text-brand-muted border border-brand-border hover:bg-brand-beige dark:hover:bg-brand-dark-surface/80 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoEdicao}
                  className="px-5 py-2.5 rounded-xl bg-brand-purple text-white font-body text-sm font-semibold hover:bg-opacity-90 transition-all disabled:opacity-60"
                >
                  {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;
