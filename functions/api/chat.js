/* Same-site Cloudflare Pages Function for the existing 3D studio.
   Requires a Workers AI binding called AI in Pages > Settings > Bindings.
   Never expose API credentials in the frontend. */
import worker from "../../ai-worker/src/index.js";

export async function onRequestPost(context) {
  // Reuse the public-studio-only model, input validation and inference.
  const request = context.request;
  const route = new URL(request.url);
  route.pathname = "/chat";
  const proxy = new Request(route.toString(), request);
  const env = { ...context.env, SITE_ORIGIN: "https://donghyun-3d.pages.dev" };
  return worker.fetch(proxy, env);
}

export async function onRequestGet(context) {
  return Response.json({
    ok: Boolean(context.env.AI),
    mode: context.env.AI ? "generative" : "faq",
    scope: "donghyun-3d.pages.dev",
  }, { status: context.env.AI ? 200 : 503, headers: { "cache-control": "no-store" } });
}
