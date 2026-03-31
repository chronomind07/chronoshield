"use client";

/**
 * DynamicMeta — Updates document.title and the meta[name="description"] tag
 * client-side when the user's language preference (cs_lang) differs from the
 * server-rendered default (Spanish). This runs after hydration so search
 * crawlers always see the server-rendered Spanish meta; real users who have
 * selected English will see the English title in their browser tab.
 */
import { useEffect } from "react";

interface Props {
  titles:       { es: string; en: string };
  descriptions: { es: string; en: string };
}

export function DynamicMeta({ titles, descriptions }: Props) {
  useEffect(() => {
    const apply = () => {
      try {
        const lang = localStorage.getItem("cs_lang") || "es";
        const title = lang === "en" ? titles.en : titles.es;
        const desc  = lang === "en" ? descriptions.en : descriptions.es;

        document.title = title;

        // Update <meta name="description">
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute("content", desc);

        // Update <meta property="og:title"> and <meta property="og:description">
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute("content", title);
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute("content", desc);
      } catch {
        // localStorage unavailable — leave server defaults
      }
    };

    apply();
  }, [titles, descriptions]);

  return null;
}
