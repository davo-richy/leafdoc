import { LANGUAGES, DEFAULT_LANG, language, t, applyStaticText } from "./js/i18n.js";
import { queueAdd, queueAll, queueCount, queueRemove } from "./js/queue.js";
import { triageFor } from "./js/triage.js";
import { buildCard, cardFileName } from "./js/card.js";

const MAX_PHOTOS = 4;
const TIMEOUT_MS = 25000;      // a diagnosis slower than this is treated as a timeout
const MAX_BUSY_RETRIES = 2;    // extra attempts when the AI service is rate limited
const HIST_KEY = "leafdoc.history.v1";
const LANG_KEY = "leafdoc.lang";

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove("hidden");
const hide = (id) => $(id).classList.add("hidden");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fill = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

const state = {
  photos: [],
  result: null,
  answers: [],
  tab: "organic",
  busy: false,
  lang: DEFAULT_LANG,
  weather: null,
  weatherText: "",
  weatherFailed: false,
  compareFrom: null,
  pendingAnswers: [],
  plantFilter: null,
  resultFromQueue: false,
};

// ---------- safe storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  raw(k) { try { return localStorage.getItem(k); } catch { return null; } },
  setRaw(k, v) { try { localStorage.setItem(k, v); } catch { /* storage full or blocked */ } },
};

// ---------- settings kept on this device ----------
const settings = {
  region: store.raw("leafdoc.region") || "Nigeria",
  lowData: store.raw("leafdoc.lowdata") === "1",
  audio: store.raw("leafdoc.audio") === "1",
};

function saveSettings() {
  store.setRaw("leafdoc.region", settings.region);
  store.setRaw("leafdoc.lowdata", settings.lowData ? "1" : "0");
  store.setRaw("leafdoc.audio", settings.audio ? "1" : "0");
}

// ---------- small transient message (replaces alert()) ----------
let toastTimer = null;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  show("toast");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hide("toast"), 6000);
}

// ---------- language ----------
function setLanguage(api, { persist = true } = {}) {
  const meta = language(api);
  state.lang = meta.api;
  if (persist) store.setRaw(LANG_KEY, state.lang);

  document.documentElement.lang = meta.locale;
  document.documentElement.dir = meta.rtl ? "rtl" : "ltr";
  $("langShort").textContent = meta.short;
  $("langBtn").setAttribute("title", meta.label);
  $("langBtn").setAttribute("aria-label", `Language: ${meta.label}`);

  document.querySelectorAll("#langList [data-lang]").forEach((b) => {
    const on = b.dataset.lang === state.lang;
    b.setAttribute("aria-selected", String(on));
    b.classList.toggle("selected", on);
  });

  applyStaticText(state.lang);
  renderThumbs();
  if (state.result) updateVoiceNote();
}

function buildLangList() {
  const list = $("langList");
  list.replaceChildren();
  LANGUAGES.forEach((meta) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "option");
    b.dataset.lang = meta.api;
    b.lang = meta.locale;
    b.textContent = meta.label;
    b.onclick = () => {
      setLanguage(meta.api);
      closeLangList();
      $("langBtn").focus();
    };
    li.append(b);
    list.append(li);
  });
}

function openLangList() {
  show("langList");
  $("langBtn").setAttribute("aria-expanded", "true");
  const selected = $("langList .selected") || $("langList button");
  if (selected) selected.focus({ preventScroll: true });
}

function closeLangList() {
  if ($("langList").classList.contains("hidden")) return;
  hide("langList");
  $("langBtn").setAttribute("aria-expanded", "false");
}

function toggleLangList() {
  if ($("langList").classList.contains("hidden")) openLangList();
  else { closeLangList(); $("langBtn").focus(); }
}

