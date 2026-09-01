/**
 * formatCurrency.js — Utilitário de formatação monetária (BRL).
 *
 * Padroniza a exibição de valores em reais em todo o Web:
 *   formatBRL(1250)      → "R$ 1.250,00"
 *   formatBRL(540)       → "R$ 540,00"
 *   formatBRL(0)         → "R$ 0,00"
 *   formatBRL(null)      → "R$ 0,00"
 */

export const formatBRL = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default formatBRL;
