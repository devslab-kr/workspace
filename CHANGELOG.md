# Changelog

## 0.2.0

- **Breaking:** closing the active tab no longer waits for the next screen's `beforeActivate`. After `beforeClose` allows it, the tab leaves at once and its neighbour shows straight away; the neighbour's guard runs afterwards. If it refuses, `close` resolves `denied` and no screen is active; if it throws, `close` rejects with no screen active. If a later `open` or `select` commits, `reset()` runs, or the shown neighbour is closed first, the check no longer applies and `close` resolves `stale`. Before 0.2.0 a refused neighbour kept the closing tab open.
- `createHistoryWorkspace` pushes the neighbour's URL when it shows, before its guard finishes; a refused neighbour's URL stays as the last accepted URL.
- A tab that is reopened while its earlier close is still checking the neighbour gets its own close.
- Solid, React, Vue and Svelte panels show the empty state whenever no screen is active, including while tabs stay open after a refused neighbour. The first remaining tab then stays in the Tab order.
- After a close, focus moves to the shown tab as soon as the closed control disappears, and is not taken from a page the user has already moved into.

## 0.1.2

- Make the default toolbar a continuous tab strip with no gaps between the switcher, tab labels and close controls.
- Use a shared active surface and indicator for tab labels and their close buttons across Solid, React, Vue and Svelte.
- Align the public demo with the package defaults.

## 0.1.1

- Publish with GitHub Actions OIDC only; remove the initial-token fallback.
- Align English and Korean READMEs with the DevsLab OSS format and shared site-kit publisher attribution.
- Add the user-approved blue Workspace Q-line logo, light/dark assets, brand guide and documentation index.
- Change the license to Apache-2.0 for this and future versions. Version 0.1.0 retains its original MIT license.

## 0.1.0

- Initial npm release: framework-independent retained-workspace core, Solid/React/Vue/Svelte adapters, tab shortcuts, open-screen switcher, guards and optional history integration.
- Original license: MIT.
