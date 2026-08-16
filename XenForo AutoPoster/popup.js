const $ = id => document.getElementById(id);

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function showToast(msg, ok = true) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast " + (ok ? "ok" : "err") + " show";
  setTimeout(() => t.classList.remove("show"), 3000);
}

async function refreshStatus() {
  const s = await chrome.runtime.sendMessage({ action: "getStatus" });
  const enabled = !!s.enabled;

  $("statusVal").innerHTML = `<span class="dot ${enabled ? "on" : "off"}"></span>${enabled ? "Active" : "Inactive"}`;
  $("lastPost").textContent = fmt(s.lastPost);
  $("nextPost").textContent = s.nextAlarm ? fmt(s.nextAlarm) : "—";

  if (s.lastStatus) {
    $("lastStatusRow").style.display = "";
    $("lastStatus").textContent = s.lastStatus;
    $("lastStatus").style.color = s.lastStatus === "success" ? "#00e676" : "#e94560";
  }

  const btn = $("btnToggle");
  if (enabled) {
    btn.textContent = "⏹ Disable";
    btn.className = "disable";
  } else {
    btn.textContent = "▶ Enable";
    btn.className = "enable";
  }

  if (s.message) $("msgInput").value = s.message;

  if (s.lastDebug) {
    $("debugSection").style.display = "";
    $("debugOut").textContent = s.lastDebug;
  }
}

async function saveMessage() {
  const msg = $("msgInput").value.trim();
  if (msg) await chrome.storage.local.set({ message: msg });
  return msg;
}

$("btnToggle").addEventListener("click", async () => {
  const s = await chrome.runtime.sendMessage({ action: "getStatus" });
  const msg = await saveMessage();

  if (!s.enabled) {
    if (!msg) { showToast("Enter a message first!", false); return; }
    await chrome.runtime.sendMessage({ action: "enable" });
    showToast("AutoPoster enabled ✅");
  } else {
    await chrome.runtime.sendMessage({ action: "disable" });
    showToast("AutoPoster disabled");
  }
  await refreshStatus();
});

$("btnNow").addEventListener("click", async () => {
  const msg = await saveMessage();
  if (!msg) { showToast("Enter a message first!", false); return; }
  $("btnNow").disabled = true;
  $("btnNow").textContent = "...";
  showToast("Posting...", true);
  await chrome.runtime.sendMessage({ action: "postNow" });
  setTimeout(async () => {
    $("btnNow").disabled = false;
    $("btnNow").textContent = "⚡ Now";
    await refreshStatus();
  }, 8000);
});

$("msgInput").addEventListener("change", saveMessage);

refreshStatus();
