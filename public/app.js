const root = document.querySelector("#view-root");
const breadcrumb = document.querySelector("#breadcrumb-current");
const toastNode = document.querySelector("#toast");
const navButtons = [...document.querySelectorAll("[data-view]")];

const state = {
  view: "overview",
  settings: null,
  status: null,
  words: [],
  previewText: "",
  previewCursor: 0,
  suggestion: { type: "idle" },
  dismissed: "",
  previewRequest: 0,
  toastTimer: null
};

const viewNames = {
  overview: "Overview",
  typing: "Typing",
  apps: "Apps",
  dictionary: "Dictionary",
  privacy: "Privacy"
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The local request could not be completed.");
  return result;
}

async function loadState() {
  const [settings, status, dictionary] = await Promise.all([
    api("/api/settings"), api("/api/status"), api("/api/dictionary")
  ]);
  state.settings = settings;
  state.status = status;
  state.words = dictionary.userWords;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function toast(message) {
  toastNode.textContent = message;
  toastNode.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toastNode.classList.remove("show"), 2400);
}

function switchView(view) {
  if (!viewNames[view]) return;
  state.view = view;
  navButtons.forEach(button => button.classList.toggle("active", button.dataset.view === view));
  breadcrumb.textContent = viewNames[view];
  render();
  window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}

