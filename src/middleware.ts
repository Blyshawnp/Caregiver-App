import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function isPublicAsset(pathname: string) {
  return (
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    pathname === "/apple-touch-icon.png" ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/") ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|css|txt|xml)$/)
  );
}

function isPublicRoute(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/accept-invite")
  );
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Critical for PWA, Bubblewrap, icons, service worker, and Android asset links.
  // These must stay publicly accessible without Supabase login.
  if (isPublicAsset(path)) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|manifest.json|sw.js|.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|css|txt|xml)$).*)",
  ],
};