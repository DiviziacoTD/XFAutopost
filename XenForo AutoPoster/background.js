// =========================
// Version: 1.4.0
// Author: DiviziacoTD
// =========================

const THREAD_URL = "XXXX"; // Input the Thread url; Include /page-9999 so that the name check is performed on the last page
const ALARM_NAME = "XF-Autoposter";
const MIN_MINUTES = 6 * 60;
const MAX_MINUTES = 7 * 60;

function randomDelay() {
  return Math.floor(Math.random() * (MAX_MINUTES - MIN_MINUTES + 1)) + MIN_MINUTES;
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

async function init() {
  const { enabled } = await chrome.storage.local.get("enabled");
  if (enabled) scheduleAlarm();
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const { enabled } = await chrome.storage.local.get("enabled");
  if (enabled) {
    await postMessage();
    scheduleAlarm();
  }
});

async function scheduleAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  const delay = randomDelay();
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: delay });
  await chrome.storage.local.set({ nextDelay: delay });
}

async function stopAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
}

async function postMessage() {
  const { message } = await chrome.storage.local.get("message");
  const text = message || "Automatic post";

  let tab;
  try {
    tab = await chrome.tabs.create({ url: THREAD_URL, active: false });
    await waitForTabLoad(tab.id);
    await delay(3000);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectPost,
      args: [text]
    });

    const result = results?.[0]?.result;
    const now = Date.now();
    const debugStr = result?.debug ? JSON.stringify(result.debug, null, 2) : "no debug";

    if (result?.success) {
      await chrome.storage.local.set({ lastPost: now, lastStatus: "success", lastDebug: debugStr });
      notify("✅ Post sent!", `Message posted at ${new Date(now).toLocaleTimeString("en-US")}`);
    } else if (result?.skipped) {
      await chrome.storage.local.set({ lastPost: now, lastStatus: "⏭ " + result.error, lastDebug: debugStr });
      notify("⏭ Skipped", result.error);
    } else {
      const errMsg = result?.error || "unknown";
      await chrome.storage.local.set({ lastPost: now, lastStatus: "error: " + errMsg, lastDebug: debugStr });
      notify("❌ Post error", errMsg);
      console.error("AutoPoster debug:", debugStr);
    }
  } catch (err) {
    const now = Date.now();
    await chrome.storage.local.set({ lastPost: now, lastStatus: "error: " + err.message });
    notify("❌ Critical error", err.message);
  } finally {
    if (tab) {
      await delay(2000);
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}

function injectPost(text) {
  const debug = {
    url: location.href,
    title: document.title,
    allContentEditable: Array.from(document.querySelectorAll("[contenteditable]")).map(el => ({
      tag: el.tagName, id: el.id,
      cls: el.className.slice(0, 80),
      ce: el.getAttribute("contenteditable")
    })),
    allTextareas: Array.from(document.querySelectorAll("textarea")).map(el => ({
      id: el.id, name: el.name, cls: el.className.slice(0, 80)
    })),
    allButtons: Array.from(document.querySelectorAll("button, input[type=submit]")).map(el => ({
      tag: el.tagName, id: el.id, type: el.type,
      cls: el.className.slice(0, 60),
      text: el.textContent.trim().slice(0, 30),
      xf: el.getAttribute("data-xf-click")
    })),
    loggedIn: !!document.querySelector(".p-navgroup--member, .username, [data-logged-in]")
  };

  try {
    const messages = Array.from(document.querySelectorAll("article.message[data-author]"));
    if (messages.length > 0) {
      const lastPoster = messages[messages.length - 1].getAttribute("data-author").trim();
      debug.lastPoster = lastPoster;
      if (lastPoster.toLowerCase().includes("indra")) {
        return { success: false, skipped: true, error: "Last poster is " + lastPoster + " — skipping", debug };
      }
    } else {
      debug.lastPoster = "not detected";
    }

    const editorSelectors = [
      ".fr-element[contenteditable='true']",
      ".fr-view[contenteditable='true']",
      "[contenteditable='true']",
      "#QuickReplyEditor .fr-element",
      ".js-quickReply .fr-element",
      ".quickReply .fr-element"
    ];

    let editor = null, editorSel = null;
    for (const sel of editorSelectors) {
      const el = document.querySelector(sel);
      if (el) { editor = el; editorSel = sel; break; }
    }

    let textarea = null, textareaSel = null;
    for (const sel of ["textarea[name='message']", "#QuickReplyEditor textarea", ".quickReply textarea", "textarea"]) {
      const el = document.querySelector(sel);
      if (el) { textarea = el; textareaSel = sel; break; }
    }

    if (!editor && !textarea) {
      return { success: false, error: "NO EDITOR FOUND", debug };
    }

    if (editor) {
      editor.focus();
      editor.innerHTML = "";
      document.execCommand("insertText", false, text);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("keyup", { bubbles: true }));
      debug.usedEditor = editorSel;
    } else {
      textarea.focus();
      textarea.value = text;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      debug.usedTextarea = textareaSel;
    }

    let submitBtn = null, submitSel = null;
    const allSubmits = Array.from(document.querySelectorAll("button[type='submit'], input[type='submit']"));
    const byText = allSubmits.find(el =>
      el.textContent.includes("risposta") || el.textContent.includes("Invia") ||
      el.className.includes("reply") || el.className.includes("--reply")
    );
    if (byText) {
      submitBtn = byText;
      submitSel = "text-match:" + byText.textContent.trim().slice(0, 30);
    } else if (allSubmits.length > 0) {
      submitBtn = allSubmits[allSubmits.length - 1];
      submitSel = "last-submit";
    }

    if (!submitBtn) {
      return { success: false, error: "NO SUBMIT BUTTON FOUND", debug };
    }

    debug.usedSubmit = submitSel;
    debug.submitText = submitBtn.textContent.trim().slice(0, 30);
    submitBtn.click();
    return { success: true, debug };

  } catch (e) {
    return { success: false, error: e.message, stack: e.stack, debug };
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon48.png",
    title,
    message
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.action === "enable") {
      await chrome.storage.local.set({ enabled: true });
      await scheduleAlarm();
      sendResponse({ ok: true });
    } else if (msg.action === "disable") {
      await chrome.storage.local.set({ enabled: false });
      await stopAlarm();
      sendResponse({ ok: true });
    } else if (msg.action === "postNow") {
      sendResponse({ ok: true });
      await postMessage();
      await scheduleAlarm();
    } else if (msg.action === "getStatus") {
      const data = await chrome.storage.local.get(["enabled", "lastPost", "lastStatus", "message", "lastDebug", "nextDelay"]);
      const alarms = await chrome.alarms.get(ALARM_NAME);
      sendResponse({ ...data, nextAlarm: alarms?.scheduledTime });
    }
  })();
  return true;
});