// ---------- init ----------
function init() {
  buildLangList();
  setLanguage(store.raw(LANG_KEY) || DEFAULT_LANG, { persist: false });

  const theme = store.raw("leafdoc.theme") ||
    (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
  $("themeBtn").onclick = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    store.setRaw("leafdoc.theme", next);
  };

  $("regionSel").value = settings.region;
  $("lowData").checked = settings.lowData;
  $("audioFirst").checked = settings.audio;
  $("regionSel").onchange = () => { settings.region = $("regionSel").value; saveSettings(); };
  $("lowData").onchange = () => { settings.lowData = $("lowData").checked; saveSettings(); };
  $("audioFirst").onchange = () => { settings.audio = $("audioFirst").checked; saveSettings(); };
  $("queueSend").onclick = () => flushQueue(true);

  if (!store.raw("leafdoc.onboarded")) show("onboard");
  $("onboardOk").onclick = () => { store.setRaw("leafdoc.onboarded", "1"); hide("onboard"); };

  $("langBtn").onclick = toggleLangList;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeLangList(); hide("clearConfirm"); }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".lang-wrap")) closeLangList();
  });

  $("camInput").onchange = (e) => addFiles(e.target.files, e.target);
  $("fileInput").onchange = (e) => addFiles(e.target.files, e.target);
  $("scanBtn").onclick = () => diagnose(state.pendingAnswers);
  $("recheckBtn").onclick = recheck;
  $("newBtn").onclick = resetAll;
  $("speakBtn").onclick = speak;
  $("stopBtn").onclick = stopSpeak;
  $("printBtn").onclick = saveReport;
  $("waBtn").onclick = shareWhatsApp;
  $("imgBtn").onclick = saveCardImage;
  $("shareBtn").onclick = saveCardImage;
  $("icsBtn").onclick = downloadIcs;
  $("chatBtn").onclick = askChat;
  $("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") askChat(); });

  $("problemRetry").onclick = () => { hide("problem"); diagnose(state.pendingAnswers); };
  $("problemBack").onclick = () => { hide("problem"); show("capture"); };

  $("historyBtn").onclick = openHistory;
  $("historyClose").onclick = closeHistory;
  $("clearHistory").onclick = () => { hide("clearHistory"); show("clearConfirm"); $("clearNo").focus(); };
  $("clearNo").onclick = () => { hide("clearConfirm"); show("clearHistory"); };
  $("clearYes").onclick = () => {
    store.set(HIST_KEY, []);
    state.plantFilter = null;
    hide("clearConfirm");
    renderHistory();
  };

  document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; renderTreatment(); }));

  setupMic();
  window.addEventListener("online", netUpdate);
  window.addEventListener("offline", netUpdate);
  netUpdate();
  renderQueue();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("themeBtn").setAttribute("aria-pressed", String(theme === "dark"));
  $("themeBtn").setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

function netUpdate() {
  $("netStatus").classList.toggle("hidden", navigator.onLine);
  if (navigator.onLine) flushQueue();
}

// ---------- photos ----------
function fileToResized(file, max = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      const dataUrl = c.toDataURL("image/jpeg", quality);
      URL.revokeObjectURL(url);
      resolve({ mime: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

async function addFiles(files, input) {
  for (const f of Array.from(files || [])) {
    if (state.photos.length >= MAX_PHOTOS) break;
    if (!f.type.startsWith("image/")) continue;
    try { state.photos.push(await fileToResized(f)); } catch { toast("That file could not be read as a photo."); }
  }
  if (input) input.value = "";
  renderThumbs();
}

function renderThumbs() {
  const box = $("thumbs");
  box.replaceChildren();
  // Four slots stay visible so the grid keeps its shape and the empties invite more photos.
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    const photo = state.photos[i];
    if (photo) {
      const im = document.createElement("img");
      im.src = photo.preview;
      im.alt = `Photo ${i + 1}`;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "slot-remove";
      b.innerHTML = icon("x");
      b.setAttribute("aria-label", `Remove photo ${i + 1}`);
      b.onclick = () => { state.photos.splice(i, 1); renderThumbs(); };
      slot.append(im, b);
    } else {
      slot.classList.add("empty");
      slot.innerHTML = icon("plus");
      slot.setAttribute("aria-hidden", "true");
    }
    box.append(slot);
  }

  const n = state.photos.length;
  $("scanBtn").disabled = n === 0;
  $("scanHint").textContent = n === 0 ? t(state.lang, "needPhoto") : "";
  $("photoHint").textContent = n === 0
    ? ""
    : n >= MAX_PHOTOS
      ? t(state.lang, "photoHintMax")
      : fill(t(state.lang, "photoHintOne"), { n });
}

// ---------- voice input ----------
let rec = null;
function micMessage(text) {
  const el = $("micMsg");
  if (!text) { hide("micMsg"); el.textContent = ""; return; }
  el.textContent = text;
  show("micMsg");
}

function setupMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { $("micBtn").classList.add("hidden"); return; }
  $("micBtn").onclick = () => {
    if (rec) { rec.stop(); return; }
    micMessage("");
    rec = new SR();
    rec.lang = language(state.lang).tts;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      $("notes").value = ($("notes").value + " " + text).trim();
    };
    rec.onend = () => { rec = null; $("micBtn").classList.remove("live"); };
    rec.onerror = (e) => {
      rec = null;
      $("micBtn").classList.remove("live");
      if (e && (e.error === "not-allowed" || e.error === "service-not-allowed")) micMessage(t(state.lang, "micBlocked"));
      else if (e && e.error === "language-not-supported") micMessage(t(state.lang, "micNoLang"));
      else if (e && e.error === "no-speech") micMessage("No speech heard. Tap the microphone and try again.");
    };
    $("micBtn").classList.add("live");
    try { rec.start(); } catch { rec = null; $("micBtn").classList.remove("live"); }
  };
}

// ---------- weather (Open-Meteo, only if the user opts in) ----------
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no geo"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 600000 });
  });
}

