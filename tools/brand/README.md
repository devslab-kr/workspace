# Canonical Workspace brand snapshot

`node tools/brand/generate.mjs --check` verifies the vendored O13 files against the canonical `checksums.txt`, verifies every compatibility alias byte-for-byte, checks release provenance, and rejects missing or extra files. It needs no dependencies and never redraws the mark.

To refresh, download `workspace.zip` and `SHA256SUMS.txt` from the pinned OSS Brand release in `docs/assets/brand/oss-brand.json`. Verify the ZIP SHA256 before extraction, then import the extracted directory:

```sh
node tools/brand/generate.mjs --source-dir /path/to/extracted/workspace
```

Update the pinned release, source commit, and archive checksum in the import tool only when adopting a new canonical release. The import verifies every extracted canonical file before replacing `docs/assets/brand`.

Canonical filenames are retained. `project-mark*.svg`, `project-lockup.svg`, and top-level `icon-*.png` are exact compatibility aliases. `readme-header.png` is the canonical header; this snapshot has no separate dark README header. The manifest records O13, v0.4.0, source commit, approved colors, and aliases.
