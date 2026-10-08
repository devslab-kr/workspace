# Releasing Workspace

The public repository is [devslab-kr/workspace](https://github.com/devslab-kr/workspace). The package is `@devslab/workspace`, licensed under MIT. A release must preserve the version in `package.json` and its lockfile, pass the complete verification workflow, and pass installed-package checks.

`verify.yml` runs on pushes and pull requests with Node 24.15 or newer, `npm ci`, Chromium, `npm run verify`, and the packed-package verification. Publication uses `publish.yml`, which runs the same checks and a dry run before publishing. Actions are pinned to verified commit IDs. Publication is manual, defaults to verification only, and accepts publishing requests only on `main`.

## Publication identity

Prefer [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). Configure the package's trusted publisher with organization `devslab-kr`, repository `workspace`, workflow `publish.yml`, no environment, and permission to use `npm publish`. The workflow has `id-token: write` and public provenance enabled. No token is used in trusted mode.

For an initial publication when a trusted publisher is unavailable, an npm administrator can grant the repository access to an existing organization `NPM_TOKEN` or configure a scoped repository secret. Run `auth-check.yml` to confirm secret availability without publishing. It never prints or copies the secret. Since August 2026, bypass-2FA tokens cannot perform [account-identity actions](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/), so a rejected `npm whoami` does not determine publication permission and is not a release gate. Local npm credentials and other repositories' configuration must remain untouched.

After approval to release this version, dispatch:

```sh
gh workflow run publish.yml --repo devslab-kr/workspace --ref main \
  -f version=0.1.0 -f publish=true -f authentication=trusted
```

Use `authentication=token` only for an approved bootstrap publication with a valid CI secret. Omit `publish=true` for a verification-only run. Verify the public registry version and provenance after the workflow succeeds, then create the matching `v0.1.0` GitHub release. This workflow never creates or updates releases in other projects.
