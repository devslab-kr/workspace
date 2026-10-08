# Releasing Workspace

The public repository is [devslab-kr/workspace](https://github.com/devslab-kr/workspace). The package is `@devslab/workspace`, licensed under Apache-2.0. A release must preserve the version in `package.json` and its lockfile, pass the complete verification workflow, and pass installed-package checks.

`verify.yml` runs on pushes and pull requests with Node 24.15 or newer, `npm ci`, Chromium, `npm run verify`, and the packed-package verification. Publication uses `publish.yml`, which runs the same checks and a dry run before publishing. Actions are pinned to verified commit IDs. Publication is manual, defaults to verification only, and accepts publishing requests only on `main`.

## Publication identity

Use [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). The workflow uses OIDC only, with `id-token: write` and public provenance enabled. It has no token fallback.

Open npm package Settings → Trusted publishing → GitHub Actions:

| Field | Value |
| --- | --- |
| Organization or user | `devslab-kr` |
| Repository | `workspace` |
| Workflow filename | `publish.yml` |
| Environment name | Leave blank |
| Allowed actions | Enable `npm publish`; `npm stage publish` is automatically allowed |
| Allow npm dist-tag | Not required by this workflow |

Workspace uses **`publish.yml`**, not DDS's `release.yml`. Enter only the filename, without `.github/workflows/`. The publish job does not declare a GitHub Environment.

In Settings → Publishing access, select **Require two-factor authentication and disallow tokens**. This blocks traditional token publication while trusted OIDC publication remains available. Save the trusted publisher first and verify the first OIDC release. New trusted publishers must complete a successful publication within two days; recreate an expired configuration.

Version `0.1.0` is already public, from the initial token publication. A subsequent release must use a new version in package.json and package-lock.json. `npm whoami` and a dry run do not prove that npm accepted a trusted publisher. The proof is a successful new-version publication with matching provenance.

After approval to release this version, dispatch:

```sh
gh workflow run publish.yml --repo devslab-kr/workspace --ref main \
  -f version=0.1.1 -f publish=true
```

The example assumes the next version has been bumped to `0.1.1` and normally merged after verification. Omit `publish=true` for a verification-only run. Verify the public registry version, actual download and provenance after the workflow succeeds, then create the matching GitHub release. This workflow never creates or updates releases in other projects.

## Shared publisher attribution

Both READMEs follow kokey and numkey's document structure. Generate company attribution through the shared site-kit preset rather than editing publisher blocks by hand:

```sh
npm ci --prefix tools/publisher --ignore-scripts
npm run sync --prefix tools/publisher
npm run check --prefix tools/publisher
```
