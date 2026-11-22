/** Gera localmente um PDF vetorial do prontuário sem transmitir dados a terceiros. */
export function downloadMedicalRecordPdf({ patient, record, history, order = "desc" }) {
  const JsPdf = window.jspdf?.jsPDF;
  if (!JsPdf) throw new Error("O gerador de PDF não foi carregado. Verifique sua conexão e tente novamente.");
  const doc = new JsPdf({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const width = 210, height = 297, left = 16, right = 194, contentWidth = right - left;
  let y = 20, page = 1;
  const teal = [18, 63, 74], mint = [37, 145, 123], ink = [32, 45, 48], muted = [95, 110, 113], pale = [238, 246, 244];

  const footer = () => {
    doc.setDrawColor(...mint); doc.line(left, 284, right, 284);
    doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text("Sistema Clínico · documento confidencial", left, 290);
    doc.text(`Página ${page}`, right, 290, { align: "right" });
  };
  const newPage = () => { footer(); doc.addPage(); page += 1; y = 20; };
  const ensure = (needed = 20) => { if (y + needed > 278) newPage(); };
  const text = (value) => String(value ?? "").trim() || "Nenhuma informação confirmada";
  const write = (value, x = left, maxWidth = contentWidth, size = 10, color = ink, style = "normal") => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text(value), maxWidth); ensure(lines.length * (size * 0.42) + 3);
    doc.text(lines, x, y); y += lines.length * (size * 0.42) + 3;
  };
  const heading = (title) => {
    ensure(16); y += 3; doc.setFillColor(...pale); doc.roundedRect(left, y - 6, contentWidth, 11, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...teal); doc.text(title, left + 4, y + 1); y += 10;
  };
  const field = (label, value) => {
    ensure(18); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...mint); doc.text(label.toUpperCase(), left, y); y += 5;
    write(value, left, contentWidth, 9.5, ink); doc.setDrawColor(222, 230, 229); doc.line(left, y - 1, right, y - 1); y += 3;
  };
  const formatDate = (value) => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

  doc.setFillColor(...teal); doc.rect(0, 0, width, 42, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("PRONTUÁRIO ÚNICO", left, 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text("Documento clínico longitudinal consolidado", left, 26);
  doc.setFontSize(8); doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, left, 34); y = 53;
  heading("Identificação do paciente");
  field("Nome", patient.nomeCompleto); field("CPF", patient.cpf); field("Data de nascimento", patient.dataNascimento);
  field("Última atualização", formatDate(record.dataUltimaAtualizacao));

  heading("Estado clínico atual");
  const fields = [
    ["Resumo clínico", record.resumoClinico], ["Alergias conhecidas", record.alergiasConhecidas],
    ["Medicamentos de uso contínuo", record.medicamentosUsoContinuo], ["Condições e problemas ativos", record.condicoesAtivas],
    ["Diagnósticos confirmados", record.diagnosticosConfirmados], ["Antecedentes pessoais", record.antecedentesPessoais],
    ["Histórico familiar", record.historicoFamiliar], ["Cirurgias e internações", record.cirurgiasInternacoes],
    ["Imunizações", record.imunizacoes], ["Hábitos e aspectos sociais", record.habitosAspectosSociais],
    ["Exames relevantes", record.examesRelevantes], ["Tratamentos e procedimentos", record.tratamentosProcedimentos],
    ["Plano terapêutico atual", record.planoTerapeuticoAtual], ["Acompanhamento e pendências", record.acompanhamentoPendencias]
  ];
  fields.forEach(([label, value]) => field(label, value));

  heading("Linha do tempo de consultas");
  const direction = order === "asc" ? 1 : -1;
  [...history].sort((a, b) => direction * (new Date(a.dataHoraConsulta) - new Date(b.dataHoraConsulta))).forEach((item, index) => {
    ensure(38); write(`${index + 1}. ${formatDate(item.dataHoraConsulta)} · ${item.nomeMedico}`, left, contentWidth, 10, teal, "bold");
    [["Subjetivo", item.soap?.subjetivo], ["Objetivo", item.soap?.objetivo], ["Avaliação", item.soap?.avaliacao], ["Plano", item.soap?.plano]].forEach(([label, value]) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...muted); doc.text(`${label}:`, left + 3, y);
      const lines = doc.splitTextToSize(text(value), contentWidth - 25); doc.setFont("helvetica", "normal"); doc.setTextColor(...ink); doc.text(lines, left + 24, y); y += Math.max(5, lines.length * 4);
      ensure(8);
    }); y += 4;
  });

  heading("Auditoria das alterações");
  [...(record.historicoAtualizacoes ?? [])].sort((a, b) => direction * (new Date(a.dataAlteracao) - new Date(b.dataAlteracao))).forEach((item) => {
    ensure(25); write(`${formatDate(item.dataAlteracao)} · ${item.campo}`, left, contentWidth, 9, teal, "bold");
    write(`Anterior: ${text(item.valorAnterior)}`, left + 3, contentWidth - 3, 8.5, muted);
    write(`Novo: ${text(item.valorNovo)}`, left + 3, contentWidth - 3, 8.5, ink);
    write(`${item.nomeMedico} · Consulta #${item.consultaId}`, left + 3, contentWidth - 3, 8, muted); y += 2;
  });
  footer();
  const safeName = String(patient.nomeCompleto ?? "paciente").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  doc.save(`prontuario-unico-${safeName || "paciente"}.pdf`);
}
