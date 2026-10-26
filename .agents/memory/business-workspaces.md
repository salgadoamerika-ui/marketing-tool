---
name: Business workspace boundaries
description: Product requirement for complete business-level separation across content and learning.
---

Each business is its own workspace. Its services, posts, performance, airtime balance, insights, and learning stay inside that business. Switching businesses must not carry content, calculations, or open recommendations into the other workspace. Newly created businesses begin without another business's seeded content.

**Why:** The user explicitly requires fully separate, walled-off workspaces, with all service rules calculated per business.

**How to apply:** Treat the business identifier as a required scope for reads, writes, calculations, and transient UI state. When a business changes, only show and act on that business's data.

Businesses can be renamed or deleted after creation. A rename changes only the business name, not service names or identifiers. Deletion requires explicit confirmation and removes that business's services, posts/results, notifications, settings, and learning while leaving every other business intact.

**Why:** The user explicitly requires post-creation rename/delete controls and reiterated that business names and service names are different things.

Expose business actions through a right-click menu on the business name/tab with exactly “Edit” and “Delete”; do not add a separate “Manage business” button. Selecting Delete opens the existing confirmation, never immediate deletion.

**Why:** The user explicitly rejected the standalone management button and requested the context menu instead.