async function loadWeather() {
  state.weatherFailed = false;
  if (!$("useWeather").checked) { state.weather = null; state.weatherText = ""; return; }
  if (state.weather) return;
  try {
    const pos = await getPosition();
    const { latitude: lat, longitude: lon } = pos.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}` +
      "&current=temperature_2m,relative_humidity_2m,precipitation&daily=temperature_2m_max,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=3";
    const r = await fetch(url);
    if (!r.ok) throw new Error("weather");
    const w = await r.json();
    const d = w.daily;
    const days = d.time.map((day, i) =>
      `${i === 0 ? "today" : i === 1 ? "tomorrow" : "in 2 days"}: max ${Math.round(d.temperature_2m_max[i])}°C, rain chance ${d.precipitation_probability_max[i]}%, ${d.precipitation_sum[i]} mm`);
    state.weather = w;
    state.weatherText = `Now ${Math.round(w.current.temperature_2m)}°C, humidity ${w.current.relative_humidity_2m}%. Forecast – ${days.join("; ")}.`;
  } catch {
    state.weather = null;
    state.weatherText = "";
    state.weatherFailed = true;
    $("useWeather").checked = false;
    toast("Weather is off: location or the weather service was not available.");
  }
}

// ---------- loading state ----------
let progressTimers = [];
function clearProgress() {
  progressTimers.forEach(clearTimeout);
  progressTimers = [];
}

function setLoadingText(text) { $("loadingText").textContent = text; }

function startProgress() {
  clearProgress();
  setLoadingText(t(state.lang, "loading1"));
  progressTimers.push(setTimeout(() => setLoadingText(t(state.lang, "loading2")), 1500));
  progressTimers.push(setTimeout(() => setLoadingText(fill(t(state.lang, "loading3"), { language: language(state.lang).label })), 6000));
}

function setLoading(on) {
  state.busy = on;
  if (on) {
    hide("capture"); hide("result"); hide("problem"); hide("history");
    show("loading");
    startProgress();
  } else {
    clearProgress();
    hide("loading");
  }
}

// ---------- errors ----------
// One table decides what the user sees and which actions make sense.
const PROBLEMS = {
  need_photo: { title: "err_title", text: "needPhoto", retry: false, back: true },
  offline: { title: "err_title", text: "err_offline", retry: true, back: true },
  busy: { title: "err_title", text: "err_busy", retry: true, back: true },
  quota: { title: "err_title", text: "err_quota", retry: true, back: true },
  timeout: { title: "err_title", text: "err_timeout", retry: true, back: true },
  network: { title: "err_title", text: "err_network", retry: true, back: true },
  json: { title: "err_title", text: "err_json", retry: true, back: true },
  request: { title: "err_title", text: "err_request", retry: true, back: true },
  key: { title: "err_title", text: "err_key", retry: false, back: true },
  model: { title: "err_title", text: "err_model", retry: false, back: true },
  access: { title: "err_title", text: "err_access", retry: false, back: true },
};

// Server error codes -> the reason table above.
const SERVER_CODES = {
  no_image: "need_photo",
  bad_key: "key",
  server_not_configured: "key",
  access_denied: "access",
  model_unavailable: "model",
  rate_limited: "busy",
  image_too_large: "request",
  upstream_error: "request",
  truncated: "request",
  bad_request: "request",
};

/**
 * @param {string} reason key of PROBLEMS, or "photo"/"plant" for AI photo feedback
 * @param {{text?: string}} [extra]
 */
function showProblem(reason, extra = {}) {
  const spec = PROBLEMS[reason] || PROBLEMS.request;
  $("problemTitle").textContent = t(state.lang, spec.title);
  $("problemText").textContent = extra.text || t(state.lang, spec.text);
  $("problemRetry").classList.toggle("hidden", !spec.retry);
  $("problemBack").classList.toggle("hidden", !spec.back);
  show("problem");
  hide("capture"); hide("result"); hide("loading");
}

// ---------- network ----------
function postJson(path, payload, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

// ---------- request payload ----------
// Low-data mode re-encodes at 640px on demand, so it also applies to photos added earlier.
function shrink(photo, max = 640, quality = 0.55) {
  if (photo.small) return Promise.resolve(photo.small);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      photo.small = c.toDataURL("image/jpeg", quality).split(",")[1];
      resolve(photo.small);
    };
    img.onerror = () => resolve(photo.data);
    img.src = photo.preview;
  });
}

async function buildPayload(answers) {
  const images = [];
  for (const p of state.photos) {
    images.push({ mime: "image/jpeg", data: settings.lowData ? await shrink(p) : p.data });
  }
  return {
    images,
    language: state.lang,
    notes: $("notes").value.trim(),
    answers,
    weather: state.weatherText,
    region: settings.region,
  };
}

// ---------- offline queue ----------
async function queueCurrent(answers, payload) {
  try {
    const saved = payload || await buildPayload(answers);
    await queueAdd({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), answers, payload: saved }, 2);
    await renderQueue();
    toast("Saved on this phone. It will send when you are back online.");
  } catch {
    showProblem("offline");
  }
}

async function renderQueue() {
  try {
    const n = await queueCount();
    if (!n) { hide("queueNote"); return; }
    $("queueText").textContent = n === 1
      ? "1 scan is saved on this phone and will send when you are online."
      : `${n} scans are saved on this phone and will send when you are online.`;
    show("queueNote");
  } catch {
    hide("queueNote");
  }
}

let flushing = false;

async function flushQueue(manual = false) {
  if (flushing || state.busy || !navigator.onLine) {
    if (manual && !navigator.onLine) toast(t(state.lang, "err_offline"));
    return;
  }
  let jobs = [];
  try { jobs = await queueAll(); } catch { return; }
  if (!jobs.length) { renderQueue(); return; }

  flushing = true;
  setLoading(true);
  setLoadingText("Sending the scan saved on this phone");
  let last = null;
  for (const job of jobs) {
    const outcome = await runDiagnosis(job.payload);
    if (!outcome.ok) {
      setLoading(false);
      flushing = false;
      // Keep the job: a bad key or a timeout should not throw away the grower's photos.
      if (!outcome.offline) showProblem(outcome.reason, outcome.extra);
      renderQueue();
      return;
    }
    await queueRemove(job.id);
    last = { data: outcome.data, answers: job.answers || [] };
  }
  setLoading(false);
  flushing = false;
  renderQueue();
  if (last) {
    handleResult(last.data, last.answers, { fromQueue: true });
    toast("Sent the scan saved on this phone.");
  }
}

// ---------- network ----------
async function runDiagnosis(payload) {
  let busyAttempts = 0;   // 429 retries
  let netAttempts = 0;    // dropped-connection retries
  let jsonAttempts = 0;   // unparseable reply retries

  for (;;) {
    try {
      const res = await postJson("api/diagnose", payload);
      const data = await res.json().catch(() => null);

      if (!data || typeof data !== "object") {
        // A proxy or crash returned HTML: retry once silently, then tell the user.
        if (jsonAttempts < 1) { jsonAttempts++; await wait(800); continue; }
        return { ok: false, reason: "json" };
      }

      if (res.ok) return { ok: true, data };

      // Rate limited: retry twice with exponential backoff, then explain.
      if (res.status === 429 && busyAttempts < MAX_BUSY_RETRIES) {
        busyAttempts++;
        setLoadingText(t(state.lang, "err_busy"));
        await wait(1200 * 2 ** (busyAttempts - 1));
        continue;
      }

      const reason = SERVER_CODES[data.error] || "request";
      // Keep the localized wording; only fall back to the server's text when we have no mapping.
      return { ok: false, reason, extra: reason === "request" ? { text: data.message } : {} };
    } catch (err) {
      if (err && err.name === "AbortError") return { ok: false, reason: "timeout" };
      if (!navigator.onLine) return { ok: false, offline: true };
      // One silent retry for a dropped connection, then explain.
      if (netAttempts < 1) { netAttempts++; await wait(1200); continue; }
      return { ok: false, reason: "network" };
    }
  }
}

async function diagnose(answers = []) {
  if (state.busy) return;
  if (!state.photos.length) { showProblem("need_photo"); return; }

  state.pendingAnswers = answers;

  if (!navigator.onLine) {
    await queueCurrent(answers);
    return;
  }

  const payload = await buildPayload(answers);
  setLoading(true);
  await loadWeather();
  setLoadingText(t(state.lang, "loading2"));
  payload.weather = state.weatherText;

  const outcome = await runDiagnosis(payload);
  setLoading(false);

  if (outcome.ok) { handleResult(outcome.data, answers); return; }
  if (outcome.offline) { await queueCurrent(answers, payload); return; }
  showProblem(outcome.reason, outcome.extra);
}

function handleResult(r, answers, opts = {}) {
  if (r.photo_ok === false || r.is_plant === false) {
    showProblem(r.is_plant === false ? "plant" : "photo", {
      text: r.photo_issue || t(state.lang, "err_photo_text"),
    });
    $("problemRetry").classList.add("hidden");
    $("problemBack").classList.remove("hidden");
    $("problemTitle").textContent = t(state.lang, r.is_plant === false ? "err_plant_title" : "err_photo_title");
    return;
  }
  state.result = r;
  state.answers = answers;
  state.resultFromQueue = !!opts.fromQueue;
  renderResult();
  saveHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (settings.audio) speak();
}

function recheck() {
  const qs = (state.result?.follow_up_questions || []);
  const answers = qs.map((q, i) => ({ q, a: ($("fq" + i)?.value || "").trim() })).filter((a) => a.a);
  const merged = [...state.answers.filter((p) => !qs.includes(p.q)), ...answers];
  diagnose(merged);
}

// ---------- rendering ----------
const list = (arr) => (Array.isArray(arr) ? arr.filter(Boolean) : []);

function renderResult() {
  const r = state.result;
  hide("capture"); hide("history"); hide("problem"); show("result");
  $("fromQueue").classList.toggle("hidden", !state.resultFromQueue);

  $("plantName").textContent = r.plant || "Unknown plant";
  $("summary").textContent = r.summary || "";

  const conf = Math.max(0, Math.min(100, Number(r.overall_confidence) || 0));
  $("confNum").textContent = conf + "%";
  $("confBar").style.width = conf + "%";
  $("confBar").parentElement.classList.toggle("low", conf < 60);

  const status = $("statusPill");
  status.className = "status";
  if (r.healthy) { status.textContent = "Looks healthy"; status.classList.add("is-ok"); }
  else if (r.needs_more_info || conf < 60) { status.textContent = t(state.lang, "notSure"); status.classList.add("is-warn"); }
  else {
    const sev = (r.problems?.[0]?.severity || "").toLowerCase();
    status.textContent = sev === "high" ? "Serious" : sev === "low" ? "Mild" : "Needs attention";
    status.classList.add(sev === "high" ? "is-bad" : sev === "low" ? "is-ok" : "is-warn");
  }

  // Below 60% we say so in plain words instead of dressing up a guess.
  const low = !r.healthy && conf < 60;
  const confNote = $("confNote");
  confNote.textContent = low
    ? `Low confidence (${conf}%). Treat this as a guess: add one clear photo in daylight or answer the questions below.`
    : "";
  confNote.classList.toggle("hidden", !low);

  const urgent = $("urgent");
  urgent.textContent = r.urgent_note || "";
  urgent.classList.toggle("hidden", !r.urgent_note);

  renderTriage(r);

  // follow-up questions
  const qs = list(r.follow_up_questions);
  const needs = (r.needs_more_info || conf < 60) && qs.length > 0;
  $("followCard").classList.toggle("hidden", !needs);
  const form = $("followForm");
  form.replaceChildren();
  if (needs) {
    qs.forEach((q, i) => {
      const wrap = document.createElement("div");
      wrap.className = "fq";
      const label = document.createElement("label");
      label.htmlFor = "fq" + i;
      label.textContent = q;
      const input = document.createElement("input");
      input.type = "text";
      input.id = "fq" + i;
      const prev = state.answers.find((a) => a.q === q);
      if (prev) input.value = prev.a;
      wrap.append(label, input);
      form.append(wrap);
    });
  }

  // candidate problems
  const box = $("problems");
  box.replaceChildren();
  box.classList.toggle("is-empty", list(r.problems).length === 0);
  list(r.problems).forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "problem";
    const h = document.createElement("h3");
    const n = document.createElement("span");
    n.textContent = `${i + 1}. ${p.name}`;
    const c = document.createElement("span");
    c.className = "muted small";
    c.textContent = `${Math.round(p.confidence)}%`;
    h.append(n, c);
    const tags = document.createElement("div");
    tags.className = "tags";
    if (p.type) { const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = p.type; tags.append(tag); }
    if (p.severity) { const tag = document.createElement("span"); tag.className = "tag " + p.severity.toLowerCase(); tag.textContent = p.severity; tags.append(tag); }
    const bar = document.createElement("div");
    bar.className = "bar";
    const barFill = document.createElement("div");
    barFill.style.width = Math.max(0, Math.min(100, p.confidence)) + "%";
    bar.append(barFill);
    card.append(h, tags, bar);
    if (p.explanation) { const e = document.createElement("p"); e.textContent = p.explanation; card.append(e); }
    const symptoms = list(p.symptoms_observed);
    if (symptoms.length) {
      const ul = document.createElement("ul");
      symptoms.forEach((s) => { const li = document.createElement("li"); li.textContent = s; ul.append(li); });
      card.append(ul);
    }
    box.append(card);
  });

  // weather
  const hasWeather = !!r.weather_advice;
  $("weatherCard").classList.toggle("hidden", !hasWeather);
  if (hasWeather) {
    $("weatherAdvice").textContent = r.weather_advice;
    $("weatherLine").textContent = state.weatherText;
  }

  // treatment
  const treatment = r.treatment || {};
  const hasTreatment = list(treatment.organic).length || list(treatment.chemical).length || list(treatment.prevention).length;
  $("treatCard").classList.toggle("hidden", !hasTreatment);
  if (hasTreatment) {
    if (!list(treatment[state.tab]).length) state.tab = ["organic", "chemical", "prevention"].find((k) => list(treatment[k]).length);
    renderTreatment();
  }
  $("calendarCard").classList.toggle("hidden", !!r.healthy || !hasTreatment);
  $("chatLog").replaceChildren();
  renderCompare();
  updateVoiceNote();
  stopSpeak();
}

function renderTriage(r) {
  const tri = triageFor(r);
  state.triage = tri;
  const card = $("triageCard");
  card.className = "block triage is-" + tri.level;
  $("triageTitle").textContent = tri.title;
  $("triageLine").textContent = tri.line;
  const steps = $("triageSteps");
  steps.replaceChildren();
  tri.steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    steps.append(li);
  });
  $("eatNote").textContent = tri.eat;
  $("eatNote").classList.toggle("hidden", !tri.eat);
}

function renderTreatment() {
  const treatment = state.result?.treatment || {};
  document.querySelectorAll(".tab").forEach((b) => {
    const on = b.dataset.tab === state.tab;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
  });
  const ul = $("treatList");
  ul.replaceChildren();
  list(treatment[state.tab]).forEach((s) => { const li = document.createElement("li"); li.textContent = s; ul.append(li); });
}

// ---------- voice output ----------
function resultText() {
  const r = state.result;
  if (!r) return "";
  const parts = [r.plant, r.summary];
  list(r.problems).forEach((p, i) => parts.push(`${i + 1}. ${p.name}. ${p.explanation || ""}`));
  const treatment = r.treatment || {};
  parts.push(...list(treatment.organic), ...list(treatment.chemical), ...list(treatment.prevention));
  if (r.weather_advice) parts.push(r.weather_advice);
  if (r.urgent_note) parts.push(r.urgent_note);
  return parts.filter(Boolean).join(". ");
}

function pickVoice(langTag) {
  if (!("speechSynthesis" in window)) return null;
  const voices = speechSynthesis.getVoices();
  const base = langTag.split("-")[0].toLowerCase();
  return voices.find((v) => v.lang.toLowerCase() === langTag.toLowerCase()) ||
         voices.find((v) => v.lang.toLowerCase().startsWith(base)) || null;
}

function speak() {
  if (!("speechSynthesis" in window)) { toast(t(state.lang, "noSpeak")); return; }
  const text = resultText();
  if (!text) return;
  stopSpeak();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language(state.lang).tts;
  const voice = pickVoice(utterance.lang);
  if (voice) utterance.voice = voice;
  utterance.onend = utterance.onerror = () => { hide("stopBtn"); show("speakBtn"); };
  hide("speakBtn");
  show("stopBtn");
  speechSynthesis.speak(utterance);
}

function stopSpeak() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  hide("stopBtn");
  show("speakBtn");
}

function updateVoiceNote() {
  const note = $("voiceNote");
  if (!("speechSynthesis" in window)) {
    note.textContent = t(state.lang, "noSpeak");
    show("voiceNote");
    hide("speakBtn");
    return;
  }
  show("speakBtn");
  const meta = language(state.lang);
  const hasVoice = !!pickVoice(meta.tts);
  if (!hasVoice && speechSynthesis.getVoices().length) {
    note.textContent = fill(t(state.lang, "noVoice"), { language: meta.label });
    show("voiceNote");
  } else {
    hide("voiceNote");
    note.textContent = "";
  }
}

if ("speechSynthesis" in window) {
  speechSynthesis.addEventListener?.("voiceschanged", () => { if (state.result) updateVoiceNote(); });
}

// ---------- follow-up chat ----------
async function askChat() {
  const input = $("chatInput");
  const question = input.value.trim();
  if (!question || !state.result || state.busy) return;
  if (!navigator.onLine) { addChat("bot", t(state.lang, "err_offline")); return; }
  addChat("me", question);
  input.value = "";
  $("chatBtn").disabled = true;
  const pending = addChat("bot", "…");
  try {
    const res = await postJson("api/chat", { question, language: state.lang, diagnosis: state.result }, 30000);
    const data = await res.json().catch(() => ({}));
    pending.textContent = res.ok
      ? data.answer
      : (SERVER_CODES[data.error] ? t(state.lang, PROBLEMS[SERVER_CODES[data.error]].text) : t(state.lang, "err_network"));
  } catch {
    pending.textContent = t(state.lang, "err_network");
  }
  $("chatBtn").disabled = false;
}

function addChat(who, text) {
  const d = document.createElement("div");
  d.className = "chat-msg " + who;
  d.textContent = text;
  $("chatLog").append(d);
  d.scrollIntoView({ block: "nearest" });
  return d;
}

// ---------- calendar reminders (.ics) ----------
function downloadIcs() {
  const r = state.result;
  if (!r) return;
  const plant = r.plant || "plant";
  const top = r.problems?.[0]?.name || "plant problem";
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const items = [
    [0, `LeafDoc: treat ${plant}`, `Remove badly affected leaves and start treatment for ${top}.`],
    [2, `LeafDoc: check ${plant}`, "Check whether new spots are still appearing."],
    [6, `LeafDoc: re-scan ${plant}`, "Take new photos in LeafDoc and compare with the first scan."],
  ];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const events = items.map(([offset, title, desc], i) => {
    const start = new Date();
    start.setDate(start.getDate() + offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return ["BEGIN:VEVENT", `UID:leafdoc-${Date.now()}-${i}@leafdoc`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${fmt(start)}`, `DTEND;VALUE=DATE:${fmt(end)}`,
      `SUMMARY:${title.replace(/[,;\\]/g, " ")}`, `DESCRIPTION:${desc.replace(/[,;\\]/g, " ")}`, "END:VEVENT"].join("\r\n");
  });
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LeafDoc//EN", ...events, "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "leafdoc-reminders.ics";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(t(state.lang, "icsSaved"));
}

