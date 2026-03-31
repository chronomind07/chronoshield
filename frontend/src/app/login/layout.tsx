import type { Metadata } from "next";

const BASE_URL = "https://chronoshield.eu";

export const metadata: Metadata = {
  title: "Iniciar sesión — ChronoShield",
  description:
    "Accede a tu panel de seguridad ChronoShield. Monitoriza SSL, dark web, uptime y seguridad de email desde un solo panel.",
  alternates: {
    canonical: `${BASE_URL}/login`,
  },
  openGraph: {
    title: "Iniciar sesión — ChronoShield",
    description:
      "Accede a tu panel de seguridad ChronoShield.",
    url: `${BASE_URL}/login`,
    type: "website",
    images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
