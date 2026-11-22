/**
 * Templates HTML das telas. Cada função recebe os dados já carregados e devolve o HTML, com todo texto dinâmico
 * escapado por escapeHtml(). A ligação com os eventos é feita em app.js.
 */
import { ageFrom, emptyState, escapeHtml, formatDate, maskCpf } from "./ui.js";
import { initials } from "./state.js";
import { CAMPOS_IDENTIFICADOS, valorIdentificado } from "./consolidacao.js";

/** Escapa um texto, usando um valor de substituição quando estiver vazio. */
const value = (text, fallback = "Não informado") => escapeHtml(text || fallback);

/**
 * Tela inicial: indicadores, rascunhos em andamento, pacientes recentes e etapas do fluxo de atendimento.
 *
 * @param {object} data
 * @param {object[]} data.patients pacientes da clínica
 * @param {object[]} [data.drafts] rascunhos do médico autenticado
 * @param {object[]} [data.doctors] médicos da clínica
 * @returns {string} HTML da tela
 */
export function dashboardView({ patients, drafts = [], doctors = [] }) {
  const recent = patients.slice(0, 5);
  return `<div class="page-stack">
    <section class="clinical-banner card">
      <div class="clinical-banner__copy"><span class="eyebrow">Jornada clínica</span><h2>Um prontuário contínuo para cada história de cuidado.</h2><p>Revise a fala, estruture o atendimento e confirme cada informação antes que ela se torne parte do registro longitudinal.</p><a class="button button--primary" href="#/consulta/nova"><i class="fa-solid fa-plus"></i>Iniciar atendimento</a></div>
      <div class="clinical-banner__art" aria-hidden="true"><i class="fa-solid fa-heart-pulse"></i></div>
    </section>
    <section class="grid grid--4" aria-label="Indicadores">
      ${metric("fa-hospital-user", patients.length, "Pacientes acompanhados")}
      ${metric("fa-file-circle-check", patients.filter(p => p.prontuarioId).length, "Prontuários ativos", "mint")}
      ${metric("fa-pen-to-square", drafts.length, "Consultas em rascunho", "amber")}
      ${metric("fa-user-doctor", doctors.length, "Médicos na clínica", "coral")}
    </section>
    <section class="grid grid--2">
      <article class="card"><header class="card__header"><h2>Pacientes recentes</h2><a class="text-button" href="#/pacientes">Ver todos</a></header><div class="card__body quick-list">
        ${recent.length ? recent.map(patientQuickItem).join("") : emptyState("fa-user-plus", "Nenhum paciente", "Cadastre o primeiro paciente para iniciar o cuidado.", '<button class="button button--secondary" data-new-patient>Novo paciente</button>')}
      </div></article>
      <article class="card"><header class="card__header"><h2>Rascunhos em andamento</h2><a class="text-button" href="#/consulta/nova">Nova consulta</a></header><div class="card__body quick-list">
        ${drafts.length ? drafts.slice(0, 5).map(draftQuickItem).join("") : emptyState("fa-file-pen", "Nenhum rascunho", "Inicie uma consulta para registrar o relato e o SOAP.", '<a class="button button--secondary" href="#/consulta/nova">Nova consulta</a>')}
      </div></article>
    </section>
  </div>`;
}

/** Cartão de indicador numérico. */
function metric(icon, number, label, tone = "brand") {
  return `<article class="card metric-card" data-tone="${tone}"><span class="metric-icon"><i class="fa-solid ${icon}"></i></span><strong class="metric-value">${number}</strong><span class="metric-label">${label}</span></article>`;
}

/** Item da lista de pacientes recentes, com link para o prontuário. */
function patientQuickItem(patient) {
  return `<a class="quick-item" href="#/pacientes/${patient.id}"><span class="avatar">${initials(patient.nomeCompleto)}</span><span><strong>${value(patient.nomeCompleto)}</strong><small>${ageFrom(patient.dataNascimento)} · ${value(patient.planoSaude, "Particular")}</small></span><i class="fa-solid fa-chevron-right"></i></a>`;
}

/** Item da lista de rascunhos, com link para retomar e botão para cancelar. */
function draftQuickItem(draft) {
  return `<div class="draft-item"><a class="quick-item draft-item__link" href="#/consulta/${draft.id}"><span class="quick-item__icon"><i class="fa-solid fa-file-pen"></i></span><span><strong>${value(draft.nomePaciente)}</strong><small>${formatDate(draft.dataHoraConsulta, { dateStyle: "short", timeStyle: "short" })} · Rascunho</small></span><i class="fa-solid fa-chevron-right"></i></a><button class="draft-item__cancel" type="button" data-cancel-draft="${draft.id}" data-patient-name="${value(draft.nomePaciente)}" aria-label="Cancelar rascunho de ${value(draft.nomePaciente)}" title="Cancelar e remover rascunho"><i class="fa-solid fa-trash-can"></i></button></div>`;
}

/** Etapa numerada do fluxo de atendimento. */
function workflowItem(number, title, description) {
  return `<div class="quick-item"><span class="quick-item__icon"><strong>${number}</strong></span><span><strong>${title}</strong><small>${description}</small></span><i class="fa-solid fa-check"></i></div>`;
}

/**
 * Tela de pacientes, com busca e a tabela de listagem.
 *
 * @param {object[]} patients pacientes da clínica
 * @returns {string} HTML da tela
 */
