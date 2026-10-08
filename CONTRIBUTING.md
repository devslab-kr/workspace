# Contributing to Workspace

Use Node 24.15 or newer in the 24.x line.

```sh
npm ci
npx playwright install chromium
npm run verify
node scripts/verify-package.mjs
```

`npm run dev` starts the Solid demo at `http://127.0.0.1:5197`.
Core, framework adapters, SSR output and installed-package behavior have separate checks. Run the checks affected by your change while developing, then the complete verification before a release.

Keep retained state, permission guards, keyboard access and inactive-page focus exclusion consistent across adapters. Apps own their business data, router and subscriptions. Document unsupported integrations rather than claiming verification from source-only tests.

Update both English and Korean READMEs when changing the public API.
README structure follows kokey and numkey: publisher attribution, registry/CI/license badges, language links, installation, usage, API guidance, contributing, related projects and license. Use product assets only after the shared OSS registry defines them.

Publisher blocks are generated, not edited by hand:

```sh
npm ci --prefix tools/publisher --ignore-scripts
npm run sync --prefix tools/publisher
npm run check --prefix tools/publisher
```

Workspace 0.1.1 and later use Apache-2.0. The original 0.1.0 npm release remains MIT. Keep package metadata, LICENSE, NOTICE, README badges and changelog aligned when changing release metadata.

Publication uses GitHub Actions OIDC; follow [docs/releasing.md](docs/releasing.md). Do not add npm publication tokens to the workflow.
