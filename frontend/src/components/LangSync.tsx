"use client";

/**
 * LangSync — Updates the <html lang="…"> attribute to match the user's
 * stored language preference (cs_lang in localStorage). Runs on every
 * page via the root layout and also reacts to storage events (cross-tab).
 */
import { useEffect } from "react";

export function LangSync() {
  useEffect(() => {
    const apply = () => {
      try {
        const lang = localStorage.getItem("cs_lang");
        if (lang === "en" || lang === "es") {
          document.documentElement.lang = lang;
        }
      } catch {
        // localStorage unavailable (private browsing, etc.) — leave default
      }
    };

    apply();

    // Keep in sync if user changes language in another tab
    window.addEventListener("storage", apply);
    return () => window.removeEventListener("storage", apply);
  }, []);

  return null;
}