export function patientsView(patients) {
  return `<div class="page-stack">
    <header class="page-heading"><div><span class="eyebrow">Carteira da clínica</span><h1>Pacientes</h1><p>Pacientes cadastrados na sua clínica, com equipe responsável identificada.</p></div><div class="heading-actions"><button class="button button--primary" data-new-patient><i class="fa-solid fa-user-plus"></i>Novo paciente</button></div></header>
    <div class="toolbar"><label class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="patient-search" type="search" placeholder="Buscar por nome, CPF ou plano"></label><span class="status-badge status-badge--neutral">${patients.length} cadastro${patients.length === 1 ? "" : "s"}</span></div>
    <section class="card table-card" id="patients-table">${patientsTable(patients)}</section>
  </div>`;
}

/**
 * @param {object[]} patients pacientes a exibir (já filtrados pela busca)
 * @returns {string} HTML da tabela, ou o estado vazio quando não há pacientes
 */
export function patientsTable(patients) {
  if (!patients.length) return emptyState("fa-hospital-user", "Sua lista está vazia", "Cadastre um paciente para criar seu prontuário único.", '<button class="button button--secondary" data-new-patient>Novo paciente</button>');
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Paciente</th><th>CPF</th><th>Idade</th><th>Plano</th><th>Responsáveis</th><th>Prontuário</th></tr></thead><tbody>${patients.map((p) => `<tr data-patient-id="${p.id}"><td><div class="person-cell"><span class="avatar">${initials(p.nomeCompleto)}</span><span><strong>${value(p.nomeCompleto)}</strong><small>${value(p.email, "Sem e-mail")}</small></span></div></td><td>${maskCpf(p.cpf)}</td><td>${ageFrom(p.dataNascimento)}</td><td>${value(p.planoSaude, "Particular")}</td><td>${p.medicosResponsaveis?.length ?? 0}</td><td><span class="status-badge status-badge--done"><i class="fa-solid fa-link"></i>Único</span></td></tr>`).join("")}</tbody></table></div>`;
}

/**
 * Ficha do paciente: dados cadastrais, equipe, resumo do prontuário, histórico de consultas e alterações.
 *
 * @param {object} patient dados cadastrais
 * @param {object} record prontuário único
 * @param {object[]} history consultas finalizadas
 * @returns {string} HTML da tela
 */
export function patientDetailView(patient, record, history) {
  return `<div class="page-stack">
    <nav class="patient-meta"><a href="#/pacientes"><i class="fa-solid fa-arrow-left"></i> Voltar para pacientes</a></nav>
    <section class="card patient-hero"><span class="avatar">${initials(patient.nomeCompleto)}</span><div><h1>${value(patient.nomeCompleto)}</h1><div class="patient-meta"><span><i class="fa-regular fa-id-card"></i>${maskCpf(patient.cpf)}</span><span><i class="fa-solid fa-cake-candles"></i>${ageFrom(patient.dataNascimento)}</span><span><i class="fa-solid fa-heart-pulse"></i>${value(patient.planoSaude, "Particular")}</span></div></div><div class="heading-actions"><button class="button button--ghost" data-link-doctor><i class="fa-solid fa-user-group"></i>Vincular médico</button><button class="button button--ghost" data-edit-patient><i class="fa-solid fa-pen"></i>Editar</button><a class="button button--primary" href="#/consulta/nova?paciente=${patient.id}"><i class="fa-solid fa-notes-medical"></i>Nova consulta</a></div></section>
    <section class="card"><header class="card__header"><div><h2>Prontuário longitudinal</h2><small>Documento clínico consolidado e atualizado a cada finalização</small></div><div class="heading-actions"><span class="status-badge status-badge--done"><i class="fa-solid fa-shield-heart"></i>Registro único</span><button class="button button--primary" type="button" data-open-record><i class="fa-solid fa-folder-open"></i>Abrir prontuário único</button></div></header><div class="record-strip">
      ${recordField("fa-allergies", "Alergias conhecidas", record.alergiasConhecidas)}
      ${recordField("fa-pills", "Medicamentos contínuos", record.medicamentosUsoContinuo)}
      ${recordField("fa-people-roof", "Histórico familiar", record.historicoFamiliar)}
    </div></section>
    <section class="columns-2">
      <div class="column-stack">
        <article class="card"><header class="card__header"><h2>Resumo e situação atual</h2></header><div class="card__body quick-list">
          ${infoItem("fa-file-medical", "Resumo clínico", record.resumoClinico)}
          ${infoItem("fa-heart-circle-bolt", "Condições e problemas ativos", record.condicoesAtivas)}
          ${infoItem("fa-stethoscope", "Diagnósticos confirmados", record.diagnosticosConfirmados)}
          ${infoItem("fa-list-check", "Acompanhamento e pendências", record.acompanhamentoPendencias)}
        </div></article>
        <article class="card"><header class="card__header"><h2>Antecedentes e contexto</h2></header><div class="card__body quick-list">
          ${infoItem("fa-notes-medical", "Antecedentes pessoais", record.antecedentesPessoais)}
          ${infoItem("fa-bed-pulse", "Cirurgias e internações", record.cirurgiasInternacoes)}
          ${infoItem("fa-syringe", "Imunizações", record.imunizacoes)}
          ${infoItem("fa-person-walking", "Hábitos e aspectos sociais", record.habitosAspectosSociais)}
        </div></article>
        <article class="card"><header class="card__header"><h2>Investigações e cuidado atual</h2></header><div class="card__body quick-list">
          ${infoItem("fa-vial-circle-check", "Exames relevantes", record.examesRelevantes)}
          ${infoItem("fa-kit-medical", "Tratamentos e procedimentos", record.tratamentosProcedimentos)}
          ${infoItem("fa-clipboard-check", "Plano terapêutico atual", record.planoTerapeuticoAtual)}
        </div></article>
        <article class="card"><header class="card__header"><h2>Dados cadastrais</h2></header><div class="card__body quick-list">
          ${infoItem("fa-phone", "Contato", patient.telefone || patient.email)}
          ${infoItem("fa-location-dot", "Endereço", [patient.logradouro, patient.numero, patient.municipio, patient.estado].filter(Boolean).join(", "))}
          ${infoItem("fa-user-doctor", "Médicos responsáveis", [...(patient.medicosResponsaveis ?? [])].map(m => `${m.nomeCompleto} · ${m.crm}`).join("; "))}
          ${infoItem("fa-clock", "Cadastro", formatDate(patient.dataCriacao, { dateStyle: "long" }))}
        </div></article>
      </div>
      <div class="column-stack">
        ${listCard("Alterações do prontuário", `<span class="status-badge status-badge--neutral">${record.historicoAtualizacoes?.length ?? 0} alteração(ões)</span>`, (record.historicoAtualizacoes ?? []).map(recordUpdateItem), emptyState("fa-clock-rotate-left", "Sem alterações consolidadas", "As confirmações feitas ao finalizar consultas aparecerão aqui."))}
        ${listCard("Histórico de consultas", `<span class="status-badge status-badge--neutral">${history.length} finalizada${history.length === 1 ? "" : "s"}</span>`, history.map(historyItem), emptyState("fa-calendar-check", "Sem consultas finalizadas", "Inicie o primeiro atendimento deste paciente."))}
      </div>
    </section>
  </div>`;
}

/**
 * Prontuário em formato de documento, com a linha do tempo de consultas e alterações.
 *
 * @param {object} patient dados cadastrais
 * @param {object} record prontuário único
 * @param {object[]} history consultas finalizadas
 * @param {"asc"|"desc"} [order] ordem da linha do tempo
 * @returns {string} HTML do documento
 */
export function recordDocumentView(patient, record, history, order = "desc") {
  const direction = order === "asc" ? 1 : -1;
  const consultations = [...history].sort((a, b) => direction * (new Date(a.dataHoraConsulta) - new Date(b.dataHoraConsulta)));
  const updates = [...(record.historicoAtualizacoes ?? [])].sort((a, b) => direction * (new Date(a.dataAlteracao) - new Date(b.dataAlteracao)));
  const sections = [
    ["Síntese clínica", [["Resumo clínico", record.resumoClinico], ["Condições e problemas ativos", record.condicoesAtivas], ["Diagnósticos confirmados", record.diagnosticosConfirmados]]],
    ["Alertas e cuidados contínuos", [["Alergias conhecidas", record.alergiasConhecidas], ["Medicamentos de uso contínuo", record.medicamentosUsoContinuo], ["Plano terapêutico atual", record.planoTerapeuticoAtual], ["Acompanhamento e pendências", record.acompanhamentoPendencias]]],
    ["Antecedentes e contexto", [["Antecedentes pessoais", record.antecedentesPessoais], ["Histórico familiar", record.historicoFamiliar], ["Cirurgias e internações", record.cirurgiasInternacoes], ["Imunizações", record.imunizacoes], ["Hábitos e aspectos sociais", record.habitosAspectosSociais]]],
    ["Investigações e tratamentos", [["Exames relevantes", record.examesRelevantes], ["Tratamentos e procedimentos", record.tratamentosProcedimentos]]]
  ];
  return `<div class="record-document">
    <header class="record-document__cover"><span class="record-document__symbol"><i class="fa-solid fa-staff-snake"></i></span><div><span class="eyebrow">Sistema Clínico</span><h2>Prontuário único longitudinal</h2><p>Documento consolidado de ${value(patient.nomeCompleto)}</p></div><span class="status-badge status-badge--done">Atualizado em ${formatDate(record.dataUltimaAtualizacao, { dateStyle: "short", timeStyle: "short" })}</span></header>
    <section class="record-document__identity"><div><small>Paciente</small><strong>${value(patient.nomeCompleto)}</strong></div><div><small>CPF</small><strong>${maskCpf(patient.cpf)}</strong></div><div><small>Nascimento</small><strong>${formatDate(patient.dataNascimento)}</strong></div><div><small>Consultas finalizadas</small><strong>${record.totalConsultasFinalizadas ?? 0}</strong></div></section>
    <section class="record-document__section"><h3 class="record-document__title"><i class="fa-solid fa-heart-pulse"></i> Estado clínico atual</h3>${sections.map(([group, fields]) => `<div class="record-clinical-group"><h4>${group}</h4><div class="record-document__grid">${fields.map(([label, content]) => `<article><small>${label}</small><p>${value(content, "Nenhuma informação confirmada")}</p></article>`).join("")}</div></div>`).join("")}</section>
    <section class="record-document__section"><h3 class="record-document__title"><i class="fa-solid fa-timeline"></i> Linha do tempo de consultas</h3><div class="record-timeline">${consultations.length ? consultations.map(consultationDocumentItem).join("") : emptyState("fa-calendar-check", "Sem consultas finalizadas", "A linha do tempo será construída após a primeira finalização.")}</div></section>
    <section class="record-document__section"><h3 class="record-document__title"><i class="fa-solid fa-clock-rotate-left"></i> Auditoria do documento</h3><div class="record-timeline">${updates.length ? updates.map(recordUpdateDocumentItem).join("") : emptyState("fa-clock-rotate-left", "Sem alterações auditadas", "As mudanças confirmadas serão registradas aqui.")}</div></section>
  </div>`;
}

/** Quantos itens de uma lista longa aparecem antes do botão "Mostrar mais". */
const ITENS_VISIVEIS = 4;

/**
 * Cartão com uma lista de itens que mostra só os primeiros e tem um botão para exibir o restante.
 *
 * @param {string} title título do cartão
 * @param {string} badge HTML do selo exibido ao lado do título
 * @param {string[]} items HTML de cada item da lista
 * @param {string} emptyHtml HTML exibido quando não há itens
 * @returns {string} HTML do cartão
 */
function listCard(title, badge, items, emptyHtml) {
  const extras = items.length - ITENS_VISIVEIS;
  const rows = items.map((html, index) => (index < ITENS_VISIVEIS ? html : `<div class="is-extra">${html}</div>`)).join("");
  const more = extras > 0
    ? `<footer class="card__more"><button class="button button--ghost" type="button" data-toggle-list aria-expanded="false" data-more="Mostrar mais (${extras})" data-less="Mostrar menos">Mostrar mais (${extras})</button></footer>`
    : "";
  return `<article class="card"><header class="card__header"><h2>${title}</h2>${badge}</header><div class="card__body timeline" data-collapsible-list>${items.length ? rows : emptyHtml}</div>${more}</article>`;
}

/** Evento de consulta na linha do tempo do documento. */
function consultationDocumentItem(item) {
  return `<article class="record-event"><time>${formatDate(item.dataHoraConsulta, { dateStyle: "long", timeStyle: "short" })}</time><div><h4>Consulta com ${value(item.nomeMedico)}</h4><p><strong>S:</strong> ${value(item.soap?.subjetivo)}</p><p><strong>O:</strong> ${value(item.soap?.objetivo)}</p><p><strong>A:</strong> ${value(item.soap?.avaliacao)}</p><p><strong>P:</strong> ${value(item.soap?.plano)}</p></div><a href="#/consulta/${item.id}">Abrir consulta</a></article>`;
}

/** Evento de alteração do prontuário na linha do tempo do documento. */
function recordUpdateDocumentItem(item) {
  return `<article class="record-event record-event--audit"><time>${formatDate(item.dataAlteracao, { dateStyle: "long", timeStyle: "short" })}</time><div><h4>${value(item.campo)}</h4><p><strong>Anterior:</strong> ${value(item.valorAnterior, "Sem valor anterior")}</p><p><strong>Novo:</strong> ${value(item.valorNovo)}</p><small>${value(item.nomeMedico)} · Consulta #${item.consultaId}</small></div></article>`;
}

