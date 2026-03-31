import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Syne, Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { LangSync } from "@/components/LangSync";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const BASE_URL = "https://chronoshield.eu";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "ChronoShield — Plataforma de Ciberseguridad para Negocios",
    template: "%s",
  },
  description:
    "Monitoriza certificados SSL, seguridad de email, brechas en la Dark Web y disponibilidad web. Seguridad automatizada para pequeños negocios y empresas.",
  keywords: [
    "ciberseguridad para negocios",
    "monitorización SSL",
    "seguridad email SPF DKIM DMARC",
    "dark web monitoring",
    "uptime monitoring",
    "filtraciones de datos",
    "cybersecurity platform",
    "security monitoring",
  ],
  authors: [{ name: "ChronoShield", url: BASE_URL }],
  creator: "ChronoShield",
  publisher: "ChronoShield",
  alternates: {
    canonical: BASE_URL,
    languages: {
      "es": BASE_URL,
      "en": BASE_URL,
      "x-default": BASE_URL,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "ChronoShield",
    title: "ChronoShield — Plataforma de Ciberseguridad para Negocios",
    description:
      "Monitoriza certificados SSL, seguridad de email, brechas en la Dark Web y disponibilidad web. Seguridad automatizada para pequeños negocios y empresas.",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "ChronoShield — Plataforma de Ciberseguridad para Negocios",
      },
    ],
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChronoShield — Plataforma de Ciberseguridad para Negocios",
    description:
      "Monitoriza certificados SSL, seguridad de email, brechas en la Dark Web y disponibilidad web. Seguridad automatizada para pequeños negocios y empresas.",
    images: [`${BASE_URL}/og-image.png`],
    creator: "@chronoshield",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        className={`${dmSans.variable} ${syne.variable} ${dmMono.variable} ${instrumentSerif.variable} ${plusJakartaSans.variable} font-sans bg-[#050507]`}
      >
        <LangSync />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#0D1117",
              color: "#F0F4F8",
              border: "1px solid rgba(255,255,255,0.08)",
            },
          }}
        />
      </body>
    </html>
  );
}
