---
name: Calendar suggestion consent
description: Product decision about recommendation cards and calendar changes in the marketing tool.
---

New calendar posts proposed by insights must be opt-in. Show the evidence and reason in one compact, action-triggered card, then let the user choose Add or Skip. Skipping must not create a post. Do not silently schedule a suggestion as a side effect of logging a post or its results.

Best-time recommendations should appear only on suggestions that have been approved and added to the calendar. Manually entered posts may contribute performance data, but they are already posted and should not receive a best-time badge.

By default the popup recommends the next step in the content sequence without requiring measured posts; a conversion-gap finding must not replace that step. The user's later flat-post ladder is an explicit exception: after its three-post data gate, it silently adapts ordinary suggestions to retry, refresh the approach, or pace the service monthly. A skipped post should not be treated as a published step.

Conversion-gap feedback belongs in the saved-post results view, separate from that sequence popup. Saving results must leave a detected gap visible rather than silently closing the view. Following the service-pattern rewrite, show no conversion icon or summary before three complete comparable results; the newest measured post carries the current service flag.

**Why:** The user replaced an earlier automatic-scheduling flow with an explicit choice after seeing it; they want to retain control without a full-screen interruption. They later corrected a conflation of this popup with the three-post performance rule and clarified that time advice should apply only to approved suggestions, not posts already entered manually.

The user also reported that conversion gaps were not visibly triggering. Keeping results open makes the assessment and its unmet prerequisites observable without changing the sequence recommendation.

Keep existing calendar items by default. When a popup recalculates the date for the same next-step content and finds an approved, unposted suggestion on another date for the same business and Service or Campaign, offer an explicit move. Only Add moves that existing suggestion in place; preserve its identity. Manual, published, measured, skipped, past, or other-business/offering posts must not be moved. A different source post does not block a date-only move of the same suggested content.

**Why:** The user wants an approved suggestion's old placement removed when the popup proposes an earlier or later date, but only after explicitly choosing Add.

**How to apply:** Keep date changes consent-based; don't silently move or duplicate approved calendar suggestions. Retain the existing boundaries for type-changing updates. Keep the separate three-post data gate for performance-based learning rules, not for sequence suggestions. Use manual posts as learning evidence where appropriate, but show a best-time badge only on an added suggestion.