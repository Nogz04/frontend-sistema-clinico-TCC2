/**
 * Controlador da aplicação de página única: sessão, rotas por hash, ligação dos eventos às telas e chamadas à API.
 *
 * Fluxos principais: acesso (login, convite e recuperação de senha), pacientes, consulta (transcrição, análise
 * pela IA, revisão e finalização), prontuário e painel de uso da IA.
 */
import { api, ApiError } from "./api.js";
import { clearSession, initializeTheme, initials, setSession, state, toggleTheme } from "./state.js";
import { SpeechTranscriber } from "./speech.js";
import { applyApiErrors, escapeHtml, formObject, formatDate, maskCpf, qs, qsa, setBusy, setPageMeta, skeletons, toast } from "./ui.js";
import { aiUsageView, consultationView, dashboardView, doctorsView, patientDetailView, patientsTable, patientsView, profileView, recordDocumentView, suggestionsHtml } from "./views.js";
import { downloadMedicalRecordPdf } from "./pdf.js";
import { CAMPOS_IDENTIFICADOS, identificadosNaoConfirmados, valorIdentificado } from "./consolidacao.js";
import { contemTrecho, destacar, limparDestaques } from "./destaques.js";
import { ligarExpansao, prepararTextosLongos } from "./expansao.js";

/** Transcrição de fala da tela de consulta aberta; é encerrada ao trocar de tela. */
let transcriber = null;
/** Posição, na caixa de texto, a partir da qual vai o texto provisório da transcrição. */
let interimStart = 0;

/** Dados do prontuário que a IA identificou na última análise da consulta aberta; null se ainda não houve análise. */
let identifiedRecordData = null;

initializeTheme();
bindGlobalEvents();
renderSession();

/** Liga os eventos fixos da página: formulários, menu, tema, máscaras e botões de cadastro. */
function bindGlobalEvents() {
  qsa(".theme-toggle").forEach((button) => button.addEventListener("click", toggleTheme));
  ligarExpansao(qs("#view"));
  qs(".password-toggle").addEventListener("click", togglePassword);
  qs("#login-form").addEventListener("submit", handleLogin);
  qs("#patient-form").addEventListener("submit", handlePatientSubmit);
  qs("#doctor-form").addEventListener("submit", handleDoctorSubmit);
  qs("#invite-form").addEventListener("submit", handleInviteSubmit);
  qs("#recovery-request-form").addEventListener("submit", handleRecoveryRequest);
  qs("#password-reset-form").addEventListener("submit", handlePasswordReset);
  qs("#logout-button").addEventListener("click", logout);
  qs(".menu-toggle").addEventListener("click", () => qs("#sidebar").classList.add("open"));
  qs(".sidebar-close").addEventListener("click", () => qs("#sidebar").classList.remove("open"));
  qsa("[data-go-profile]").forEach((button) => button.addEventListener("click", () => location.hash = "#/perfil"));
  window.addEventListener("hashchange", renderSession);
  window.addEventListener("sistema-clinico:unauthorized", () => {
    renderSession();
    toast("Sessão encerrada", "Entre novamente para continuar.", "error");
  });
  document.addEventListener("input", applyMasks);
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-new-patient]")) openPatientDialog();
    if (event.target.closest("[data-new-doctor]")) {
      const dialog = qs("#doctor-dialog");
      const input = dialog.querySelector('input[name="clinicaAtuacao"]');
      if (input) {
        input.value = state.session?.clinicaAtuacao || "";
      }
      dialog.showModal();
    }
  });
}

/** Alterna a exibição da senha digitada no login. */
function togglePassword() {
  const input = qs('#login-form input[name="senha"]');
  input.type = input.type === "password" ? "text" : "password";
  qs(".password-toggle i").className = input.type === "password" ? "fa-regular fa-eye" : "fa-regular fa-eye-slash";
}

/** Autentica o médico e abre a sessão. */
async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = qs('button[type="submit"]', form);
  qs("#login-message").hidden = true;
  setBusy(button, true, "Autenticando");
  try {
    const payload = formObject(form);
    const session = await api.login(payload);
    setSession(session);
    form.reset();
    renderSession();
    toast("Acesso confirmado", `Bem-vindo, ${session.nomeCompleto}.`);
  } catch (error) {
    applyApiErrors(form, normalizeError(error));
  } finally {
    setBusy(button, false);
  }
}

/**
 * Decide qual tela exibir: convite, recuperação de senha, login ou a aplicação autenticada, de acordo com a rota
 * e com a sessão.
 */
function renderSession() {
  const invitationRoute = currentRoute().path === "/definir-senha";
  const recoveryRoute = ["/recuperar-senha", "/redefinir-senha"].includes(currentRoute().path);
  qs("#invite-screen").hidden = !invitationRoute;
  qs("#recovery-screen").hidden = !recoveryRoute;
  if (invitationRoute) {
    qs("#auth-screen").hidden = true;
    qs("#app-shell").hidden = true;
    document.title = "Definir senha · Sistema Clínico";
    loadInvite();
    return;
  }
  if (recoveryRoute) {
    qs("#auth-screen").hidden = true; qs("#app-shell").hidden = true;
    const resetting = currentRoute().path === "/redefinir-senha";
    qs("#recovery-request-form").hidden = resetting;
    qs("#password-reset-form").hidden = !resetting;
    document.title = `${resetting ? "Redefinir" : "Recuperar"} senha · Sistema Clínico`;
    return;
  }
  const authenticated = Boolean(state.session?.token);
  qs("#auth-screen").hidden = authenticated;
  qs("#app-shell").hidden = !authenticated;
  if (!authenticated) {
    document.title = "Acesso · Sistema Clínico";
    return;
  }
  const name = state.session.nomeCompleto;
  qsa("#sidebar-user, #top-user").forEach((node) => node.textContent = name);
  qsa("#sidebar-avatar, #top-avatar").forEach((node) => node.textContent = initials(name));
  qs("#current-date").innerHTML = `<i class="fa-regular fa-calendar"></i>${formatDate(new Date().toISOString(), { weekday: "short", day: "2-digit", month: "short" })}`;
  if (!location.hash || location.hash === "#/") location.hash = "#/dashboard";
  else route();
}

