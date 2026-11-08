/**
 * Boot warning, parked vs voice-only choice, location opt-in, mode switch bar.
 */
(function uiModule() {
  "use strict";

  /**
   * @typedef {{
   *   locationOptIn: boolean,
   *   onChooseParked: (locationOptIn: boolean) => void,
   *   onChooseMotion: (locationOptIn: boolean) => void,
   *   onSwitchParked: () => void,
   *   onSwitchMotion: () => void,
   *   getMode: () => string
   * }} BootUiOptions
   */

  /**
   * @param {BootUiOptions} opts
   */
  function attachBootUi(opts) {
    var boot = document.createElement("div");
    boot.id = "boot-overlay";
    boot.setAttribute("role", "dialog");
    boot.setAttribute("aria-modal", "true");
    boot.setAttribute("aria-labelledby", "boot-title");

    var title = document.createElement("h2");
    title.id = "boot-title";
    title.textContent = "Gauntlet Loop";

    var warn = document.createElement("p");
    warn.className = "boot-warn";
    warn.textContent =
      "Voice only does not make play while driving safe. The parked confirm is how visual controls unlock.";

    var detail = document.createElement("p");
    detail.className = "boot-detail";
    detail.textContent =
      "Choose parked to steer and use the screen. Choose voice only for typed commands while on-rails.";

    var locLabel = document.createElement("label");
    locLabel.className = "boot-location";
    var locBox = document.createElement("input");
    locBox.type = "checkbox";
    locBox.id = "location-opt-in";
    locBox.checked = false;
    locLabel.appendChild(locBox);
    locLabel.appendChild(document.createTextNode(" Share my location (optional, off by default)"));

    var actions = document.createElement("div");
    actions.className = "boot-actions";

    var parkedBtn = document.createElement("button");
    parkedBtn.type = "button";
    parkedBtn.id = "boot-parked";
    parkedBtn.textContent = "I am parked";

    var motionBtn = document.createElement("button");
    motionBtn.type = "button";
    motionBtn.id = "boot-motion";
    motionBtn.textContent = "Voice only";

    actions.appendChild(parkedBtn);
    actions.appendChild(motionBtn);

    boot.appendChild(title);
    boot.appendChild(warn);
    boot.appendChild(detail);
    boot.appendChild(locLabel);
    boot.appendChild(actions);
    document.body.appendChild(boot);

    var switchBar = document.createElement("div");
    switchBar.id = "mode-switch";
    switchBar.style.display = "none";

    var toParked = document.createElement("button");
    toParked.type = "button";
    toParked.textContent = "Parked";

    var toMotion = document.createElement("button");
    toMotion.type = "button";
    toMotion.textContent = "Voice only";

    var modeReadout = document.createElement("span");
    modeReadout.id = "mode-readout";

    switchBar.appendChild(modeReadout);
    switchBar.appendChild(toParked);
    switchBar.appendChild(toMotion);
    document.body.appendChild(switchBar);

    /** @type {{ locationOptIn: boolean }} */
    var clientSession = { locationOptIn: false };

    function readLocationOptIn() {
      clientSession.locationOptIn = !!locBox.checked;
      return clientSession.locationOptIn;
    }

    function dismissBoot() {
      boot.style.display = "none";
      switchBar.style.display = "flex";
      syncSwitchUi();
    }

    function syncSwitchUi() {
      var m = opts.getMode();
      modeReadout.textContent = "Mode: " + m;
      toParked.disabled = m === "parked";
      toMotion.disabled = m === "motion";
    }

    parkedBtn.addEventListener("click", function () {
      var loc = readLocationOptIn();
      opts.onChooseParked(loc);
      dismissBoot();
    });

    motionBtn.addEventListener("click", function () {
      var loc = readLocationOptIn();
      opts.onChooseMotion(loc);
      dismissBoot();
    });

    toParked.addEventListener("click", function () {
      opts.onSwitchParked();
      syncSwitchUi();
    });

    toMotion.addEventListener("click", function () {
      opts.onSwitchMotion();
      syncSwitchUi();
    });

    return {
      getLocationOptIn: function () {
        return clientSession.locationOptIn;
      },
      isBootVisible: function () {
        return boot.style.display !== "none";
      },
      syncSwitchUi: syncSwitchUi,
      destroy: function () {
        boot.remove();
        switchBar.remove();
      },
    };
  }

  var api = {
    attachBootUi: attachBootUi,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopUi = api;
  }
})();
