/**
 * Visible text field that calls parseIntent and enqueues commands.
 */
(function inputTypedModule() {
  "use strict";

  /**
   * @param {{
   *   onCommands: (cmds: object[]) => void,
   *   parseIntent: (text: string) => object[]
   * }} opts
   */
  function attachTypedInput(opts) {
    var wrap = document.createElement("div");
    wrap.id = "typed-input-wrap";
    wrap.setAttribute("aria-label", "Typed combat commands");

    var input = document.createElement("input");
    input.type = "text";
    input.id = "typed-command";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "shoot red, fire left, use special...";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Send";

    function submit() {
      var text = input.value;
      var cmds = opts.parseIntent(text);
      if (cmds.length === 0) {
        return;
      }
      opts.onCommands(cmds);
      input.value = "";
      input.blur();
    }

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        submit();
      }
    });
    btn.addEventListener("click", submit);

    wrap.appendChild(input);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    return {
      submitText: function (text) {
        var cmds = opts.parseIntent(text);
        if (cmds.length) {
          opts.onCommands(cmds);
        }
        return cmds;
      },
      destroy: function () {
        wrap.remove();
      },
    };
  }

  var api = {
    attachTypedInput: attachTypedInput,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopInputTyped = api;
  }
})();
