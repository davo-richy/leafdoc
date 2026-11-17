(() => {
  "use strict";

  const LANGS = [
    ["English", "en-US"], ["Yoruba", "yo-NG"], ["Hausa", "ha-NG"], ["Igbo", "ig-NG"],
    ["Nigerian Pidgin", "en-NG"], ["French", "fr-FR"], ["Spanish", "es-ES"], ["Portuguese", "pt-BR"],
    ["Arabic", "ar-SA"], ["Hindi", "hi-IN"], ["Swahili", "sw-KE"], ["Chinese", "zh-CN"],
  ];
  const MAX_PHOTOS = 4;
  const HIST_KEY = "leafdoc.history.v1";
  const $ = (id) => document.getElementById(id);
  const show = (id) => $(id).classList.remove("hidden");
  const hide = (id) => $(id).classList.add("hidden");

  const state = { photos: [], result: null, answers: [], weather: null, weatherText: "", tab: "organic", busy: false };

  // ---------- safe storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    raw(k) { try { return localStorage.getItem(k); } catch { return null; } },
    setRaw(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  // ---------- init ----------
  function init() {
    const sel = $("lang");
    LANGS.forEach(([name]) => sel.add(new Option(name, name)));
    sel.value = store.raw("leafdoc.lang") || "English";
    sel.addEventListener("change", () => store.setRaw("leafdoc.lang", sel.value));

    const theme = store.raw("leafdoc.theme") ||
      (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    $("themeBtn").setAttribute("aria-pressed", String(theme === "dark"));
    $("themeBtn").onclick = () => {
      const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = t;
      $("themeBtn").setAttribute("aria-pressed", String(t === "dark"));
      store.setRaw("leafdoc.theme", t);
    };

    if (!store.raw("leafdoc.onboarded")) show("onboard");
    $("onboardOk").onclick = () => { store.setRaw("leafdoc.onboarded", "1"); hide("onboard"); };

    $("camInput").onchange = (e) => addFiles(e.target.files, e.target);
    $("fileInput").onchange = (e) => addFiles(e.target.files, e.target);
    $("scanBtn").onclick = () => diagnose([]);
    $("recheckBtn").onclick = recheck;
    $("newBtn").onclick = resetAll;
    $("problemBtn").onclick = () => { hide("problem"); show("capture"); };
    $("speakBtn").onclick = speak;
    $("stopBtn").onclick = stopSpeak;
    $("shareBtn").onclick = saveReport;
    $("icsBtn").onclick = downloadIcs;
    $("chatBtn").onclick = askChat;
    $("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") askChat(); });
    $("historyBtn").onclick = openHistory;
    $("historyClose").onclick = () => { hide("history"); (state.result ? show("result") : show("capture")); };
    $("clearHistory").onclick = () => { if (confirm("Delete all saved scans from this device?")) { store.set(HIST_KEY, []); renderHistory(); } };
    document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; renderTreatment(); }));

    setupMic();
    window.addEventListener("online", netUpdate);
    window.addEventListener("offline", netUpdate);
    netUpdate();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  function netUpdate() {
    $("netStatus").classList.toggle("hidden", navigator.onLine);
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
      try { state.photos.push(await fileToResized(f)); } catch { /* skip unreadable */ }
    }
    if (input) input.value = "";
    renderThumbs();
  }

  function renderThumbs() {
    const box = $("thumbs");
    box.replaceChildren();
    state.photos.forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "thumb";
      const im = document.createElement("img");
      im.src = p.preview; im.alt = `Photo ${i + 1}`;
      const b = document.createElement("button");
      b.textContent = "×"; b.setAttribute("aria-label", `Remove photo ${i + 1}`);
      b.onclick = () => { state.photos.splice(i, 1); renderThumbs(); };
      d.append(im, b);
      box.append(d);
    });
    $("scanBtn").disabled = state.photos.length === 0;
    $("photoHint").textContent = state.photos.length >= MAX_PHOTOS
      ? "Maximum of 4 photos reached."
      : state.photos.length
        ? `${state.photos.length} of ${MAX_PHOTOS} photos added – add another angle for a better diagnosis.`
        : "Tip: add up to 4 photos – close-up, whole plant, leaf underside.";
  }

  // ---------- voice input ----------
  let rec = null;
  function setupMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { $("micBtn").classList.add("hidden"); return; }
    $("micBtn").onclick = () => {
      if (rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = (LANGS.find((l) => l[0] === $("lang").value) || LANGS[0])[1];
      rec.interimResults = false;
      rec.onresult = (e) => {
        const t = Array.from(e.results).map((r) => r[0].transcript).join(" ");
        $("notes").value = ($("notes").value + " " + t).trim();
      };
      rec.onend = () => { rec = null; $("micBtn").classList.remove("live"); };
      rec.onerror = (e) => {
        rec = null; $("micBtn").classList.remove("live");
        if (e && (e.error === "not-allowed" || e.error === "service-not-allowed")) alert("Microphone access was blocked. Allow the microphone in your browser settings, or type your notes instead.");
        else if (e && e.error === "language-not-supported") alert("Voice input is not available for this language on your device. Please type your notes.");
      };
      $("micBtn").classList.add("live");
      try { rec.start(); } catch { rec = null; $("micBtn").classList.remove("live"); }
    };
  }

  // ---------- weather (Open-Meteo, only if the user opts in) ----------
  function getPosition() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error("no geo"));
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 600000 });
    });
  }

  async function loadWeather() {
    if (!$("useWeather").checked) { state.weather = null; state.weatherText = ""; return; }
    if (state.weather) return;
    try {
      const pos = await getPosition();
      const { latitude: lat, longitude: lon } = pos.coords;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}` +
        `&current=temperature_2m,relative_humidity_2m,precipitation&daily=temperature_2m_max,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=3`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("weather");
      const w = await r.json();
      const d = w.daily;
      const days = d.time.map((t, i) =>
        `${i === 0 ? "today" : i === 1 ? "tomorrow" : "in 2 days"}: max ${Math.round(d.temperature_2m_max[i])}°C, rain chance ${d.precipitation_probability_max[i]}%, ${d.precipitation_sum[i]} mm`);
      state.weather = w;
      state.weatherText = `Now ${Math.round(w.current.temperature_2m)}°C, humidity ${w.current.relative_humidity_2m}%. Forecast – ${days.join("; ")}.`;
    } catch {
      state.weather = null; state.weatherText = "";
      $("useWeather").checked = false;
      state.weatherFailed = true;
    }
  }

  // ---------- diagnosis ----------
  function setLoading(on, text) {
    state.busy = on;
    if (on) { hide("capture"); hide("result"); hide("problem"); hide("history"); $("loadingText").textContent = text || "Examining your plant…"; show("loading"); }
    else hide("loading");
  }

  function showProblem(title, text) {
    $("problemTitle").textContent = title;
    $("problemText").textContent = text;
    show("problem");
  }

  async function diagnose(answers) {
    if (state.busy) return;
    if (!navigator.onLine) { showProblem("You're offline", "LeafDoc needs internet to analyse a new photo. You can still open past scans from the 🕘 button."); return; }
    setLoading(true, "Checking your photos…");
    await loadWeather();
    $("loadingText").textContent = "Examining your plant…";
    try {
      const res = await fetch("api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: state.photos.map((p) => ({ mime: p.mime, data: p.data })),
          language: $("lang").value,
          notes: $("notes").value.trim(),
          answers,
          weather: state.weatherText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) { showProblem("Something went wrong", data.message || "Please try again in a moment."); return; }
      handleResult(data, answers);
    } catch {
      setLoading(false);
      showProblem("Connection problem", "We couldn't reach the server. Check your internet and try again.");
    }
  }

  function handleResult(r, answers) {
    if (r.photo_ok === false || r.is_plant === false) {
      showProblem(r.is_plant === false ? "That doesn't look like a plant" : "Let's try a better photo",
        r.photo_issue || "Take a clear, well-lit, close photo of the affected leaf and try again.");
      return;
    }
    state.result = r;
    state.answers = answers;
    renderResult();
    saveHistory();
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    $("plantName").textContent = r.plant || "Unknown plant";
    $("summary").textContent = r.summary || "";

    const conf = Math.max(0, Math.min(100, Number(r.overall_confidence) || 0));
    $("confNum").textContent = conf + "%";
    $("confBar").style.width = conf + "%";
    $("confBar").parentElement.classList.toggle("low", conf < 65);

    const pill = $("statusPill");
    pill.className = "pill";
    if (r.healthy) { pill.textContent = "Looks healthy"; pill.classList.add("ok"); }
    else if (r.needs_more_info || conf < 65) { pill.textContent = "Not sure yet"; pill.classList.add("warn"); }
    else {
      const sev = (r.problems?.[0]?.severity || "").toLowerCase();
      pill.textContent = sev === "high" ? "Serious" : sev === "low" ? "Mild" : "Needs attention";
      pill.classList.add(sev === "high" ? "bad" : sev === "low" ? "ok" : "warn");
    }

    const urgent = $("urgent");
    urgent.textContent = r.urgent_note || "";
    urgent.classList.toggle("hidden", !r.urgent_note);

    // follow-ups
    const qs = list(r.follow_up_questions);
    const needs = (r.needs_more_info || conf < 65) && qs.length > 0;
    $("followCard").classList.toggle("hidden", !needs);
    const form = $("followForm");
    form.replaceChildren();
    if (needs) {
      qs.forEach((q, i) => {
        const wrap = document.createElement("div");
        wrap.className = "fq";
        const l = document.createElement("label"); l.htmlFor = "fq" + i; l.textContent = q;
        const inp = document.createElement("input"); inp.type = "text"; inp.id = "fq" + i;
        const prev = state.answers.find((a) => a.q === q); if (prev) inp.value = prev.a;
        wrap.append(l, inp); form.append(wrap);
      });
    }

    // problems
    const box = $("problems");
    box.replaceChildren();
    list(r.problems).forEach((p, i) => {
      const card = document.createElement("div");
      card.className = "card problem";
      const h = document.createElement("h3");
      const n = document.createElement("span"); n.textContent = `${i + 1}. ${p.name}`;
      const c = document.createElement("span"); c.className = "muted small"; c.textContent = `${Math.round(p.confidence)}%`;
      h.append(n, c);
      const tags = document.createElement("div"); tags.className = "tags";
      if (p.type) { const t = document.createElement("span"); t.className = "tag"; t.textContent = p.type; tags.append(t); }
      if (p.severity) { const t = document.createElement("span"); t.className = "tag " + p.severity.toLowerCase(); t.textContent = p.severity; tags.append(t); }
      const bar = document.createElement("div"); bar.className = "bar";
      const fill = document.createElement("div"); fill.style.width = Math.max(0, Math.min(100, p.confidence)) + "%"; bar.append(fill);
      card.append(h, tags, bar);
      if (p.explanation) { const e = document.createElement("p"); e.textContent = p.explanation; card.append(e); }
      const sy = list(p.symptoms_observed);
      if (sy.length) {
        const ul = document.createElement("ul");
        sy.forEach((s) => { const li = document.createElement("li"); li.textContent = s; ul.append(li); });
        card.append(ul);
      }
      box.append(card);
    });

    // weather
    const hasW = !!r.weather_advice;
    $("weatherCard").classList.toggle("hidden", !hasW && !state.weatherFailed);
    if (hasW) { $("weatherAdvice").textContent = r.weather_advice; $("weatherLine").textContent = state.weatherText; }
    else if (state.weatherFailed) { $("weatherAdvice").textContent = "Weather advice is off because your location or the weather service wasn't available."; $("weatherLine").textContent = ""; }
    state.weatherFailed = false;

    // treatment
    const t = r.treatment || {};
    const hasT = list(t.organic).length || list(t.chemical).length || list(t.prevention).length;
    $("treatCard").classList.toggle("hidden", !hasT);
    if (hasT) {
      if (!list(t[state.tab]).length) state.tab = ["organic", "chemical", "prevention"].find((k) => list(t[k]).length);
      renderTreatment();
    }
    $("calendarCard").classList.toggle("hidden", !!r.healthy || !hasT);
    $("chatLog").replaceChildren();
    renderCompare();
    updateVoiceNote();
    stopSpeak();
  }

  function renderTreatment() {
    const t = state.result?.treatment || {};
    document.querySelectorAll(".tab").forEach((b) => {
      const on = b.dataset.tab === state.tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    const ul = $("treatList");
    ul.replaceChildren();
    list(t[state.tab]).forEach((s) => { const li = document.createElement("li"); li.textContent = s; ul.append(li); });
  }

  // ---------- voice output ----------
  function resultText() {
    const r = state.result; if (!r) return "";
    const parts = [r.plant, r.summary];
    list(r.problems).forEach((p, i) => parts.push(`${i + 1}. ${p.name}. ${p.explanation || ""}`));
    const t = r.treatment || {};
    parts.push(...list(t.organic), ...list(t.chemical), ...list(t.prevention));
    if (r.weather_advice) parts.push(r.weather_advice);
    if (r.urgent_note) parts.push(r.urgent_note);
    return parts.filter(Boolean).join(". ");
  }

  function speak() {
    if (!("speechSynthesis" in window)) { alert("Your browser can't read text aloud."); return; }
    stopSpeak();
    const u = new SpeechSynthesisUtterance(resultText());
    u.lang = (LANGS.find((l) => l[0] === $("lang").value) || LANGS[0])[1];
    const v = pickVoice(u.lang);
    if (v) u.voice = v;
    u.onend = u.onerror = () => { hide("stopBtn"); show("speakBtn"); };
    show("stopBtn"); hide("speakBtn");
    speechSynthesis.speak(u);
  }
  function stopSpeak() {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    hide("stopBtn"); show("speakBtn");
  }


  // ---------- voice availability ----------
  function pickVoice(lang) {
    if (!("speechSynthesis" in window)) return null;
    const voices = speechSynthesis.getVoices();
    const base = lang.split("-")[0].toLowerCase();
    return voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
           voices.find((v) => v.lang.toLowerCase().startsWith(base)) || null;
  }

  function updateVoiceNote() {
    const note = $("voiceNote");
    if (!("speechSynthesis" in window)) { note.textContent = "Read aloud is not supported on this browser."; note.classList.remove("hidden"); $("speakBtn").classList.add("hidden"); return; }
    const lang = (LANGS.find((l) => l[0] === $("lang").value) || LANGS[0])[1];
    const has = !!pickVoice(lang);
    if (!has && speechSynthesis.getVoices().length) {
      note.textContent = `Your device has no ${$("lang").value} voice, so it may sound wrong or stay silent. The text above is still fully available.`;
      note.classList.remove("hidden");
    } else note.classList.add("hidden");
  }
  if ("speechSynthesis" in window) speechSynthesis.addEventListener?.("voiceschanged", () => { if (state.result) updateVoiceNote(); });

  // ---------- follow-up chat ----------
  async function askChat() {
    const input = $("chatInput");
    const q = input.value.trim();
    if (!q || !state.result || state.busy) return;
    if (!navigator.onLine) { addChat("bot", "You're offline. Questions need an internet connection."); return; }
    addChat("me", q);
    input.value = "";
    $("chatBtn").disabled = true;
    const pending = addChat("bot", "…");
    try {
      const res = await fetch("api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, language: $("lang").value, diagnosis: state.result }),
      });
      const data = await res.json().catch(() => ({}));
      pending.textContent = res.ok ? data.answer : (data.message || "Sorry, I couldn't answer that. Please try again.");
    } catch {
      pending.textContent = "Connection problem. Please try again.";
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
    const r = state.result; if (!r) return;
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
    const ev = items.map(([off, title, desc], i) => {
      const s = new Date(); s.setDate(s.getDate() + off);
      const e = new Date(s); e.setDate(e.getDate() + 1);
      return ["BEGIN:VEVENT", `UID:leafdoc-${Date.now()}-${i}@leafdoc`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${fmt(s)}`, `DTEND;VALUE=DATE:${fmt(e)}`,
        `SUMMARY:${title.replace(/[,;\\]/g, " ")}`, `DESCRIPTION:${desc.replace(/[,;\\]/g, " ")}`, "END:VEVENT"].join("\r\n");
    });
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LeafDoc//EN", ...ev, "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url; a.download = "leafdoc-reminders.ics";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- compare with previous scan of same plant ----------
  function renderCompare() {
    const card = $("compareCard");
    card.classList.add("hidden");
    const r = state.result; if (!r || !state.compareFrom) return;
    const prev = state.compareFrom; state.compareFrom = null;
    const pn = prev.problems?.[0], nn = r.problems?.[0];
    const prevTxt = prev.healthy ? "healthy" : `${pn?.name || "unknown"} (${pn?.confidence ?? "?"}%)`;
    const nowTxt = r.healthy ? "healthy" : `${nn?.name || "unknown"} (${nn?.confidence ?? "?"}%)`;
    let verdict = "";
    if (!prev.healthy && r.healthy) verdict = "Good news: it now looks healthy.";
    else if (prev.healthy && !r.healthy) verdict = "A problem has appeared since the last scan.";
    else {
      const sev = { low: 1, moderate: 2, high: 3 };
      const a = sev[(pn?.severity || "").toLowerCase()] || 0, b = sev[(nn?.severity || "").toLowerCase()] || 0;
      verdict = !a || !b ? "Compare the symptoms below with your last scan." : b < a ? "Severity looks lower than before." : b > a ? "Severity looks higher than before." : "Severity looks about the same.";
    }
    $("compareText").textContent = `Before: ${prevTxt}. Now: ${nowTxt}. ${verdict}`;
    card.classList.remove("hidden");
  }

  // ---------- history ----------
  function makeThumb(preview) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = 96; c.height = 96;
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
    const h = store.get(HIST_KEY, []);
    h.unshift({ id: Date.now(), ts: Date.now(), plant: state.result.plant || "Plant", thumb, language: $("lang").value, result: state.result });
    while (h.length > 20) h.pop();
    while (h.length && !store.set(HIST_KEY, h)) h.pop(); // handle quota
  }

  function openHistory() {
    hide("capture"); hide("result"); hide("problem");
    renderHistory(); show("history");
  }

  function renderHistory() {
    const box = $("historyList");
    box.replaceChildren();
    const h = store.get(HIST_KEY, []);
    if (!h.length) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "No saved scans yet."; box.append(p); return; }
    h.forEach((it) => {
      const row = document.createElement("div"); row.className = "hist-item"; row.tabIndex = 0;
      const im = document.createElement("img"); if (it.thumb) im.src = it.thumb; im.alt = "";
      const d = document.createElement("div");
      const b = document.createElement("b"); b.textContent = it.plant;
      const s = document.createElement("span"); s.className = "muted small";
      s.textContent = `${new Date(it.ts).toLocaleString()} · ${it.result?.problems?.[0]?.name || (it.result?.healthy ? "Healthy" : "")}`;
      d.append(b, s); row.append(im, d);
      const open = () => { state.result = it.result; state.answers = []; hide("history"); renderResult(); };
      row.onclick = open; row.onkeydown = (e) => { if (e.key === "Enter") open(); };
      const rs = document.createElement("button"); rs.className = "btn ghost small-btn"; rs.textContent = "Re-scan";
      rs.title = "Take new photos and compare with this scan";
      rs.onclick = (ev) => { ev.stopPropagation(); resetAll(); state.compareFrom = it.result; hide("history"); show("capture"); };
      row.append(rs);
      box.append(row);
    });
  }

  // ---------- report ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function saveReport() {
    const r = state.result; if (!r) return;
    const t = r.treatment || {};
    const ul = (a) => `<ul>${list(a).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    const html = `<!doctype html><meta charset="utf-8"><title>LeafDoc report</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:700px;margin:24px auto;padding:0 16px}h1{color:#1f5f3a}h2{margin-top:22px}.d{font-size:.85rem;color:#555;margin-top:30px}</style>
<h1>🌿 LeafDoc report</h1><p>${esc(new Date().toLocaleString())}</p>
<h2>${esc(r.plant)}</h2><p>${esc(r.summary)}</p><p>Overall confidence: ${esc(r.overall_confidence)}%</p>
${r.urgent_note ? `<p><b>${esc(r.urgent_note)}</b></p>` : ""}
${list(r.problems).map((p) => `<h2>${esc(p.name)} (${esc(p.confidence)}%)</h2><p>${esc(p.explanation)}</p>${ul(p.symptoms_observed)}`).join("")}
${r.weather_advice ? `<h2>Weather advice</h2><p>${esc(r.weather_advice)}</p>` : ""}
<h2>Organic treatment</h2>${ul(t.organic)}<h2>Chemical treatment</h2>${ul(t.chemical)}<h2>Prevention</h2>${ul(t.prevention)}
<p class="d">AI-generated guidance, not a laboratory diagnosis. For serious or spreading problems consult a local agricultural extension officer.</p>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to save the report."); return; }
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 300);
  }

  // ---------- reset ----------
  function resetAll() {
    stopSpeak();
    state.photos = []; state.result = null; state.answers = []; state.compareFrom = null;
    $("notes").value = "";
    renderThumbs();
    hide("result"); hide("problem"); hide("history"); show("capture");
    window.scrollTo({ top: 0 });
  }

  init();
})();
