// Runs the actual <script> block shipped in module/webroot/index.html inside a sandboxed VM,
// against a mocked ksu.exec bridge (matching the real `kernelsu` npm package's
// `ksu.exec(command, JSON.stringify(options), callbackName)` contract), so these tests exercise
// the real shipped code rather than a reimplementation of its logic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(here, "..", "module", "webroot", "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const MODULE_DIR = "/data/adb/modules/unlimitedphotos";
const PROFILE_FILE = MODULE_DIR + "/custom.profile.prop";
const CUSTOM_PROP_FILE = MODULE_DIR + "/custom.fgp.prop";
const CUSTOM_JSON_FILE = MODULE_DIR + "/custom.fgp.json";
const ACTIVE_PROFILE_FILE = MODULE_DIR + "/.active_profile";

function makeElement(overrides = {}) {
  return { hidden: false, disabled: false, checked: false, textContent: "", listeners: {}, addEventListener(event, fn) {
    (this.listeners[event] ??= []).push(fn);
  }, ...overrides };
}

// Sets up a fresh sandbox per test: a fake filesystem (`state`), a fake DOM, and a fake `ksu.exec`
// that only understands the exact commands this page's script actually sends - not a shell.
function runPage(state) {
  const radios = [
    makeElement({ value: "original" }),
    makeElement({ value: "datasaver" }),
  ];
  const elements = {
    overrideNotice: makeElement({ hidden: true }),
    profileFields: makeElement(),
    status: makeElement(),
    // The real markup ships `<button ... hidden>`, so it starts hidden before any script runs.
    rebootButton: makeElement({ hidden: true }),
  };
  const rebootCalls = [];

  const sandbox = {
    document: {
      getElementById: (id) => elements[id],
      querySelectorAll: () => radios,
      querySelector: (selector) => {
        assert.equal(selector, 'input[name="profile"]:checked');
        return radios.find((r) => r.checked) ?? null;
      },
    },
    window: {},
    intervalCallbacks: [],
    setInterval: (fn) => sandbox.intervalCallbacks.push(fn),
    ksu: {
      exec(command, _optionsJson, callbackName) {
        const respond = (stdout) => sandbox.window[callbackName](0, stdout, "");
        if (command.includes(CUSTOM_PROP_FILE)) return respond(state.hasCustomProp ? "yes" : "no");
        if (command.includes(CUSTOM_JSON_FILE)) return respond(state.hasCustomJson ? "yes" : "no");
        if (command.includes(ACTIVE_PROFILE_FILE)) return respond(state.active ?? "");
        if (command.startsWith("printf")) {
          const written = command.match(/printf 'profile=%s\\n' "([^"]*)"/)[1];
          state.profile = written;
          return respond("");
        }
        if (command.includes(PROFILE_FILE)) return respond(state.profile ?? "");
        if (command === "reboot") {
          rebootCalls.push(true);
          return respond("");
        }
        throw new Error(`unexpected command: ${command}`);
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);

  return { radios, elements, rebootCalls, poll: () => Promise.all(sandbox.intervalCallbacks.map((fn) => fn())) };
}

// Node's microtask queue needs a real tick for the page's chained awaits to settle before we
// assert on DOM state, since nothing here uses fake timers.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// A real radio group enforces mutual exclusion natively before the "change" event fires; the fake
// DOM has no such behavior built in, so tests that click a radio must simulate it explicitly.
async function clickRadio(radios, value) {
  const target = radios.find((r) => r.value === value);
  for (const radio of radios) radio.checked = radio === target;
  await Promise.all(target.listeners.change.map((fn) => fn({ target })));
}

test("reboot button stays hidden when the selected profile is already active", async () => {
  const { elements } = runPage({ profile: "datasaver", active: "datasaver" });
  await flush();
  assert.equal(elements.rebootButton.hidden, true);
});

test("reboot button shows on load when the selected profile isn't active yet", async () => {
  const { elements } = runPage({ profile: "datasaver", active: "original" });
  await flush();
  assert.equal(elements.rebootButton.hidden, false);
});

test("switching to a different profile than the active one shows the reboot button", async () => {
  const { radios, elements } = runPage({ profile: "original", active: "original" });
  await flush();
  assert.equal(elements.rebootButton.hidden, true);

  await clickRadio(radios, "datasaver");
  await flush();

  assert.equal(elements.rebootButton.hidden, false);
});

test("switching back to the active profile hides the reboot button again", async () => {
  const state = { profile: "original", active: "original" };
  const { radios, elements } = runPage(state);
  await flush();

  await clickRadio(radios, "datasaver");
  await flush();
  assert.equal(elements.rebootButton.hidden, false);

  await clickRadio(radios, "original");
  await flush();
  assert.equal(elements.rebootButton.hidden, true);
});

test("polling picks up an external change (e.g. a soft-reboot) without user interaction", async () => {
  const state = { profile: "datasaver", active: "original" };
  const { elements, poll } = runPage(state);
  await flush();
  assert.equal(elements.rebootButton.hidden, false);

  // Simulate a soft-reboot re-snapshotting .active_profile to match the desired profile.
  state.active = "datasaver";
  await poll();
  await flush();

  assert.equal(elements.rebootButton.hidden, true);
});

test("a hand-written custom.fgp.prop disables the fields and never shows the reboot button", async () => {
  const { elements } = runPage({ hasCustomProp: true, profile: "datasaver", active: "original" });
  await flush();
  assert.equal(elements.overrideNotice.hidden, false);
  assert.equal(elements.profileFields.disabled, true);
  assert.equal(elements.rebootButton.hidden, true);
});
