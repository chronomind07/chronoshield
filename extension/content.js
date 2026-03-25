/**
 * ChronoShield — Gmail Content Script
 *
 * Detects email opens, extracts sender + links, injects:
 *  - Colored badge (🟢/🟡/🔴) in Gmail header — always clickable to toggle panel
 *  - Side panel for ALL emails (auto-shown for suspicious/danger, hidden for safe)
 */

(function () {
  "use strict";

  // Avoid double-injection
  if (window.__chronoshield_injected) return;
  window.__chronoshield_injected = true;

  // ── Constants ─────────────────────────────────────────────────────────────

  const BULK_EMAIL_DOMAINS = new Set([
    "gmail.com", "googlemail.com",
    "outlook.com", "hotmail.com", "hotmail.es", "live.com", "msn.com",
    "yahoo.com", "yahoo.es",
    "icloud.com", "me.com",
    "aol.com",
    "protonmail.com", "proton.me",
    "zoho.com",
    "gmx.com", "mail.com",
    "yandex.com",
  ]);

  // Maps backend check key → human label + signal types that would disqualify it
  const CHECK_LABELS = {
    spf_dmarc:      { label: "SPF y DMARC verificados",                    types: ["spf_missing", "dmarc_missing", "domain_not_found", "spf_error"] },
    domain_age:     { label: "Dominio con antigüedad verificada",           types: ["new_domain", "young_domain"] },
    typosquatting:  { label: "Sin typosquatting detectado",                 types: ["typosquatting"] },
    risky_tlds:     { label: "URLs sin TLDs de alto riesgo",                types: ["risky_tld"] },
    brand_spoofing: { label: "Sin suplantación de marcas en URLs",          types: ["brand_spoofing"] },
    http_urls:      { label: "Todos los enlaces usan HTTPS",                types: ["http_no_tls"] },
    ip_urls:        { label: "Sin URLs con IPs directas",                   types: ["ip_url"] },
    sender_tld:     { label: "Dominio del remitente sin TLD de riesgo",     types: ["risky_sender_tld"] },
    safe_browsing:  { label: "URLs verificadas con Google Safe Browsing",   types: ["malicious_url"] },
  };

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

  // ── Message ID detection ──────────────────────────────────────────────────

  function getCurrentMsgId() {
    const hash = window.location.hash;
    const m = hash.match(/[#/]([A-Za-z0-9_-]{16,})/);
    return m ? m[1] : null;
  }

  // ── Badge ─────────────────────────────────────────────────────────────────

  function removeBadge() {
    if (badgeEl) { badgeEl.remove(); badgeEl = null; }
  }

  function injectBadge(recommendation, score) {
    removeBadge();

    const configs = {
      safe:       { emoji: "🟢", label: "Seguro",      color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
      suspicious: { emoji: "🟡", label: "Sospechoso",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
      danger:     { emoji: "🔴", label: "Peligroso",   color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
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

    const subjectEl =
      document.querySelector("h2.hP") ||
      document.querySelector(".ha h2") ||
      document.querySelector("[data-thread-perm-id] h2");

    if (subjectEl) {
      subjectEl.parentElement.style.position = "relative";
      subjectEl.insertAdjacentElement("afterend", badgeEl);
    } else {
      const emailView =
        document.querySelector(".nH.if") ||
        document.querySelector("[role='main']");
      if (emailView) emailView.prepend(badgeEl);
    }

    // Badge click: toggle panel (panel always exists after analysis)
    badgeEl.addEventListener("click", () => {
      if (panelEl) {
        panelEl.style.display = panelEl.style.display === "none" ? "flex" : "none";
      }
    });
  }

  // ── Side Panel ────────────────────────────────────────────────────────────

  function removePanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
  }

  function severityIcon(sev) {
    return { critical: "🔴", high: "🟠", warning: "🟡", info: "🔵" }[sev] || "⚪";
  }

  function severityColor(sev) {
    return { critical: "#ef4444", high: "#f97316", warning: "#f59e0b", info: "#60a5fa" }[sev] || "#9ca3af";
  }

  /** Build the deep-analysis buttons HTML based on whether sender is bulk. */
  function deepButtonsHtml(isBulk) {
    if (isBulk) {
      return `
        <button class="cs-btn-deep" data-mode="email_only">
          🔬 Analizar email del remitente (1 crédito)
        </button>`;
    }
    return `
      <button class="cs-btn-deep" data-mode="email_only">
        🔬 Analizar email del remitente (1 crédito)
      </button>
      <button class="cs-btn-deep cs-btn-deep-full" data-mode="full" style="margin-top:4px;">
        🔬 Analizar email + dominio (2 créditos)
      </button>`;
  }

  /**
   * Build the body content for a SAFE result.
   * Shows "no risks" message + list of checks that passed (didn't fire a signal).
   */
  function safePanelBodyHtml(data) {
    const signalTypes = new Set((data.signals || []).map((s) => s.type));
    const checks = data.checks_performed || [];

    const passedRows = checks
      .filter((key) => {
        const info = CHECK_LABELS[key];
        if (!info) return false;
        // Only show check as "passed" if none of its associated signal types fired
        return !info.types.some((t) => signalTypes.has(t));
      })
      .map((key) => `
        <div class="cs-check-row">
          <span class="cs-check-icon">✓</span>
          <span class="cs-check-label">${CHECK_LABELS[key].label}</span>
        </div>`)
      .join("");

    return `
      <div class="cs-no-signals">No se detectaron riesgos en este email</div>
      ${passedRows ? `<div class="cs-signals-title" style="margin-top:10px;">Verificaciones realizadas</div>${passedRows}` : ""}
    `;
  }

  /**
   * Inject the side panel.
   * @param {object}  data        - API response from /analyze
   * @param {object}  senderInfo  - { email, name, domain }
   * @param {boolean} autoShow    - true = visible immediately; false = hidden until badge click
   */
  function injectPanel(data, senderInfo, autoShow) {
    removePanel();

    const { risk_score, recommendation, signals } = data;
    const isBulk = BULK_EMAIL_DOMAINS.has(senderInfo.domain.toLowerCase());

    const headerColors = {
      safe:       { bg: "rgba(34,197,94,0.08)",    border: "rgba(34,197,94,0.2)",    text: "#22c55e", label: "✅ Email Seguro" },
      suspicious: { bg: "rgba(245,158,11,0.08)",   border: "rgba(245,158,11,0.2)",   text: "#f59e0b", label: "⚠️ Email Sospechoso" },
      danger:     { bg: "rgba(239,68,68,0.08)",    border: "rgba(239,68,68,0.2)",    text: "#ef4444", label: "🚨 Email Peligroso" },
    };
    const hc = headerColors[recommendation] || headerColors.safe;

    // Body: safe gets checks-passed list; others get signal rows
    let bodyContent;
    if (recommendation === "safe") {
      bodyContent = safePanelBodyHtml(data);
    } else {
      const signalRows = signals
        .map((s) => `
          <div class="cs-signal-row" style="border-left: 3px solid ${severityColor(s.severity)};">
            <span class="cs-signal-icon">${severityIcon(s.severity)}</span>
            <span class="cs-signal-msg">${s.message}</span>
          </div>`)
        .join("");
      bodyContent = signals.length === 0
        ? `<div class="cs-no-signals">No se detectaron señales de riesgo</div>`
        : `<div class="cs-signals-title">Señales detectadas</div>${signalRows}`;
    }

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
        ${bodyContent}
        <div class="cs-panel-footer">
          <div id="cs-deep-buttons">${deepButtonsHtml(isBulk)}</div>
          <div id="cs-deep-result"></div>
        </div>
      </div>
    `;

    // Safe emails start hidden; suspicious/danger start visible
    panelEl.style.display = autoShow ? "flex" : "none";

    document.body.appendChild(panelEl);

    // Close button
    panelEl.querySelector(".cs-panel-close").addEventListener("click", () => {
      panelEl.style.display = "none";
    });

    // ── Deep analysis click handler ─────────────────────────────────────────
    panelEl.querySelector("#cs-deep-buttons").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-mode]");
      if (!btn) return;

      const mode = btn.dataset.mode; // "email_only" | "full"
      const buttonsEl = panelEl.querySelector("#cs-deep-buttons");
      const resultEl  = panelEl.querySelector("#cs-deep-result");

      // Disable all buttons and show loading state
      buttonsEl.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      btn.textContent = "Analizando...";
      resultEl.innerHTML = "";

      try {
        const bodyEl = getEmailBody();
        const urls   = extractUrls(bodyEl);
        const msgType = mode === "full" ? "ANALYZE_EMAIL_DEEP_FULL" : "ANALYZE_EMAIL_DEEP";

        const deepData = await chrome.runtime.sendMessage({
          type: msgType,
          sender_email:  senderInfo.email,
          sender_name:   senderInfo.name,
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
          const emailBreaches  = deepData.email_breaches  || 0;
          const domainBreaches = deepData.domain_breaches || 0;
          const totalBreaches  = deepData.breaches_found  || 0;
          const creditsLeft    = deepData.credits_remaining ?? "?";
          const scanNote       = deepData.scan_note || "";

          const noteHtml = scanNote
            ? `<small class="cs-scan-note">${scanNote}</small>`
            : "";

          if (totalBreaches > 0) {
            const lines = [];
            if (emailBreaches > 0) {
              lines.push(`⚠️ <strong>${emailBreaches}</strong> filtraci${emailBreaches === 1 ? "ón" : "ones"} del email <em>${senderInfo.email}</em>`);
            }
            if (domainBreaches > 0) {
              lines.push(`⚠️ <strong>${domainBreaches}</strong> filtraci${domainBreaches === 1 ? "ón" : "ones"} del dominio <em>${senderInfo.domain}</em>`);
            }
            const breachList = (deepData.breach_data || [])
              .slice(0, 5)
              .map((b) => `<li>${b.name || b.domain || b.email || JSON.stringify(b)}</li>`)
              .join("");
            resultEl.innerHTML = `
              <div class="cs-deep-result cs-deep-danger">
                ${lines.map((l) => `<div>${l}</div>`).join("")}
                <ul class="cs-breach-list">${breachList}</ul>
                <small>Créditos restantes: ${creditsLeft}</small>
                ${noteHtml}
              </div>`;
          } else {
            resultEl.innerHTML = `
              <div class="cs-deep-result cs-deep-safe">
                <strong>✅ Sin filtraciones detectadas</strong>
                <small>Créditos restantes: ${creditsLeft}</small>
                ${noteHtml}
              </div>`;
          }
        }
      } catch (err) {
        resultEl.innerHTML = `<div class="cs-deep-error">Error inesperado: ${err.message}</div>`;
      } finally {
        // Restore buttons
        buttonsEl.innerHTML = deepButtonsHtml(isBulk);
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
      const urls   = extractUrls(bodyEl);

      const result = await chrome.runtime.sendMessage({
        type:          "ANALYZE_EMAIL",
        sender_email:  senderInfo.email,
        sender_name:   senderInfo.name,
        sender_domain: senderInfo.domain,
        urls,
      });

      if (result.error) {
        removeBadge();
        return;
      }

      injectBadge(result.recommendation, result.risk_score);

      // Always create the panel; auto-show only for suspicious/danger
      const autoShow = result.recommendation !== "safe";
      injectPanel(result, senderInfo, autoShow);

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

  window.addEventListener("hashchange", onNavigate);

  const observer = new MutationObserver(() => {
    const msgId = getCurrentMsgId();
    if (msgId && msgId !== currentMsgId) onNavigate();
  });

  observer.observe(document.body, { childList: true, subtree: true, attributes: false });

  setTimeout(analyzeCurrentEmail, 1500);
})();
