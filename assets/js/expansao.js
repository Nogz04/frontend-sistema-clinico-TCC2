/**
 * Listas e textos longos recolhíveis da ficha do paciente.
 *
 * Uma lista longa mostra só os primeiros itens e tem um botão para exibir o restante. Um texto longo é limitado a
 * três linhas e ganha um botão "Ver mais" apenas quando realmente passa disso.
 */

/**
 * Liga, na área principal da página, os botões de expandir e recolher. Chamar uma única vez, pois a área principal
 * permanece a mesma ao trocar de tela.
 *
 * @param {HTMLElement} visao contêiner que recebe o conteúdo das telas
 */
export function ligarExpansao(visao) {
  visao.addEventListener("click", (event) => {
    const lista = event.target.closest("[data-toggle-list]");
    if (lista) return alternarLista(lista);
    const texto = event.target.closest("[data-toggle-clamp]");
    if (texto) alternarTexto(texto);
  });
}

/**
 * Expande ou recolhe a lista do cartão do botão.
 *
 * @param {HTMLButtonElement} botao botão "Mostrar mais" ou "Mostrar menos"
 */
function alternarLista(botao) {
  const lista = botao.closest(".card").querySelector("[data-collapsible-list]");
  const aberta = lista.classList.toggle("is-expanded");
  botao.setAttribute("aria-expanded", String(aberta));
  botao.textContent = aberta ? botao.dataset.less : botao.dataset.more;
  if (aberta) prepararTextosLongos(lista);
  else lista.scrollTop = 0;
}

/**
 * Mostra ou limita o texto que fica antes do botão.
 *
 * @param {HTMLButtonElement} botao botão "Ver mais" ou "Ver menos"
 */
function alternarTexto(botao) {
  const aberto = botao.previousElementSibling.classList.toggle("is-open");
  botao.setAttribute("aria-expanded", String(aberto));
  botao.textContent = aberto ? "Ver menos" : "Ver mais";
}

/**
 * Acrescenta o botão "Ver mais" aos textos que passam do limite de linhas. Textos escondidos são ignorados e
 * podem ser preparados depois, quando ficarem visíveis.
 *
 * @param {ParentNode} raiz trecho da página a examinar
 */
export function prepararTextosLongos(raiz) {
  raiz.querySelectorAll(".clamp-text:not(.clamp-text--static):not([data-clamp-ready])").forEach((texto) => {
    if (texto.clientHeight === 0 || texto.scrollHeight <= texto.clientHeight + 1) return;
    texto.dataset.clampReady = "true";
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "clamp-toggle";
    botao.dataset.toggleClamp = "";
    botao.setAttribute("aria-expanded", "false");
    botao.textContent = "Ver mais";
    texto.after(botao);
  });
}