/** Campo do prontuário, com texto padrão quando não há informação confirmada. */
function recordField(icon, label, content) {
  return `<div class="record-field"><span><i class="fa-solid ${icon}"></i>${label}</span><p class="clamp-text">${value(content, "Nenhuma informação confirmada")}</p></div>`;
}

/** Item do histórico de consultas na ficha do paciente. */
function historyItem(item) {
  const date = new Date(item.dataHoraConsulta);
  return `<a class="timeline-item" href="#/consulta/${item.id}"><span class="timeline-date"><strong>${date.getDate()}</strong><small>${date.toLocaleDateString("pt-BR", { month: "short" })}</small></span><span><h3>Consulta com ${value(item.nomeMedico)}</h3><p class="clamp-text clamp-text--static" title="${value(item.soap?.avaliacao, "Registro SOAP finalizado")}">${value(item.soap?.avaliacao, "Registro SOAP finalizado")}</p></span><span class="status-badge status-badge--done">Finalizada</span></a>`;
}

/** Item da trilha de alterações do prontuário, com link para a consulta de origem. */
function recordUpdateItem(item) {
  return `<a class="timeline-item" href="#/consulta/${item.consultaId}"><span class="timeline-date"><i class="fa-solid fa-pen-to-square"></i></span><span><h3>${value(item.campo)}</h3><p class="clamp-text clamp-text--static" title="${value(item.valorAnterior, "Sem valor anterior")} → ${value(item.valorNovo)}">${value(item.valorAnterior, "Sem valor anterior")} → ${value(item.valorNovo)}</p><small>${value(item.nomeMedico)} · ${formatDate(item.dataAlteracao, { dateStyle: "short", timeStyle: "short" })}</small></span></a>`;
}

