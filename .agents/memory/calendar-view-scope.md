---
name: Calendar view scope
description: User requirements for shared calendar data and separate weekly check-in work.
---

Month and Week must display the same business-scoped posts, not maintain separate content or storage. Week navigation uses Monday–Sunday ranges. Preserve the existing Month behavior and Add Post flow when expanding calendar views.

“This month at a glance” and the content-type legend belong only in Month view, not Week view.

Post completion is stored on the shared business post, not in view-only state. Week progress counts actionable saved posts (not seeded display-only sample events), and completion invokes the same sequence-recommendation handler used by the saved-post detail action. The Week check-in’s results entry opens the existing results form for the latest prior-week post missing results.

**Why:** The user explicitly requested a display-only Week view with no new data and no changes to post storage, and specified that the monthly panels are only for Month view.

**How to apply:** Reuse existing posts and forms; test cross-month weeks and business isolation. Weekly insights upload/check-in learning was explicitly reserved for the next phase, so an entry point must not imply that analysis already runs.
