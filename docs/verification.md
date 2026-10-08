# Local implementation verification

Verified on 2026-10-08 before consumer migration. The package remains private and unpublished; CI is configured, not claimed to have run on GitHub.

- TypeScript check and browser/server/Svelte package builds passed.
- Core/history and React/Vue SSR tests: 18 passed.
- Playwright desktop/mobile tests: 36 passed, covering retention, fresh reopen, guards, keyboard/IME, custom button events/refs, modal focus, RTL, CSS exclusion and DDS theme mapping; axe checks had no violations.
- `npm run test:adapters`: RetainedPanels native DOM 3 and SSR 3; Svelte adapter and fixture typechecks, SSR and native browser checks passed. The runner starts and closes its own server on an assigned port.
- Demo build passed.
- `node scripts/verify-package.mjs`: clean packed core-only installation without framework/Ark dependencies; selected React/Vue/Solid/Svelte installations and SSR; Solid Chromium hydration preserving DOM nodes and accessibility IDs; compiled packaged Svelte output. All passed.

Reproduce with `npm ci`, install Playwright Chromium, then `npm run verify` and `node scripts/verify-package.mjs`. The CI runtime uses Node 24.15+ to satisfy development-tool engine requirements. Local checks ran on the existing Node 24.12 runtime; the jsdom engine warning was visible.

The synchronous history adapter is optional; asynchronous router loaders remain app-owned. Fixed screen registries are construction-time. Solid `RetainedPanels` supports an app-owned dynamic authorized list without adopting the library controller. Next.js, Nuxt and SvelteKit production integration and external publication have not been verified here.