/** Solicita o link de recuperação de senha. A resposta do servidor é sempre neutra. */
async function handleRecoveryRequest(event) {
  event.preventDefault(); const form=event.currentTarget; const button=qs('button[type="submit"]',form);
  const message=qs("[data-recovery-message]",form); message.hidden=true; setBusy(button,true,"Enviando");
  try { const result=await api.requestPasswordReset({email:formObject(form).email});
    message.textContent=result.mensagem; message.hidden=false; form.reset();
    if(result.urlDesenvolvimento) { const token=new URL(result.urlDesenvolvimento).hash.split("token=")[1]; location.hash=`#/redefinir-senha?token=${token}`; }
  } catch(error) { message.textContent=normalizeError(error).message; message.hidden=false; }
  finally { setBusy(button,false); }
}

/** Valida a confirmação e grava a nova senha usando o token do link. */
async function handlePasswordReset(event) {
  event.preventDefault(); const form=event.currentTarget; const data=formObject(form); const message=qs("[data-reset-message]",form);
  message.hidden=true; if(data.novaSenha!==data.confirmacaoSenha){ message.textContent="As senhas não coincidem."; message.hidden=false; return; }
  const token=currentRoute().query.get("token"); if(!token){ message.textContent="O link não contém um token válido."; message.hidden=false; return; }
  const button=qs('button[type="submit"]',form); setBusy(button,true,"Redefinindo");
  try { await api.resetPassword({token,novaSenha:data.novaSenha}); form.reset(); toast("Senha atualizada","Entre com sua nova senha."); location.hash="#/"; }
  catch(error){ message.textContent=normalizeError(error).message; message.hidden=false; } finally { setBusy(button,false); }
}

/** Consulta o convite da rota e prepara o formulário de definição de senha. */
async function loadInvite() {
  const token = currentRoute().query.get("token") ?? "";
  const loading = qs("[data-invite-loading]");
  const form = qs("#invite-form");
  const errorBox = qs("[data-invite-error]");
  loading.hidden = false; form.hidden = true; errorBox.hidden = true;
  if (!token) return showInviteError("O link não contém um token de convite.");
  try {
    const invite = await api.getInvite(token);
    form.dataset.token = token;
    qs("[data-invite-welcome]").textContent = `Olá, ${invite.nomeCompleto}. Confirme uma senha para ativar ${invite.email}.`;
    qs("[data-invite-clinic]").innerHTML = `<i class="fa-solid fa-house-medical"></i><span><small>Clínica</small><strong>${escapeHtml(invite.clinica)}</strong></span>`;
    loading.hidden = true; form.hidden = false;
  } catch (error) { showInviteError(normalizeError(error).message); }
}

/**
 * Exibe o erro de convite inválido, expirado ou já utilizado.
 *
 * @param {string} message motivo do erro
 */
function showInviteError(message) {
  qs("[data-invite-loading]").hidden = true;
  qs("#invite-form").hidden = true;
  qs("[data-invite-error]").hidden = false;
  qs("[data-invite-error-message]").textContent = message;
}

/** Ativa a conta do médico convidado definindo a senha. */
async function handleInviteSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = qs("[data-invite-message]", form);
  const data = formObject(form);
  message.hidden = true;
  if (data.novaSenha !== data.confirmacaoSenha) {
    message.textContent = "As senhas informadas não coincidem."; message.hidden = false; return;
  }
  const button = qs('button[type="submit"]', form);
  setBusy(button, true, "Ativando");
  try {
    await api.definePassword({ token: form.dataset.token, novaSenha: data.novaSenha });
    form.reset();
    toast("Acesso ativado", "Sua senha foi definida. Entre com o e-mail do convite.");
    location.hash = "#/";
  } catch (error) {
    message.textContent = normalizeError(error).message; message.hidden = false;
  } finally { setBusy(button, false); }
}

/** Encerra a transcrição e a sessão e volta ao login. */
function logout() {
  transcriber?.stop();
  clearSession();
  location.hash = "";
  renderSession();
}

/**
 * Carrega a tela da rota atual (visão geral, pacientes, médicos, perfil, uso da IA ou consulta). Falhas são
 * exibidas na própria tela, com a opção de tentar novamente.
 */
