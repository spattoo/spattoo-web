# Self-hosted web fonts

These are here so the production build never touches the network.

`next/font/google` downloads the face **at build time**. Next 16 builds with Turbopack, and when
that fetch fails inside Vercel's container Turbopack reports it as a module-resolution error rather
than a network one, so the build log blames the code:

```
Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
next/font/google queries have exactly one entry
```

That failed a deploy on 2026-09-22 and again on 2026-10-30. Both times the same commit built clean
locally and the fix was "redeploy without the build cache" — a remedy that needs a human to notice,
which the second occurrence proved, because it sat there blocking an unrelated release.

## What these files are

The **latin** subset only, matching the `subsets: ["latin"]` they replaced, in the **variable**
builds — so the weight ranges declared in `../layout.tsx` are what the axis actually supports.

| file | family | styles |
|---|---|---|
| `geist-latin-var.woff2` | Geist | normal, wght 100–900 |
| `geist-mono-latin-var.woff2` | Geist Mono | normal, wght 100–900 |
| `fraunces-latin-var.woff2` | Fraunces | normal, wght 400–500 |
| `fraunces-latin-italic-var.woff2` | Fraunces | italic, wght 400–500 |

## Licence

Both families are under the **SIL Open Font License 1.1**, which permits redistribution as part of
a larger work:

- Geist — © 2023 Vercel, Inc. — https://github.com/vercel/geist-font
- Fraunces — © 2019 The Fraunces Project Authors — https://github.com/undercasetype/Fraunces

## Replacing or adding a face

Fetch the `latin` block from the Google Fonts CSS2 API with a modern User-Agent (it serves woff2
only to browsers that support it), download that block's `url(...)`, and drop it here. Do **not**
reintroduce `next/font/google`: it puts the network back in the build.
