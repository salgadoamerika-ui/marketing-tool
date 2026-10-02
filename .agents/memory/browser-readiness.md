---
name: Calendar browser test readiness
description: Avoid treating a delayed initial load event as proof that a reload completed.
---

A calendar can render before the browser finishes its initial load. A later load event can therefore satisfy a reload waiter while the old document is still visible, producing intermittent missing controls during the subsequent navigation.

**Why:** A service-management browser check intermittently found the calendar and then lost its always-present management button between evaluations.

**How to apply:** When testing reload persistence, require proof that the document changed as well as the calendar rendering. A load event or a selector that also exists in the previous document is not sufficient on its own.