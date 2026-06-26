# Linking `@spattoo/designer` (core) into `apps/app`

`apps/app` consumes the cake designer from `spattoo-core` (`@spattoo/designer`).

## Current (stopgap) — vendored tarball
Turbopack can't resolve a `file:` **symlink** pointing outside the repo root, so we
install core as a **packed tarball** committed at `vendor/spattoo-designer-*.tgz`
(referenced by `apps/app/package.json` → `"@spattoo/designer": "file:../../vendor/..."`).
Real files land in `node_modules`, inside the repo root, which Turbopack resolves fine.

### Regenerate after changing core
```sh
cd <spattoo-core checkout> && npm run build && \
  npm pack --pack-destination=<spattoo-web>/vendor
# then bump the filename in apps/app/package.json if the version changed, and:
cd <spattoo-web> && npm install
```

## Proper fix (decision pending)
Publish `@spattoo/designer` to a registry (npm / GitHub Packages) and depend on it
normally. That removes the vendored tarball and the manual re-pack. Chosen later.

## Notes
- Core ships no `.d.ts`; `apps/app/types/spattoo-designer.d.ts` declares the module.
- Core's React/three are peer deps — `apps/app` provides `react`, `three`,
  `@react-three/fiber`, `@react-three/drei`.