// ---------- compare with previous scan of the same plant ----------
function renderCompare() {
  const card = $("compareCard");
  card.classList.add("hidden");
  const r = state.result;
  if (!r || !state.compareFrom) return;
  const prev = state.compareFrom;
  state.compareFrom = null;
  const prevProblem = prev.problems?.[0], nowProblem = r.problems?.[0];
  const prevText = prev.healthy ? "healthy" : `${prevProblem?.name || "unknown"} (${prevProblem?.confidence ?? "?"}%)`;
  const nowText = r.healthy ? "healthy" : `${nowProblem?.name || "unknown"} (${nowProblem?.confidence ?? "?"}%)`;
  let verdict = "";
  if (!prev.healthy && r.healthy) verdict = "Good news: it now looks healthy.";
  else if (prev.healthy && !r.healthy) verdict = "A problem has appeared since the last scan.";
  else {
    const sev = { low: 1, moderate: 2, high: 3 };
    const before = sev[(prevProblem?.severity || "").toLowerCase()] || 0;
    const after = sev[(nowProblem?.severity || "").toLowerCase()] || 0;
    verdict = !before || !after
      ? "Compare the symptoms below with your last scan."
      : after < before ? "Severity looks lower than before."
      : after > before ? "Severity looks higher than before."
      : "Severity looks about the same.";
  }
  $("compareText").textContent = `Before: ${prevText}. Now: ${nowText}. ${verdict}`;
  card.classList.remove("hidden");
}

