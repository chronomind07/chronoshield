import type { Metadata } from "next";

const BASE_URL = "https://chronoshield.eu";

export const metadata: Metadata = {
  title: "Crear cuenta — ChronoShield",
  description:
    "Crea tu cuenta en ChronoShield y empieza a proteger tu empresa con monitorización continua de SSL, dark web, uptime y seguridad de email.",
  alternates: {
    canonical: `${BASE_URL}/register`,
  },
  openGraph: {
    title: "Crear cuenta — ChronoShield",
    description:
      "Crea tu cuenta y empieza a proteger tu empresa con ChronoShield.",
    url: `${BASE_URL}/register`,
    type: "website",
    images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