async function route() {
  if (!state.session) return;
  transcriber?.stop();
  transcriber = null;
  qs("#sidebar").classList.remove("open");
  const { path, query } = currentRoute();
  const segments = path.split("/").filter(Boolean);
  const root = segments[0] || "dashboard";
  qsa(".primary-nav a").forEach((link) => link.classList.toggle("active", link.dataset.route === root || (root === "pacientes" && link.dataset.route === "pacientes")));
  qs("#route-progress").hidden = false;
  qs("#view").innerHTML = skeletons(4);
  try {
    if (root === "dashboard") await showDashboard();
    else if (root === "pacientes" && segments[1]) await showPatient(segments[1]);
    else if (root === "pacientes") await showPatients();
    else if (root === "medicos") await showDoctors();
    else if (root === "perfil") await showProfile();
    else if (root === "uso-ia") await showAiUsage();
    else if (root === "consulta") await showConsultation(segments[1], query);
    else location.hash = "#/dashboard";
  } catch (error) {
    renderRouteError(normalizeError(error));
  } finally {
    qs("#route-progress").hidden = true;
    qs("#main-content").focus({ preventScroll: true });
  }
}

/**
 * @returns {{path: string, query: URLSearchParams}} caminho e parâmetros da rota atual, que fica no hash da URL
 */
function currentRoute() {
  const raw = location.hash.replace(/^#/, "") || "/dashboard";
  const [path, search = ""] = raw.split("?");
  return { path, query: new URLSearchParams(search) };
}

/**
 * Carrega a lista de pacientes, reaproveitando a que já está em memória.
 *
 * @param {boolean} [force] true para recarregar do servidor
 * @returns {Promise<object[]>} pacientes da clínica
 */
async function loadPatients(force = false) {
  if (force || !state.patients.length) state.patients = await api.listPatients();
  return state.patients;
}

/** Monta a visão geral e liga o cancelamento de rascunhos. */
async function showDashboard() {
  setPageMeta("Cuidado conectado", "Visão geral");
  const [patients, drafts, doctors] = await Promise.all([loadPatients(true), api.listDrafts(), api.listDoctors()]);
  qs("#view").innerHTML = dashboardView({ patients, drafts, doctors });
  qsa("[data-cancel-draft]").forEach((button) => button.addEventListener("click", () => cancelDraft(button)));
}

/**
 * Cancela um rascunho depois de confirmação do médico. Consultas finalizadas e o prontuário não são afetados.
 *
 * @param {HTMLButtonElement} button botão que identifica o rascunho e o paciente
 */
async function cancelDraft(button) {
  const patientName = button.dataset.patientName || "este paciente";
  const confirmed = await confirmAction(
    "Cancelar este rascunho?",
    `O rascunho de ${patientName} será excluído permanentemente. O prontuário e as consultas finalizadas não serão alterados.`,
    "Cancelar rascunho",
    "Manter rascunho",
    true
  );
  if (!confirmed) return;
  setBusy(button, true, "");
  try {
    await api.cancelDraft(button.dataset.cancelDraft);
    toast("Rascunho cancelado", "O atendimento incompleto foi removido.");
    await showDashboard();
  } catch (error) {
    setBusy(button, false);
    toast("Não foi possível cancelar", normalizeError(error).message, "error");
  }
}

/** Monta a lista de pacientes, com busca por nome, CPF ou plano de saúde. */
async function showPatients() {
  setPageMeta("Carteira de cuidado", "Pacientes");
  const patients = await loadPatients(true);
  qs("#view").innerHTML = patientsView(patients);
  qs("#patient-search")?.addEventListener("input", ({ target }) => {
    const term = target.value.toLocaleLowerCase("pt-BR").replace(/\D/g, "") || target.value.toLocaleLowerCase("pt-BR");
    const filtered = patients.filter((patient) => [patient.nomeCompleto, patient.cpf, patient.planoSaude].some((item) => String(item ?? "").toLocaleLowerCase("pt-BR").replace(/\D/g, "").includes(term) || String(item ?? "").toLocaleLowerCase("pt-BR").includes(term)));
    qs("#patients-table").innerHTML = patientsTable(filtered);
    bindPatientRows();
  });
  bindPatientRows();
}

/** Faz cada linha da tabela abrir a ficha do paciente. */
function bindPatientRows() {
  qsa("[data-patient-id]").forEach((row) => row.addEventListener("click", () => location.hash = `#/pacientes/${row.dataset.patientId}`));
}

/**
 * Monta a ficha do paciente com o prontuário e o histórico.
 *
 * @param {string} id identificador do paciente
 */
async function showPatient(id) {
  setPageMeta("Prontuário único", "Paciente");
  const [patient, record, history] = await Promise.all([api.getPatient(id), api.getRecord(id), api.getHistory(id)]);
  state.currentPatient = patient;
  qs("#view").innerHTML = patientDetailView(patient, record, history);
  prepararTextosLongos(qs("#view"));
  document.fonts?.ready.then(() => prepararTextosLongos(qs("#view")));
  qs("[data-edit-patient]")?.addEventListener("click", () => openPatientDialog(patient));
  qs("[data-link-doctor]")?.addEventListener("click", () => linkDoctorDialog(patient));
  qs("[data-open-record]")?.addEventListener("click", () => openMedicalRecord(patient, record, history));
}

/**
 * Abre o prontuário em formato de documento, com ordenação da linha do tempo e download em PDF.
 *
 * @param {object} patient dados cadastrais
 * @param {object} record prontuário único
 * @param {object[]} history consultas finalizadas
 */
function openMedicalRecord(patient, record, history) {
  const dialog = document.createElement("dialog");
  dialog.className = "modal record-modal";
  dialog.setAttribute("aria-labelledby", "record-modal-title");
  dialog.innerHTML = `<div class="record-modal__frame"><header class="record-modal__toolbar"><div class="record-modal__heading"><span class="eyebrow">Documento longitudinal</span><h2 id="record-modal-title">Prontuário único</h2><p>Histórico clínico consolidado do paciente</p></div><div class="record-modal__actions"><label class="record-sort"><span>Ordenar consultas por data</span><select aria-label="Ordenar consultas por data"><option value="desc">Mais recentes primeiro</option><option value="asc">Mais antigas primeiro</option></select></label><button class="button button--secondary" type="button" data-download-record><i class="fa-solid fa-file-pdf"></i><span>Baixar PDF</span></button><button class="icon-button" type="button" data-close-record aria-label="Fechar prontuário"><i class="fa-solid fa-xmark"></i></button></div></header><div class="record-modal__body" data-record-body></div></div>`;
  const body = qs("[data-record-body]", dialog);
  const select = qs("select", dialog);
  const render = () => {
    const scrollTop = body.scrollTop;
    body.innerHTML = recordDocumentView(patient, record, history, select.value);
    body.scrollTop = scrollTop;
  };
  select.addEventListener("change", render);
  qs("[data-download-record]", dialog).addEventListener("click", (event) => {
    try {
      downloadMedicalRecordPdf({ patient, record, history, order: select.value });
      toast("PDF gerado", "O prontuário foi baixado neste dispositivo.");
    } catch (error) {
      toast("Não foi possível gerar o PDF", error.message, "error");
    }
  });
  qs("[data-close-record]", dialog).addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", ({ target }) => { if (target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("record-modal-open");
    dialog.remove();
  }, { once: true });
  document.body.append(dialog);
  render();
  document.documentElement.classList.add("record-modal-open");
  dialog.showModal();
}

