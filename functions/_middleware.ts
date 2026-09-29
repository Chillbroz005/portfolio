interface MiddlewareContext {
  request: Request;
  next(): Promise<Response>;
}

const PUBLIC_HOST = "suresh-ganesan.pages.dev";
const AUTH_BACKEND = "https://chillbroz005-portfolio.pages.dev";

export async function onRequest({ request, next }: MiddlewareContext): Promise<Response> {
  const url = new URL(request.url);
  let response: Response;

  // Keep the existing D1 sessions and server-only credentials on the original
  // Pages project while the public site uses its new hostname.
  if (url.hostname === PUBLIC_HOST && url.pathname.startsWith("/api/")) {
    const origin = request.headers.get("Origin");
    if (request.method !== "GET" && request.method !== "HEAD" && origin !== url.origin) {
      response = new Response(JSON.stringify({ error: "Request rejected." }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    } else {
      const headers = new Headers(request.headers);
      headers.delete("Host");
      if (origin) headers.set("Origin", AUTH_BACKEND);
      const upstreamUrl = new URL(`${url.pathname}${url.search}`, AUTH_BACKEND);
      response = await fetch(new Request(upstreamUrl, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "manual"
      }));
    }
  } else {
    response = await next();
  }

  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
