---
name: Notification sound intent
description: Which bell events deserve sound and how quiet delivery should behave.
---

Sound is reserved for real, honesty-gated performance insights (including overperformers and conversion diagnoses) and Campaign wake-ups. Ordinary completion, skipping, navigation, plan updates, dismissed alerts, and restart confirmations are quiet.

**Why:** The user wants a calm attention cue, not feedback on every action. Several alerts from one upload should produce one chime, and the same insight must not sound again on a re-render or reopening.

**How to apply:** Keep sound tied to new bell events, use stable performance-event identity rather than popup identity, and preserve the existing learning gates. Default sound on with a remembered app-wide mute. Before browser audio permission is unlocked, drop sound rather than queueing a surprise for the next click.
