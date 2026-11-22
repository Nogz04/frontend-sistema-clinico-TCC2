/**
 * Funções de apoio à interface: seleção de elementos, formatação, máscaras, avisos e estados de carregamento.
 */
export const qs = (selector, root = document) => root.querySelector(selector);
/** Seleciona todos os elementos que correspondem ao seletor, como array. */
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

/**
 * Escapa caracteres especiais de HTML. Todo texto vindo do servidor ou do usuário deve passar por aqui antes de
 * ser inserido em um template, para evitar injeção de código.
 *
 * @param {*} [value] valor a escapar
 * @returns {string} texto seguro para HTML
 */
export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

/**
 * Formata uma data no padrão brasileiro. Datas sem horário são tratadas ao meio-dia, para o fuso horário não
 * deslocar o dia.
 *
 * @param {string} value data ISO (AAAA-MM-DD) ou data e hora ISO
 * @param {Intl.DateTimeFormatOptions} [options] estilo de formatação
 * @returns {string} data formatada, ou "Não informado" se vazia
 */
export function formatDate(value, options = { dateStyle: "medium" }) {
  if (!value) return "Não informado";
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

/**
 * @param {string} date data de nascimento (AAAA-MM-DD)
 * @returns {string} idade em anos completos, ou "—" se vazia
 */
export function ageFrom(date) {
  if (!date) return "—";
  const birth = new Date(`${date}T12:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return `${age} anos`;
}

/**
 * Aplica a máscara 000.000.000-00 ao valor digitado.
 *
 * @param {string} [value] texto com ou sem pontuação
 * @returns {string} CPF mascarado, limitado a 11 dígitos
 */
export function maskCpf(value = "") {
  const digits = String(value).replace(/\D/g, "").slice(0, 11);
  return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Exibe um aviso temporário no canto da tela (some após cerca de 5 segundos).
 *
 * @param {string} title título do aviso
 * @param {string} message detalhe do aviso
 * @param {"success"|"error"} [type] tipo do aviso
 */
export function toast(title, message, type = "success") {
  const region = qs("#toast-region");
  const element = document.createElement("div");
  element.className = `toast ${type === "error" ? "toast--error" : ""}`;
  element.innerHTML = `<span class="toast__icon"><i class="fa-solid ${type === "error" ? "fa-triangle-exclamation" : "fa-check"}"></i></span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(message)}</small></span><button type="button" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>`;
  element.querySelector("button").addEventListener("click", () => element.remove());
  region.append(element);
  setTimeout(() => element.remove(), 5200);
}

/**
 * Coloca um botão em estado de processamento, desabilitando-o, ou restaura o seu conteúdo original.
 *
 * @param {HTMLButtonElement|null} button botão afetado
 * @param {boolean} busy true para iniciar o processamento, false para restaurar
 * @param {string} [label] texto exibido durante o processamento
 */
export function setBusy(button, busy, label = "Processando") {
  if (!button) return;
  if (busy) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>${label}`;
  } else {
    button.disabled = false;
    if (button.dataset.original) button.innerHTML = button.dataset.original;
  }
}

/**
 * Mostra, em cada campo do formulário, a mensagem de validação devolvida pela API, além da mensagem geral.
 *
 * @param {HTMLFormElement} form formulário enviado
 * @param {ApiError} error erro da requisição
 */
export function applyApiErrors(form, error) {
  qsa(".field-error", form).forEach((field) => field.textContent = "");
  for (const [name, message] of Object.entries(error.fields ?? {})) {
    const input = form.elements.namedItem(name);
    const field = input?.closest(".field");
    const target = field?.querySelector(".field-error");
    if (target) target.textContent = message;
  }
  const message = qs("[data-form-message]", form) ?? qs("#login-message", form);
  if (message) {
    message.textContent = error.message;
    message.hidden = false;
  }
}

/**
 * @param {HTMLFormElement} form formulário
 * @returns {Object<string, FormDataEntryValue>} valores dos campos por nome
 */
export function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

/**
 * @param {string} icon classe do ícone Font Awesome
 * @param {string} title título
 * @param {string} message explicação
 * @param {string} [action] HTML de um botão de ação opcional
 * @returns {string} HTML do estado vazio
 */
export function emptyState(icon, title, message, action = "") {
  return `<div class="empty-state"><div><span class="empty-state__icon"><i class="fa-solid ${icon}"></i></span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p>${action}</div></div>`;
}

/**
 * Atualiza o cabeçalho da página e o título da aba.
 *
 * @param {string} eyebrow texto curto acima do título
 * @param {string} title título da página
 */
export function setPageMeta(eyebrow, title) {
  qs("#page-eyebrow").textContent = eyebrow;
  qs("#page-title").textContent = title;
  document.title = `${title} · Sistema Clínico`;
}

/**
 * @param {number} [count] quantidade de cartões
 * @returns {string} HTML de cartões de carregamento, exibidos enquanto a tela é montada
 */
export function skeletons(count = 4) {
  return `<div class="grid grid--${Math.min(count, 4)}">${Array.from({ length: count }, () => '<div class="card skeleton"></div>').join("")}</div>`;
}
