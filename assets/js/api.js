/**
 * Cliente HTTP da API REST do backend.
 *
 * Todas as chamadas passam por request(), que envia o token JWT da sessão, converte as respostas de erro em
 * ApiError e, ao receber HTTP 401 com sessão ativa, encerra a sessão e dispara o evento
 * "sistema-clinico:unauthorized".
 */
import { clearSession, state } from "./state.js";

const API_BASE_URL = window.SISTEMA_CLINICO_API_URL ?? "http://localhost:8080/api";

/** Erro de uma chamada à API, com o status HTTP e as mensagens de validação por campo. */
export class ApiError extends Error {
  /**
   * @param {string} message mensagem para o usuário
   * @param {number} [status] status HTTP; zero quando não houve resposta
   * @param {Object<string, string>} [fields] mensagens de validação por nome de campo
   */
  constructor(message, status = 0, fields = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

/**
 * Executa uma requisição à API.
 *
 * @param {string} path rota relativa à base da API
 * @param {RequestInit} [options] opções do fetch (método, corpo, cabeçalhos)
 * @returns {Promise<any|null>} corpo JSON da resposta, ou null para HTTP 204
 * @throws {ApiError} se não houver conexão ou se a resposta indicar erro
 */
async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (state.session?.token) headers.set("Authorization", `Bearer ${state.session.token}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Não foi possível conectar ao backend. Confirme se a API está em execução.");
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    if (response.status === 401 && state.session) {
      clearSession();
      window.dispatchEvent(new CustomEvent("sistema-clinico:unauthorized"));
    }
    throw new ApiError(body?.mensagem ?? `A requisição falhou (${response.status}).`, response.status, body?.campos ?? {});
  }
  return body;
}

/** Monta as opções de uma requisição com corpo JSON. */
const json = (method, body) => ({ method, body: JSON.stringify(body) });

/**
 * Operações da API agrupadas por assunto: acesso, médicos, pacientes, consultas e consumo de IA.
 * Cada função devolve uma Promise com o corpo JSON da resposta.
 */
export const api = {
  login: (payload) => request("/auth/login", json("POST", payload)),
  getInvite: (token) => request(`/auth/convite?token=${encodeURIComponent(token)}`),
  definePassword: (payload) => request("/auth/definir-senha", json("POST", payload)),
  requestPasswordReset: (payload) => request("/auth/solicitar-recuperacao", json("POST", payload)),
  resetPassword: (payload) => request("/auth/redefinir-senha", json("POST", payload)),
  listDoctors: () => request("/medicos"),
  getDoctor: (id) => request(`/medicos/${id}`),
  createDoctor: (payload) => request("/medicos", json("POST", payload)),
  updateProfile: (payload) => request("/medicos/me", json("PUT", payload)),
  listPatients: () => request("/pacientes"),
  getPatient: (id) => request(`/pacientes/${id}`),
  createPatient: (payload) => request("/pacientes", json("POST", payload)),
  updatePatient: (id, payload) => request(`/pacientes/${id}`, json("PUT", payload)),
  linkDoctor: (patientId, doctorId) => request(`/pacientes/${patientId}/medicos/${doctorId}`, { method: "POST" }),
  getRecord: (patientId) => request(`/pacientes/${patientId}/prontuario`),
  getHistory: (patientId) => request(`/pacientes/${patientId}/consultas`),
  createConsultation: (payload) => request("/consultas", json("POST", payload)),
  listDrafts: () => request("/consultas/rascunhos"),
  getConsultation: (id) => request(`/consultas/${id}`),
  updateConsultation: (id, payload) => request(`/consultas/${id}`, json("PUT", payload)),
  cancelDraft: (id) => request(`/consultas/${id}`, { method: "DELETE" }),
  analyzeConsultation: (id) => request(`/consultas/${id}/analise-ia`, { method: "POST" }),
  finalizeConsultation: (id, payload) => request(`/consultas/${id}/finalizar`, json("POST", payload)),
  getAiUsage: () => request("/ia/uso")
};

export { API_BASE_URL };