/** Monta a tela da equipe médica. */
async function showDoctors() {
  setPageMeta("Rede assistencial", "Médicos");
  state.doctors = await api.listDoctors();
  qs("#view").innerHTML = doctorsView(state.doctors);
}

/** Monta o painel de consumo de tokens da IA. */
async function showAiUsage() {
  setPageMeta("Consumo da integração", "Uso da IA");
  const usage = await api.getAiUsage();
  qs("#view").innerHTML = aiUsageView(usage);
}

/** Monta a tela de perfil do médico autenticado. */
async function showProfile() {
  setPageMeta("Identidade profissional", "Meu perfil");
  const doctor = await api.getDoctor(state.session.medicoId);
  qs("#view").innerHTML = profileView(doctor);
  qs("#profile-form").addEventListener("submit", handleProfileSubmit);
}

/** Salva o perfil e atualiza o nome exibido na sessão. */
async function handleProfileSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = qs('button[type="submit"]', form);
  setBusy(button, true, "Salvando");
  try {
    const data = formObject(form);
    const updated = await api.updateProfile({ ...data, especialidades: splitList(data.especialidades) });
    state.session.nomeCompleto = updated.nomeCompleto;
    setSession(state.session);
    renderSession();
    toast("Perfil atualizado", "Seus dados profissionais foram salvos.");
  } catch (error) {
    applyApiErrors(form, normalizeError(error));
  } finally { setBusy(button, false); }
}

/**
 * Monta a tela de consulta, nova ou existente. Consulta finalizada abre somente para leitura.
 *
 * @param {string} [id] identificador da consulta, ou "nova"
 * @param {URLSearchParams} query parâmetros da rota (ex.: paciente pré-selecionado)
 */
async function showConsultation(id, query) {
  const patients = await loadPatients();
  let consultation = null;
  if (id && id !== "nova") consultation = await api.getConsultation(id);
  state.currentConsultation = consultation;
  identifiedRecordData = consultation?.dadosProntuarioIdentificados ?? null;
  const readOnly = consultation?.status === "FINALIZADA";
  setPageMeta("Atendimento estruturado", readOnly ? "Consulta finalizada" : "Consulta");
  qs("#view").innerHTML = consultationView({ consultation, patients, selectedPatientId: query.get("paciente"), readOnly });
  bindSoapTabs();
  if (!readOnly) bindConsultationActions();
}

/** Alterna entre os quatro eixos do SOAP. */
function bindSoapTabs() {
  qsa("[data-soap-tab]").forEach((tab) => tab.addEventListener("click", () => {
    qsa("[data-soap-tab]").forEach((item) => item.classList.toggle("active", item === tab));
    qsa("[data-soap-pane]").forEach((pane) => pane.classList.toggle("active", pane.dataset.soapPane === tab.dataset.soapTab));
  }));
}

/**
 * Liga os controles da consulta: transcrição de fala (iniciar, pausar, retomar e encerrar), salvar rascunho,
 * analisar com a IA, aceitar ou recusar sugestões e finalizar.
 */
