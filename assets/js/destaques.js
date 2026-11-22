/**
 * Destaque de trechos dentro de uma caixa de texto (textarea), usado para mostrar ao médico onde uma sugestão da IA
 * aceita ou recusada está no SOAP.
 *
 * Uma textarea não pinta partes do próprio texto. Por isso cada caixa fica dentro de um contêiner que tem, atrás
 * dela, uma camada com o mesmo texto e a mesma formatação, em que o trecho é envolvido por um marcador colorido.
 * O texto dessa camada é transparente: só o fundo do marcador aparece, por baixo da textarea.
 */
import { escapeHtml } from "./ui.js";

/** Trechos destacados de cada caixa de texto. */
const destaques = new WeakMap();

/** Classe de cor de cada tipo de destaque. */
const CLASSES = { aceita: "hl--ok", recusada: "hl--no" };

/**
 * @param {string} texto texto a normalizar
 * @returns {string} texto em minúsculas, para comparar sem diferenciar maiúsculas de minúsculas
 */
function normaliza(texto) {
  return texto.toLocaleLowerCase("pt-BR");
}

/**
 * @param {string} texto conteúdo da caixa de texto
 * @param {string} trecho trecho procurado
 * @returns {boolean} true se o trecho já está no texto, sem diferenciar maiúsculas de minúsculas
 */
export function contemTrecho(texto, trecho) {
  return normaliza(texto).includes(normaliza(trecho.trim()));
}

/**
 * @param {HTMLTextAreaElement} campo caixa de texto
 * @returns {HTMLElement|null} camada de destaque que fica atrás da caixa
 */
function camada(campo) {
  return campo.parentElement?.querySelector(".mirror-field__backdrop") ?? null;
}

/**
 * Redesenha a camada de destaque com o texto atual da caixa. Cada trecho é procurado de novo a cada chamada, então
 * o destaque acompanha as edições do médico e some quando o trecho é apagado.
 *
 * @param {HTMLTextAreaElement} campo caixa de texto
 */
function pintar(campo) {
  const fundo = camada(campo);
  if (!fundo) return;
  const texto = campo.value;
  const minusculo = normaliza(texto);
  const faixas = [];
  for (const { trecho, tipo } of destaques.get(campo) ?? []) {
    const inicio = minusculo.indexOf(normaliza(trecho));
    if (inicio >= 0) faixas.push({ inicio, fim: inicio + trecho.length, tipo });
  }
  faixas.sort((a, b) => a.inicio - b.inicio);
  let html = "";
  let cursor = 0;
  for (const faixa of faixas) {
    if (faixa.inicio < cursor) continue;
    html += `${escapeHtml(texto.slice(cursor, faixa.inicio))}<mark class="hl ${CLASSES[faixa.tipo]}">${escapeHtml(texto.slice(faixa.inicio, faixa.fim))}</mark>`;
    cursor = faixa.fim;
  }
  // O caractere invisível no fim mantém a altura quando o texto termina com quebra de linha.
  fundo.innerHTML = `${html}${escapeHtml(texto.slice(cursor))}\u200b`;
  fundo.scrollTop = campo.scrollTop;
}

/**
 * Liga, uma única vez, os eventos que mantêm a camada alinhada com a caixa de texto.
 *
 * @param {HTMLTextAreaElement} campo caixa de texto
 */
function ligar(campo) {
  if (campo.dataset.destaquesLigados) return;
  campo.dataset.destaquesLigados = "true";
  campo.addEventListener("input", () => pintar(campo));
  campo.addEventListener("scroll", () => {
    const fundo = camada(campo);
    if (fundo) fundo.scrollTop = campo.scrollTop;
  });
}

/**
 * Destaca um trecho da caixa de texto. Um trecho destacado de novo troca de cor.
 *
 * @param {HTMLTextAreaElement} campo caixa de texto dentro de um contêiner com camada de destaque
 * @param {string} trecho texto a destacar
 * @param {"aceita"|"recusada"} tipo verde para a sugestão aceita e vermelho para a recusada
 */
export function destacar(campo, trecho, tipo) {
  ligar(campo);
  const chave = normaliza(trecho.trim());
  const lista = (destaques.get(campo) ?? []).filter((item) => normaliza(item.trecho) !== chave);
  lista.push({ trecho: trecho.trim(), tipo });
  destaques.set(campo, lista);
  pintar(campo);
}

/**
 * Remove todos os destaques da caixa de texto, por exemplo quando uma nova análise substitui o conteúdo.
 *
 * @param {HTMLTextAreaElement} campo caixa de texto
 */
export function limparDestaques(campo) {
  destaques.delete(campo);
  pintar(campo);
}
