/**
 * ChronoShield Extension — Background Service Worker
 *
 * Responsibilities:
 *  - Supabase Auth: login, logout, token storage, auto-refresh
 *  - Proxy API calls to ChronoShield backend (avoids CORS issues from content scripts)
 *  - Message bus between popup.js and content.js
 */

const SUPABASE_URL = "https://bbnydesmeezzppvhcolp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJibnlkZXNtZWV6enBwdmhjb2xwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzk0ODMsImV4cCI6MjA4ODkxNTQ4M30.CsiV7NvexNICoW3rvQ2yXR2F5pPmd_BN0LBnfsaWvhA";
const API_BASE = "https://chronoshield-production.up.railway.app/api/v1";

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["access_token", "refresh_token", "expires_at", "user_email"], resolve);
  });
}

async function setStoredAuth(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

async function clearStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["access_token", "refresh_token", "expires_at", "user_email"], resolve);
  });
}

async function refreshAccessToken(refreshToken) {
  const resp = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }
  );
  if (!resp.ok) throw new Error("Token refresh failed");
  return resp.json();
}

async function getValidToken() {
  const stored = await getStoredAuth();
  if (!stored.access_token) return null;

  // Check if token needs refresh (refresh 60s before expiry)
  const expiresAt = stored.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);

  if (now < expiresAt - 60) {
    return stored.access_token;
  }

  // Try refresh
  if (stored.refresh_token) {
    try {
      const data = await refreshAccessToken(stored.refresh_token);
      await setStoredAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: now + data.expires_in,
        user_email: stored.user_email,
      });
      return data.access_token;
    } catch {
      await clearStoredAuth();
      return null;
    }
  }

  return null;
}

// ── API call helper ───────────────────────────────────────────────────────────

async function callApi(method, path, body = null) {
  const token = await getValidToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");

  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(`${API_BASE}${path}`, opts);

  if (resp.status === 402) {
    throw new Error("NO_CREDITS");
  }
  if (resp.status === 429) {
    throw new Error("DAILY_LIMIT");
  }
  if (!resp.ok) {
    throw new Error(`API_ERROR_${resp.status}`);
  }

  return resp.json();
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    // ── Auth ──────────────────────────────────────────────────────────────────
    case "LOGIN": {
      const { email, password } = message;
      const resp = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email, password }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error_description || err.msg || "Login failed");
      }
      const data = await resp.json();
      const now = Math.floor(Date.now() / 1000);
      await setStoredAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: now + data.expires_in,
        user_email: email,
      });
      return { ok: true, email };
    }

    case "LOGOUT": {
      await clearStoredAuth();
      return { ok: true };
    }

    case "GET_AUTH_STATE": {
      const token = await getValidToken();
      const stored = await getStoredAuth();
      return { authenticated: !!token, email: stored.user_email || null };
    }

    // ── Credits ───────────────────────────────────────────────────────────────
    case "GET_CREDITS": {
      const data = await callApi("GET", "/credits");
      return data;
    }

    // ── Level-1 analysis (free) ───────────────────────────────────────────────
    case "ANALYZE_EMAIL": {
      const { sender_email, sender_name, sender_domain, urls } = message;
      const data = await callApi("POST", "/extension/analyze", {
        sender_email,
        sender_name,
        sender_domain,
        urls: urls || [],
      });
      return data;
    }

    // ── Level-2 deep analysis (1 credit) ──────────────────────────────────────
    case "ANALYZE_EMAIL_DEEP": {
      const { sender_email, sender_name, sender_domain, urls } = message;
      const data = await callApi("POST", "/extension/analyze-deep", {
        sender_email,
        sender_name,
        sender_domain,
        urls: urls || [],
      });
      return data;
    }

    default:
      throw new Error("UNKNOWN_MESSAGE_TYPE");
  }
}