function heading(eyebrow, title, copy, action = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${copy}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ""}</div>`;
}

function switchButton(key, label, description, checked, disabled = false) {
  return `<div class="setting-row"><div class="setting-copy"><strong>${label}</strong><span>${description}</span></div><button class="switch ${checked ? "on" : ""}" type="button" role="switch" aria-checked="${checked}" aria-label="${label}" data-toggle="${key}" ${disabled ? "disabled" : ""}></button></div>`;
}

function previewMarkup() {
  return `<section class="card preview-card" aria-label="Interactive Typo preview">
    <div class="preview-topline"><span class="live-dot"></span><span class="preview-label">TRY THE PREVIEW</span></div>
    <p class="preview-help">A small local sandbox. Your text stays in this page and is not saved.</p>
    <div class="editor-frame">
      <div class="editor-caption"><span>UNTITLED NOTE</span><span>EN · US</span></div>
      <div class="editor" id="typing-editor" contenteditable="true" role="textbox" aria-label="Type here to preview Typo suggestions" aria-multiline="true" spellcheck="false" data-placeholder="Type something… try “im” or “ty”"></div>
      <div class="suggestion-row" id="suggestion-row"><div class="suggestion-copy" id="suggestion-copy"><span>Start typing to see a local suggestion.</span></div><span class="shortcut">TAB ACCEPTS</span></div>
      <div class="editor-bottom"><span>Preview only · no system input access</span><span>ESC dismiss</span></div>
    </div>
  </section>`;
}

function integrationCard() {
  return `<section class="card integration-card"><div class="integration-head"><h2 class="card-title">System integration</h2><span class="integration-state"><i></i>NOT CONNECTED</span></div>
    <p class="integration-copy">This build runs the local suggestion engine and dashboard preview. It is not attached to your keyboard or other apps yet.</p>
    <div class="integration-note"><span class="note-mark">↗</span><span>Next integration step: validate Fcitx5 or IBus pre-edit behavior on your Linux Wayland session, then connect the native adapter.</span></div>
  </section>`;
}

function overviewView() {
  return `${heading("YOUR WRITING, IN MOTION", "A little ahead of your hands.", "Typo catches the next word while you stay with the thought. Try the local preview, then explore how the first Linux build is configured.", `<button class="button button-quiet" data-view="typing">Adjust typing</button>`)}
    <div class="grid overview-grid">
      <div>
        <section class="card hero-card"><div class="hero-top"><span class="hero-status"><span class="pill-dot"></span>LOCAL ENGINE READY</span></div><h2>Keep your thought.<br><em>Lose the friction.</em></h2><p>Completions and common corrections, suggested locally and accepted only when you choose.</p><div class="hero-actions"><button class="button button-primary" data-focus-editor="true">Try Typo <span aria-hidden="true">↗</span></button><button class="text-link" data-view="privacy">How privacy works</button></div></section>
        <div class="spacer-15"></div>${previewMarkup()}
        <div class="grid how-grid"><article class="card mini-card"><span class="step-number">01</span><div><h3>Type naturally</h3><p>Typo reads the active word in the preview and finds a local match.</p></div></article><article class="card mini-card"><span class="step-number">02</span><div><h3>See it lightly</h3><p>A muted suffix completes a word; a marked token shows a correction.</p></div></article><article class="card mini-card"><span class="step-number">03</span><div><h3>Choose to accept</h3><p>Tab accepts a fresh suggestion. Escape leaves what you typed untouched.</p></div></article></div>
      </div>
      <div class="overview-side"><section class="card card-pad"><div class="card-heading"><div><h2 class="card-title">Typing behavior</h2><p class="card-subtitle">Preview controls</p></div><span class="chip green">READY</span></div>
        ${switchButton("completionEnabled", "Word completion", "Suggest the rest of a word as you type.", state.settings.completionEnabled)}
        ${switchButton("correctionEnabled", "Common corrections", "Mark likely typos and offer a replacement.", state.settings.correctionEnabled)}
        <div class="setting-row"><div class="setting-copy"><strong>Suggestion style</strong><span>How readily Typo offers a match.</span></div><select class="select-control" data-setting="suggestionMode" aria-label="Suggestion style"><option value="fewer" ${state.settings.suggestionMode === "fewer" ? "selected" : ""}>Fewer</option><option value="balanced" ${state.settings.suggestionMode === "balanced" ? "selected" : ""}>Balanced</option><option value="more" ${state.settings.suggestionMode === "more" ? "selected" : ""}>More</option></select></div>
      </section>${integrationCard()}</div>
    </div>`;
}

function typingView() {
  const action = `<button class="button" data-reset-preview="true">Clear preview</button>`;
  return `${heading("PERSONALIZE THE FEEL", "Typing", "Choose when the local preview suggests a completion or correction. Tab accepts an active suggestion; without one, Tab is untouched.", action)}
    <div class="grid overview-grid"><div class="section-stack">
      <section class="card card-pad"><div class="card-heading"><div><h2 class="card-title">Suggestion types</h2><p class="card-subtitle">These preferences control the local preview engine.</p></div><span class="chip green">LOCAL</span></div>
        ${switchButton("enabled", "Enable Typo preview", "Turn local suggestions on in this browser preview.", state.settings.enabled)}
        ${switchButton("completionEnabled", "Word completion", "Show a muted suffix for likely word endings.", state.settings.completionEnabled)}
        ${switchButton("correctionEnabled", "Common corrections", "Underline a known typo and offer one replacement.", state.settings.correctionEnabled)}
      </section>
      <section class="card card-pad"><div class="card-heading"><div><h2 class="card-title">Suggestion behavior</h2><p class="card-subtitle">Start conservative. Tune it to your writing.</p></div></div>
        <div class="setting-row"><div class="setting-copy"><strong>Suggestion style</strong><span>Higher confidence means fewer interruptions.</span></div><select class="select-control" data-setting="suggestionMode" aria-label="Suggestion style"><option value="fewer" ${state.settings.suggestionMode === "fewer" ? "selected" : ""}>Fewer</option><option value="balanced" ${state.settings.suggestionMode === "balanced" ? "selected" : ""}>Balanced</option><option value="more" ${state.settings.suggestionMode === "more" ? "selected" : ""}>More</option></select></div>
        <div class="setting-row"><div class="setting-copy"><strong>Minimum letters</strong><span>Wait for this many characters before completion.</span></div><select class="select-control" data-setting="minimumPrefixLength" aria-label="Minimum letters"><option value="1" ${state.settings.minimumPrefixLength === 1 ? "selected" : ""}>1 letter</option><option value="2" ${state.settings.minimumPrefixLength === 2 ? "selected" : ""}>2 letters</option><option value="3" ${state.settings.minimumPrefixLength === 3 ? "selected" : ""}>3 letters</option></select></div>
      </section></div><div class="section-stack">${previewMarkup()}${integrationCard()}</div></div>`;
}

const suggestedApps = [
  ["B", "Browser text fields", "Example scope · preview only"],
  ["D", "Document editor", "Example scope · preview only"],
  [">_", "Terminal", "Not supported in the first release"],
  ["⌑", "Password fields", "Always excluded · cannot be enabled"]
];

function appsView() {
  const appRows = suggestedApps.map(([icon, name, details], index) => {
    const protectedField = index === 3;
    const excluded = protectedField || state.settings.excludedApps.includes(name);
    return `<div class="app-row"><span class="app-glyph">${icon}</span><div><strong>${name}</strong><small>${details}</small></div>${protectedField ? `<span class="chip amber">ALWAYS OFF</span>` : `<button class="switch ${excluded ? "" : "on"}" role="switch" aria-checked="${!excluded}" aria-label="${excluded ? "Allow" : "Exclude"} ${name}" data-app-toggle="${escapeHTML(name)}"></button>`}</div>`;
  }).join("");
  return `${heading("APP COVERAGE", "Apps", "Manage the app exclusions that the native adapter will use when it is added. The preview itself does not inspect or control other apps.")}
    <div class="grid overview-grid"><div class="section-stack"><section class="card card-pad"><div class="card-heading"><div><h2 class="card-title">App access</h2><p class="card-subtitle">No application outside this page is currently connected.</p></div><span class="chip amber">PREVIEW MODE</span></div><div class="notice notice-apps"><strong>Secure fields stay excluded.</strong> Password fields can never be opted in. This preference is reserved for a future native adapter.</div>${appRows}</section></div><div class="section-stack"><section class="card card-pad"><h2 class="card-title">How app support will work</h2><p class="card-subtitle subtitle-gap">The Linux adapter will use app identity exposed by the input framework. It will not guess from window titles or read screen contents.</p><div class="progress-track"><span></span></div><p class="field-hint">Integration status: local dashboard and engine preview are implemented. Fcitx5/IBus adapter is not connected in this build.</p></section>${integrationCard()}</div></div>`;
}

function dictionaryView() {
  const words = state.words.length
    ? state.words.map(word => `<div class="word-item"><span>${escapeHTML(word)}</span><button class="remove-word" aria-label="Remove ${escapeHTML(word)}" data-remove-word="${escapeHTML(word)}">×</button></div>`).join("")
    : `<div class="empty-state">No personal words yet. Add a name or spelling you want Typo to recognize.</div>`;
  return `${heading("YOUR WORDS, YOUR WAY", "Dictionary", "Words added here are stored locally and used by the preview engine. They are not shared or synced.")}
    <div class="grid overview-grid"><section class="card card-pad"><div class="card-heading"><div><h2 class="card-title">Personal dictionary</h2><p class="card-subtitle">Words Typo should recognize and leave alone.</p></div><span class="chip green">${state.words.length} WORD${state.words.length === 1 ? "" : "S"}</span></div>
      <form id="add-word-form" class="add-word-form"><label class="sr-only" for="new-word">Add a word</label><input id="new-word" class="text-control" maxlength="40" placeholder="Add a name or word" autocomplete="off"><button class="button button-primary" type="submit">Add word</button></form>
      <div class="word-list">${words}</div></section><div class="section-stack"><section class="card card-pad"><h2 class="card-title">Built-in vocabulary</h2><p class="card-subtitle dictionary-subtitle">The local preview includes a compact English starter list for demonstrating the interaction. It is not a complete spelling dictionary.</p><div class="metric-row"><div class="card metric"><span>Language</span><strong>English</strong><small>United States</small></div><div class="card metric"><span>Built-in words</span><strong>${state.status ? "Starter" : "—"}</strong><small>Preview list</small></div></div></section><div class="notice"><strong>Local storage.</strong> Personal words are saved in this app’s local data folder. Clear them below whenever you like.</div><button class="button button-quiet" data-clear-words="true">Clear personal dictionary</button></div></div>`;
}

function privacyView() {
  return `${heading("ON DEVICE, BY DEFAULT", "Privacy", "The preview is built to keep your text local. It does not connect to a cloud model or collect typing activity.")}
    <div class="grid privacy-grid"><article class="card privacy-card"><div class="privacy-icon">⌂</div><h3>Local processing</h3><p>Suggestions are ranked by the local engine on this machine. The preview sends only the text you type in its sandbox to its local process for ranking; nothing leaves this device.</p></article>
      <article class="card privacy-card"><div class="privacy-icon">◉</div><h3>No text history</h3><p>Sandbox text is held in the page while open. It is not saved to preferences, logs, analytics, or a typing history.</p></article>
      <article class="card privacy-card"><div class="privacy-icon">⌑</div><h3>Secure fields</h3><p>The browser preview cannot observe other applications. When a native adapter is built, secure-field checks must run before text reaches the engine.</p></article>
      <article class="card privacy-card"><div class="privacy-icon">↗</div><h3>No network service</h3><p>This app binds to localhost for its dashboard and local engine API. It does not make external network requests.</p></article></div>
    <div class="grid overview-grid privacy-bottom"><section class="card card-pad"><div class="card-heading"><div><h2 class="card-title">Optional local learning</h2><p class="card-subtitle">Not included in this preview engine. Keep this off until the native learning and deletion flow is ready.</p></div></div>${switchButton("learningEnabled", "Allow local learning", "Reserved preference only; no learning is performed in this build.", state.settings.learningEnabled)}</section>
      <section class="card card-pad"><div class="card-heading"><div><h2 class="card-title">Diagnostics sharing</h2><p class="card-subtitle">This build has no upload or diagnostics export feature.</p></div></div>${switchButton("diagnosticsConsent", "Allow diagnostics export", "Reserved preference only; no data is sent.", state.settings.diagnosticsConsent)}</section></div>`;
}

function render() {
  if (!state.settings) return;
  root.innerHTML = ({ overview: overviewView, typing: typingView, apps: appsView, dictionary: dictionaryView, privacy: privacyView })[state.view]();
  root.querySelectorAll("[data-toggle]").forEach(button => button.addEventListener("click", () => toggleSetting(button.dataset.toggle)));
  root.querySelectorAll("[data-setting]").forEach(select => select.addEventListener("change", () => updateSetting(select.dataset.setting, select.value)));
  root.querySelectorAll("[data-focus-editor]").forEach(button => button.addEventListener("click", () => document.querySelector("#typing-editor")?.focus()));
  root.querySelectorAll("[data-reset-preview]").forEach(button => button.addEventListener("click", clearPreview));
  root.querySelectorAll("[data-app-toggle]").forEach(button => button.addEventListener("click", () => toggleApp(button.dataset.appToggle)));
  root.querySelectorAll("[data-remove-word]").forEach(button => button.addEventListener("click", () => removeWord(button.dataset.removeWord)));
  root.querySelector("#add-word-form")?.addEventListener("submit", addWord);
  root.querySelector("[data-clear-words]")?.addEventListener("click", clearWords);
  bindEditor();
}

async function persistSettings() {
  state.settings = await api("/api/settings", { method: "PUT", body: JSON.stringify(state.settings) });
}

async function updateSetting(key, value) {
  if (key === "minimumPrefixLength") value = Number(value);
  state.settings[key] = value;
  try {
    await persistSettings();
    render();
    toast("Preference saved on this device");
  } catch (error) { toast(error.message); }
}

async function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  try {
    await persistSettings();
    render();
    toast("Preference saved on this device");
  } catch (error) { toast(error.message); }
}

async function toggleApp(appName) {
  const exclusions = new Set(state.settings.excludedApps);
  if (exclusions.has(appName)) exclusions.delete(appName);
  else exclusions.add(appName);
  state.settings.excludedApps = [...exclusions];
  try { await persistSettings(); render(); toast("Exclusion saved for the future native adapter"); }
  catch (error) { toast(error.message); }
}

async function addWord(event) {
  event.preventDefault();
  const input = event.currentTarget.querySelector("input");
  const word = input.value.trim();
  if (!word) { input.focus(); return; }
  try {
    const result = await api("/api/dictionary", { method: "POST", body: JSON.stringify({ word }) });
    state.words = result.userWords;
    state.suggestion = { type: "idle" };
    render();
    toast("Word added to your local dictionary");
  } catch (error) { toast(error.message); input.focus(); }
}

async function removeWord(word) {
  try {
    const result = await api(`/api/dictionary/${encodeURIComponent(word)}`, { method: "DELETE" });
    state.words = result.userWords;
    render();
    toast("Word removed");
  } catch (error) { toast(error.message); }
}

async function clearWords() {
  if (!state.words.length) { toast("Your personal dictionary is already empty"); return; }
  try {
    for (const word of [...state.words]) await api(`/api/dictionary/${encodeURIComponent(word)}`, { method: "DELETE" });
    state.words = [];
    render();
    toast("Personal dictionary cleared");
  } catch (error) { toast(error.message); }
}

function editorText(editor) { return editor.innerText.replace(/\n$/, ""); }

function caretOffset(editor) {
  const selection = getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return editorText(editor).length;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.setEnd(selection.anchorNode, selection.anchorOffset);
  return range.toString().length;
}

function placeCaret(editor, offset) {
  const selection = getSelection();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();
  while (node) {
    const ignored = node.parentElement?.closest(".ghost");
    if (!ignored) {
      if (remaining <= node.length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= node.length;
    }
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function addText(parent, value) { parent.append(document.createTextNode(value)); }

function renderEditor(editor, text, cursor, suggestion) {
  editor.replaceChildren();
  if (suggestion?.type === "completion" && suggestion.suffix) {
    addText(editor, text.slice(0, suggestion.end));
    const ghost = document.createElement("span");
    ghost.className = "ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.textContent = suggestion.suffix;
    editor.append(ghost);
    addText(editor, text.slice(suggestion.end));
  } else if (suggestion?.type === "correction") {
    addText(editor, text.slice(0, suggestion.start));
    const token = document.createElement("span");
    token.className = "correction-token";
    token.textContent = text.slice(suggestion.start, suggestion.end);
    editor.append(token);
    addText(editor, text.slice(suggestion.end));
  } else addText(editor, text);
  placeCaret(editor, cursor);
}

function updateSuggestionRow(suggestion) {
  const copy = document.querySelector("#suggestion-copy");
  const row = document.querySelector("#suggestion-row");
  if (!copy || !row) return;
  row.classList.toggle("has-suggestion", suggestion.type !== "idle");
  if (suggestion.type === "completion") {
    copy.innerHTML = `<span class="suggestion-kind">Complete</span><span class="suggestion-target">${escapeHTML(suggestion.word)}</span><span>·</span><span>local match</span>`;
  } else if (suggestion.type === "correction") {
    copy.innerHTML = `<span class="suggestion-kind">Correct</span><span class="suggestion-target">${escapeHTML(suggestion.token)} → ${escapeHTML(suggestion.replacement)}</span>`;
  } else copy.innerHTML = `<span>Start typing to see a local suggestion.</span>`;
  const keycap = row.querySelector(".shortcut");
  if (keycap) keycap.textContent = suggestion.type === "idle" ? "TAB PASSES THROUGH" : "TAB ACCEPTS";
}

function bindEditor() {
  const editor = document.querySelector("#typing-editor");
  if (!editor) return;
  if (state.previewText) {
    renderEditor(editor, state.previewText, state.previewCursor, { type: "idle" });
    scheduleSuggestion(editor);
  }
  editor.addEventListener("input", () => {
    state.dismissed = "";
    state.previewText = editorText(editor);
    state.previewCursor = caretOffset(editor);
    scheduleSuggestion(editor);
  });
  editor.addEventListener("keyup", event => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) scheduleSuggestion(editor);
  });
  editor.addEventListener("click", () => scheduleSuggestion(editor));
  editor.addEventListener("keydown", event => {
    if (event.key === "Tab" && state.suggestion.type !== "idle") {
      event.preventDefault();
      acceptSuggestion(editor);
    } else if (event.key === "Escape" && state.suggestion.type !== "idle") {
      event.preventDefault();
      const text = editorText(editor);
      const cursor = caretOffset(editor);
      state.dismissed = `${state.suggestion.token}:${state.suggestion.start}`;
      state.suggestion = { type: "idle" };
      renderEditor(editor, text, cursor, state.suggestion);
      updateSuggestionRow(state.suggestion);
    }
  });
}

let suggestionTimer;
function scheduleSuggestion(editor) {
  clearTimeout(suggestionTimer);
  const text = editorText(editor);
  const cursor = caretOffset(editor);
  state.previewText = text;
  state.previewCursor = cursor;
  const request = ++state.previewRequest;
  suggestionTimer = setTimeout(async () => {
    try {
      const suggestion = await api("/api/suggest", { method: "POST", body: JSON.stringify({ text, cursor }) });
      if (request !== state.previewRequest || !editor.isConnected) return;
      const key = `${suggestion.token || ""}:${suggestion.start ?? cursor - (suggestion.token || "").length}`;
      state.suggestion = key === state.dismissed ? { type: "idle" } : suggestion;
      renderEditor(editor, text, cursor, state.suggestion);
      updateSuggestionRow(state.suggestion);
    } catch { state.suggestion = { type: "idle" }; updateSuggestionRow(state.suggestion); }
  }, 35);
}

function acceptSuggestion(editor) {
  const suggestion = state.suggestion;
  let text = editorText(editor);
  let cursor = caretOffset(editor);
  if (suggestion.type === "completion" && suggestion.end === cursor) {
    text = text.slice(0, cursor) + suggestion.suffix + text.slice(cursor);
    cursor += suggestion.suffix.length;
  } else if (suggestion.type === "correction" && text.slice(suggestion.start, suggestion.end) === suggestion.token) {
    text = text.slice(0, suggestion.start) + suggestion.replacement + text.slice(suggestion.end);
    cursor = suggestion.start + suggestion.replacement.length;
  } else {
    state.suggestion = { type: "idle" };
    scheduleSuggestion(editor);
    return;
  }
  state.dismissed = "";
  state.suggestion = { type: "idle" };
  state.previewText = text;
  state.previewCursor = cursor;
  renderEditor(editor, text, cursor, state.suggestion);
  updateSuggestionRow(state.suggestion);
  scheduleSuggestion(editor);
}

function clearPreview() {
  const editor = document.querySelector("#typing-editor");
  if (!editor) return;
  editor.replaceChildren();
  state.suggestion = { type: "idle" };
  state.dismissed = "";
  state.previewText = "";
  state.previewCursor = 0;
  updateSuggestionRow(state.suggestion);
  editor.focus();
  toast("Preview cleared");
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) switchView(viewButton.dataset.view);
});

document.querySelector("#help-button").addEventListener("click", () => {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="about-title"><div class="eyebrow">TYPO 0.1.0</div><h2 id="about-title">A first local preview.</h2><p>This build includes a local suggestion engine, a working typing sandbox, and settings for the planned native app. It is not connected to the system keyboard. No text is uploaded or stored.</p><div class="notice"><strong>Next:</strong> validate Fcitx5 or IBus pre-edit behavior on the target Wayland desktop and build the native adapter.</div><div class="modal-actions"><button class="button button-primary" data-close-modal="true">Got it</button></div></section>`;
  document.body.append(backdrop);
  backdrop.addEventListener("click", event => { if (event.target === backdrop || event.target.closest("[data-close-modal]")) backdrop.remove(); });
  backdrop.querySelector("[data-close-modal]").focus();
});

loadState().then(() => render()).catch(error => {
  root.innerHTML = `<section class="card card-pad"><h1>Typo could not start</h1><p class="card-subtitle">${escapeHTML(error.message)} Start the local app with <code>npm start</code> and open the address it prints.</p></section>`;
});
