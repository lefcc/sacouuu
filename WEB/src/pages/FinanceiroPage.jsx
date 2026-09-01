import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { api } from '../api/api';
import { formatBRL } from '../utils/formatCurrency';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const formatarMesReferencia = (mes) => {
  if (!mes) return '—';
  const [ano, mesNum] = String(mes).split('-');
  const nome = MESES[Number(mesNum) - 1];
  return nome ? `Mensalidade Escolar - ${nome}/${ano}` : String(mes);
};

const formatarData = (iso) => {
  if (!iso) return '—';
  const [data] = String(iso).split('T');
  const [ano, mes, dia] = data.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : '—';
};

const FinanceiroPage = () => {
  const { escolaAtual } = useSchool();
  const idEscola = escolaAtual?.id_escola;

  const [faturas, setFaturas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [contrato, setContrato] = useState(null);
  const [arquivos, setArquivos] = useState([]);
  const [carregandoContrato, setCarregandoContrato] = useState(true);

  useEffect(() => {
    if (!idEscola) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    api.financeiro.faturas
      .listar(idEscola)
      .then(({ data }) => setFaturas(data || []))
      .catch(() => {
        setFaturas([]);
        setErro('Não foi possível carregar as faturas da escola.');
      })
      .finally(() => setCarregando(false));
  }, [idEscola]);

  useEffect(() => {
    if (!idEscola) {
      setCarregandoContrato(false);
      return;
    }
    setCarregandoContrato(true);
    const buscaContrato = api.financeiro.contratos
      .listar(idEscola)
      .then(({ data }) => setContrato((data || [])[0] || null))
      .catch(() => setContrato(null));

    const buscaArquivos = api.financeiro.contratos.arquivos
      .listar(idEscola)
      .then(({ data }) => setArquivos(data || []))
      .catch(() => setArquivos([]));

    Promise.all([buscaContrato, buscaArquivos]).finally(() =>
      setCarregandoContrato(false),
    );
  }, [idEscola]);

  const situacaoFatura = (fatura) => {
    if (fatura.status === 'PAGO') {
      return { texto: 'Pago', classe: 'bg-emerald-100 text-emerald-700' };
    }
    if (fatura.data_vencimento && new Date(fatura.data_vencimento) < new Date()) {
      return { texto: 'Vencido', classe: 'bg-red-100 text-red-700' };
    }
    return { texto: 'Em Aberto', classe: 'bg-amber-100 text-amber-700 animate-pulse' };
  };

  const baixarBoleto = (fatura) => {
    if (!fatura?.boleto_url) return;
    window.open(fatura.boleto_url, '_blank', 'noopener,noreferrer');
  };

  const baixarArquivoContrato = async (arquivo) => {
    try {
      const { data } = await api.financeiro.contratos.arquivos.baixar(arquivo.id_arquivo);
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = arquivo.nome_original || 'contrato.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setErro('Não foi possível baixar o documento do contrato.');
    }
  };

  const arquivoContrato = arquivos.length > 0 ? arquivos[0] : null;
  const contratoAtivo = Boolean(contrato?.ativo);
  const statusContrato = contratoAtivo
    ? 'Status: Ativo'
    : 'Status: Sem contrato ativo';

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-title font-bold text-brand-dark dark:text-white">
        Gestão Financeira - {escolaAtual?.nome_instituicao || 'Escola'}
      </h1>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-body font-semibold rounded-xl p-4">
          {erro}
        </div>
      )}

      {/* Contrato Ativo (dados reais da API) */}
      <div className="bg-white dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-brand-beige rounded-xl text-brand-purple text-2xl font-bold">PDF</div>
          <div>
            <h2 className="text-lg font-title font-bold text-brand-dark dark:text-white">
              Contrato de Prestação de Serviços Pedagógicos
            </h2>
            {carregandoContrato ? (
              <p className="text-sm text-brand-muted font-body">Carregando contrato...</p>
            ) : (
              <p className="text-sm text-brand-muted font-body">
                {statusContrato}
                {contratoAtivo && (
                  <>
                    {' '}
                    | Setup: {formatBRL(contrato.valor_setup)} | Aluno ativo:{' '}
                    {formatBRL(contrato.valor_por_aluno)}/mês
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        {!carregandoContrato && arquivoContrato ? (
          <button
            onClick={() => baixarArquivoContrato(arquivoContrato)}
            className="bg-brand-purple hover:bg-opacity-90 text-white font-body text-sm font-semibold px-6 py-3 rounded-xl transition-all shadow-sm"
          >
            Visualizar Contrato
          </button>
        ) : (
          <button
            disabled
            className="bg-brand-muted/40 text-brand-muted cursor-not-allowed font-body text-sm font-semibold px-6 py-3 rounded-xl shadow-sm"
          >
            Documento não anexado
          </button>
        )}
      </div>

      {/* Histórico de Faturas (dados reais da API) */}
      <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm border border-brand-border dark:border-brand-dark-border p-6">
        <h2 className="text-xl font-title font-bold text-brand-dark dark:text-white mb-6">Histórico de Faturas</h2>

        {carregando ? (
          <div className="text-center text-brand-muted font-body py-10">
            Carregando faturas...
          </div>
        ) : faturas.length === 0 ? (
          <div className="text-center text-brand-muted font-body py-10">
            Nenhuma fatura cadastrada para esta escola.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-brand-beige dark:bg-brand-dark-surface/80">
                <tr>
                  <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Referência</th>
                  <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Valor</th>
                  <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Vencimento</th>
                  <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen">Situação</th>
                  <th className="p-4 font-title text-brand-purple dark:text-brand-lightGreen text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-brand-dark-border">
                {faturas.map((fatura) => {
                  const situacao = situacaoFatura(fatura);
                  return (
                    <tr key={fatura.id_fatura} className="hover:bg-brand-beige dark:hover:bg-brand-dark-surface/50 transition-colors">
                      <td className="p-4 font-body font-medium text-brand-dark dark:text-white">
                        {formatarMesReferencia(fatura.mes_referencia)}
                      </td>
                      <td className="p-4 font-body text-brand-muted dark:text-brand-muted-dark">
                        {formatBRL(fatura.valor_total)}
                      </td>
                      <td className="p-4 font-body text-brand-muted dark:text-brand-muted-dark">
                        {formatarData(fatura.data_vencimento)}
                      </td>
                      <td className="p-4 font-body">
                        <span className={`${situacao.classe} px-3 py-1 rounded-full text-xs font-bold`}>
                          {situacao.texto}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {fatura.boleto_url ? (
                          <button
                            onClick={() => baixarBoleto(fatura)}
                            className="text-brand-purple font-semibold text-sm hover:underline"
                          >
                            Baixar Boleto
                          </button>
                        ) : (
                          <span className="text-brand-muted dark:text-brand-muted-dark text-sm font-body">
                            Indisponível
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceiroPage;
