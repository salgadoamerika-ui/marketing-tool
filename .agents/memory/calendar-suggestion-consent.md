---
name: Calendar suggestion consent
description: Product decision about recommendation cards and calendar changes in the marketing tool.
---

New calendar posts proposed by insights must be opt-in. Show the evidence and reason in one compact, action-triggered card, then let the user choose Add or Skip. Skipping must not create a post. Do not silently schedule a suggestion as a side effect of logging a post or its results.

Best-time recommendations should appear only on suggestions that have been approved and added to the calendar. Manually entered posts may contribute performance data, but they are already posted and should not receive a best-time badge.

The popup's recommended post is the next step in the content sequence, not a performance-based recommendation. It can show recorded numbers as context, but it must not require three measured posts or let a conversion-gap finding replace the sequence step. A skipped post should not be treated as a published step.

**Why:** The user replaced an earlier automatic-scheduling flow with an explicit choice after seeing it; they want to retain control without a full-screen interruption. They later corrected a conflation of this popup with the three-post performance rule and clarified that time advice should apply only to approved suggestions, not posts already entered manually.

**How to apply:** This applies to future sequence steps too. Keep existing calendar items unless the user deletes them; do not retroactively remove suggestions that were added under the previous flow. Keep the separate three-post data gate for performance-based learning rules, not for sequence suggestions. Use manual posts as learning evidence where appropriate, but show a best-time badge only on an added suggestion.