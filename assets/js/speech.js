/**
 * Adaptador da Web Speech API. A aplicação recebe somente texto: nenhum arquivo
 * de áudio é gravado ou enviado ao backend.
 *
 * Estados informados em onState: "idle" (parado), "listening" (ouvindo) e "paused" (pausado).
 *
 * O navegador encerra sozinho cada sessão de escuta (por silêncio, por tempo ou por falha passageira). Por isso,
 * enquanto o médico não encerrar a transcrição, uma nova sessão é aberta automaticamente e o estado permanece
 * "listening". A escuta só para quando o médico clica em encerrar, ao sair da tela ou diante de uma falha que
 * reiniciar não resolve (microfone negado ou indisponível, serviço de voz fora do ar).
 *
 * Além do reinício após o fim da sessão, há uma vigilância contra sessões "travadas": o navegador às vezes mantém a
 * escuta aberta sem entregar mais texto e sem avisar. Se uma sessão passa do tempo limite sem nenhuma atividade
 * recente de fala, ela é recriada (sem interromper quem está falando). Falhas de rede passageiras também são
 * tentadas de novo antes de desistir.
 *
 * A API do navegador não tem pausa nativa: pausar encerra a escuta atual e retomar abre outra sessão,
 * enquanto o texto já transcrito permanece na tela.
 */
export class SpeechTranscriber {
  constructor({ onText, onState, onError, recycleAfterMs = 40000 }) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = Boolean(Recognition);
    this.listening = false;
    this.paused = false;
    /** true desde o início até o encerramento pedido pelo médico: indica que a escuta deve continuar ligada. */
    this.wanted = false;
    /** Reinício automático agendado, ainda não executado. */
    this.restartTimer = null;
    this.restartPending = false;
    /** Sessões seguidas que terminaram quase logo após começar; muitas indicam que reiniciar não adianta. */
    this.shortSessions = 0;
    this.sessionStart = 0;
    /** Última atividade vinda do navegador (áudio, fala ou resultado) na sessão atual. */
    this.lastActivity = 0;
    this.beginAt = 0;
    /** Tempo de sessão, sem atividade recente, a partir do qual ela é recriada. */
    this.recycleAfterMs = recycleAfterMs;
    this.watchdog = null;
    this.recycleTimer = null;
    this.recycling = false;
    /** Erros de rede seguidos, zerados quando chega texto. */
    this.networkFails = 0;
    this.onText = onText;
    this.onState = onState;
    this.onError = onError;
    if (!Recognition) return;

