"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { TRANSLATIONS, Lang } from "@/lib/translations";

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "es",
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem("cs_lang") as Lang | null;
      if (saved === "en" || saved === "es") setLangState(saved);
    } catch {
      // localStorage not available (SSR) — keep default
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("cs_lang", l);
    } catch {
      // silent
    }
  };

  const t = (key: string): string => {
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS["es"]?.[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