function bindConsultationActions() {
  const textarea = qs("#transcript");
  const recordButton = qs("#record-button");
  const pauseButton = qs("#pause-button");
  transcriber = new SpeechTranscriber({
    onText: ({ finalText, interimText }) => {
      if (finalText) {
        const prefix = textarea.value.trim();
        textarea.value = `${prefix}${prefix ? " " : ""}${finalText}`;
        interimStart = textarea.value.length;
      }
      qs("#speech-subtitle").textContent = interimText || "Escutando em português do Brasil...";
    },
    onState: (state) => {
      const listening = state === "listening";
      const paused = state === "paused";
      recordButton.classList.toggle("is-listening", listening);
      recordButton.innerHTML = `<i class="fa-solid ${listening || paused ? "fa-stop" : "fa-microphone"}"></i>`;
      recordButton.setAttribute("aria-label", listening || paused ? "Encerrar transcrição" : "Iniciar transcrição");
      if (pauseButton) {
        pauseButton.hidden = !(listening || paused);
        pauseButton.classList.toggle("is-paused", paused);
        pauseButton.innerHTML = `<i class="fa-solid ${paused ? "fa-play" : "fa-pause"}"></i>`;
        pauseButton.title = paused ? "Retomar transcrição" : "Pausar transcrição";
        pauseButton.setAttribute("aria-label", pauseButton.title);
      }
      qs("#speech-title").textContent = listening ? "Transcrevendo agora" : paused ? "Transcrição pausada" : "Pronto para transcrever";
      if (paused) qs("#speech-subtitle").textContent = "Clique em retomar para continuar de onde parou, ou encerre a transcrição.";
      else if (!listening) qs("#speech-subtitle").textContent = "Revise o texto antes de solicitar qualquer análise.";
    },
    onError: (message) => toast("Transcrição indisponível", message, "error")
  });
  qs("#speech-unsupported").hidden = transcriber.supported;
  recordButton.disabled = !transcriber.supported;
  recordButton.addEventListener("click", () => transcriber.toggle());
  pauseButton?.addEventListener("click", () => transcriber.togglePause());
  qs("#save-draft")?.addEventListener("click", saveDraft);
  qs("#analyze-ai")?.addEventListener("click", analyzeWithAi);
  bindSuggestionActions();
  qs("#finish-consultation")?.addEventListener("click", finishConsultation);
}

/** Aba e nome, na tela, de cada eixo do SOAP que recebe sugestões da IA. */
const EIXOS_DAS_SUGESTOES = {
  "soap-avaliacao": { aba: "avaliacao", nome: "Avaliação" },
  "soap-plano": { aba: "plano", nome: "Plano" }
};

/**
 * Mostra a aba do SOAP indicada e leva a tela até a caixa de texto dela.
 *
 * @param {string} aba chave do eixo, como "plano"
 * @param {HTMLTextAreaElement} campo caixa de texto do eixo
 */
function showSoapTab(aba, campo) {
  qsa("[data-soap-tab]").forEach(tab => tab.classList.toggle("active", tab.dataset.soapTab === aba));
  qsa("[data-soap-pane]").forEach(pane => pane.classList.toggle("active", pane.dataset.soapPane === aba));
  campo.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Trata o aceite e a recusa das sugestões da IA. Aceitar copia a sugestão para a Avaliação ou o Plano, sem
 * duplicar um texto já presente, e destaca o trecho em verde. Recusar não altera o SOAP: se o trecho já estiver
 * no eixo, ele é destacado em vermelho e o médico é avisado de que deve removê-lo de lá.
 */
function bindSuggestionActions() {
  const container = qs("#suggestions");
  if (!container || container.dataset.bound) return;
  container.dataset.bound = "true";
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggestion-action]");
    if (!button) return;
    const item = button.closest(".suggestion-item");
    const target = qs(`#${item.dataset.target}`);
    if (!target) return;
    const eixo = EIXOS_DAS_SUGESTOES[item.dataset.target];
    const suggestion = qs("[data-suggestion-text]", item).textContent.trim();
    const jaNoEixo = contemTrecho(target.value, suggestion);
    item.querySelectorAll("button").forEach(control => control.disabled = true);
    if (button.dataset.suggestionAction === "reject") {
      item.classList.add("is-rejected");
      if (!jaNoEixo) return toast("Sugestão recusada", `“${suggestion}” não consta no eixo ${eixo.nome}; não há nada a remover.`);
      destacar(target, suggestion, "recusada");
      showSoapTab(eixo.aba, target);
      return toast("Sugestão recusada", `Ela continua no eixo ${eixo.nome}, destacada em vermelho. Remova o trecho de lá se não quiser que conste no registro.`);
    }
    if (!jaNoEixo) {
      const current = target.value.trim();
      target.value = `${current}${current ? "\n" : ""}• ${suggestion}`;
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }
    item.classList.add("is-accepted");
    destacar(target, suggestion, "aceita");
    showSoapTab(eixo.aba, target);
    target.focus({ preventScroll: true });
    toast(jaNoEixo ? "Já consta no SOAP" : "Copiada para o SOAP",
      jaNoEixo ? `“${suggestion}” já estava no eixo ${eixo.nome}, destacada em verde.` : `“${suggestion}” foi adicionada ao fim do eixo ${eixo.nome}, destacada em verde.`);
  });
}

/**
 * @returns {object} conteúdo atual da tela: paciente, transcrição, dados gerais e os quatro eixos do SOAP
 */
function consultationPayload() {
  return {
    pacienteId: Number(qs("#consultation-patient").value),
    transcricaoOriginal: qs("#transcript").value,
    dadosGeraisConsulta: qs("#general-data").value,
    soap: {
      subjetivo: qs("#soap-subjetivo").value,
      objetivo: qs("#soap-objetivo").value,
      avaliacao: qs("#soap-avaliacao").value,
      plano: qs("#soap-plano").value
    }
  };
}

