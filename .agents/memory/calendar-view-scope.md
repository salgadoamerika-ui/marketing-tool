---
name: Calendar view scope
description: User requirements for shared calendar data and separate weekly check-in work.
---

Month and Week must display the same business-scoped posts, not maintain separate content or storage. Week navigation uses Monday–Sunday ranges. Preserve the existing Month behavior and Add Post flow when expanding calendar views.

“This month at a glance” and the content-type legend belong only in Month view, not Week view.

Post completion is stored on the shared business post, not in view-only state. Week progress counts actionable saved posts (not seeded display-only sample events), and completion invokes the same sequence-recommendation handler used by the saved-post detail action.

Completing a post must allow both the next content move and one qualifying performance insight to appear independently. Fewer than three measured posts means no trend claim, not no sequence suggestion. Approving or declining the next move must not discard the accompanying performance insight.

**Why:** The user explicitly says sequence recommendations and performance insights are not either/or. Suggestions remain opt-in.

The weekly Upload insights entry must first offer a picker of the active business’s posts from the week before the viewed week. Keep the picker available after saving so several posts can be entered in one sitting, including posts that already have results. Reuse the existing results form and save performance on the post itself: Month, Week, and the learning engine must read the same numbers.

Keep the picker’s business/week context fixed for the open session, even if accepting a recommendation navigates the background calendar.

**Why:** The user requested choosing each post and entering several sets of results in one sitting; a recommendation can navigate the calendar, but must not change which week the open picker is working through.

The separate mid-campaign prompt is per active-business paid post with a positive budget and positive integer run length; a Service/Campaign mode by itself is not enough. Its run starts on the post date, the midpoint is the start date plus `floor(runLength / 2)` days, and its end is start plus `runLength` days (exclusive). Show it only when the midpoint date is in the viewed Monday–Sunday week and today is inside that run; place it after, not instead of, the weekly prompt. Its upload button opens results for that same post.

**Why:** The user explicitly requested a display-only Week view with no new data and no changes to post storage, and specified that the monthly panels are only for Month view.

**How to apply:** Reuse existing posts, forms, and result-saving behavior; test cross-month weeks, business isolation, and shared results between views. Only the picker context is temporary UI state; performance remains on the original post.
