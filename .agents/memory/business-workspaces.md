---
name: Business workspace boundaries
description: Product requirement for complete business-level separation across content and learning.
---

Each business is its own workspace. Its services, posts, performance, airtime balance, insights, and learning stay inside that business. Switching businesses must not carry content, calculations, or open recommendations into the other workspace. Newly created businesses begin without another business's seeded content.

**Why:** The user explicitly requires fully separate, walled-off workspaces, with all service rules calculated per business.

**How to apply:** Treat the business identifier as a required scope for reads, writes, calculations, and transient UI state. When a business changes, only show and act on that business's data.
