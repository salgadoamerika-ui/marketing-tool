# The Content Strategy Playbook
### The brain of the adaptive marketing tool — v0.7 (draft spec)

This is the working spec for the tool. It captures two things at once: the **marketing logic** (how promotion should run) and the **engine logic** (how the tool thinks). Read it, poke holes in it, mark what's wrong — it's meant to be revised.

---

## 1. What the tool actually is

An **adaptive marketing strategist**. You bring a service and your first move; it tells you the next right move — and it gets smarter the longer you use it.

It is *not* a live tracker that spies on your accounts, and *not* a rigid 30-day plan you fall off of by day 3. You enter what you did, it plots the path from there, you check things off, and what you skip teaches it.

## 1a. The structure: BUSINESSES → PROJECTS → timeline

The full hierarchy, top to bottom:

**Welcome screen → Home screen (= the monthly calendar, with business tabs) → switch businesses via tabs → Month/Week views → the timeline of to-dos.**

### Businesses = separate tabs (like Excel sheets)

A user may run **more than one business**. Without separation, all their to-dos pile into one overstimulating wall. So each business gets its **own tab / own calendar** — like sheets in Excel. You only ever *work* inside one business at a time; everything else disappears while you're in that tab.

Each business is a **fully walled-off world**: its own airtime math, its own weekly heartbeat, its own learning, **zero bleed** between businesses. This matters because the smartest rules (airtime allocation §8b, the heartbeat sweeping across a business's services, campaign-vs-evergreen coexistence §8g) only work *within* a single business — they're about balancing *that business's* week.

### The home screen is the monthly calendar

**Design decision:** rather than a separate condensed triage screen, the **monthly calendar view *is* the home screen.** After the welcome, the user lands directly on the monthly calendar for their first business, with the **business tabs across the top** for switching. Multi-business navigation happens through the tabs, not a separate dashboard layer.

- **Switching businesses** = clicking a tab. Each tab loads that business's own walled-off world (its calendar, its projects, its heartbeat).
- **The monthly view** carries a sidebar ("this month at a glance" + the weekly check-in / upload insights) so the triage information still surfaces — just folded into the calendar rather than living on its own screen.
- **The weekly view** is the zoomed-in work view, reached via the Month/Week toggle.

> Why this is cleaner: fewer screens, and the tabs already provide multi-business switching without a separate triage layer. The calendar is both the overview and the workspace.

## 1b. The core unit inside a business: PROJECTS

Within a business, the **projects** are the services/offerings — one adaptive thread each. Tax, divorce, immigration all live *inside* one business's tab as parallel threads (they are **not** split onto separate tabs — that would fragment the airtime/portfolio logic, which needs to see all of a business's services together to divide the week between them).

The tool runs each project as its **own independent adaptive thread**: its own content, its own uploads, its own learned audience.

Every project carries **one flag** that determines how it behaves:

- **Has-deadline** → runs the *campaign arc* (builds toward a moment, ends in "last chance," then closes). Example: summer camp enrollment.
- **Evergreen** → runs a *sustained rhythm* (no finish line, steady visibility and booking drip). Example: income tax, divorce, insurance, immigration — the things the business always does.

> This is the key architectural insight: it's **not** "campaign mode vs. evergreen mode" as two separate machines. It's one machine running **projects**, and the only difference is whether a project has an end date pulling it forward. The adaptive brain (§8) is shared and universal across every project. Only the *front half* — how the next move is chosen — reads the deadline flag.

A multi-service business runs **several projects in parallel** (Monday: tax post → its thread adapts; Tuesday: divorce post → its thread adapts; etc.). The tool personalizes **per service, not just per business** — because a multi-service business's audiences barely overlap. What works for the tax audience ("show the refund amounts") is a different lesson than what works for the divorce audience.

## 1c. Services and platforms are user-extensible (system-wide)

