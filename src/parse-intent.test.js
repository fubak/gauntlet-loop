#!/usr/bin/env node
"use strict";

var parseIntent = require("./parse-intent.js").parseIntent;
var command = require("./command.js");
var mode = require("./mode.js");

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function assertEqual(a, b, msg) {
  var sa = JSON.stringify(a);
  var sb = JSON.stringify(b);
  console.assert(sa === sb, msg + " expected " + sb + " got " + sa);
}

/**
 * @param {{ type: string, payload?: object, source: string }[]} cmds
 */
function stripMeta(cmds) {
  return cmds.map(function (c) {
    return { type: c.type, payload: c.payload || {}, source: c.source };
  });
}

function runTableTests() {
  assertEqual(
    stripMeta(parseIntent("shoot red")),
    [
      { type: "target-color", payload: { color: "red" }, source: "typed" },
      { type: "fire", payload: { color: "red" }, source: "typed" },
    ],
    "shoot red"
  );
  assertEqual(
    stripMeta(parseIntent("fire blue")),
    [
      { type: "target-color", payload: { color: "blue" }, source: "typed" },
      { type: "fire", payload: { color: "blue" }, source: "typed" },
    ],
    "fire blue"
  );
  assertEqual(
    stripMeta(parseIntent("shoot green")),
    [
      { type: "target-color", payload: { color: "green" }, source: "typed" },
      { type: "fire", payload: { color: "green" }, source: "typed" },
    ],
    "shoot green"
  );
  assertEqual(
    stripMeta(parseIntent("fire left")),
    [{ type: "fire", payload: { side: "left" }, source: "typed" }],
    "fire left"
  );
  assertEqual(
    stripMeta(parseIntent("shoot right")),
    [{ type: "fire", payload: { side: "right" }, source: "typed" }],
    "shoot right"
  );
  assertEqual(
    stripMeta(parseIntent("focus nearest")),
    [{ type: "focus-nearest", payload: {}, source: "typed" }],
    "focus nearest"
  );
  assertEqual(
    stripMeta(parseIntent("use special")),
    [{ type: "special", payload: {}, source: "typed" }],
    "use special"
  );
  assertEqual(
    stripMeta(parseIntent("collect all")),
    [{ type: "collect-all", payload: {}, source: "typed" }],
    "collect all"
  );
  assertEqual(
    stripMeta(parseIntent("shoot")),
    [{ type: "fire", payload: { side: "center" }, source: "typed" }],
    "bare shoot"
  );
  assertEqual(
    stripMeta(parseIntent("fire")),
    [{ type: "fire", payload: { side: "center" }, source: "typed" }],
    "bare fire"
  );
  assertEqual(
    stripMeta(parseIntent("please shoot the red one")),
    [
      { type: "target-color", payload: { color: "red" }, source: "typed" },
      { type: "fire", payload: { color: "red" }, source: "typed" },
    ],
    "extra words red"
  );
  assertEqual(
    stripMeta(parseIntent("fire left red")),
    [
      {
        type: "fire",
        payload: { color: "red", side: "left" },
        source: "typed",
      },
    ],
    "fire left red"
  );
}

function runUnknownTests() {
  assertEqual(stripMeta(parseIntent("shoot bread")), [], "shoot bread");
  assertEqual(stripMeta(parseIntent("hello world")), [], "hello world");
  assertEqual(stripMeta(parseIntent("   ")), [], "empty");
}

function runModeTests() {
  var fakeKeyboardFire = {
    type: "fire",
    payload: { side: "center" },
    source: "keyboard",
  };
  var typedFire = {
    type: "fire",
    payload: { color: "blue" },
    source: "typed",
  };
  console.assert(
    mode.filterCommand(fakeKeyboardFire, mode.MODE_MOTION) === null,
    "motion drops keyboard fire"
  );
  console.assert(
    mode.filterCommand(typedFire, mode.MODE_MOTION) !== null,
    "motion allows typed fire"
  );
  console.assert(
    mode.filterSteer(-0.8, "keyboard", mode.MODE_MOTION) === 0,
    "motion drops keyboard steer"
  );
  console.assert(
    mode.filterSteer(-0.8, "keyboard", mode.MODE_PARKED) === -0.8,
    "parked keeps keyboard steer"
  );
}

function runQueueSmoke() {
  var q = command.createQueue();
  var enqueued = command.enqueue(q, {
    type: "special",
    source: "typed",
    payload: {},
  });
  console.assert(enqueued.id === 1, "first id is 1");
  var batch = command.drainForTick(q);
  console.assert(batch.length === 1, "drain returns one");
  console.assert(command.queueLength(q) === 0, "queue empty after drain");
}

runTableTests();
runUnknownTests();
runModeTests();
runQueueSmoke();

console.log("parse-intent.test.js: all assertions passed");
