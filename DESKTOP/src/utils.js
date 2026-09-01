// ─────────────────────────────────────────────────────────────────────────────
// utils.js — Utilitários de segurança para o Renderer (e Main, se necessário)
//
// escapeHTML: escapa caracteres HTML para impedir injeção de scripts (XSS)
// quando dados dinâmicos são interpolados em innerHTML.
// No Renderer (scripts clássicos) fica disponível como window.escapeHTML.
// ─────────────────────────────────────────────────────────────────────────────

const escapeHTML = function (str) {
  if (typeof str !== 'string') return str || '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (match) => map[match]);
};

// Expõe globalmente para o Renderer (vanilla JS, sem módulos).
if (typeof window !== 'undefined') {
  window.escapeHTML = escapeHTML;
}

// Compatibilidade com CommonJS (caso seja usado no Main Process).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeHTML };
}
