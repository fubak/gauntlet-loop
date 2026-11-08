#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");
var presence = require("./room-presence.js");

var fixturePath = path.join(__dirname, "..", "fixtures", "room.sample.json");

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

function run() {
  var raw = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assert(Array.isArray(raw.ships), "fixture ships array");
  var i;
  for (i = 0; i < raw.ships.length; i++) {
    var ship = raw.ships[i];
    var cleaned = presence.sanitizeForWire(ship);
    assert(!presence.forbiddenSurvives(cleaned), "valid fixture ship has no forbidden keys");
    assert(typeof cleaned.publicId === "string", "publicId string");
    assert(typeof cleaned.lane === "number", "lane number");
  }

  var evil = {
    publicId: "Pilot-EVIL",
    nickname: "",
    lane: 50,
    shipY: 82,
    score: 1,
    fireFlash: false,
    lat: 33.1,
    lon: -87.2,
    token: "must-not-appear",
  };
  var stripped = presence.sanitizeForWire(evil);
  assert(!Object.prototype.hasOwnProperty.call(stripped, "lat"), "lat stripped");
  assert(!Object.prototype.hasOwnProperty.call(stripped, "lon"), "lon stripped");
  assert(!Object.prototype.hasOwnProperty.call(stripped, "token"), "token stripped");
  assert(!presence.forbiddenSurvives(stripped), "evil frame cleaned");

  var badSanitizer = Object.assign({}, evil);
  assert(presence.forbiddenSurvives(badSanitizer), "unsanitized evil still has forbidden");

  console.log("room-allowlist.test.js: all assertions passed");
}

run();
