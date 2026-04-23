import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── /admin protection ────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "superadmin"].includes(profile.role ?? "")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // ── /dashboard/* protection ──────────────────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    // Must be logged in
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Must have an active paid plan — redirect to /select-plan otherwise
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .single();

    const PAID_PLANS = ["starter", "business", "enterprise"];
    const hasPaidPlan =
      sub &&
      PAID_PLANS.includes(sub.plan ?? "") &&
      sub.status === "active";

    if (!hasPaidPlan) {
      return NextResponse.redirect(new URL("/select-plan", request.url));
    }

    return response;
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/dashboard"],
};
