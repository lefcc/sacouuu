export const diasDesde = (iso) => {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;

  const inicio = Date.UTC(data.getFullYear(), data.getMonth(), data.getDate());
  const hoje = new Date();
  const fim = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  return Math.floor((fim - inicio) / (1000 * 60 * 60 * 24));
};

export default diasDesde;
