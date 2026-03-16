/**
 * ChronoShield Extension — Popup Script
 *
 * Handles login form, session state display, credits fetch, and logout.
 * Communicates with background.js via chrome.runtime.sendMessage.
 */

const DASHBOARD_URL = "https://chronoshield-production.up.railway.app/dashboard";
const BUY_CREDITS_URL = "https://chronoshield-production.up.railway.app/dashboard/billing";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewLogin = document.getElementById("view-login");
const viewAccount = document.getElementById("view-account");
const inpEmail = document.getElementById("inp-email");
const inpPassword = document.getElementById("inp-password");
const btnLogin = document.getElementById("btn-login");
const loginError = document.getElementById("login-error");
const accountEmail = document.getElementById("account-email");
const creditsValue = document.getElementById("credits-value");
const btnBuy = document.getElementById("btn-buy");
const btnDashboard = document.getElementById("btn-dashboard");
const btnLogout = document.getElementById("btn-logout");

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
  viewLogin.style.display = name === "login" ? "block" : "none";
  viewAccount.style.display = name === "account" ? "block" : "none";
}

function setLoading(loading) {
  btnLogin.disabled = loading;
  btnLogin.innerHTML = loading
    ? `<span class="spinner"></span>Iniciando sesión...`
    : "Iniciar sesión";
}

// ── Fetch credits ─────────────────────────────────────────────────────────────

async function loadCredits() {
  creditsValue.textContent = "…";
  try {
    const res = await send("GET_CREDITS");
    if (res && res.credits_available !== undefined) {
      creditsValue.textContent = res.credits_available;
    } else {
      creditsValue.textContent = "—";
    }
  } catch {
    creditsValue.textContent = "—";
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const state = await send("GET_AUTH_STATE");
  if (state && state.authenticated) {
    accountEmail.textContent = state.email || "Usuario autenticado";
    showView("account");
    loadCredits();
  } else {
    showView("login");
  }
}

// ── Login ──────────────────────────────────────────────────────────────────────

btnLogin.addEventListener("click", async () => {
  hideError();
  const email = inpEmail.value.trim();
  const password = inpPassword.value;

  if (!email || !password) {
    showError("Introduce email y contraseña.");
    return;
  }

  setLoading(true);
  const res = await send("LOGIN", { email, password });

  if (res && res.ok) {
    accountEmail.textContent = res.email || email;
    showView("account");
    loadCredits();
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
  inpEmail.value = "";
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

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
