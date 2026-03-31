import type { Metadata } from "next";

const BASE_URL = "https://chronoshield.eu";

export const metadata: Metadata = {
  title: "Recuperar contraseña — ChronoShield",
  description: "Recupera el acceso a tu cuenta de ChronoShield.",
  alternates: {
    canonical: `${BASE_URL}/forgot-password`,
  },
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
