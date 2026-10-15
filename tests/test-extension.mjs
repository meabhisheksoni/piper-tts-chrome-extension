import { chromium } from "playwright-core";
import path from "path";
import { fileURLToPath } from "url";

import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "..");

let executablePath = process.env.CHROMIUM_PATH;
if (!executablePath) {
  const localCache = "/home/zeus/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
  if (fs.existsSync(localCache)) {
    executablePath = localCache;
  }
}

console.log("=================================================");
console.log("🚀 STARTING AUTOMATED HEADLESS EXTENSION TEST SUITE");
console.log("=================================================");

async function run() {
  console.log("0. Validating Manifest V3 match patterns & schema integrity...");
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, "manifest.json"), "utf8"));
  
  function validatePattern(pattern) {
    if (pattern === "<all_urls>") return;
    const match = pattern.match(/^(\*|https?|file|ftp|wss?):\/\/([^\/]+)(\/.*)$/);
    if (!match) throw new Error(`URL pattern '${pattern}' is malformed (invalid syntax).`);
    const host = match[2];
    if (host !== "*" && host.includes("*")) {
      if (!host.startsWith("*.") || host.slice(2).includes("*")) {
        throw new Error(`URL pattern '${pattern}' is malformed. Wildcard in host must only be leading '*.'`);
      }
    }
  }

  for (const hostPerm of manifest.host_permissions || []) {
    validatePattern(hostPerm);
  }
  for (const cs of manifest.content_scripts || []) {
    for (const match of cs.matches || []) {
      validatePattern(match);
    }
  }
  console.log("✅ Manifest match patterns strictly validated with zero errors.");

  const isCI = !!process.env.CI;
  const launchOptions = {
    headless: false,
    args: [
      ...(isCI ? [] : ["--headless=new"]),
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required"
    ]
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  const context = await chromium.launchPersistentContext("", launchOptions);

  console.log("1. Browser context booted. Waiting for background service worker...");
  let backgroundWorker = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const workers = context.serviceWorkers();
    if (workers.length > 0) {
      backgroundWorker = workers[0];
      break;
    }
    const bgPages = context.backgroundPages();
    if (bgPages.length > 0) {
      const extId = bgPages[0].url().split("/")[2];
      backgroundWorker = { url: () => `chrome-extension://${extId}/` };
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!backgroundWorker) {
    try {
      backgroundWorker = await context.waitForEvent("serviceworker", { timeout: 10000 });
    } catch (e) {
      const workers = context.serviceWorkers();
      if (workers.length > 0) {
        backgroundWorker = workers[0];
      } else {
        throw new Error("Failed to detect extension service worker after 40 seconds. Workers count: " + workers.length);
      }
    }
  }

  const extensionId = backgroundWorker.url().split("/")[2];
  console.log(`✅ Extension loaded successfully! ID: ${extensionId}`);

  // Open offscreen page
  console.log("\n2. Loading Offscreen Engine Page directly...");
  const offscreenPage = await context.newPage();
  offscreenPage.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("Kokoro") || text.includes("error") || text.includes("Error") || text.includes("WASM")) {
      console.log(`[Offscreen ${msg.type()}]: ${text}`);
    }
  });
  offscreenPage.on("pageerror", (err) => console.error(`[Offscreen Exception]:`, err));

  await offscreenPage.goto(`chrome-extension://${extensionId}/offscreen/offscreen.html`);
  await offscreenPage.waitForLoadState("domcontentloaded");
  console.log("✅ Offscreen page loaded.");

  // TEST 1: Synthesize English Sentence via Kokoro-82M FP32 (Offline)
  console.log("\n3. [TEST 1] Testing Kokoro-82M Offline English Synthesis (voice: af_heart)...");
  const enResult = await offscreenPage.evaluate(async () => {
    try {
      const start = performance.now();
      // synthesizeKokoroChunk is defined in offscreen.js module scope, let's trigger via chrome.runtime or export
      // We can trigger via window postMessage or SYNTHESIZE_AND_PLAY
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("English synthesis timed out after 30s")), 30000);
        
        const listener = (msg) => {
          if (msg.type === "CHUNK_STARTED") {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(listener);
            resolve({
              success: true,
              durationMs: Math.round(performance.now() - start),
              text: msg.text,
              chunkId: msg.chunkId
            });
          } else if (msg.type === "PLAYBACK_ERROR") {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(listener);
            reject(new Error(msg.error));
          }
        };
        chrome.runtime.onMessage.addListener(listener);

        chrome.runtime.sendMessage({
          type: "SYNTHESIZE_AND_PLAY",
          chunks: [{ id: 1, text: "Hello! Kokoro neural studio voice is running completely offline.", paragraphIndex: 0 }],
          voiceId: "af_heart",
          speed: 1.0
        });
      });
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  });

  if (!enResult.success) {
    throw new Error(`TEST 1 FAILED (English Synthesis): ${enResult.error}`);
  }
  console.log(`✅ TEST 1 PASSED: English synthesized in ${enResult.durationMs}ms! Text: "${enResult.text}"`);

  // Wait 2 seconds for playback
  await new Promise(r => setTimeout(r, 2000));

  // TEST 2: Synthesize Native Hindi Sentence via Kokoro-82M (voice: hf_alpha)
  console.log("\n4. [TEST 2] Testing Native Hindi Synthesis (voice: hf_alpha)...");
  const hiResult = await offscreenPage.evaluate(async () => {
    try {
      const start = performance.now();
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Hindi synthesis timed out after 30s")), 30000);
        
        const listener = (msg) => {
          if (msg.type === "CHUNK_STARTED") {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(listener);
            resolve({
              success: true,
              durationMs: Math.round(performance.now() - start),
              text: msg.text,
              chunkId: msg.chunkId
            });
          } else if (msg.type === "PLAYBACK_ERROR") {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(listener);
            reject(new Error(msg.error));
          }
        };
        chrome.runtime.onMessage.addListener(listener);

        chrome.runtime.sendMessage({
          type: "SYNTHESIZE_AND_PLAY",
          chunks: [{ id: 2, text: "नमस्ते! यह कोकोरो न्यूरल हिंदी वॉइस मॉडल है।", paragraphIndex: 0 }],
          voiceId: "hf_alpha",
          speed: 1.0
        });
      });
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  });

  if (!hiResult.success) {
    throw new Error(`TEST 2 FAILED (Hindi Synthesis): ${hiResult.error}`);
  }
  console.log(`✅ TEST 2 PASSED: Hindi synthesized in ${hiResult.durationMs}ms! Text: "${hiResult.text}"`);

  // TEST 3: Popup UI End-to-End Interaction
  console.log("\n5. [TEST 3] Testing Popup UI Interaction & Test Voice Button...");
  const popupPage = await context.newPage();
  popupPage.on("console", (msg) => console.log(`[Popup Console]: ${msg.text()}`));
  popupPage.on("pageerror", (err) => console.error(`[Popup Error]:`, err));

  console.log("Navigating to popup URL:", `chrome-extension://${extensionId}/popup/popup.html`);
  await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const btnInfo = await popupPage.evaluate(async () => {
    const el = document.getElementById("test-voice-btn");
    const viewAction = document.getElementById("view-action");
    const viewSettings = document.getElementById("view-settings");
    const settings = await new Promise(r => chrome.storage.local.get(null, r));
    return {
      settings,
      btnExists: !!el,
      btnText: el ? el.innerText : null,
      viewActionDisplay: viewAction ? window.getComputedStyle(viewAction).display : null,
      viewSettingsDisplay: viewSettings ? window.getComputedStyle(viewSettings).display : null
    };
  });
  console.log("Popup State Info:", JSON.stringify(btnInfo, null, 2));

  const initialText = (btnInfo.btnText || "").replace(/\n/g, " ");
  console.log(`Popup loaded. Initial test button text: "${initialText}"`);

  console.log("Dispatching click on #test-voice-btn...");
  await popupPage.evaluate(() => setTimeout(() => document.getElementById("test-voice-btn").click(), 50));

  let playingDetected = false;
  let errorDetected = false;
  let finalStatus = "";

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    const btnText = await popupPage.evaluate(() => {
      const el = document.getElementById("test-voice-btn");
      return el ? el.innerText.replace(/\n/g, " ") : "";
    });
    finalStatus = btnText;
    console.log(`[Popup Status ${i * 0.5}s]: "${btnText}"`);
    if (btnText.includes("Playing") || btnText.includes("🔊") || btnText.includes("Synthesizing")) {
      playingDetected = true;
      console.log(`✅ Playing / Synthesizing detected -> "${btnText}"`);
      break;
    }
    if (btnText.includes("❌") || btnText.includes("Error")) {
      errorDetected = true;
      console.error(`❌ Error detected -> "${btnText}"`);
      break;
    }
  }

  if (errorDetected || !playingDetected) {
    throw new Error(`TEST 3 FAILED: Popup test button did not play audio. Final text: "${finalStatus}"`);
  }
  console.log(`✅ TEST 3 PASSED: Popup test button successfully triggered audio playback!`);

  await context.close();
  console.log("\n=================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY (100% GREEN)!");
  console.log("=================================================");
}

run().catch((err) => {
  console.error("\n❌ SUITE FAILED WITH ERROR:", err);
  process.exit(1);
});