// ---------- history ----------
function makeThumb(preview) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 96; c.height = 96;
      const s = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
      resolve(c.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve("");
    img.src = preview;
  });
}

async function saveHistory() {
  const thumb = state.photos[0] ? await makeThumb(state.photos[0].preview) : "";
  const history = store.get(HIST_KEY, []);
  history.unshift({ id: Date.now(), ts: Date.now(), plant: state.result.plant || "Plant", thumb, language: state.lang, result: state.result });
  while (history.length > 20) history.pop();
  while (history.length && !store.set(HIST_KEY, history)) history.pop(); // stay inside the storage quota
}

function openHistory() {
  hide("capture"); hide("result"); hide("problem");
  renderHistory();
  show("history");
  $("historyClose").focus();
}

function closeHistory() {
  hide("history");
  hide("clearConfirm");
  if (state.result) show("result"); else show("capture");
}

function renderHistory() {
  const box = $("historyList");
  box.replaceChildren();
  const all = store.get(HIST_KEY, []);
  const history = state.plantFilter
    ? all.filter((it) => (it.plant || "Unknown plant") === state.plantFilter)
    : all;

  renderPlants(all);

  // Empty state owns the panel: no list, no clear button.
  const empty = all.length === 0;
  $("historyEmpty").classList.toggle("hidden", !empty);
  $("clearWrap").classList.toggle("hidden", empty);
  hide("clearConfirm");
  show("clearHistory");

  const locale = language(state.lang).locale;
  history.forEach((it) => {
    const row = document.createElement("div");
    row.className = "hist-item";
    row.tabIndex = 0;
    const im = document.createElement("img");
    if (it.thumb) im.src = it.thumb;
    im.alt = "";
    const d = document.createElement("div");
    const b = document.createElement("b");
    b.textContent = it.plant;
    const s = document.createElement("span");
    s.className = "muted small";
    s.textContent = `${new Date(it.ts).toLocaleString(locale)} · ${it.result?.problems?.[0]?.name || (it.result?.healthy ? "Healthy" : "")}`;
    d.append(b, s);
    row.append(im, d);

    const open = () => {
      state.result = it.result;
      state.answers = [];
      state.resultFromQueue = false;
      hide("history");
      renderResult();
    };
    row.onclick = open;
    row.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };

    const rescan = document.createElement("button");
    rescan.type = "button";
    rescan.className = "btn ghost small-btn";
    rescan.textContent = "Re-scan";
    rescan.title = "Take new photos and compare with this scan";
    rescan.onclick = (ev) => { ev.stopPropagation(); resetAll(); state.compareFrom = it.result; hide("history"); show("capture"); };
    row.append(rescan);
    box.append(row);
  });
}