/** Cria ou atualiza o rascunho. O prontuário não é alterado. */
async function saveDraft(event) {
  const button = event.currentTarget;
  const payload = consultationPayload();
  if (!payload.pacienteId) return toast("Selecione o paciente", "O atendimento precisa pertencer a um prontuário.", "error");
  setBusy(button, true, "Salvando");
  try {
    const id = qs(".consultation-page").dataset.consultationId;
    const consultation = id ? await api.updateConsultation(id, payload) : await api.createConsultation(payload);
    state.currentConsultation = consultation;
    toast("Rascunho salvo", "O prontuário ainda não foi alterado.");
    if (!id) location.hash = `#/consulta/${consultation.id}`;
  } catch (error) { toast("Não foi possível salvar", normalizeError(error).message, "error"); }
  finally { setBusy(button, false); }
}

/**
 * Salva o relato e solicita a análise pela IA. Preenche o SOAP, os dados do prontuário e as sugestões, que o
 * médico revisa antes de finalizar. Mostra o consumo de tokens da chamada.
 */
async function analyzeWithAi(event) {
  const button = event.currentTarget;
  const id = qs(".consultation-page").dataset.consultationId;
  if (!qs("#transcript").value.trim()) return toast("Transcrição necessária", "Digite ou transcreva o relato antes da análise.", "error");
  setBusy(button, true, "Analisando");
  try {
    await api.updateConsultation(id, consultationPayload());
    const result = await api.analyzeConsultation(id);
    showIdentifiedTranscript(result.transcricaoIdentificada);
    for (const key of ["subjetivo", "objetivo", "avaliacao", "plano"]) qs(`#soap-${key}`).value = result.soap?.[key] ?? "";
    qsa(".soap-pane textarea").forEach((campo) => limparDestaques(campo));
    identifiedRecordData = result.dadosProntuarioIdentificados ?? null;
    for (const { chave, campo } of CAMPOS_IDENTIFICADOS) qs(campo).value = valorIdentificado(identifiedRecordData?.[chave]);
    qs("#suggestions").innerHTML = suggestionsHtml(result);
    toast(result.uso?.reaproveitada ? "Análise reaproveitada" : "Análise recebida", usageMessage(result.uso));
  } catch (error) { toast("Apoio consultivo indisponível", normalizeError(error).message, "error"); }
  finally { setBusy(button, false); }
}

/**
 * Exibe, ou oculta se estiver vazio, o diálogo com as falas identificadas pela IA.
 *
 * @param {string|undefined} text diálogo devolvido pela análise
 */
function showIdentifiedTranscript(text) {
  const box = qs("#identified-box");
  if (!box) return;
  qs("#identified-transcript").textContent = text ?? "";
  box.hidden = !text;
}

/**
 * @param {object|undefined} usage consumo da análise
 * @returns {string} resumo para o aviso: tokens, modelo e tentativas, ou a informação de reaproveitamento
 */
function usageMessage(usage) {
  if (!usage) return "Revise cada campo antes de finalizar.";
  if (usage.reaproveitada) return "O texto não mudou desde a última análise: nenhum token foi gasto. Edite o relato para gerar uma nova.";
  const retries = usage.tentativas > 1 ? ` · ${usage.tentativas} tentativas` : "";
  return `${usage.tokensTotal.toLocaleString("pt-BR")} tokens · ${usage.modelo}${retries}. Revise cada campo antes de finalizar.`;
}

/**
 * Finaliza a consulta, exigindo os quatro eixos do SOAP preenchidos e a confirmação do médico. Os dados
 * confirmados atualizam o prontuário, e a consulta passa a ser imutável.
 */
async function finishConsultation(event) {
  const button = event.currentTarget;
  const payload = consultationPayload();
  if (Object.values(payload.soap).some((item) => !item.trim())) return toast("SOAP incompleto", "Preencha e revise os quatro eixos antes de finalizar.", "error");
  const unconfirmed = identificadosNaoConfirmados(
    identifiedRecordData,
    Object.fromEntries(CAMPOS_IDENTIFICADOS.map(({ chave, campo }) => [chave, qs(campo).value])));
  const confirmed = unconfirmed.length
    ? await confirmAction(
      "Finalizar sem confirmar dados da IA?",
      `A análise identificou ${unconfirmed.map(({ rotulo, chave }) => `${rotulo.toLocaleLowerCase("pt-BR")} (${valorIdentificado(identifiedRecordData[chave])})`).join("; ")}, mas o campo correspondente em "Consolidar no prontuário" está vazio. Finalizar assim deixa essas informações fora do prontuário.`,
      "Finalizar sem confirmar", "Voltar e revisar", true)
    : await confirmAction("Finalizar consulta?", "O registro entrará no histórico e não poderá mais ser editado.");
  if (!confirmed) return;
  setBusy(button, true, "Finalizando");
  try {
    const id = qs(".consultation-page").dataset.consultationId;
    await api.finalizeConsultation(id, {
      soap: payload.soap,
      dadosGeraisConsulta: payload.dadosGeraisConsulta,
      consolidacaoProntuario: {
        alergiasConhecidas: qs("#confirmed-allergies").value,
        medicamentosUsoContinuo: qs("#confirmed-medicines").value,
        historicoFamiliar: qs("#confirmed-history").value,
        resumoClinico: qs("#confirmed-summary").value,
        antecedentesPessoais: qs("#confirmed-personal-history").value,
        condicoesAtivas: qs("#confirmed-active-conditions").value,
        cirurgiasInternacoes: qs("#confirmed-surgeries").value,
        imunizacoes: qs("#confirmed-immunizations").value,
        habitosAspectosSociais: qs("#confirmed-habits").value,
        diagnosticosConfirmados: qs("#confirmed-diagnoses").value,
        examesRelevantes: qs("#confirmed-exams").value,
        tratamentosProcedimentos: qs("#confirmed-treatments").value,
        planoTerapeuticoAtual: qs("#confirmed-plan").value,
        acompanhamentoPendencias: qs("#confirmed-follow-up").value
      }
    });
    toast("Consulta finalizada", "O histórico e o prontuário foram atualizados.");
    location.hash = `#/pacientes/${payload.pacienteId}`;
  } catch (error) { toast("Não foi possível finalizar", normalizeError(error).message, "error"); }
  finally { setBusy(button, false); }
}