    this.recognition = new Recognition();
    this.recognition.lang = "pt-BR";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.onstart = () => {
      this.sessionStart = Date.now();
      this.lastActivity = this.sessionStart;
      this.log("sessão iniciada");
      this.updateState("listening");
    };
    for (const evento of ["onaudiostart", "onsoundstart", "onspeechstart"]) this.recognition[evento] = () => this.touch();
    this.recognition.onend = () => {
      this.recycling = false;
      clearTimeout(this.recycleTimer);
      this.log("sessão encerrada pelo navegador");
      if (this.paused) this.updateState("paused");
      else if (this.wanted) this.scheduleRestart();
      else this.updateState("idle");
    };
    this.recognition.onerror = ({ error }) => {
      // Silêncio e interrupções são normais: o onend que se segue reinicia a escuta.
      this.log(`erro: ${error}`);
      if (error === "no-speech" || error === "aborted") return;
      if (error === "network" && ++this.networkFails < 4) return;
      this.fail({
        "not-allowed": "Permita o uso do microfone no navegador.",
        "service-not-allowed": "Permita o uso do microfone no navegador.",
        "audio-capture": "O microfone não está disponível.",
        network: "O serviço de reconhecimento de voz está indisponível."
      }[error] ?? "Não foi possível transcrever a fala.");
    };
    this.recognition.onresult = (event) => {
      this.touch();
      this.networkFails = 0;
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const text = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText += text;
        else interimText += text;
      }
      this.onText?.({ finalText: finalText.trim(), interimText: interimText.trim() });
    };
  }

  /** Inicia a escuta (ou encerra, se já houver uma sessão ouvindo ou pausada). */
  toggle() {
    if (!this.supported) return;
    if (this.wanted || this.paused) this.stop();
    else this.start();
  }

  start() {
    if (!this.supported || this.wanted) return;
    this.paused = false;
    this.wanted = true;
    this.shortSessions = 0;
    this.networkFails = 0;
    this.startWatchdog();
    if (!this.begin()) {
      this.wanted = false;
      this.stopWatchdog();
      this.updateState("idle");
    }
  }

  /** Suspende a escuta mantendo o texto já transcrito; use resume() para continuar. */
  pause() {
    if (!this.supported || !this.wanted || this.paused) return;
    this.paused = true;
    const entreSessoes = this.restartPending;
    this.restartPending = false;
    this.cancelRestart();
    if (this.listening && !entreSessoes) this.recognition.stop();
    else this.updateState("paused");
  }

  /** Continua a transcrição depois de uma pausa, acrescentando ao texto existente. */
  resume() {
    if (!this.supported || !this.paused) return;
    this.shortSessions = 0;
    if (this.begin()) this.paused = false;
  }

  /** Pausa se estiver ouvindo e retoma se estiver pausado. */
  togglePause() {
    if (this.paused) this.resume();
    else if (this.wanted) this.pause();
  }

  /** Encerra a transcrição, ouvindo ou pausada. Só é chamado pelo médico ou ao sair da tela. */
  stop() {
    if (!this.supported) return;
    const estavaParado = !this.listening;
    this.wanted = false;
    this.paused = false;
    this.cancelRestart();
    this.stopWatchdog();
    if (this.listening) this.recognition.stop();
    if (estavaParado || this.restartPending) this.updateState("idle");
    this.restartPending = false;
  }

  /** Registra atividade da sessão atual (usada pela vigilância contra sessões travadas). */
  touch() {
    this.lastActivity = Date.now();
  }

  /** Verifica periodicamente se a sessão atual travou e, se sim, a recria. */
  startWatchdog() {
    this.stopWatchdog();
    const intervalo = Math.max(200, Math.min(5000, this.recycleAfterMs / 4));
    this.watchdog = setInterval(() => {
      if (!this.wanted || this.paused || this.restartPending || this.recycling) return;
      const agora = Date.now();
      const semAtividade = agora - this.lastActivity >= Math.min(2500, this.recycleAfterMs / 2);
      const sessaoLonga = agora - (this.sessionStart || this.beginAt) >= this.recycleAfterMs;
      if (sessaoLonga && semAtividade) this.recycle();
    }, intervalo);
  }

  stopWatchdog() {
    clearInterval(this.watchdog);
    this.watchdog = null;
    clearTimeout(this.recycleTimer);
    this.recycling = false;
  }

  /** Derruba a sessão atual (sem esperar resultado) e abre outra; garante o reinício mesmo se o fim não for avisado. */
  recycle() {
    this.log("recriando sessão sem atividade");
    this.recycling = true;
    try { this.recognition.abort(); } catch { /* sessão já encerrada */ }
    clearTimeout(this.recycleTimer);
    this.recycleTimer = setTimeout(() => {
      if (!this.recycling || !this.wanted || this.paused) return;
      this.recycling = false;
      this.queueRestart();
    }, 1500);
  }

  /** Abre uma nova sessão logo após o navegador encerrar a anterior, sem mudar o estado exibido. */
  scheduleRestart() {
    const duration = this.sessionStart ? Date.now() - this.sessionStart : 0;
    this.sessionStart = 0;
    this.shortSessions = duration < 1500 ? this.shortSessions + 1 : 0;
    if (this.shortSessions >= 6) {
      this.fail("A transcrição foi interrompida pelo navegador. Clique no microfone para iniciar de novo.");
      return;
    }
    this.queueRestart();
  }

  /** Agenda a abertura da próxima sessão; se o navegador recusar, tenta de novo algumas vezes. */
  queueRestart() {
    this.restartPending = true;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.restartPending = false;
      if (!this.wanted || this.paused) return;
      if (this.begin(true)) return;
      this.shortSessions += 1;
      if (this.shortSessions >= 6) this.fail("Não foi possível manter a transcrição ligada. Clique no microfone para iniciar de novo.");
      else this.queueRestart();
    }, 300);
  }

  cancelRestart() {
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }

  /** Interrompe de vez a transcrição e avisa o médico. */
  fail(message) {
    this.wanted = false;
    this.paused = false;
    this.restartPending = false;
    this.cancelRestart();
    this.stopWatchdog();
    this.log(`desistiu: ${message}`);
    this.updateState("idle");
    this.onError?.(message);
  }

  /**
   * @param {boolean} [silent] true nos reinícios automáticos, em que uma recusa não deve gerar aviso
   * @returns {boolean} falso quando o navegador recusa iniciar (ex.: a sessão anterior ainda está encerrando)
   */
  begin(silent = false) {
    this.sessionStart = 0;
    this.beginAt = this.lastActivity = Date.now();
    try {
      this.recognition.start();
      return true;
    } catch {
      if (!silent) this.onError?.("Aguarde um instante e tente novamente.");
      return false;
    }
  }

  log(mensagem) {
    console.debug("[fala]", mensagem);
  }

  updateState(state) {
    this.listening = state === "listening";
    this.onState?.(state);
  }
}
