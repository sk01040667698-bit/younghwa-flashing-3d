# Pansooni AI — Cloudflare Workers AI, public site information only

This is an **optional backend** for the existing GitHub Pages site.
The current GitHub Pages site is static and cannot execute a generative LLM itself.

## Configuration (free account only)

1. Use a **Cloudflare Workers Free** account. Do not upgrade to Paid if the goal is zero additional charges. Workers AI Free has a daily free allocation; requests **fail** when exhausted.
2. In a terminal with Node.js, run `cd ai-worker && npx wrangler login` in **your own Cloudflare account**.
3. Deploy with `npx wrangler deploy`. This creates a Worker with an `AI` binding and two approximate rate-limit bindings. Record the returned public `https://...workers.dev` URL.
4. Add that **exact URL** (without a trailing slash) as `window.PANSOONI_AI_ENDPOINT` in the repository root `pansooni-ai-config.js`. GitHub Pages will continue serving the same site; no migration or replacement.
5. Test /health and a chat question from the actual GitHub Pages origin. If the AI backend fails, the existing local site FAQ remains available.

No Cloudflare API keys or user secrets should ever be placed in the public repository.
Use the Workers AI binding `env.AI`, not a browser API token.

## Scope and privacy

- Only public 3D studio product names, publicly exposed selection options and basic usage tips are in the Worker source.
- Do **not** upload internal company files, prices, private production records, quality reports, employee data, financials, or unreleased documents.
- Chat history is limited to four short messages, kept only in the current browser tab. The Worker does not persist chat history or user prompts.
- The AI provider necessarily receives each question and the selected public site snippets. Do not claim this is an entirely local-only design.
- This is **not access-controlled staff infrastructure**. An Origin check and simple per-IP/regional request limits are **not authentication**, can be spoofed by non-browser clients, and cannot strictly cap global usage. For a future confidential-data application, add authenticated access and server-side per-document access checks **before** any retrieval/inference.
- Content security policy and an actual abuse-protection system such as Turnstile/Cloudflare Access can be added before larger staff rollout.
- Cloudflare Free limitations may change. Verify active model and daily usage in Cloudflare dashboard.

## Code

- `src/index.js`: handles `GET /health`, CORS, public-document retrieval, `POST /chat`, and Workers AI inference.
- `wrangler.jsonc`: AI binding, allowed website Origin and two rate limits.
- Frontend `pansooni-ai-config.js`: initially an empty endpoint, so FAQ continues to work until deployment is configured.

**Model:** `@cf/google/gemma-4-26b-a4b-it`. This model was listed as active as of Nov 15 2026. Model availability and pricing can change.
