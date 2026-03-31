import type { Metadata } from "next";

const BASE_URL = "https://chronoshield.eu";

export const metadata: Metadata = {
  title: "Nueva contraseña — ChronoShield",
  description: "Establece una nueva contraseña para tu cuenta de ChronoShield.",
  alternates: {
    canonical: `${BASE_URL}/reset-password`,
  },
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