/** Par de rótulo e valor com ícone. */
function infoItem(icon, label, content) {
  return `<div class="quick-item"><span class="quick-item__icon"><i class="fa-solid ${icon}"></i></span><span><strong>${label}</strong><small class="clamp-text">${value(content)}</small></span></div>`;
}

/**
 * @param {object[]} doctors médicos da clínica
 * @returns {string} HTML da tela da equipe médica
 */
export function doctorsView(doctors) {
  return `<div class="page-stack"><header class="page-heading"><div><span class="eyebrow">Rede assistencial</span><h1>Equipe médica</h1><p>Profissionais autorizados a acessar o ambiente clínico.</p></div><div class="heading-actions"><button class="button button--primary" data-new-doctor><i class="fa-solid fa-user-doctor"></i>Novo médico</button></div></header><section class="grid grid--3">${doctors.length ? doctors.map(doctorCard).join("") : emptyState("fa-user-doctor", "Nenhum profissional listado", "Cadastre outro médico para ampliar a equipe.")}</section></div>`;
}

/** Cartão de um médico da equipe. */
function doctorCard(doctor) {
  return `<article class="card"><div class="card__body"><div class="person-cell"><span class="avatar">${initials(doctor.nomeCompleto)}</span><span><strong>${value(doctor.nomeCompleto)}</strong><small>${value(doctor.crm)}</small></span></div><div class="patient-meta" style="margin-top:16px"><span><i class="fa-regular fa-envelope"></i>${value(doctor.email)}</span><span><i class="fa-solid fa-house-medical"></i>${value(doctor.clinicaAtuacao)}</span></div><div class="patient-meta" style="margin-top:12px">${[...(doctor.especialidades ?? [])].map(item => `<span class="status-badge status-badge--neutral">${value(item)}</span>`).join("") || '<span class="status-badge status-badge--neutral">Sem especialidade</span>'}</div></div></article>`;
}

