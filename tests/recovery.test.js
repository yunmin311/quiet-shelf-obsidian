"use strict";

// Exercise the shipped plugin, not a copied implementation. Only the Obsidian
// host, disk writes and DOM boundary are replaced in this dependency-free suite.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function fixture(overrides = {}) {
  const notices = [], ready = [], events = new Map(), timers = new Map();
  let nextTimer = 0;
  const nodes = new Map();
  const container = { querySelectorAll: () => [...nodes.values()] };
  const document = {
    documentElement: { lang: "en" },
    querySelector: () => container,
    querySelectorAll: (selector) => selector === ".nav-files-container"
      ? [container] : [...nodes.values()].filter(n => n.classList.contains("qs-hidden")),
  };
  class Plugin {
    async loadData() { return { language: "en", ...overrides }; }
    async saveData(data) { this.persisted = JSON.parse(JSON.stringify(data)); }
    registerEvent() {}
    addCommand(command) { (this.commands ||= []).push(command); }
    addSettingTab() {}
  }
  const sandbox = {
    module: { exports: {} },
    require(id) {
      assert.equal(id, "obsidian", "shipped plugin must be self-contained");
      return { Plugin, PluginSettingTab: class {}, Setting: class {}, Modal: class {},
        Notice: class { constructor(message) { notices.push(message); } } };
    },
    document,
    window: {
      localStorage: { getItem: () => "en" },
      setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    MutationObserver: class { observe() {} disconnect() {} },
    console: { error() {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../main.js"), "utf8"), sandbox);
  const plugin = new sandbox.module.exports();
  plugin.app = {
    workspace: { onLayoutReady(fn) { ready.push(fn); }, on() {} },
    vault: { on(name, fn) { events.set(name, fn); }, getAbstractFileByPath(p) { return { path: p }; } },
  };
  await plugin.onload();
  function addNode(p) {
    const classes = new Set(["tree-item", "other-plugin-mark"]);
    const node = {
      getAttribute: () => p,
      closest: () => node,
      classList: {
        contains: c => classes.has(c),
        toggle(c, flag) { flag ? classes.add(c) : classes.delete(c); },
        remove(c) { classes.delete(c); },
      },
    };
    nodes.set(p, node);
    return node;
  }
  const hidden = p => nodes.get(p).classList.contains("qs-hidden");
  return { plugin, notices, ready, events, timers, addNode, hidden };
}

test("restore outside focus makes the requested item visible and keeps the saved targets", async () => {
  const f = await fixture({ focusActive: true, focusTargets: ["Work"], shelved: ["Archive", "Other"] });
  f.addNode("Archive"); f.plugin.apply();
  assert.equal(f.hidden("Archive"), true);
  await f.plugin.reveal("Archive");
  f.plugin.apply();
  assert.equal(f.hidden("Archive"), false);
  assert.equal(f.plugin.settings.focusActive, false);
  assert.deepEqual(Array.from(f.plugin.settings.focusTargets), ["Work"]);
  assert.equal(f.plugin.isShelved("Other"), true);
});

test("restoring a child also unblocks shelved ancestors, without restoring unrelated items", async () => {
  const f = await fixture({ shelved: ["Archive", "Other"], autoRules: ["readme"] });
  for (const p of ["Archive", "Archive/readme", "Archive/readme/note.md", "Other"]) f.addNode(p);
  await f.plugin.reveal("Archive/readme/note.md");
  f.plugin.apply();
  assert.equal(f.hidden("Archive"), false);
  assert.equal(f.hidden("Archive/readme"), false);
  assert.equal(f.hidden("Archive/readme/note.md"), false);
  assert.equal(f.hidden("Other"), true);
});

test("batch restore follows the same focus and ancestor rules", async () => {
  const f = await fixture({ focusActive: true, focusTargets: ["Work"], shelved: ["Archive"] });
  f.addNode("Archive"); f.addNode("Archive/note.md");
  assert.equal(await f.plugin.revealMany(["Archive/note.md"]), 1);
  assert.equal(f.hidden("Archive"), false);
  assert.equal(f.hidden("Archive/note.md"), false);
  assert.equal(f.plugin.settings.focusActive, false);
});

test("restore inside focus does not unnecessarily turn focus off", async () => {
  const f = await fixture({ focusActive: true, focusTargets: ["Work"], shelved: ["Work/note.md"] });
  await f.plugin.reveal("Work/note.md");
  assert.equal(f.plugin.settings.focusActive, true);
});

test("exit focus restores the tree immediately, before a slow settings write completes", async () => {
  const f = await fixture({ focusActive: true, focusTargets: ["Work"] });
  f.addNode("Other"); f.plugin.apply();
  let finish;
  f.plugin.saveData = () => new Promise(resolve => { finish = resolve; });
  const pending = f.plugin.clearFocus();
  try { assert.equal(f.hidden("Other"), false); } finally { finish(); await pending; }
});

test("failed settings writes do not trap the tree in focus and show a persistence warning", async () => {
  const f = await fixture({ focusActive: true, focusTargets: ["Work"] });
  f.addNode("Other"); f.plugin.apply();
  f.plugin.saveData = async () => { throw Error("File has been modified since read"); };
  await assert.doesNotReject(() => f.plugin.clearFocus());
  assert.equal(f.hidden("Other"), false);
  assert.ok(f.notices.some(n => /not saved/i.test(n)), "warn that restart may restore old settings");
});

test("unload removes only Quiet Shelf's mark", async () => {
  const f = await fixture({ focusActive: true, focusTargets: ["Work"] });
  const node = f.addNode("Other"); f.plugin.apply(); f.plugin.onunload();
  assert.equal(f.hidden("Other"), false);
  assert.equal(node.classList.contains("other-plugin-mark"), true);
});

test("a late layout-ready callback cannot hide the tree after plugin unload", async () => {
  const f = await fixture({ focusActive: true, focusTargets: ["Work"] });
  f.addNode("Other"); f.plugin.onunload();
  for (const callback of f.ready) callback();
  assert.equal(f.hidden("Other"), false);
});

test("a pending operation cannot reapply hiding after plugin unload", async () => {
  const f = await fixture();
  f.addNode("Other");
  let finish;
  f.plugin.saveData = () => new Promise(resolve => { finish = resolve; });
  const pending = f.plugin.shelveMany(["Other"]);
  f.plugin.onunload(); finish(); await pending;
  assert.equal(f.hidden("Other"), false);
});

test("exit focus preserves explicit shelving and automatic rules", async () => {
  const f = await fixture({ focusActive: true, focusTargets: ["Work"], shelved: ["Archive"], autoRules: ["*index*"] });
  await f.plugin.clearFocus();
  assert.equal(f.plugin.shouldHide("Other"), false);
  assert.equal(f.plugin.shouldHide("Archive"), true);
  assert.equal(f.plugin.shouldHide("My Index.md"), true);
});

test("focus status offers an exit control without deleting the user's focus targets", async () => {
  const f = await fixture({ focusActive: true, focusTargets: ["Work"] });
  f.addNode("Other"); f.plugin.apply();
  const entries = [];
  const el = {
    createDiv(options) { entries.push(options); return el; },
    createEl(tag, options) { const entry = { tag, ...options }; entries.push(entry); return {
      addEventListener(type, callback) { entry[type] = callback; },
    }; },
  };
  let refreshed = false;
  f.plugin.renderFocusStatus(el, () => { refreshed = true; });
  const button = entries.find(e => e.tag === "button");
  assert.ok(button, "a visible exit button is provided while focus is active");
  await button.click();
  assert.equal(f.hidden("Other"), false);
  assert.deepEqual(Array.from(f.plugin.settings.focusTargets), ["Work"]);
  assert.equal(refreshed, true);
});

test("wildcard rules run through the actual shipped plugin", async () => {
  const f = await fixture();
  for (const [rule, p, expected] of [
    ["hub", "github.md", false], ["*hub", "github.md", true],
    ["hub*", "github.md", false], ["*hub*", "my-hub-old.md", true],
    ["*index*", "a/_Aesthetic Index.md", true], ["readme", "README.md", true],
    ["*", "anything.md", false], ["**", "anything.md", false],
  ]) { f.plugin.settings.autoRules = [rule]; assert.equal(f.plugin.matchesAutoRule(p), expected, rule + ": " + p); }
});

test("every locale key and placeholder has a matching translation", () => {
  const { LOCALES } = require("../locales.js");
  assert.deepEqual(Object.keys(LOCALES.zh).sort(), Object.keys(LOCALES.en).sort());
  for (const key of Object.keys(LOCALES.en)) {
    assert.deepEqual((LOCALES.zh[key].match(/\{\w+\}/g) || []).sort(), (LOCALES.en[key].match(/\{\w+\}/g) || []).sort(), key);
  }
});
