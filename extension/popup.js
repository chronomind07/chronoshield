/**
 * ChronoShield Extension — Popup Script
 *
 * Handles login form, session state display, credits fetch, and logout.
 * Communicates with background.js via chrome.runtime.sendMessage.
 */

const DASHBOARD_URL   = "https://chronoshield.eu/dashboard";
const BUY_CREDITS_URL = "https://chronoshield.eu/dashboard/billing";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewLogin    = document.getElementById("view-login");
const viewAccount  = document.getElementById("view-account");
const viewSettings = document.getElementById("view-settings");

const inpEmail    = document.getElementById("inp-email");
const inpPassword = document.getElementById("inp-password");
const btnLogin    = document.getElementById("btn-login");
const loginError  = document.getElementById("login-error");

const accountEmail = document.getElementById("account-email");
const creditsValue = document.getElementById("credits-value");
const emailsToday  = document.getElementById("emails-today");
const userAvatar   = document.getElementById("user-avatar");

const btnBuy       = document.getElementById("btn-buy");
const btnDashboard = document.getElementById("btn-dashboard");
const btnLogout    = document.getElementById("btn-logout");
const btnSettings  = document.getElementById("btn-settings");

const btnBack    = document.getElementById("btn-back");
const toggleAuto = document.getElementById("toggle-auto");
const selectLang = document.getElementById("select-lang");

// ── State ─────────────────────────────────────────────────────────────────────
let prevView = "account";

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(type, extra = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...extra }, resolve);
  });
}

function showError(msg) {
  loginError.textContent = msg;
  loginError.style.display = "block";
}

function hideError() {
  loginError.style.display = "none";
}

function showView(name) {
  viewLogin.style.display    = name === "login"    ? "block" : "none";
  viewAccount.style.display  = name === "account"  ? "block" : "none";
  viewSettings.style.display = name === "settings" ? "block" : "none";
}

function setLoading(loading) {
  btnLogin.disabled = loading;
  btnLogin.innerHTML = loading
    ? `<span class="spinner"></span>Iniciando sesión...`
    : "Iniciar sesión";
}

function setAvatarFromEmail(email) {
  if (!userAvatar) return;
  userAvatar.textContent = (email || "U").charAt(0).toUpperCase();
}

// ── Fetch credits ─────────────────────────────────────────────────────────────

async function loadCredits() {
  if (!creditsValue) return;
  creditsValue.textContent = "…";
  try {
    const res = await send("GET_CREDITS");
    creditsValue.textContent =
      res && res.credits_available !== undefined ? res.credits_available : "—";
  } catch {
    creditsValue.textContent = "—";
  }
}

// ── Fetch emails analyzed today ───────────────────────────────────────────────

async function loadEmailsToday() {
  if (!emailsToday) return;
  try {
    const stored = await chrome.storage.local.get("emails_analyzed_today");
    emailsToday.textContent = stored.emails_analyzed_today ?? 0;
  } catch {
    emailsToday.textContent = "0";
  }
}

// ── Load settings from storage ────────────────────────────────────────────────

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(["auto_analysis", "lang"]);
    if (toggleAuto) toggleAuto.checked = stored.auto_analysis !== false; // default true
    if (selectLang) selectLang.value   = stored.lang || "es";
  } catch {
    // ignore
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const state = await send("GET_AUTH_STATE");
  if (state && state.authenticated) {
    const email = state.email || "Usuario autenticado";
    accountEmail.textContent = email;
    setAvatarFromEmail(email);
    showView("account");
    loadCredits();
    loadEmailsToday();
    loadSettings();
  } else {
    showView("login");
  }
}

// ── Login ──────────────────────────────────────────────────────────────────────

btnLogin.addEventListener("click", async () => {
  hideError();
  const email    = inpEmail.value.trim();
  const password = inpPassword.value;

  if (!email || !password) {
    showError("Introduce email y contraseña.");
    return;
  }

  setLoading(true);
  const res = await send("LOGIN", { email, password });

  if (res && res.ok) {
    const userEmail = res.email || email;
    accountEmail.textContent = userEmail;
    setAvatarFromEmail(userEmail);
    showView("account");
    loadCredits();
    loadEmailsToday();
    loadSettings();
  } else {
    showError(res?.error || "Email o contraseña incorrectos.");
  }
  setLoading(false);
});

// Allow Enter key in password field
inpPassword.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLogin.click();
});

// ── Logout ────────────────────────────────────────────────────────────────────

btnLogout.addEventListener("click", async () => {
  await send("LOGOUT");
  inpEmail.value    = "";
  inpPassword.value = "";
  showView("login");
});

// ── Buy credits ───────────────────────────────────────────────────────────────

btnBuy.addEventListener("click", () => {
  chrome.tabs.create({ url: BUY_CREDITS_URL });
});

// ── Dashboard link ────────────────────────────────────────────────────────────

btnDashboard.addEventListener("click", () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

// ── Settings panel ────────────────────────────────────────────────────────────

btnSettings.addEventListener("click", () => {
  prevView = "account";
  loadSettings();
  showView("settings");
});

btnBack.addEventListener("click", () => {
  showView(prevView);
});

toggleAuto.addEventListener("change", () => {
  chrome.storage.local.set({ auto_analysis: toggleAuto.checked });
});

selectLang.addEventListener("change", () => {
  chrome.storage.local.set({ lang: selectLang.value });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