function plantStatus(result) {
  if (!result) return "";
  if (result.healthy) return "Healthy";
  const top = Array.isArray(result.problems) ? result.problems[0] : null;
  return top && top.name ? top.name : "Not clear";
}

function renderPlants(history) {
  const wrap = $("plantsWrap");
  const list = $("plantsList");
  list.replaceChildren();

  if (history.length < 2) { hide("plantsWrap"); return; }

  const groups = new Map();
  history.forEach((it) => {
    const name = (it.plant || "Unknown plant").trim();
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(it);
  });

  const locale = language(state.lang).locale;
  groups.forEach((items, name) => {
    const latest = items[0];
    const row = document.createElement("button");
    row.type = "button";
    row.className = "plant-row" + (state.plantFilter === name ? " active" : "");
    row.setAttribute("aria-pressed", String(state.plantFilter === name));

    const label = document.createElement("span");
    label.className = "plant-name";
    label.textContent = name;

    const meta = document.createElement("span");
    meta.className = "hint";
    meta.textContent = `${items.length} scan${items.length === 1 ? "" : "s"} · ${plantStatus(latest.result)} · ${new Date(latest.ts).toLocaleDateString(locale)}`;

    row.append(label, meta);
    row.onclick = () => {
      state.plantFilter = state.plantFilter === name ? null : name;
      renderHistory();
    };
    list.append(row);
  });
  show("plantsWrap");
}