The tool ships with sensible defaults (the user's known services; FB / Instagram / TikTok), but **the user can add a new service or a new platform at any time** — and doing so **registers it across the whole system**, not just the one form. "Add it once, it's everywhere."

**Adding a new service** creates a first-class **project**:
- Gets its own adaptive thread (own content, uploads, learned audience).
- Appears in every future add-post as a selectable service.
- Gets its own content-type color on the calendars.
- Joins **airtime allocation** (§8b) — it now competes for the week under the same season/attention/floor rules.
- Gets swept into the **weekly heartbeat** and the home-screen triage.
- Starts accumulating its own learning from turn one.

**Adding a new platform** makes it a first-class channel:
- Available in the platform multi-select everywhere.
- Joins **per-service platform mapping** (§8d) — the engine begins learning whether *each service's* audience responds there, exactly as it does for the defaults.

> Why this matters: a tool meant to scale to *other businesses* can't assume it knows everyone's services or channels. A fixed dropdown would break the first time a business offers something unlisted. The "+ Add new" escape hatch on every service/platform selector — wired to register the entity system-wide — is what lets the tool fit any business, not just the one it was designed around.

## 2. The three stages of the tool's intelligence

**Stage 1 — Cold start.** New user, no history. Runs on a general marketing playbook: proven best practices (follow-up timing, boost windows, cross-posting rhythm, good posting times). Everyone starts here.

**Stage 2 — Personalization.** As the user logs content and uploads results, the tool learns *their* behavior and *their audience's* responses. Generic rules give way to what actually works for this specific business.

**Stage 3 — Diversification.** Once it knows what works, it branches out — suggesting new angles, formats, and channels based on where this audience actually responds. Assistant becomes strategist.

> Design principle: **audience response**, not just whether you checked the box, is what should drive adaptation. That's the difference between "learns your habits" and "learns your market."

## 3. Content types (this user's taxonomy)

These are action-oriented — mostly about getting someone to take a step, which points to a service / program / membership business (summer camp is the running example).

- **Launch / Announcement** — "here's something new."
- **Enroll Now / Book Now** — direct call to action; get them to commit.
- **Take a Look Inside** — behind-the-scenes; show the experience up close.
- **Pricing Update** — inform about cost, plans, deals; often the urgency nudge.

**The bundling tension:** sometimes you post one "do it all" piece (announce + look-inside + enroll, all at once). But you often prefer to *separate* them, because one focused idea lands harder than four jumbled together.

→ So one of the tool's core jobs is to **unbundle**: you throw in the big idea, it spreads it across a paced sequence so each beat gets room to breathe. Unbundling is the discipline people know they should do but skip because it's more work in the moment. The tool removes that friction.

## 4. How input works

You give the tool **goal + context + your first move** at the same time:

> "I'm launching my summer program. Here's step 1 — the announcement I just posted."

So it's **goal-aware but step-driven**: it always knows the destination, but only ever tells you the *next* move based on what you've actually done. Responsive, not rigid.

**On entry, it must ask which platforms** the step went out on (FB / Instagram / TikTok — all or some), because every downstream move depends on where you already are.

## 5. The campaign arc (summer camp launch — reference sequence)

| Beat | Move | Timing | Type |
|---|---|---|---|
| 1 | **Announce** — big news drop. Tool asks: which platforms? | Day 1 | Time-driven |
| 2 | **Look Inside + Book Now** — show the camp, soft CTA | Day 2 | Time-driven |
| 3 | **Listen** — let views/reactions come in; watch what resonates. *(Upload insights via screenshot.)* | No fixed length — waits for signal | **Data-gated** |
| 4 | **Adapt + Push** — based on what the data shows, adjust content toward what's working; push enrollment + pricing | After signal | **Data-gated** |
| 5 | **Last Chance** — urgency close | ~2 weeks before deadline | Time-driven (anchored to deadline) |

## 5a. The campaign intensity curve (how a deadline shapes the arc)

A campaign isn't flat — it **escalates** as the deadline approaches, but *not* as a gradual ramp the whole way. It stays warm through the middle, then spikes at the close. Reference: a **4-week enrollment window.**

| Phase | Messaging | Job |
|---|---|---|
| **Week 1 — Announce & introduce** | Warm, informational. Establish what it is, put it on the radar. | Awareness |
| **Weeks 2–3 — Excitement + momentum + sneak peek** | Build excitement, show sneak peeks, and **"we're getting bookings."** | Proof / desire |
| **Final week — Roll out promotions** | The incentive drops — discount/offer that converts fence-sitters before the window shuts. | Close |

**The escalation is: awareness → proof/excitement → incentive.** Each phase raises the reason to act *without repeating* the last one.

**Two rules worth stating explicitly:**

- **"We're getting bookings" is social proof AS urgency.** Showing momentum ("spots are filling") makes people act without a fake deadline — a far better way to carry the middle than repeating the announcement.
- **The promotion is a CLOSING tool, not an opening one.** Hold the discount to the final week on purpose. Lead with it and you've (a) got nothing left to pull when it matters and (b) trained people the price isn't real. Held back, the discount *becomes* the urgency mechanism — deadline and deal land together for maximum push.

> Contrast with evergreen: evergreen's failure mode is repetition; a campaign's is fizzling before the deadline. The intensity curve is what prevents the fizzle — it keeps giving a *new, escalating* reason to act right up to the close.

## 6. The two clocks (key engine insight)

The tool runs on **two clocks at once**:

- **Campaign clock** — the goal-driven sequence above (announce → look inside → push → last chance). Applies to has-deadline projects.
- **Heartbeat clock** — a standing **weekly "listen" check-in** that runs underneath *everything*, campaign or evergreen: *"Time to check in — upload your latest insights so I can keep suggestions sharp."* The heartbeat **sweeps across all active projects** at once ("here's your check-in across tax, divorce, and immigration").

Why the heartbeat matters:
- **Audiences drift.** What worked three weeks ago may not work today. Weekly listening keeps the playbook alive instead of stale.
- **It builds the habit loop.** The weekly nudge keeps the user engaged and gives the tool a reason to reach out. This is what makes it sticky.
- **It compounds.** Every upload is another data point. Over months, the tool builds a real picture of the audience across everything posted — the flywheel that eventually justifies branching to other businesses.

## 7. Steps come in two speeds

Not every step is on a clock. The engine must handle both:

- **Time-driven steps** — "Day 2, post the look-inside." Just do it.
- **Data-gated steps** — "push enrollment *when* you know what's resonating." Wait for signal, then adapt.

This respects how real marketing works: there's a *read-the-room* phase before you push. Most content planners miss this.

## 8. The core adaptation rule

**When a post overperforms → two moves fire:**
1. **Boost that specific post** to ride its momentum.
2. **Make more content in that style/format** — replicate the pattern going forward.

**The mirror rule:** when a post **underperforms** → the tool quietly stops suggesting more of that type.

→ Winners get amplified *and* cloned; losers fade out. That's Stage 2 personalization actually working.

> Note: at the **project level**, "fade out" has a floor — see §8b. Within a single project it's fine for a weak content *type* to disappear, but a whole *service* must never starve to zero.

## 8c. The conversion-gap rule (high engagement, low bookings)

One of the most common and most important cases. Handle it as a **diagnosis**, not a single fix.

**Step 1 — Reframe: this is not a failure.** Lots of likes + no bookings = the brand is landing but not *converting*. That's **awareness / image being built** — real value, just not revenue *yet*. Do **not** fade this post out as a loser; it's doing half its job and earning reach you can convert later.

**Step 2 — Diagnose the block. It's almost always one of two things:**

- **Trust gap** → the audience is interested but not convinced. **Move: prove it.** Personal testimonials, social proof, show what you do and how it's helped real people. *(Same DNA as the income-tax "tell them how much money these people got back" move — replace claims with evidence.)*
- **Money gap** → the audience wants it but the price/value isn't clicking. **Move: lower the barrier.** A discount, or a referral benefit on the next post — make the math work or de-risk the decision.

**Step 3 — Test and let the data confirm.** The tool doesn't have to guess right the first time. It knows the two suspects, tests one (trust post or price post), and watches which moves the needle. Over time it **learns whether this audience tends to be trust-blocked or price-blocked** — a durable, valuable thing to know about a customer base.

> Connects to the §8b tiebreaker: "high engagement, low bookings" is the **same shape** as "in-season but flat" — presence works, message doesn't convert → **change the content, not the volume.** Keep showing up; change *what you show.*

## 8f. "Enough signal" — reading depends on how the post was distributed

The listen phase (data-gated steps, §7) has no fixed length — it waits for signal. But **"enough signal" isn't one number; it depends on whether the post was paid or organic.** So logging a post must capture **distribution: organic, or paid (+ run length + budget).** That input drives both signal timing *and* ROI measurement (did the spend actually convert, or just buy views?).

**Paid / boosted posts → TWO reads:**

- **Mid-campaign read (for ACTION).** Partway through the run (e.g. day 2 of a 4-day ad), read results *while budget is still live.* If it's working, act now — "this is crushing, make more like it" — capitalizing while momentum and spend are still going. This is the overperformer rule (§8) firing *during* the campaign, not after. Steer the plane mid-flight.
- **End-of-campaign read (for LEARNING).** When the run ends, read the full result — did the spend convert, what's the final tally, what's the durable lesson for next time.

> Why two reads: the mid-read exists because there's still budget to redirect (catching a winner early has value); the end-read exists to record what worked. Same data, two purposes, timed to when you can *use* it. A single end-of-run read would miss every chance to double down while the ad was still hot.

**Organic posts → the weekly heartbeat handles it.** No custom timer, no mid-read. An unpaid post has no live budget to react to, so there's nothing to steer — it just gets read on the weekly check-in rhythm.

## 8d. Platform performance is learned PER-SERVICE (never globally)

When the same content performs very differently across platforms (e.g. divorce content crushes on TikTok, dies on Facebook), the correct conclusion is **not** "Facebook is bad." It's "**divorce content** is bad on Facebook."

**The trap this avoids:** if the tool learned "Facebook underperforms" and eased off it globally, it might be pulling back on the exact platform where the *tax* or *insurance* audience lives. A dead channel for one service can be a thriving channel for another.

**The rule:** each project builds its **own map of which platforms its audience lives on.** Divorce may index on TikTok; tax may do its best work on Facebook; immigration on Instagram. A multi-service business is **not one audience on three platforms — it's several different audiences scattered differently across the same three platforms.**

**How it stacks on §8b:** airtime allocation becomes two questions stacked:
1. *How much* airtime does this service get? → season / attention / floor (§8b).
2. *Where* does that airtime go? → this service's **learned platform map**.

Content also adapts per-platform within a service (format tuned to each), but the primary, durable lesson is the **audience-mapping** one above.

## 8e. The flat-post ladder (low engagement AND low bookings)

A genuinely weak post — nobody engaged, nobody booked. **Never fade a content type on a single dud.** One flat post is a data point, not a verdict. The tool waits for a **pattern** and escalates through four strikes, testing one hypothesis at a time:

| Strike | Action | Hypothesis being ruled out |
|---|---|---|
| **1** | Initial post underperforms → **do nothing yet.** | — (just a data point) |
| **2** | **Post again**, clean second shot — "maybe it was a weird week." | Bad luck / timing |
| **3** | Still flat → **adjust the content** (new angle, hook, format), try once more. | Wrong execution |
| **4** | Still flat → **move to maintenance mode**: keep it around here and there so customers know the service still exists. | Topic just isn't a performer — but protect the revenue floor |

**Why this is right:** it's patient in the correct way — *slow to give up, but not stubborn forever.* Strike 1→2 rules out bad luck; 2→3 rules out bad execution; only after both are eliminated does it conclude the topic isn't a performer — and even then it **doesn't kill it**, it drops to the §8b floor.

> Strike 3 is the "change the content, not the volume" principle again. Strike 4 **is** the entry point into maintenance mode (§8b) — this ladder answers both "the dead post" and "how a service enters the floor."

## 8a. Evergreen rhythm (projects with no deadline)

Evergreen projects have no arc to move through — they have a **cadence to sustain**. The tool's job shifts from "what's the next beat toward the goal" to "what keeps this service visible and fresh without repeating itself."

- **No "last chance."** Urgency, if any, comes from elsewhere (season, limited slots) — never from a fake deadline.
- **The failure mode is repetition, not fizzle.** A campaign fails by dying before the deadline; evergreen fails by posting the same "book now" until people tune out. So the tool's real value here is **variety management** — rotating content types, angles, and platforms so the steady drip doesn't become wallpaper.

## 8b. Airtime allocation (dividing the week across projects)

The genuinely new strategy problem in a multi-project world: with several services running, **how much of the week does each one get?** Three forces decide:

1. **Season pushes it UP.** A service in its hot window (tax in spring, immigration around policy changes) gets weighted heavier. Ride natural demand. **How the tool learns season: BOTH — user seeds it at setup ("tax is Jan–April"), and the tool refines/discovers seasons from performance data over time.** Same Stage 1 → Stage 2 pattern as the whole tool: user input is the cold-start default, audience data personalizes it. This can surface seasons the user didn't consciously know they had (e.g. "divorce consults spike every January") — a strategist moment, not a scheduler one.
2. **Attention/traction pushes it UP.** A service getting strong response *right now* gets more airtime. (The overperformer rule operating at the project level — allocating budget *between* services, not just within one.)
3. **Underperformance scales it DOWN — but never to zero.** A slow service gets dialed back into **maintenance mode**: **roughly one post per month** — the minimum dose that still counts as presence — so it never disappears. *Reasoning: even a low-performing service is still part of total revenue, so it can't fall completely off. Monthly is the smallest cadence that still keeps the service on the audience's mental menu; less than that risks it genuinely dropping off the radar.*

**Why the floor matters (the trap it avoids):** naive "fade the losers" would *starve a service to death* — stop posting about immigration → audience forgets you do it → it gets even slower → tool kills it → you've accidentally exited a business line. The floor prevents this. The business is a **portfolio, not a single bet**: winners get the extra airtime, but nothing starves below a minimum presence, ready to recover when its season returns.

**Tiebreaker when forces conflict** (e.g. in-season but underperforming): **opportunity drives the peaks, revenue-protection sets the floor.** Season and live attention win the short-term airtime fight (time-sensitive — miss the window and it's gone); the revenue-floor rule protects the baseline (not about winning the week, about never disappearing). These don't truly collide — one sets the ceiling, one sets the floor.

**The in-season-but-flat case (confirmed rule):** when a service is in its hot window but the posts aren't landing, **keep the airtime up — do NOT pull back.** The window is now-or-never. Instead, **change the *approach*, not the *volume*** — switch the angle or platform, because underperformance is a signal about the *content*, not a reason to go quiet. Push through, but push *differently*. (Key distinction: how *often* to post and *what* to post are separate decisions — a weak signal fixes the message, not necessarily the frequency.)

## 8g. Campaign + evergreen running at the same time

The real-world case: an active launch (has-deadline project) runs while the evergreen services (tax, divorce, immigration…) still need to stay alive. They compete for the same week on the same platforms. **The split depends on campaign phase:**

- **Early campaign (e.g. weeks 1–2 of a 4-week launch — announce + build):** campaign is still *warm*, so **evergreen runs basically normal.** Regular services keep their rhythm.
- **Final 2 weeks (momentum peak → promotions close):** campaign is *hot* and needs the airtime, so **evergreen eases back toward its monthly floor** — quiet, not gone — letting the launch dominate the calendar when it matters most.

**Why two weeks, not one:** the promotion drops in the *final* week, but the momentum push ("we're getting bookings," spots filling) ramps the week *before.* The campaign starts needing heavy airtime a week ahead of the close, so pulling evergreen back for the whole final stretch gives the launch clean air for its *entire* peak — not just the finish line.

**Respects the floor:** "chill a bit" ≠ "disappear." Evergreen drops toward its ~monthly minimum during those two weeks but never fully goes dark — a tax client still sees you exist mid-launch. Once the campaign closes, **evergreen springs back to normal rhythm.**

→ The tool must know **which campaign phase it's in** to set the evergreen dial: *early → evergreen normal; final 2 weeks → evergreen toward floor.*

## 8h. What happens when a campaign ends (lifecycle + dormancy)

When the deadline passes and the campaign closes, the project **goes dormant** — it is *not* deleted (that throws away everything learned) and *not* left active. It sleeps, holding all its learned intelligence (winning angles, platform map, what converted), and waits for its next cycle. Re-entry happens two ways, covering both directions:

**Mechanism 1 — Proactive wake-up nudge (tool-initiated).** When the dormant campaign's season comes back around, the tool *asks* rather than waiting to be remembered: *"You ran the summer camp launch around this time last year — doing it again this year?"*

- The nudge matches the **original cadence** — a yearly launch is asked annually, a monthly promo monthly. It re-asks on the clock the campaign first ran on.
- **If yes** → wakes up with all prior learning, ready to run smarter.
- **If no** → **stays dormant and leaves the user alone.** One question, declined, goes quiet again until next cycle. *This respect for "no" is what keeps the tool from nagging — the thing that kills these tools.*

**Mechanism 2 — Name-match detection (user-initiated).** If the user starts a *new* campaign with the same/similar name as a past one ("Summer Camp 2026" vs. last year's "Summer Camp 2025"), the tool catches it and asks *"Is this the same as the one you ran before?"* If confirmed, it **pre-loads the whole learned strategy** — winning timing, platform map, what converted — instead of making the user rebuild from scratch.

**The payoff (the moat):** either path lands in the same place — a campaign that starts from *last cycle's intelligence*, not a blank page. The fifth annual camp launch runs on four years of accumulated learning about *this specific campaign* and *this audience.* This is Stage 2/3 personalization applied to campaigns, and it's something a generic scheduler can never build.

## 9. How results get entered (data entry)

**Screenshot upload, not manual typing.** The user screenshots their insights (they already do this constantly); the tool reads the numbers via OCR/vision and files them where they belong.

- Realistic and good UX — meets people where they already are.
- Caveat to plan for: each platform lays out its insights screen differently and redesigns periodically, so the reader needs to know an IG insights screen from a TikTok one. Solvable, not free.

## 10. The checkoff → learning loop

1. Tool suggests the next move(s).
2. User checks off what they did / skips what they didn't.
3. **Skips teach it.** Simple version: a skipped suggestion type appears less. Richer version: it occasionally asks *"skipped this — not your thing, or just bad timing?"* to learn whether the issue is the action type, the timing, or the platform.

---

## Open questions / to refine next

- **What the tool looks like.** Not a strategy gap — a design one. How you enter a project, what the weekly check-in screen shows, how a suggestion is presented, how you log a post's distribution (organic vs. paid + budget), how the wake-up nudge appears. *This is the main thing left.*
- **Build path.** Manual/screenshot data first, prove the loop works for user #1 (you), then generalize. Automated API pulls deliberately deferred.
- **Minor tuning** (not load-bearing): exact "enough signal" thresholds for organic beyond the heartbeat; how "similar name" is detected for campaign matching; whether a closed campaign can *optionally* leave a waitlist/evergreen breadcrumb instead of going fully dormant.

---

## RESOLVED (locked)

**Architecture**
- ✅ **Businesses = separate tabs** (like Excel sheets) — each a fully walled-off world, zero bleed. **The monthly calendar is the home screen**; you switch businesses via the tabs. Fixes the multi-business pile-up.
- ✅ **Projects are the core unit inside a business.** One per service; each an independent adaptive thread. Services stay grouped in their business's tab (not split out).
- ✅ **Services and platforms are user-extensible** — "+ Add new" on any selector registers the entity system-wide (new service → new project with color, airtime, heartbeat, learning; new platform → joins every selector + per-service platform mapping).
- ✅ **Deadline-vs-evergreen is a single flag**, not two separate modes. Shared adaptive brain.
- ✅ **Three stages of intelligence** — cold start (general playbook) → personalization → diversification.
- ✅ **Two clocks** — campaign clock (per has-deadline project) + weekly heartbeat sweeping all projects.

**Airtime & portfolio**
- ✅ **Airtime allocation** — season up, attention up, underperformance down-but-never-zero.
- ✅ **Revenue floor / maintenance mode** — ~1 post/month minimum; no service starves to death.
- ✅ **Tiebreaker** — opportunity sets the ceiling, revenue-protection sets the floor; in-season-but-flat keeps volume up and changes the approach.
- ✅ **Season learned BOTH ways** — user seeds it, data refines and discovers it.

**The adapt rulebook**
- ✅ **Overperformer** → boost + clone the winning angle.
- ✅ **Conversion gap** (high engagement, low bookings) → reframe as awareness, diagnose trust vs. money, test and learn.
- ✅ **Platform performance is per-service, never global** — each service maps where its own audience lives.
- ✅ **Flat-post ladder** — 4 strikes (do nothing → repost → adjust → maintenance) before fading; patient, not stubborn.
- ✅ **Signal timing** — paid posts get two reads (mid = action, end = learning); organic reads on the heartbeat.

**Campaign / deadline side**
- ✅ **Intensity curve** — awareness → proof/excitement → incentive; stays warm then spikes, doesn't ramp gradually.
- ✅ **Momentum as urgency** — "we're getting bookings" carries the middle without a fake deadline.
- ✅ **Promotion is a closing tool** — held to the final week on purpose, never led with.
- ✅ **Campaign + evergreen coexistence** — evergreen normal early, eases toward floor in the final 2 weeks, springs back after close.
- ✅ **Campaign lifecycle** — close → dormant (keeps learning) → wakes via proactive nudge OR name-match → re-runs smarter. Respects "no."

**Core principle threaded throughout**
- ✅ When presence works but conversion doesn't, change the *content*, not the *volume*.

---

*Draft — captured from planning conversation. Everything here is meant to be argued with.*
