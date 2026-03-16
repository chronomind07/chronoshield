/**
 * ChronoShield — Gmail Content Script
 *
 * Detects email opens, extracts sender + links, injects:
 *  - Colored badge (🟢/🟡/🔴) in Gmail header
 *  - Side alert panel for suspicious/dangerous emails
 */

(function () {
  "use strict";

  // Avoid double-injection
  if (window.__chronoshield_injected) return;
  window.__chronoshield_injected = true;

  // ── State ─────────────────────────────────────────────────────────────────
  let currentMsgId = null;
  let panelEl = null;
  let badgeEl = null;

  // ── Utilities ─────────────────────────────────────────────────────────────

  function extractEmailDomain(email) {
    const m = email.match(/@([\w.-]+)/);
    return m ? m[1].toLowerCase() : null;
  }

  function extractUrls(bodyEl) {
    if (!bodyEl) return [];
    const anchors = bodyEl.querySelectorAll("a[href]");
    const urls = [];
    anchors.forEach((a) => {
      const href = a.href;
      if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
        urls.push(href);
      }
    });
    return [...new Set(urls)].slice(0, 20);
  }

  function getSenderInfo() {
    // Gmail stores sender email in [email] attribute on the sender span
    const senderEl =
      document.querySelector("h3.iw span[email]") ||
      document.querySelector(".gD[email]") ||
      document.querySelector("span[email]");

    if (!senderEl) return null;

    const email = senderEl.getAttribute("email") || "";
    const name = senderEl.getAttribute("name") || senderEl.textContent.trim();
    const domain = extractEmailDomain(email);

    if (!email || !domain) return null;
    return { email, name, domain };
  }

  function getEmailBody() {
    return (
      document.querySelector(".a3s.aiL") ||
      document.querySelector(".a3s") ||
      document.querySelector("[data-message-id] .ii.gt div")
    );
  }

  // ── Message ID detection (to avoid re-analyzing same email) ───────────────

  function getCurrentMsgId() {
    // Gmail URL: mail.google.com/mail/u/0/#inbox/MSGID
    const hash = window.location.hash;
    const m = hash.match(/[#/]([a-f0-9]{16,})/i);
    return m ? m[1] : null;
  }

  // ── Badge injection ───────────────────────────────────────────────────────

  function removeBadge() {
    if (badgeEl) {
      badgeEl.remove();
      badgeEl = null;
    }
  }

  function injectBadge(recommendation, score) {
    removeBadge();

    const configs = {
      safe: { emoji: "🟢", label: "Seguro", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
      suspicious: { emoji: "🟡", label: "Sospechoso", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
      danger: { emoji: "🔴", label: "Peligroso", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
    };
    const cfg = configs[recommendation] || configs.safe;

    badgeEl = document.createElement("div");
    badgeEl.className = "cs-badge";
    badgeEl.innerHTML = `
      <span class="cs-badge-emoji">${cfg.emoji}</span>
      <span class="cs-badge-label">${cfg.label}</span>
      <span class="cs-badge-score">${score}</span>
    `;
    badgeEl.style.cssText = `
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px 3px 6px; border-radius: 20px;
      background: ${cfg.bg}; border: 1px solid ${cfg.color}33;
      color: ${cfg.color}; font-family: 'DM Sans', sans-serif;
      font-size: 12px; font-weight: 600; cursor: pointer;
      margin-left: 10px; vertical-align: middle;
      transition: opacity 0.2s;
    `;

    // Insert after subject line
    const subjectEl =
      document.querySelector("h2.hP") ||
      document.querySelector(".ha h2") ||
      document.querySelector("[data-thread-perm-id] h2");

    if (subjectEl) {
      subjectEl.parentElement.style.position = "relative";
      subjectEl.insertAdjacentElement("afterend", badgeEl);
    } else {
      // Fallback: insert at top of email view
      const emailView =
        document.querySelector(".nH.if") ||
        document.querySelector("[role='main']");
      if (emailView) emailView.prepend(badgeEl);
    }

    badgeEl.addEventListener("click", () => {
      if (panelEl) {
        panelEl.style.display = panelEl.style.display === "none" ? "flex" : "none";
      }
    });
  }

  // ── Side Panel ────────────────────────────────────────────────────────────

  function removePanel() {
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }
  }

  function severityIcon(severity) {
    const icons = {
      critical: "🔴",
      high: "🟠",
      warning: "🟡",
      info: "🔵",
    };
    return icons[severity] || "⚪";
  }

  function severityColor(severity) {
    const colors = {
      critical: "#ef4444",
      high: "#f97316",
      warning: "#f59e0b",
      info: "#60a5fa",
    };
    return colors[severity] || "#9ca3af";
  }

  function injectPanel(data, senderInfo) {
    removePanel();

    const { risk_score, recommendation, signals } = data;

    const headerColors = {
      safe: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", text: "#22c55e", label: "✅ Email Seguro" },
      suspicious: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", text: "#f59e0b", label: "⚠️ Email Sospechoso" },
      danger: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", text: "#ef4444", label: "🚨 Email Peligroso" },
    };
    const hc = headerColors[recommendation] || headerColors.safe;

    const signalRows = signals
      .map(
        (s) => `
        <div class="cs-signal-row" style="border-left: 3px solid ${severityColor(s.severity)};">
          <span class="cs-signal-icon">${severityIcon(s.severity)}</span>
          <span class="cs-signal-msg">${s.message}</span>
        </div>`
      )
      .join("");

    panelEl = document.createElement("div");
    panelEl.className = "cs-panel";
    panelEl.innerHTML = `
      <div class="cs-panel-header" style="background:${hc.bg}; border-bottom: 1px solid ${hc.border};">
        <div class="cs-panel-title-row">
          <span class="cs-panel-title" style="color:${hc.text};">${hc.label}</span>
          <button class="cs-panel-close" title="Cerrar">✕</button>
        </div>
        <div class="cs-panel-meta">
          <span class="cs-meta-item">Remitente: <strong>${senderInfo.email}</strong></span>
          <span class="cs-meta-item">Dominio: <strong>${senderInfo.domain}</strong></span>
          <span class="cs-meta-item">Puntuación de riesgo: <strong style="color:${hc.text};">${risk_score}/100</strong></span>
        </div>
      </div>
      <div class="cs-panel-body">
        ${
          signals.length === 0
            ? `<div class="cs-no-signals">No se detectaron señales de riesgo</div>`
            : `<div class="cs-signals-title">Señales detectadas</div>${signalRows}`
        }
        <div class="cs-panel-footer">
          <button class="cs-btn-deep" id="cs-deep-btn">
            🔬 Análisis profundo (1 crédito)
          </button>
          <div id="cs-deep-result"></div>
        </div>
      </div>
    `;

    document.body.appendChild(panelEl);

    // Close button
    panelEl.querySelector(".cs-panel-close").addEventListener("click", () => {
      panelEl.style.display = "none";
    });

    // Deep analysis button
    panelEl.querySelector("#cs-deep-btn").addEventListener("click", async () => {
      const btn = panelEl.querySelector("#cs-deep-btn");
      const resultEl = panelEl.querySelector("#cs-deep-result");
      btn.disabled = true;
      btn.textContent = "Analizando...";
      resultEl.innerHTML = "";

      try {
        const bodyEl = getEmailBody();
        const urls = extractUrls(bodyEl);

        const deepData = await chrome.runtime.sendMessage({
          type: "ANALYZE_EMAIL_DEEP",
          sender_email: senderInfo.email,
          sender_name: senderInfo.name,
          sender_domain: senderInfo.domain,
          urls,
        });

        if (deepData.error) {
          if (deepData.error === "NO_CREDITS") {
            resultEl.innerHTML = `<div class="cs-deep-error">❌ Sin créditos. <a href="https://chronoshield-production.up.railway.app/dashboard" target="_blank">Comprar créditos →</a></div>`;
          } else if (deepData.error === "NOT_AUTHENTICATED") {
            resultEl.innerHTML = `<div class="cs-deep-error">🔒 Sesión expirada. Abre el popup para volver a iniciar sesión.</div>`;
          } else {
            resultEl.innerHTML = `<div class="cs-deep-error">Error: ${deepData.error}</div>`;
          }
        } else {
          const breachCount = deepData.breaches_found || 0;
          const creditsLeft = deepData.credits_remaining ?? "?";
          if (breachCount > 0) {
            const breachList = (deepData.breach_data || [])
              .slice(0, 5)
              .map((b) => `<li>${b.name || b.domain || JSON.stringify(b)}</li>`)
              .join("");
            resultEl.innerHTML = `
              <div class="cs-deep-result cs-deep-danger">
                <strong>⚠️ ${breachCount} filtraciones en dark web</strong>
                <ul class="cs-breach-list">${breachList}</ul>
                <small>Créditos restantes: ${creditsLeft}</small>
              </div>`;
          } else {
            resultEl.innerHTML = `
              <div class="cs-deep-result cs-deep-safe">
                <strong>✅ Sin filtraciones detectadas</strong>
                <small>Créditos restantes: ${creditsLeft}</small>
              </div>`;
          }
        }
      } catch (err) {
        resultEl.innerHTML = `<div class="cs-deep-error">Error inesperado: ${err.message}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = "🔬 Análisis profundo (1 crédito)";
      }
    });
  }

  // ── Main analysis flow ────────────────────────────────────────────────────

  async function analyzeCurrentEmail() {
    const msgId = getCurrentMsgId();
    if (!msgId || msgId === currentMsgId) return;

    const senderInfo = getSenderInfo();
    if (!senderInfo) return;

    currentMsgId = msgId;

    // Show loading badge
    injectBadge("safe", "...");

    try {
      const bodyEl = getEmailBody();
      const urls = extractUrls(bodyEl);

      const result = await chrome.runtime.sendMessage({
        type: "ANALYZE_EMAIL",
        sender_email: senderInfo.email,
        sender_name: senderInfo.name,
        sender_domain: senderInfo.domain,
        urls,
      });

      if (result.error) {
        // Not authenticated or daily limit — silently remove badge
        removeBadge();
        return;
      }

      injectBadge(result.recommendation, result.risk_score);

      // Auto-show panel for suspicious/dangerous emails
      if (result.recommendation !== "safe" && result.signals.length > 0) {
        injectPanel(result, senderInfo);
      }
    } catch (err) {
      removeBadge();
      console.debug("[ChronoShield] Analysis error:", err);
    }
  }

  // ── Gmail SPA navigation detection ───────────────────────────────────────

  let debounceTimer = null;

  function onNavigate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Reset on navigation away from email
      const msgId = getCurrentMsgId();
      if (!msgId) {
        currentMsgId = null;
        removeBadge();
        removePanel();
        return;
      }
      analyzeCurrentEmail();
    }, 600);
  }

  // hashchange covers most Gmail navigation
  window.addEventListener("hashchange", onNavigate);

  // MutationObserver for cases where hash doesn't change (thread switching)
  const observer = new MutationObserver(() => {
    const msgId = getCurrentMsgId();
    if (msgId && msgId !== currentMsgId) {
      onNavigate();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
  });

  // Initial check (page may load directly on an email)
  setTimeout(analyzeCurrentEmail, 1500);
})();