/**
 * Abre o formulário de paciente, vazio para cadastro ou preenchido para edição. O CPF não pode ser alterado.
 *
 * @param {object|null} [patient] paciente a editar, ou null para cadastrar
 */
function openPatientDialog(patient = null) {
  const form = qs("#patient-form");
  form.reset();
  qs("[data-form-message]", form).hidden = true;
  qs("#patient-dialog-title").textContent = patient ? "Editar paciente" : "Novo paciente";
  qs(".initial-record", form).hidden = Boolean(patient);
  const cpf = form.elements.namedItem("cpf");
  cpf.disabled = Boolean(patient);
  if (patient) {
    for (const [key, value] of Object.entries(patient)) {
      const field = form.elements.namedItem(key);
      if (field && typeof value !== "object") field.value = key === "cpf" ? maskCpf(value) : value ?? "";
    }
  }
  qs("#patient-dialog").showModal();
}

/** Cadastra ou atualiza o paciente e abre a sua ficha. */
async function handlePatientSubmit(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  const button = qs('button[value="default"]', form);
  const data = formObject(form);
  const id = data.id;
  const payload = patientPayload(data, !id);
  setBusy(button, true, "Salvando");
  try {
    const patient = id ? await api.updatePatient(id, payload) : await api.createPatient(payload);
    state.patients = [];
    form.reset();
    qs("#patient-dialog").close();
    toast(id ? "Paciente atualizado" : "Paciente cadastrado", id ? "Os dados cadastrais foram salvos." : "O prontuário único foi criado.");
    location.hash = `#/pacientes/${patient.id}`;
    if (currentRoute().path === `/pacientes/${patient.id}`) route();
  } catch (error) { applyApiErrors(form, normalizeError(error)); }
  finally { setBusy(button, false); }
}

/** Cadastra o médico e envia o convite de ativação. */
async function handleDoctorSubmit(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  const button = qs('button[value="default"]', form);
  setBusy(button, true, "Cadastrando");
  try {
    const result = await api.createDoctor(doctorPayload(formObject(form)));
    form.reset();
    qs("#doctor-dialog").close();
    toast("Médico convidado", result.conviteEnviadoPorEmail ? "O link para definir a senha foi enviado por e-mail." : "Cadastro criado; copie o link de desenvolvimento exibido.");
    if (result.urlConviteDesenvolvimento) showDevelopmentInvite(result.urlConviteDesenvolvimento, result.conviteExpiraEm);
    if (currentRoute().path === "/medicos") route();
  } catch (error) { applyApiErrors(form, normalizeError(error)); }
  finally { setBusy(button, false); }
}

/**
 * @param {object} data valores do formulário
 * @param {boolean} creating true no cadastro, que inclui o CPF e o prontuário inicial
 * @returns {object} corpo da requisição, com CPF, telefone e CEP somente com dígitos
 */
function patientPayload(data, creating) {
  const base = {
    nomeCompleto: data.nomeCompleto, dataNascimento: data.dataNascimento, planoSaude: data.planoSaude,
    telefone: digits(data.telefone), email: data.email, sexo: data.sexo, nomeMae: data.nomeMae,
    naturalidadeMunicipio: data.naturalidadeMunicipio, naturalidadeEstado: data.naturalidadeEstado,
    logradouro: data.logradouro, numero: data.numero, complemento: data.complemento, bairro: data.bairro,
    municipio: data.municipio, estado: data.estado, cep: digits(data.cep)
  };
  if (creating) {
    base.cpf = digits(data.cpf);
    base.prontuarioInicial = { alergiasConhecidas: data.alergiasConhecidas, medicamentosUsoContinuo: data.medicamentosUsoContinuo, historicoFamiliar: data.historicoFamiliar };
  }
  return base;
}

/**
 * @param {object} data valores do formulário
 * @returns {object} corpo da requisição de cadastro de médico
 */
function doctorPayload(data) {
  return { nomeCompleto: data.nomeCompleto, email: data.email, crm: data.crm, cpf: digits(data.cpf), dataNascimento: data.dataNascimento, especialidades: splitList(data.especialidades) };
}

/**
 * Exibe o link do convite para cópia. Usado apenas em desenvolvimento, quando o envio de e-mail está desativado.
 *
 * @param {string} url link de ativação
 * @param {string} expiration validade do convite
 */
function showDevelopmentInvite(url, expiration) {
  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.innerHTML = `<div class="modal__frame"><header class="modal__header"><div><span class="eyebrow">Somente desenvolvimento</span><h2>Link de ativação</h2><p>SMTP está desativado. Este link deixa de aparecer quando EXPOSE_INVITE_LINK=false.</p></div><button class="icon-button" type="button" data-close aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button></header><div class="modal__body"><label class="field"><span>Convite válido até ${formatDate(expiration, { dateStyle: "short", timeStyle: "short" })}</span><input value="${escapeHtml(url)}" readonly data-invite-url></label></div><footer class="modal__footer"><button class="button button--primary" type="button" data-copy-invite><i class="fa-regular fa-copy"></i>Copiar link</button></footer></div>`;
  document.body.append(dialog);
  qs("[data-close]", dialog).addEventListener("click", () => dialog.close());
  qs("[data-copy-invite]", dialog).addEventListener("click", async () => {
    await navigator.clipboard.writeText(url);
    toast("Link copiado", "Envie-o ao médico por um canal seguro.");
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal();
}

/**
 * @param {string} [value] itens separados por vírgula
 * @returns {string[]} itens sem espaços nas pontas, vazios ou repetidos
 */
function splitList(value = "") { return [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))]; }
/**
 * @returns {string} somente os dígitos do valor
 */