// ---------- report ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function saveReport() {
  const r = state.result;
  if (!r) return;
  const treatment = r.treatment || {};
  const ul = (arr) => `<ul>${list(arr).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const html = `<!doctype html><meta charset="utf-8"><title>LeafDoc report</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:700px;margin:24px auto;padding:0 16px}h1{color:#1f5f3a}h2{margin-top:22px}.d{font-size:.85rem;color:#555;margin-top:30px}</style>
<h1>LeafDoc report</h1><p>${esc(new Date().toLocaleString(language(state.lang).locale))}</p>
<h2>${esc(r.plant)}</h2><p>${esc(r.summary)}</p><p>Confidence: ${esc(r.overall_confidence)}%</p>
${r.urgent_note ? `<p><b>${esc(r.urgent_note)}</b></p>` : ""}
${list(r.problems).map((p) => `<h2>${esc(p.name)} (${esc(p.confidence)}%)</h2><p>${esc(p.explanation)}</p>${ul(p.symptoms_observed)}`).join("")}
${r.weather_advice ? `<h2>Weather note</h2><p>${esc(r.weather_advice)}</p>` : ""}
<h2>Organic treatment</h2>${ul(treatment.organic)}<h2>Chemical treatment</h2>${ul(treatment.chemical)}<h2>Prevention</h2>${ul(treatment.prevention)}
<p class="d">AI-generated guidance, not a laboratory diagnosis. For serious or spreading problems consult a local agricultural extension officer.</p>`;
  const w = window.open("", "_blank");
  if (!w) { toast(t(state.lang, "popupBlocked")); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

// ---------- sharing ----------
function shareSummary() {
  const r = state.result;
  if (!r) return "";
  const tri = triageFor(r);
  const lines = [
    `LeafDoc · ${r.plant || "Plant"}`,
    `${tri.title}${tri.top ? `: ${tri.top}` : ""}`,
    r.summary || "",
    ...tri.steps.slice(0, 3).map((s) => `- ${s}`),
    tri.eat,
    `Confidence ${Math.round(tri.confidence)}%. Not a lab test.`,
  ].filter(Boolean);
  return lines.join("\n");
}

async function shareWhatsApp() {
  const text = shareSummary();
  if (!text) return;
  if (navigator.share) {
    try { await navigator.share({ title: "LeafDoc", text }); return; }
    catch (err) { if (err && err.name === "AbortError") return; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

async function saveCardImage() {
  const r = state.result;
  if (!r) return;
  const btn = $("imgBtn");
  if (btn) btn.disabled = true;
  try {
    const blob = await buildCard({
      result: r,
      triage: triageFor(r),
      meta: language(state.lang),
      date: new Date().toLocaleDateString(language(state.lang).locale),
    });
    const name = cardFileName(r);
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "LeafDoc" }); return; }
      catch (err) { if (err && err.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Image saved.");
  } catch {
    toast("Could not make the image on this device.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------- reset ----------
function resetAll() {
  stopSpeak();
  state.photos = [];
  state.result = null;
  state.answers = [];
  state.compareFrom = null;
  $("notes").value = "";
  micMessage("");
  renderThumbs();
  hide("result"); hide("problem"); hide("history");
  show("capture");
  window.scrollTo({ top: 0 });
}

init();
