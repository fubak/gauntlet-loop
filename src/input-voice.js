/**
 * Speech adapter: transcripts go to parseIntent, enqueue source voice.
 */
(function inputVoiceModule() {
  "use strict";

  var UNAVAILABLE_MSG = "Voice unavailable. Use typed commands.";

  /**
   * @returns {typeof SpeechRecognition | null}
   */
  function getSpeechCtor() {
    var g = typeof globalThis !== "undefined" ? globalThis : window;
    return g.SpeechRecognition || g.webkitSpeechRecognition || null;
  }

  /**
   * @returns {boolean}
   */
  function hasGetUserMedia() {
    return !!(
      navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function"
    );
  }

  /**
   * @returns {boolean}
   */
  function isVoicePlatformAvailable() {
    return !!getSpeechCtor() && hasGetUserMedia();
  }

  /**
   * @param {{
   *   parseIntent: (text: string) => object[],
   *   onVoiceCommands: (cmds: object[]) => void,
   *   getMode: () => string,
   *   modeBoot: string
   * }} opts
   */
  function attachVoiceInput(opts) {
    var hud = document.createElement("div");
    hud.id = "voice-hud";
    hud.setAttribute("aria-live", "polite");

    var listenBtn = document.createElement("button");
    listenBtn.type = "button";
    listenBtn.id = "voice-listen";
    listenBtn.textContent = "Listen";

    var wrap = document.createElement("div");
    wrap.id = "voice-controls";
    wrap.appendChild(hud);
    wrap.appendChild(listenBtn);
    document.body.appendChild(wrap);

    var available = isVoicePlatformAvailable();
    var listening = false;
    var gestureArmed = false;
    /** @type {SpeechRecognition | null} */
    var recognition = null;
    var forcedUnavailable = false;

    /**
     * @returns {boolean}
     */
    function voiceReady() {
      return available && !forcedUnavailable;
    }

    function setHud(text) {
      hud.textContent = text;
    }

    function refreshUi() {
      var inBoot = opts.getMode() === opts.modeBoot;
      if (!voiceReady() || inBoot) {
        wrap.style.display = inBoot ? "none" : "flex";
        listenBtn.style.display = "none";
        if (!voiceReady()) {
          setHud(UNAVAILABLE_MSG);
        }
        return;
      }
      wrap.style.display = "flex";
      listenBtn.style.display = "block";
      if (listening) {
        setHud("Listening...");
      } else {
        setHud("Tap Listen, then speak a command.");
      }
    }

    function stopRecognition() {
      listening = false;
      gestureArmed = false;
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          /* ignore */
        }
        recognition = null;
      }
    }

    function markUnavailable() {
      forcedUnavailable = true;
      available = false;
      stopRecognition();
      setHud(UNAVAILABLE_MSG);
      listenBtn.style.display = "none";
    }

    /**
     * @param {string} text
     */
    function deliverFinalTranscript(text) {
      var cmds = opts.parseIntent(text);
      if (!cmds.length) {
        return cmds;
      }
      var voiceCmds = [];
      var i;
      for (i = 0; i < cmds.length; i++) {
        var copy = {
          type: cmds[i].type,
          payload: cmds[i].payload ? Object.assign({}, cmds[i].payload) : {},
          source: "voice",
        };
        voiceCmds.push(copy);
      }
      opts.onVoiceCommands(voiceCmds);
      return voiceCmds;
    }

    /**
     * @param {SpeechRecognitionEvent} ev
     */
    function handleResult(ev) {
      var i;
      for (i = ev.resultIndex; i < ev.results.length; i++) {
        var res = ev.results[i];
        if (!res.isFinal) {
          continue;
        }
        var text = res[0].transcript;
        deliverFinalTranscript(text);
      }
    }

    function startListening() {
      if (!voiceReady() || opts.getMode() === opts.modeBoot) {
        return false;
      }
      var Ctor = getSpeechCtor();
      if (!Ctor) {
        markUnavailable();
        return false;
      }
      stopRecognition();
      gestureArmed = true;
      recognition = new Ctor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = function (ev) {
        handleResult(ev);
      };
      recognition.onerror = function (ev) {
        var err = ev.error || "error";
        if (
          err === "not-allowed" ||
          err === "service-not-allowed" ||
          err === "audio-capture"
        ) {
          markUnavailable();
        } else {
          stopRecognition();
          if (voiceReady()) {
            setHud("Voice error. Tap Listen to try again.");
          }
        }
        refreshUi();
      };
      recognition.onend = function () {
        listening = false;
        refreshUi();
      };

      try {
        recognition.start();
        listening = true;
        refreshUi();
        return true;
      } catch (e) {
        markUnavailable();
        return false;
      }
    }

    listenBtn.addEventListener("click", function () {
      if (!voiceReady() || opts.getMode() === opts.modeBoot) {
        return;
      }
      startListening();
    });

    if (!voiceReady()) {
      setHud(UNAVAILABLE_MSG);
      listenBtn.style.display = "none";
    } else {
      setHud("Tap Listen, then speak a command.");
    }
    refreshUi();

    return {
      syncForMode: refreshUi,
      isAvailable: function () {
        return voiceReady();
      },
      getHudText: function () {
        return hud.textContent;
      },
      isListening: function () {
        return listening;
      },
      isListenVisible: function () {
        return listenBtn.style.display !== "none" && voiceReady();
      },
      markUnavailable: markUnavailable,
      forcePlatformUnavailable: function () {
        markUnavailable();
      },
      simulateListenGesture: function () {
        return startListening();
      },
      deliverFinalTranscript: function (text) {
        if (!gestureArmed && !listening) {
          return [];
        }
        return deliverFinalTranscript(text);
      },
      destroy: function () {
        stopRecognition();
        wrap.remove();
      },
    };
  }

  var api = {
    UNAVAILABLE_MSG: UNAVAILABLE_MSG,
    attachVoiceInput: attachVoiceInput,
    isVoicePlatformAvailable: isVoicePlatformAvailable,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopInputVoice = api;
  }
})();
