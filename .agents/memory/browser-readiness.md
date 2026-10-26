---
name: Calendar browser test readiness
description: Reliable reload checks and physical clickability checks for calendar browser tests.
---

A calendar can render before the browser finishes its initial load. A later load event can therefore satisfy a reload waiter while the old document is still visible, producing intermittent missing controls during the subsequent navigation.

**Why:** A service-management browser check intermittently found the calendar and then lost its always-present management button between evaluations.

**How to apply:** When testing reload persistence, require proof that the document changed as well as the calendar rendering. A load event or a selector that also exists in the previous document is not sufficient on its own.

Programmatic DOM clicks do not prove a calendar control is usable. Check suggestion controls with real, hit-tested pointer actions on short/mobile viewports, including after scrolling their content.

**Why:** A calendar-move check passed using DOM clicks even though the mobile popup placed Add and Skip outside the viewport and scrolled its close button away. Storage assertions alone missed the user-facing failure.

**How to apply:** Verify that Add, Skip and close are visible and hit-test to their own controls, then verify the changed post's visible calendar placement and persistence. Keep control accessibility checks distinct from the planner's data tests.

Persistence test seeds must run only once in an isolated browser context. An unconditional `addInitScript` storage seed reruns on every navigation and can make working saves appear to revert.

**Why:** A Campaign restart check falsely reported lost results and approved posts because the tester restored its original fixture on each reload; the same journey persisted correctly with a one-time seed guard.

**How to apply:** Seed through a one-time setup or a guarded initialization script, and confirm both the new document and the unchanged seed sentinel when verifying reload persistence.