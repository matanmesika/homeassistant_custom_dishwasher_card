import assert from "node:assert/strict";
import test from "node:test";

import { createHass, installCardDom } from "./test-helpers.mjs";

const registry = installCardDom();
await import("../../src/homeassistant_custom_dishwasher_card.js");

const DishwasherCard = registry.get("dishwasher-card");
const DishwasherCardEditor = registry.get("dishwasher-card-editor");

test("registers a visual editor for the card", () => {
  assert.ok(DishwasherCardEditor);
  globalThis.document = { createElement: (name) => ({ name }) };
  assert.equal(DishwasherCard.getConfigElement().name, "dishwasher-card-editor");
});

test("editor offers every entity role and the display options", () => {
  const editor = new DishwasherCardEditor();
  editor._hass = createHass({}, "en");
  const schema = editor._schema();
  const names = JSON.stringify(schema);
  for (const key of ["device_id", "title", "accent_color", "show_program", "show_delay", "show_options", "show_maintenance", "selectedProgram", "salt", "machineCareRemainingRuns"]) {
    assert.match(names, new RegExp(`"name":"${key}"`), key);
  }
  assert.equal(schema.at(-1).name, "entities");
});

test("editor keeps only filled entity overrides and drops empty fields", () => {
  const editor = new DishwasherCardEditor();
  editor._config = { type: "custom:dishwasher-card", device_id: "abc", title: "Dishwasher" };
  editor._changed({ title: "", entities: { salt: "sensor.salt", rinseAid: "" } });
  const config = editor.lastDispatchedEvent.detail.config;
  assert.equal(config.title, undefined);
  assert.deepEqual(config.entities, { salt: "sensor.salt" });
  editor._changed({ entities: { salt: "" } });
  assert.equal(editor.lastDispatchedEvent.detail.config.entities, undefined);
});

test("manual entities override the ones found on the device", async () => {
  const card = new DishwasherCard();
  card._render = () => {};
  card.setConfig({ device_id: "dev", entities: { salt: "sensor.my_salt" } });
  assert.equal(card._entities, null, "the device is still searched");
  card._hass = {
    ...createHass({}, "en"),
    callWS: async () => [
      { ei: "sensor.dishwasher_salt", di: "dev", pl: "home_connect" },
      { ei: "sensor.dishwasher_operation_state", di: "dev", pl: "home_connect" },
    ],
  };
  await card._discover();
  assert.equal(card._entities.salt, "sensor.my_salt");
  assert.equal(card._entities.operation, "sensor.dishwasher_operation_state");
});

test("entities without a device are used as they are", () => {
  const card = new DishwasherCard();
  card._render = () => {};
  card.setConfig({ entities: { operation: "sensor.op" } });
  assert.deepEqual(card._entities, { operation: "sensor.op" });
});
