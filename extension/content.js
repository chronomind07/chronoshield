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

  function shieldSvg(size, color) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 6v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V6L12 2z" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="${color}" stroke-width="1.5"/>
      <path d="M12 9.5V12l1.5 1" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function injectBadge(recommendation, score) {
    removeBadge();

    const configs = {
      safe:       { label: "Seguro",      color: "#4ade80", bg: "rgba(74,222,128,0.09)" },
      suspicious: { label: "Sospechoso",  color: "#fbbf24", bg: "rgba(251,191,36,0.09)" },
      danger:     { label: "Peligroso",   color: "#f87171", bg: "rgba(248,113,113,0.09)" },
    };
    const cfg = configs[recommendation] || configs.safe;

    badgeEl = document.createElement("div");
    badgeEl.className = "cs-badge";
    badgeEl.innerHTML = `
      <span class="cs-badge-icon">${shieldSvg(14, cfg.color)}</span>
      <span class="cs-badge-label">${cfg.label}</span>
      <span class="cs-badge-score">${score}</span>
    `;
    badgeEl.style.cssText = `
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px 3px 7px; border-radius: 20px;
      background: ${cfg.bg}; border: 1px solid ${cfg.color}33;
      color: ${cfg.color}; font-family: 'Plus Jakarta Sans', 'DM Sans', sans-serif;
      font-size: 11.5px; font-weight: 600; cursor: pointer;
      margin-left: 10px; vertical-align: middle;
      animation: cs-badge-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both;
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
    const icons = {
      critical: `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" fill="#f87171" fill-opacity="0.15" stroke="#f87171" stroke-width="1.4"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#f87171" stroke-width="1.4" stroke-linecap="round"/></svg>`,
      high:     `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2.5L13.8 13H2.2L8 2.5z" fill="#fb923c" fill-opacity="0.15" stroke="#fb923c" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.5v3.5" stroke="#fb923c" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.7" fill="#fb923c"/></svg>`,
      warning:  `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2.5L13.8 13H2.2L8 2.5z" fill="#fbbf24" fill-opacity="0.12" stroke="#fbbf24" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.5v3.5" stroke="#fbbf24" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.7" fill="#fbbf24"/></svg>`,
      info:     `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" fill="#60a5fa" fill-opacity="0.1" stroke="#60a5fa" stroke-width="1.4"/><path d="M8 7.5v4" stroke="#60a5fa" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="5.2" r="0.7" fill="#60a5fa"/></svg>`,
    };
    return icons[sev] || icons.info;
  }

  function severityColor(sev) {
    return { critical: "#f87171", high: "#fb923c", warning: "#fbbf24", info: "#60a5fa" }[sev] || "#64748b";
  }

  const SCAN_ICON = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  /** Build the deep-analysis buttons HTML based on whether sender is bulk. */
  function deepButtonsHtml(isBulk) {
    if (isBulk) {
      return `
        <button class="cs-btn-deep" data-mode="email_only">
          ${SCAN_ICON} Analizar email del remitente <span style="opacity:0.6;font-size:10px;">(1 crédito)</span>
        </button>`;
    }
    return `
      <button class="cs-btn-deep" data-mode="email_only">
        ${SCAN_ICON} Analizar email del remitente <span style="opacity:0.6;font-size:10px;">(1 crédito)</span>
      </button>
      <button class="cs-btn-deep cs-btn-deep-full" data-mode="full" style="margin-top:4px;">
        ${SCAN_ICON} Email + dominio <span style="opacity:0.6;font-size:10px;">(2 créditos)</span>
      </button>`;
  }

  /**
   * Build the body content for a SAFE result.
   * Shows "no risks" message + list of checks that passed (didn't fire a signal).
   */
  function safePanelBodyHtml(data) {
    const signalTypes = new Set((data.signals || []).map((s) => s.type));
    const checks = data.checks_performed || [];

    const CHECK_SVG = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#4ade80" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const passedRows = checks
      .filter((key) => {
        const info = CHECK_LABELS[key];
        if (!info) return false;
        // Only show check as "passed" if none of its associated signal types fired
        return !info.types.some((t) => signalTypes.has(t));
      })
      .map((key) => `
        <div class="cs-check-row">
          <span class="cs-check-icon">${CHECK_SVG}</span>
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
      safe:       { bg: "linear-gradient(135deg, rgba(74,222,128,0.09), rgba(0,229,191,0.05))", border: "rgba(74,222,128,0.18)",   text: "#4ade80", label: "Email Seguro" },
      suspicious: { bg: "linear-gradient(135deg, rgba(251,191,36,0.1),  rgba(251,191,36,0.04))", border: "rgba(251,191,36,0.18)",   text: "#fbbf24", label: "Email Sospechoso" },
      danger:     { bg: "linear-gradient(135deg, rgba(248,113,113,0.1), rgba(248,113,113,0.04))", border: "rgba(248,113,113,0.18)", text: "#f87171", label: "Email Peligroso" },
    };
    const hc = headerColors[recommendation] || headerColors.safe;

    // Score ring — ring fills based on risk_score (higher = more risk)
    const CIRC = 125.66;
    const ringColor  = risk_score < 30 ? "#4ade80" : risk_score < 60 ? "#fbbf24" : "#f87171";
    const ringOffset = (CIRC * (1 - risk_score / 100)).toFixed(2);
    const scoreRingHtml = `
      <div class="cs-score-ring-wrap">
        <svg class="cs-score-ring" width="50" height="50" viewBox="0 0 50 50">
          <circle class="cs-score-ring-track" cx="25" cy="25" r="20"/>
          <circle class="cs-score-ring-fill" cx="25" cy="25" r="20"
            stroke="${ringColor}"
            style="stroke-dashoffset:${ringOffset};"/>
          <text class="cs-score-ring-label" x="25" y="23" text-anchor="middle" dominant-baseline="middle">${risk_score}</text>
          <text class="cs-score-ring-sub"   x="25" y="33" text-anchor="middle" dominant-baseline="middle">riesgo</text>
        </svg>
      </div>
    `;

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

    const BRAND_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V6L12 2z" fill="${hc.text}" fill-opacity="0.2" stroke="${hc.text}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="${hc.text}" stroke-width="1.4"/><path d="M12 9.5V12l1.5 1" stroke="${hc.text}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const CLOSE_SVG = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

    panelEl = document.createElement("div");
    panelEl.className = "cs-panel";
    panelEl.innerHTML = `
      <div class="cs-panel-header" style="background:${hc.bg}; border-bottom: 1px solid ${hc.border};">
        <div class="cs-panel-title-row">
          <div class="cs-panel-brand">
            ${BRAND_SVG}
            <span class="cs-panel-title" style="color:${hc.text};">${hc.label}</span>
          </div>
          <button class="cs-panel-close" title="Cerrar">${CLOSE_SVG}</button>
        </div>
        ${scoreRingHtml}
        <div class="cs-panel-meta">
          <span class="cs-meta-item">Remitente: <strong>${senderInfo.email}</strong></span>
          <span class="cs-meta-item">Dominio: <strong>${senderInfo.domain}</strong></span>
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
            resultEl.innerHTML = `<div class="cs-deep-error">Sin créditos disponibles. <a href="https://chronoshield.eu/dashboard/billing" target="_blank">Comprar créditos →</a></div>`;
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