/**
 * @param {object} doctor perfil do médico autenticado
 * @returns {string} HTML da tela de perfil, com o formulário de edição
 */
export function profileView(doctor) {
  return `<div class="page-stack"><header class="page-heading"><div><span class="eyebrow">Identidade profissional</span><h1>Meu perfil</h1><p>Dados utilizados no acesso e na autoria dos atendimentos.</p></div></header><section class="grid grid--2"><article class="card"><div class="card__body patient-hero" style="grid-template-columns:auto 1fr"><span class="avatar">${initials(doctor.nomeCompleto)}</span><div><h1>${value(doctor.nomeCompleto)}</h1><div class="patient-meta"><span>${value(doctor.crm)}</span><span>${value(doctor.clinicaAtuacao)}</span></div></div></div></article><article class="card"><header class="card__header"><h2>Atualizar dados</h2></header><form class="card__body form-grid" id="profile-form"><label class="field field--span-2"><span>Nome completo</span><input name="nomeCompleto" value="${value(doctor.nomeCompleto, "")}" required></label><label class="field"><span>E-mail</span><input name="email" type="email" value="${value(doctor.email, "")}" required></label><label class="field"><span>Nascimento</span><input name="dataNascimento" type="date" value="${value(doctor.dataNascimento, "")}" required></label><label class="field"><span>Clínica</span><input name="clinicaAtuacao" value="${value(doctor.clinicaAtuacao, "")}" readonly style="background: var(--surface-2); cursor: not-allowed;"></label><label class="field"><span>Especialidades</span><input name="especialidades" value="${value([...(doctor.especialidades ?? [])].join(", "), "")}"></label><div class="form-message field--span-2" data-form-message hidden></div><button class="button button--primary field--span-2" type="submit"><i class="fa-solid fa-check"></i>Salvar alterações</button></form></article></section></div>`;
}

/**
 * Tela de consulta: relato com transcrição, quatro eixos do SOAP, apoio consultivo da IA e confirmação dos dados
 * do prontuário. Em rascunho já analisado, o painel de confirmação abre preenchido com os dados que a IA
 * identificou. Em consulta finalizada, todos os campos ficam somente leitura.
 *
 * @param {object} data
 * @param {object|null} data.consultation consulta aberta, ou null para uma nova
 * @param {object[]} data.patients pacientes que podem ser selecionados
 * @param {string|null} data.selectedPatientId paciente pré-selecionado
 * @param {boolean} [data.readOnly] true para consulta finalizada
 * @returns {string} HTML da tela
 */
