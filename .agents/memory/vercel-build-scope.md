---
name: Vercel build scope
description: Deployment-specific build boundary for the marketing app.
---

Deploy the marketing frontend alone to Vercel, not every artifact in the workspace. Keep Vercel's project root at the repository root so the shared lockfile and workspace catalogs are available.

**Why:** The workspace-wide build includes a design-preview sandbox whose configuration requires PORT even during build. Vercel's static frontend build does not supply that preview-server variable. The dedicated marketing build succeeds without it.

**How to apply:** Preserve a targeted frontend build and output directory. This Vercel deployment is frontend-only; it does not deploy the separate API server. Pin the install/build package-manager version because an overridden unversioned pnpm install command can select an older Vercel default that lacks workspace catalog support.