function digits(value = "") { return value.replace(/\D/g, ""); }

/** Aplica as máscaras de CPF, CEP e telefone e a conversão para maiúsculas conforme os atributos do campo. */
function applyMasks(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.dataset.mask === "cpf") input.value = maskCpf(input.value);
  if (input.dataset.mask === "cep") input.value = digits(input.value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
  if (input.dataset.mask === "phone") {
    const phone = digits(input.value).slice(0, 11);
    input.value = phone.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4,5})(\d{4})$/, "$1-$2");
  }
  if (input.hasAttribute("data-uppercase")) input.value = input.value.toUpperCase();
}

/**
 * Pede confirmação ao usuário em uma janela modal.
 *
 * @param {string} title título da pergunta
 * @param {string} message explicação das consequências
 * @param {string} [confirmLabel] texto do botão de confirmação
 * @param {string} [cancelLabel] texto do botão de cancelamento
 * @param {boolean} [destructive] true para destacar uma ação destrutiva
 * @returns {Promise<boolean>} true se o usuário confirmou
 */
function confirmAction(title, message, confirmLabel = "Confirmar finalização", cancelLabel = "Continuar revisando", destructive = false) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "modal";
    dialog.innerHTML = `<form method="dialog" class="modal__frame"><header class="modal__header"><div><span class="eyebrow">Confirmação clínica</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div></header><footer class="modal__footer"><button class="button button--ghost" value="cancel" formnovalidate>${escapeHtml(cancelLabel)}</button><button class="button ${destructive ? "button--danger" : "button--primary"}" value="confirm"><i class="fa-solid ${destructive ? "fa-trash-can" : "fa-check"}"></i>${escapeHtml(confirmLabel)}</button></footer></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => { resolve(dialog.returnValue === "confirm"); dialog.remove(); }, { once: true });
    dialog.showModal();
  });
}

/**
 * Abre a janela para vincular outro médico da clínica ao paciente.
 *
 * @param {object} patient paciente cuja equipe será ampliada
 */
async function linkDoctorDialog(patient) {
  try {
    const doctors = await api.listDoctors();
    const linkedIds = new Set([...(patient.medicosResponsaveis ?? [])].map((doctor) => doctor.id));
    const available = doctors.filter((doctor) => !linkedIds.has(doctor.id));
    if (!available.length) return toast("Equipe já vinculada", "Não há outro médico disponível para associação.");
    const dialog = document.createElement("dialog");
    dialog.className = "modal";
    dialog.innerHTML = `<form method="dialog" class="modal__frame"><header class="modal__header"><div><span class="eyebrow">Equipe assistencial</span><h2>Vincular médico responsável</h2><p>O profissional passará a constar na equipe responsável pelo paciente. O acesso aos dados já é controlado pela clínica.</p></div></header><div class="modal__body"><label class="field"><span>Profissional</span><select name="medicoId">${available.map((doctor) => `<option value="${doctor.id}">${escapeHtml(doctor.nomeCompleto)} · ${escapeHtml(doctor.crm)}</option>`).join("")}</select></label></div><footer class="modal__footer"><button class="button button--ghost" value="cancel" formnovalidate>Cancelar</button><button class="button button--primary" value="confirm"><i class="fa-solid fa-link"></i>Vincular</button></footer></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", async () => {
      const doctorId = qs('select[name="medicoId"]', dialog).value;
      const confirmed = dialog.returnValue === "confirm";
      dialog.remove();
      if (!confirmed) return;
      try {
        await api.linkDoctor(patient.id, doctorId);
        toast("Médico vinculado", "O acompanhamento compartilhado foi atualizado.");
        route();
      } catch (error) { toast("Não foi possível vincular", normalizeError(error).message, "error"); }
    }, { once: true });
    dialog.showModal();
  } catch (error) { toast("Não foi possível listar a equipe", normalizeError(error).message, "error"); }
}

/**
 * @param {*} error erro capturado
 * @returns {ApiError} o próprio erro da API, ou um ApiError com a mensagem do erro recebido
 */
function normalizeError(error) {
  return error instanceof ApiError ? error : new ApiError(error?.message || "Ocorreu um erro inesperado.");
}

/**
 * Exibe, no lugar da tela, o erro de carregamento da rota, com o botão de tentar novamente.
 *
 * @param {ApiError} error erro ocorrido
 */
function renderRouteError(error) {
  qs("#view").innerHTML = `<div class="card empty-state"><div><span class="empty-state__icon"><i class="fa-solid fa-triangle-exclamation"></i></span><h3>Não foi possível carregar</h3><p>${escapeHtml(error.message)}</p><button class="button button--secondary" id="retry-route"><i class="fa-solid fa-rotate-right"></i>Tentar novamente</button></div></div>`;
  qs("#retry-route").addEventListener("click", route);
}
