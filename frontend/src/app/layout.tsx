import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Syne, Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

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
    default: "ChronoShield – Ciberseguridad para Inmobiliarias",
    template: "%s | ChronoShield",
  },
  description:
    "Protege tu agencia inmobiliaria con monitorización continua: vigilancia de filtraciones, SSL, uptime y seguridad del email. Alertas en tiempo real.",
  keywords: [
    "ciberseguridad inmobiliaria",
    "monitorización seguridad web",
    "filtraciones de datos",
    "SSL monitoring",
    "uptime monitoring",
    "seguridad email SPF DKIM DMARC",
  ],
  authors: [{ name: "ChronoShield", url: BASE_URL }],
  creator: "ChronoShield",
  publisher: "ChronoShield",
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
    title: "ChronoShield – Ciberseguridad para Inmobiliarias",
    description:
      "Monitorización continua de seguridad para agencias inmobiliarias. Detección de filtraciones, SSL, uptime y email security en un solo panel.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ChronoShield – Ciberseguridad para Inmobiliarias",
      },
    ],
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChronoShield – Ciberseguridad para Inmobiliarias",
    description:
      "Monitorización continua de seguridad para agencias inmobiliarias. Detección de filtraciones, SSL, uptime y email security en un solo panel.",
    images: ["/og-image.png"],
    creator: "@chronoshield",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        className={`${dmSans.variable} ${syne.variable} ${dmMono.variable} ${instrumentSerif.variable} ${plusJakartaSans.variable} font-sans bg-[#050507]`}
      >
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
