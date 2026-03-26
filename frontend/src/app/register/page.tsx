"use client";

/**
 * /register → redirects to /login?tab=register
 * The unified auth page handles both login and registration.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login?tab=register");
  }, [router]);
  return null;
}