export function consultationView({ consultation, patients, selectedPatientId, readOnly = false }) {
  // Em rascunho analisado, o painel reabre com o que a IA identificou, para nada se perder ao recarregar a tela.
  const identified = readOnly ? null : consultation?.dadosProntuarioIdentificados;
  const pending = identified && Object.fromEntries(
    CAMPOS_IDENTIFICADOS.map(({ chave }) => [chave, valorIdentificado(identified[chave])]));
  const selected = consultation?.pacienteId ?? selectedPatientId ?? "";
  const soap = consultation?.soap ?? {};
  return `<div class="page-stack consultation-page" data-consultation-id="${consultation?.id ?? ""}" data-read-only="${readOnly}">
    <header class="page-heading"><div><span class="eyebrow">Atendimento estruturado</span><h1>${readOnly ? "Consulta finalizada" : consultation ? "Consulta em andamento" : "Nova consulta"}</h1><p>${readOnly ? "Registro clínico confirmado e imutável." : "A IA é opcional; toda informação permanece sob sua revisão."}</p></div>${consultation ? `<span class="status-badge ${readOnly ? "status-badge--done" : "status-badge--draft"}">${consultation.status}</span>` : ""}</header>
    <div class="stepper"><span class="step active" data-step="1">Paciente e relato</span><span class="step ${consultation ? "active" : ""}" data-step="2">SOAP</span><span class="step ${readOnly ? "active" : ""}" data-step="3">Revisão e finalização</span></div>
    <div class="consultation-layout"><div class="consultation-main">
      <article class="card"><header class="card__header"><h2>Paciente</h2></header><div class="card__body"><label class="field"><span>Selecione o paciente</span><select id="consultation-patient" ${consultation ? "disabled" : ""} required><option value="">Escolha um paciente da clínica</option>${patients.map(p => `<option value="${p.id}" ${String(p.id) === String(selected) ? "selected" : ""}>${value(p.nomeCompleto)} · ${maskCpf(p.cpf)}</option>`).join("")}</select></label></div></article>
      <article class="card speech-panel"><header class="card__header"><h2>Relato da consulta</h2><span class="status-badge status-badge--neutral"><i class="fa-solid fa-microphone-lines"></i>Web Speech</span></header><div class="speech-controls"><button class="record-button" id="record-button" type="button" ${readOnly ? "disabled" : ""} aria-label="Iniciar transcrição"><i class="fa-solid fa-microphone"></i></button><span class="speech-state"><strong id="speech-title">Pronto para transcrever</strong><small id="speech-subtitle">A fala vira texto no navegador; nenhum áudio é salvo.</small></span><button class="pause-button" id="pause-button" type="button" hidden ${readOnly ? "disabled" : ""} title="Pausar transcrição" aria-label="Pausar transcrição"><i class="fa-solid fa-pause"></i></button></div><p class="speech-unsupported" id="speech-unsupported" hidden>Seu navegador não oferece reconhecimento de voz. Continue pela digitação manual.</p><textarea class="transcript" id="transcript" placeholder="Digite o relato ou use o microfone..." ${readOnly ? "readonly" : ""}>${value(consultation?.transcricaoOriginal, "")}</textarea>${identifiedBox(consultation?.transcricaoIdentificada)}</article>
      <article class="card"><header class="card__header"><h2>Registro SOAP</h2><small>Revise os quatro eixos</small></header><div class="soap-tabs">${["subjetivo","objetivo","avaliacao","plano"].map((key,index) => `<button class="soap-tab ${index === 0 ? "active" : ""}" type="button" data-soap-tab="${key}">${key[0].toUpperCase()} · ${key}</button>`).join("")}</div>${soapPane("subjetivo", "S", "Relato, sintomas e percepções do paciente", soap.subjetivo, readOnly, true)}${soapPane("objetivo", "O", "Achados observáveis, medidas e exames", soap.objetivo, readOnly)}${soapPane("avaliacao", "A", "Síntese e hipóteses sob avaliação médica", soap.avaliacao, readOnly)}${soapPane("plano", "P", "Condutas, orientações e acompanhamento", soap.plano, readOnly)}</article>
      <article class="card"><header class="card__header"><h2>Observações gerais</h2></header><div class="card__body"><label class="field"><textarea id="general-data" rows="4" placeholder="Informações complementares do atendimento" ${readOnly ? "readonly" : ""}>${value(consultation?.dadosGeraisConsulta, "")}</textarea></label></div></article>
      ${readOnly ? "" : `<div class="finish-bar"><small><i class="fa-solid fa-circle-info"></i> Salve o rascunho antes de usar o apoio consultivo.</small><div class="heading-actions"><button class="button button--ghost" id="save-draft" type="button"><i class="fa-solid fa-floppy-disk"></i>${consultation ? "Salvar rascunho" : "Criar rascunho"}</button>${consultation ? '<button class="button button--primary" id="finish-consultation" type="button"><i class="fa-solid fa-circle-check"></i>Revisar e finalizar</button>' : ""}</div></div>`}
    </div><aside class="consultation-side">
      <article class="card assist-card"><div class="card__body"><div class="assist-heading"><span class="assist-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span><div><h3>Apoio consultivo</h3><p>Gemini · uso opcional</p></div></div><div class="assist-note"><i class="fa-solid fa-user-doctor"></i> Aceite para copiar a sugestão ao campo clínico correspondente ou recuse para descartá-la.</div>${readOnly || !consultation ? "" : '<button class="button button--secondary button--wide" id="analyze-ai" type="button"><span>Analisar transcrição</span><i class="fa-solid fa-arrow-right"></i></button>'}<div id="suggestions">${suggestionsHtml(consultation, !readOnly)}</div></div></article>
      <article class="card"><header class="card__header"><h3>Consolidar no prontuário</h3><small>Somente campos preenchidos e confirmados serão atualizados</small></header><div class="card__body form-grid">
        ${consolidationField("confirmed-summary", "Resumo clínico", "", readOnly)}
        ${consolidationField("confirmed-allergies", "Alergias conhecidas", consultation?.alergiasConfirmadas || pending?.alergiasConhecidas, readOnly)}
        ${consolidationField("confirmed-medicines", "Medicamentos contínuos", consultation?.medicamentosUsoContinuoConfirmados || pending?.medicamentosUsoContinuo, readOnly)}
        ${consolidationField("confirmed-history", "Histórico familiar", consultation?.historicoFamiliarConfirmado || pending?.historicoFamiliar, readOnly)}
        ${consolidationField("confirmed-personal-history", "Antecedentes pessoais", pending?.antecedentesPessoais, readOnly)}
        ${consolidationField("confirmed-active-conditions", "Condições e problemas ativos", "", readOnly)}
        ${consolidationField("confirmed-surgeries", "Cirurgias e internações", pending?.cirurgiasInternacoes, readOnly)}
        ${consolidationField("confirmed-immunizations", "Imunizações", pending?.imunizacoes, readOnly)}
        ${consolidationField("confirmed-habits", "Hábitos e aspectos sociais", pending?.habitosAspectosSociais, readOnly)}
        ${consolidationField("confirmed-diagnoses", "Diagnósticos confirmados", "", readOnly)}
        ${consolidationField("confirmed-exams", "Exames relevantes", "", readOnly)}
        ${consolidationField("confirmed-treatments", "Tratamentos e procedimentos", "", readOnly)}
        ${consolidationField("confirmed-plan", "Plano terapêutico atual", "", readOnly)}
        ${consolidationField("confirmed-follow-up", "Acompanhamento e pendências", "", readOnly)}
      </div></article>
    </aside></div>
  </div>`;
}

