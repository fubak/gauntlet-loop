/**
 * Web Audio SFX. Resume context on first user gesture. No remote files.
 */
(function audioModule() {
  "use strict";

  /**
   * @returns {{ resumeOnUserGesture: () => void, getState: () => string, playUiBlip: () => void }}
   */
  function createAudio() {
    /** @type {AudioContext | null} */
    var actx = null;
    var unlocked = false;

  /**
   * @param {number} freq
   * @param {number} durationSec
   * @param {number} gain
   */
    function tone(freq, durationSec, gain) {
      if (!actx || actx.state !== "running") {
        return;
      }
      try {
        var osc = actx.createOscillator();
        var amp = actx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        amp.gain.value = gain;
        osc.connect(amp);
        amp.connect(actx.destination);
        var t0 = actx.currentTime;
        amp.gain.setValueAtTime(gain, t0);
        amp.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
        osc.start(t0);
        osc.stop(t0 + durationSec + 0.02);
      } catch (e) {
        /* fail quietly */
      }
    }

    function playUiBlip() {
      tone(440, 0.08, 0.06);
    }

    function resumeOnUserGesture() {
      if (unlocked && actx && actx.state === "running") {
        return;
      }
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) {
          return;
        }
        if (!actx) {
          actx = new AC();
        }
        var resume = actx.resume();
        if (resume && typeof resume.then === "function") {
          resume
            .then(function () {
              unlocked = true;
              playUiBlip();
            })
            .catch(function () {
              /* blocked */
            });
        } else {
          unlocked = true;
          playUiBlip();
        }
      } catch (e) {
        /* blocked */
      }
    }

    function getState() {
      if (!actx) {
        return "none";
      }
      return actx.state;
    }

    return {
      resumeOnUserGesture: resumeOnUserGesture,
      playUiBlip: playUiBlip,
      getState: getState,
    };
  }

  var api = {
    createAudio: createAudio,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopAudio = api;
  }
})();
