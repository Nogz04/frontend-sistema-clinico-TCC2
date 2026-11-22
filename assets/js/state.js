/**
 * Estado mínimo da sessão. O JWT usa sessionStorage para não sobreviver ao
 * fechamento da aba; dados clínicos nunca são armazenados localmente.
 */
const SESSION_KEY = "sistema-clinico.session";
const THEME_KEY = "sistema-clinico.theme";

/** Estado em memória da aplicação: sessão autenticada e dados já carregados para a tela corrente. */
export const state = {
  session: readSession(),
  patients: [],
  doctors: [],
  currentPatient: null,
  currentConsultation: null
};

/**
 * Lê a sessão guardada na aba. Um valor corrompido é descartado.
 *
 * @returns {object|null} sessão do médico, ou null se não houver
 */
function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) ?? null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

/**
 * Guarda a sessão autenticada (inclui o token JWT) pelo tempo de vida da aba.
 *
 * @param {object} session resposta do login
 */
export function setSession(session) {
  state.session = session;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/** Encerra a sessão e descarta todos os dados em memória. */
export function clearSession() {
  state.session = null;
  state.patients = [];
  state.doctors = [];
  state.currentPatient = null;
  state.currentConsultation = null;
  sessionStorage.removeItem(SESSION_KEY);
}

/** Aplica o tema salvo ou, na falta dele, a preferência do sistema operacional. */
export function initializeTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const preferred = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(saved === "dark" || saved === "light" ? saved : preferred);
}

/** Alterna entre os temas claro e escuro. */
export function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

/**
 * Aplica e persiste o tema, atualizando o ícone do botão e a cor da barra do navegador.
 *
 * @param {"light"|"dark"} theme tema desejado
 */
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  document.querySelectorAll(".theme-toggle i").forEach((icon) => {
    icon.className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#09191d" : "#123f4a");
}

/**
 * @param {string} [name] nome completo
 * @returns {string} iniciais das duas primeiras palavras, em maiúsculas
 */
export function initials(name = "Médico") {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
