---
name: First-run setup intent
description: First-run eligibility, sample-data boundaries, and how setup joins the welcome and calendar entrance.
---

Offer exactly three setup steps after the welcome screen: first Service/Campaign, existing platform choices, and a first post's content type/day. Completion or skipping permanently dismisses setup for that saved workspace. Existing real businesses, user posts, user-configured services, or customized catalogs bypass it.

**Why:** The user wants help for genuinely new users, not an interruption for people who already have data. Automatically persisted demo services must not count as real setup.

New first-run workspaces display no demo businesses or seeded demo posts. Preserve the old demo experience and real saved data for existing workspaces until the separate sample-data cleanup is requested.

**Why:** The user explicitly deferred full sample removal but requires a new user's workspace to begin empty.

The first service's name also names the initial business workspace; “Build my plan” explicitly adds the first move and starting suggestions through the existing engine.

**Why:** The specified three-step flow has no separate business-name question and explicitly asks for starting suggestions on arrival.

**How to apply:** Keep business isolation and the shared post store intact. Show a brief building state after successful saving; only then reveal the monthly calendar and run its one-time left-sliding ripple. Skipping leaves an empty calendar with the existing add-business path available.

One-shot calendar animation must wait for the actual calendar DOM, not only the outer entry shell's ready state.

**Why:** After setup, routing/context updates can mount the calendar after the outer shell's layout effect; an early snapshot finds no chips and silently loses the entrance.

**How to apply:** Attach the initial animation once the first calendar grid is mounted, then stop watching; never make ordinary post mutations retrigger the full entrance.