/** Bloco recolhível com o diálogo em que a IA identificou as falas (é uma estimativa). */
function identifiedBox(text) {
  return `<details class="identified-box" id="identified-box" open ${text ? "" : "hidden"}><summary><i class="fa-solid fa-comments"></i>Falas identificadas pela IA (estimativa, sujeita a revisão)</summary><pre id="identified-transcript">${value(text, "")}</pre></details>`;
}

/** Campo de texto de um dado do prontuário a ser confirmado pelo médico. */
function consolidationField(id, label, content = "", readOnly = false) {
  return `<label class="field field--span-2"><span>${label}</span><textarea id="${id}" rows="2" ${readOnly ? "readonly" : ""}>${value(content, "")}</textarea></label>`;
}

/** Painel de um dos quatro eixos do SOAP. */
function soapPane(key, letter, helper, content, readOnly, active = false) {
  return `<div class="soap-pane ${active ? "active" : ""}" data-soap-pane="${key}"><label class="field"><span>${letter} · ${key[0].toUpperCase() + key.slice(1)}</span><div class="mirror-field"><div class="mirror-field__backdrop" aria-hidden="true"></div><textarea id="soap-${key}" placeholder="${helper}" ${readOnly ? "readonly" : ""}>${value(content, "")}</textarea></div><small>${helper}</small></label></div>`;
}

/**
 * Lista as sugestões da IA (pré-diagnósticos, exames e condutas), cada uma com ações de aceitar ou recusar.
 *
 * @param {object} data resposta da análise
 * @param {boolean} [interactive] false para exibir sem os botões de ação
 * @returns {string} HTML das sugestões
 */
export function suggestionsHtml(data, interactive = true) {
  const groups = [
    ["Hipóteses preliminares", data?.preDiagnosticosSugeridos ?? data?.preDiagnosticos, "soap-avaliacao", "Avaliação"],
    ["Exames sugeridos", data?.examesSugeridos ?? data?.exames, "soap-plano", "Plano"],
    ["Possíveis condutas", data?.prescricoesSugeridas ?? data?.prescricoes, "soap-plano", "Plano"]
  ];
  if (!groups.some(([, items]) => items?.length)) return '<p class="assist-note">As sugestões aparecerão aqui separadas do registro confirmado.</p>';
  return groups.filter(([, items]) => items?.length).map(([title, items, target, targetLabel]) => `<div class="suggestion-group"><h4>${title}</h4><div class="suggestion-list">${items.map(item => `<article class="suggestion-item" data-target="${target}"><p data-suggestion-text>${value(item)}</p>${interactive ? `<div class="suggestion-actions"><button type="button" class="suggestion-decision suggestion-decision--accept" data-suggestion-action="accept" title="Aceitar e copiar para ${targetLabel}" aria-label="Aceitar sugestão e copiar para ${targetLabel}"><i class="fa-solid fa-check"></i></button><button type="button" class="suggestion-decision suggestion-decision--reject" data-suggestion-action="reject" title="Recusar sugestão" aria-label="Recusar sugestão"><i class="fa-solid fa-xmark"></i></button></div>` : ""}</article>`).join("")}</div></div>`).join("");
}

/** Formata um número no padrão brasileiro, tratando valores ausentes como zero. */
const fmt = (number) => Number(number ?? 0).toLocaleString("pt-BR");

/**
 * Painel de uso da IA: tokens do médico e da clínica, cota diária, consumo por médico e série dos últimos 14 dias.
 * Exibe apenas números, nunca conteúdo clínico.
 *
 * @param {object} usage resposta de GET /ia/uso
 * @returns {string} HTML da tela
 */
