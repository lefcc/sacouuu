import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { api } from '../api/api';
import { diasDesde } from '../utils/diasDesde';

const formatarData = (iso) => {
  if (!iso) return null;
  const [data] = String(iso).split('T');
  const [ano, mes, dia] = data.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : null;
};

const formatarNota = (valor) => {
  if (valor === null || valor === undefined) return '—';
  return Number(valor)
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/0$/, '');
};

const DesempenhoAlunos = () => {
  const { escolaAtual } = useSchool();
  const idEscola = escolaAtual?.id_escola;

  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregarDados = async () => {
    if (!idEscola) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.escola.getDesempenhoAlunos(idEscola);
      setDados(data);
    } catch {
      setErro('Não foi possível carregar o desempenho dos alunos.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEscola]);

  const classificarUltimaAtividade = (aluno) => {
    const data = formatarData(aluno.data_ultima_atividade);
    if (!data) {
      return { data: '—', label: null, classeData: 'text-brand-muted dark:text-brand-muted-dark', classeBadge: '' };
    }

    const dias = diasDesde(aluno.data_ultima_atividade);

    if (dias <= 10) {
      return { data, label: null, classeData: 'text-brand-muted dark:text-brand-muted-dark', classeBadge: '' };
    }

    if (dias <= 20) {
      return { data, label: 'Atenção', classeData: 'text-amber-700 font-semibold', classeBadge: 'bg-amber-100 text-amber-700' };
    }

    return { data, label: 'Risco Crítico', classeData: 'text-red-700 font-semibold', classeBadge: 'bg-red-100 text-red-700' };
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-title font-bold text-brand-dark dark:text-white">
          Desempenho dos Alunos - {escolaAtual?.nome_instituicao || 'Escola'}
        </h1>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-body font-semibold rounded-xl p-4">
          {erro}
        </div>
      )}

      <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-brand-beige dark:bg-brand-dark-surface/80">
              <tr>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Nome</th>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Turma</th>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Aulas Concluídas</th>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Nota Média</th>
                <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Última Atividade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border dark:divide-brand-dark-border">
              {carregando ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-brand-muted font-body">Carregando dados...</td>
                </tr>
              ) : dados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-brand-muted font-body">Nenhum aluno encontrado</td>
                </tr>
              ) : (
                dados.map((aluno) => (
                  <tr key={aluno.id_usuario} className="hover:bg-brand-beige dark:hover:bg-brand-dark-surface/50 transition-colors">
                    <td className="p-4 font-body font-medium flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-purple/10 text-brand-purple flex items-center justify-center font-bold text-xs">
                        {aluno.nome_completo.charAt(0)}
                      </div>
                      {aluno.nome_completo}
                    </td>
                    <td className="p-4 font-body text-brand-muted dark:text-brand-muted-dark">{aluno.nome_turma || '—'}</td>
                    <td className="p-4 font-body text-brand-muted dark:text-brand-muted-dark">{aluno.total_licoes_concluidas}</td>
                    <td className="p-4 font-body text-brand-muted dark:text-brand-muted-dark">{formatarNota(aluno.nota_media)}</td>
                    <td className="p-4 font-body">
                      {(() => {
                        const { data, label, classeData, classeBadge } = classificarUltimaAtividade(aluno);
                        return (
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <span className={classeData}>{data}</span>
                            {label && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${classeBadge}`}>
                                {label}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DesempenhoAlunos;
