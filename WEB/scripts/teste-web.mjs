// ─────────────────────────────────────────────────────────────────────────────
// scripts/teste-web.mjs — Abre e fecha o navegador de teste SEM afetar o Chrome
// do usuário.
//
// REGRAS DE CICLO DE VIDA:
//   • Abre UMA instância isolada do Chrome com perfil TEMPORÁRIO
//     (--user-data-dir num diretório próprio) e porta de depuração dedicada.
//   • No final, fecha APENAS essa instância:
//       1) via CDP `Browser.close` (método nativo — fecha só o navegador de teste);
//       2) fallback: `taskkill /PID <pid> /T /F` — mata SOMENTE a árvore do PID
//          da instância de teste, NUNCA por nome de imagem.
//   • NUNCA usa `taskkill /IM chrome.exe` / `taskkill chrome*`.
//
// Uso como CLI:
//   node scripts/teste-web.mjs [url] [porta]
//
// Uso como módulo:
//   import { abrirBrowserTeste, fechar } from './scripts/teste-web.mjs';
//   const { wsUrl } = await abrirBrowserTeste({ headless: true });
//   ... rodar os testes via CDP ...
//   await fechar();
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CANDIDATOS_CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const CHROME =
  process.env.CHROME_PATH || CANDIDATOS_CHROME.find((p) => fs.existsSync(p));

if (!CHROME) {
  throw new Error('Nenhum navegador Chromium encontrado. Defina CHROME_PATH.');
}

let processo = null;
let pastaPerfil = null;
let porta = 0;

/** Aguarda o endpoint CDP do navegador responder. */
function aguardarCdp(portaAlvo, tentativas = 40) {
  return new Promise((resolve, reject) => {
    const tenta = async (n) => {
      if (n <= 0) return reject(new Error('O navegador de teste não respondeu.'));
      try {
        const r = await fetch(`http://127.0.0.1:${portaAlvo}/json`);
        if (r.ok) {
          const lista = await r.json();
          const pagina = lista.find((t) => t.type === 'page') || lista[0];
          if (pagina?.webSocketDebuggerUrl) return resolve(pagina.webSocketDebuggerUrl);
        }
      } catch { /* ainda iniciando */ }
      setTimeout(() => tenta(n - 1), 1000);
    };
    tenta(tentativas);
  });
}

/**
 * Abre UMA instância isolada do Chrome (perfil temporário) para testes.
 * @param {{portaAlvo?:number, headless?:boolean}} [opts]
 * @returns {Promise<{wsUrl:string, porta:number, pid:number}>}
 */
export async function abrirBrowserTeste({ portaAlvo = 9333, headless = false } = {}) {
  if (processo) throw new Error('Já existe uma instância de teste aberta.');
  porta = portaAlvo;
  pastaPerfil = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-teste-'));

  const args = [
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${pastaPerfil}`,
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new');

  processo = spawn(CHROME, args, { stdio: 'ignore' });

  const wsUrl = await aguardarCdp(porta);
  return { wsUrl, porta, pid: processo.pid };
}

/** Fecha o navegador de teste via CDP (método nativo `Browser.close`). */
async function fecharPorCdp() {
  try {
    const lista = await (await fetch(`http://127.0.0.1:${porta}/json`)).json();
    const alvo = lista.find((t) => t.type === 'page') || lista[0];
    if (!alvo?.webSocketDebuggerUrl) return false;
    const ws = new WebSocket(alvo.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res);
      ws.addEventListener('error', rej);
    });
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await new Promise((r) => setTimeout(r, 800));
    ws.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Fecha APENAS a instância de teste e limpa o perfil temporário.
 * Nunca toca em outros processos do Chrome (nem por nome de imagem).
 */
export async function fechar() {
  let fechado = false;

  if (processo?.pid) {
    // 1) Fechamento nativo via CDP.
    fechado = await fecharPorCdp();

    // 2) Fallback seguro: mata apenas a árvore do PID desta instância.
    if (!fechado) {
      try {
        spawn('taskkill', ['/PID', String(processo.pid), '/T', '/F'], { stdio: 'ignore' });
        fechado = true;
      } catch {
        fechado = false;
      }
    }
  }

  if (pastaPerfil) {
    try {
      fs.rmSync(pastaPerfil, { recursive: true, force: true });
    } catch { /* perfil já removido */ }
  }

  processo = null;
  pastaPerfil = null;
  return fechado;
}

// ── CLI: node scripts/teste-web.mjs [url] [porta] ─────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.argv[2] || 'http://localhost:5173/';
  const portaCli = Number(process.argv[3]) || 9333;

  const { wsUrl } = await abrirBrowserTeste({ portaAlvo: portaCli, headless: false });
  const ws = new WebSocket(wsUrl);
  let msgId = 0;
  const pend = new Map();
  const send = (m, p = {}) => new Promise((res, rej) => {
    const id = ++msgId;
    pend.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });
  ws.addEventListener('message', (ev) => {
    const d = JSON.parse(ev.data);
    if (d.id && pend.has(d.id)) {
      const q = pend.get(d.id);
      pend.delete(d.id);
      d.error ? q.rej(d.error) : q.res(d.result);
    }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });

  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 2500));

  const r = await send('Runtime.evaluate', {
    expression: `({ url: location.href, titulo: document.title, favicon: document.querySelector('link[rel="icon"]')?.getAttribute('href') })`,
    returnByValue: true,
  });
  console.log('RESULTADO_TESTE:', JSON.stringify(r.result?.value));

  ws.close();
  await fechar();
  console.log('Instância de teste fechada com segurança (só a de teste).');
}
