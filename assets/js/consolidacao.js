/**
 * Apoio à confirmação dos dados do prontuário que a IA identifica na análise da consulta.
 *
 * A IA apenas sugere dados que o paciente relatou (alergias, medicamentos, histórico, antecedentes e similares). Só o que o médico confirma no
 * painel "Consolidar no prontuário" ao finalizar chega ao prontuário. Estas funções evitam que uma informação
 * identificada seja perdida em silêncio, por exemplo ao reabrir o rascunho ou ao finalizar com o campo vazio.
 */

/**
 * Dados do prontuário que a IA pode identificar, com o rótulo exibido e o campo do painel que os recebe.
 *
 * São apenas informações relatadas pelo próprio paciente. Resumo, condições ativas, diagnósticos, exames,
 * tratamentos, plano e acompanhamento dependem de julgamento clínico e são preenchidos somente pelo médico.
 */
export const CAMPOS_IDENTIFICADOS = [
  { chave: "alergiasConhecidas", rotulo: "Alergias conhecidas", campo: "#confirmed-allergies" },
  { chave: "medicamentosUsoContinuo", rotulo: "Medicamentos contínuos", campo: "#confirmed-medicines" },
  { chave: "historicoFamiliar", rotulo: "Histórico familiar", campo: "#confirmed-history" },
  { chave: "antecedentesPessoais", rotulo: "Antecedentes pessoais", campo: "#confirmed-personal-history" },
  { chave: "cirurgiasInternacoes", rotulo: "Cirurgias e internações", campo: "#confirmed-surgeries" },
  { chave: "imunizacoes", rotulo: "Imunizações", campo: "#confirmed-immunizations" },
  { chave: "habitosAspectosSociais", rotulo: "Hábitos e aspectos sociais", campo: "#confirmed-habits" }
];

/**
 * @param {*} valor texto devolvido pela IA
 * @returns {boolean} true se o texto traz informação; vazio e "Não informado" não contam
 */
export function temInformacao(valor) {
  const texto = String(valor ?? "").trim();
  return texto !== "" && !/^n[ãa]o informad[oa]\.?$/i.test(texto);
}

/**
 * @param {*} valor texto devolvido pela IA
 * @returns {string} o próprio texto quando traz informação, ou vazio, para preencher o painel sem gravar
 *   "Não informado" no prontuário
 */
export function valorIdentificado(valor) {
  return temInformacao(valor) ? String(valor).trim() : "";
}

/**
 * Lista os dados que a IA identificou e que o médico ainda não confirmou.
 *
 * @param {object|null|undefined} identificados dados identificados na última análise, por chave
 * @param {Object<string, string>} confirmados valores atuais do painel de confirmação, por chave
 * @returns {Array<{chave: string, rotulo: string, campo: string}>} campos identificados com o painel vazio
 */
export function identificadosNaoConfirmados(identificados, confirmados) {
  if (!identificados) return [];
  return CAMPOS_IDENTIFICADOS.filter(({ chave }) =>
    temInformacao(identificados[chave]) && !String(confirmados?.[chave] ?? "").trim());
}