export function aiUsageView(usage) {
  const { configuracao: config, meu, clinica, medicos, ultimosDias: days } = usage;
  const limit = Number(config.limiteDiarioPorMedico ?? 0);
  const used = Number(meu.hoje.tokensTotal ?? 0);
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const peak = Math.max(1, ...days.map((day) => day.tokensClinica));
  const maxDoctor = Math.max(1, ...medicos.map((doctor) => doctor.tokensTotal));
  return `<div class="page-stack">
    <header class="page-heading"><div><span class="eyebrow">Consumo da integração</span><h1>Uso da IA</h1><p>Tokens gastos pelas análises consultivas da Gemini. Somente números são exibidos: nenhum conteúdo clínico aparece aqui.</p></div></header>
    <section class="grid grid--4" aria-label="Resumo do consumo">
      ${metric("fa-user-doctor", fmt(meu.hoje.tokensTotal), "Meus tokens hoje")}
      ${metric("fa-calendar-days", fmt(meu.mes.tokensTotal), "Meus tokens no mês", "mint")}
      ${metric("fa-coins", fmt(meu.total.tokensTotal), "Meus tokens no total", "amber")}
      ${metric("fa-house-medical", fmt(clinica.total.tokensTotal), "Tokens da clínica no total", "coral")}
    </section>
    ${limit > 0 ? `<article class="card"><div class="card__body usage-limit"><div><strong>Cota diária: ${fmt(used)} de ${fmt(limit)} tokens</strong><small>Ao atingir o limite, novas análises ficam bloqueadas até o dia seguinte. A consulta pode ser finalizada manualmente.</small></div><div class="usage-meter" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div></div></article>` : ""}
    <section class="grid grid--2">
      <article class="card table-card"><header class="card__header"><h2>Meu consumo</h2><small>${escapeHtml(config.modeloPrincipal)}${config.modeloReserva !== config.modeloPrincipal ? ` · reserva ${escapeHtml(config.modeloReserva)}` : ""}</small></header><div class="table-scroll">${periodsTable(meu)}</div></article>
      <article class="card table-card"><header class="card__header"><h2>Consumo da clínica</h2><small>todos os médicos somados</small></header><div class="table-scroll">${periodsTable(clinica)}</div></article>
    </section>
    <article class="card table-card"><header class="card__header"><h2>Consumo por médico</h2><small>tokens por profissional da clínica</small></header><div class="table-scroll"><table class="data-table usage-table"><thead><tr><th>Médico</th><th>No mês</th><th>No total</th><th>Solicitações</th><th>Último uso</th><th>Participação</th></tr></thead><tbody>
      ${medicos.map((doctor) => `<tr><td><div class="person-cell"><span class="avatar">${initials(doctor.nome)}</span><span><strong>${value(doctor.nome)}${doctor.voce ? ' <span class="status-badge status-badge--neutral">você</span>' : ""}</strong><small>${value(doctor.crm)}</small></span></div></td><td>${fmt(doctor.tokensMes)}</td><td><strong>${fmt(doctor.tokensTotal)}</strong></td><td>${fmt(doctor.solicitacoes)}</td><td>${doctor.ultimoUso ? formatDate(doctor.ultimoUso, { dateStyle: "short", timeStyle: "short" }) : "Sem uso"}</td><td><div class="usage-bar"><span style="width:${Math.round((doctor.tokensTotal / maxDoctor) * 100)}%"></span></div></td></tr>`).join("")}
    </tbody></table></div></article>
    <article class="card"><header class="card__header"><h2>Últimos 14 dias</h2><small>tokens por dia: clínica (barra clara) e você (barra escura)</small></header><div class="card__body"><div class="usage-chart" role="img" aria-label="Tokens por dia nos últimos 14 dias">
      ${days.map((day) => `<div class="usage-chart__day" title="${formatDate(day.data, { dateStyle: "short" })}: clínica ${fmt(day.tokensClinica)} · você ${fmt(day.meusTokens)}"><div class="usage-chart__bars"><span class="usage-chart__clinic" style="height:${Math.round((day.tokensClinica / peak) * 100)}%"></span><span class="usage-chart__mine" style="height:${Math.round((day.meusTokens / peak) * 100)}%"></span></div><small>${day.data.slice(8, 10)}/${day.data.slice(5, 7)}</small></div>`).join("")}
    </div></div></article>
    <article class="card"><div class="card__body"><div class="assist-note"><i class="fa-solid fa-circle-info"></i> Token é a unidade de cobrança da Gemini (cerca de 4 caracteres de texto). O total soma o texto enviado, a resposta e o raciocínio interno do modelo. Quando o relato não muda entre duas solicitações, o resultado anterior é reaproveitado e nada é gasto.</div></div></article>
  </div>`;
}

/** Tabela de totais de hoje, do mês e de todo o período, com a divisão entre entrada, saída e raciocínio. */
function periodsTable(periods) {
  const rows = [["Hoje", periods.hoje], ["Neste mês", periods.mes], ["Total", periods.total]];
  return `<table class="data-table usage-table"><thead><tr><th>Período</th><th>Entrada</th><th>Saída</th><th>Raciocínio</th><th>Total</th><th>Análises</th><th>Reaprov.</th><th>Falhas</th></tr></thead><tbody>${rows.map(([label, totals]) => `<tr><td><strong>${label}</strong></td><td>${fmt(totals.tokensEntrada)}</td><td>${fmt(totals.tokensSaida)}</td><td>${fmt(totals.tokensRaciocinio)}</td><td><strong>${fmt(totals.tokensTotal)}</strong></td><td>${fmt(totals.solicitacoes - totals.falhas - totals.reaproveitadas)}</td><td>${fmt(totals.reaproveitadas)}</td><td>${fmt(totals.falhas)}</td></tr>`).join("")}</tbody></table>`;
}
