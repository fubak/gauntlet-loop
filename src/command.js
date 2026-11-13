/**
 * Command queue: ids, enqueue, drain-for-tick. No parsing or rendering.
 *
 * @typedef {{ id?: number, type: string, payload?: object, source: string, t?: number }} Command
 */

(function commandModule(factory) {
  "use strict";

  /**
   * @returns {{ nextId: number, items: Command[] }}
   */
  function createQueue() {
    return { nextId: 1, items: [] };
  }

  /**
   * @param {{ nextId: number, items: Command[] }} queue
   * @param {Omit<Command, "id"> & { id?: number }} partial
   * @returns {Command}
   */
  function enqueue(queue, partial) {
    var cmd = {
      id: typeof partial.id === "number" ? partial.id : queue.nextId++,
      type: partial.type,
      payload: partial.payload ? Object.assign({}, partial.payload) : {},
      source: partial.source,
      t: typeof partial.t === "number" ? partial.t : now(),
    };
    if (typeof partial.id !== "number") {
      queue.nextId = Math.max(queue.nextId, cmd.id + 1);
    }
    queue.items.push(cmd);
    return cmd;
  }

  /**
   * @returns {number}
   */
  function now() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  }

  /**
   * @param {{ nextId: number, items: Command[] }} queue
   * @returns {Command[]}
   */
  function drainForTick(queue) {
    var batch = queue.items.slice();
    queue.items.length = 0;
    return batch;
  }

  /**
   * @param {{ nextId: number, items: Command[] }} queue
   * @returns {number}
   */
  function queueLength(queue) {
    return queue.items.length;
  }

  var api = {
    createQueue: createQueue,
    enqueue: enqueue,
    drainForTick: drainForTick,
    queueLength: queueLength,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopCommand = api;
  }
})(undefined);
