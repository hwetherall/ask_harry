# TODO (high priority): Precomputed understanding layer

> **Status: not built.** This is the real lever for turning Ask Harry from a
> sharper summariser into something that actually *understands* Harry. The
> observer-stance prompt + year-grouping (shipped 2026-05-31) are the cheap moves
> that get us most of the way; this is the bigger one. Captured here so it isn't
> forgotten.

## The problem it solves

People who know Harry well carry a **compressed model** of him — his recurring
preoccupations, his contradictions, how he's grown, what he over- and
under-indexes on. The tool currently rebuilds a shallow version of that *from
scratch on every query*: it reads 800+ raw posts and, under time pressure,
averages them into the safe, frequent themes. Even with the observer-stance
prompt, the model is re-deriving a thin understanding each time instead of
drawing on a real one.

This is the **soul.md pattern** from the Half Baked screener: precompute a dense,
durable model of the person once, then feed it alongside the raw material.

## The shape

1. **One-time deep analysis** over the whole corpus (a heavyweight pass, run
   occasionally — not per query). It produces a structured "understanding"
   artifact: recurring preoccupations and how they've evolved; the tensions and
   contradictions; what he returns to; what he over-/under-states; turning points
   over time. Think "what a close friend would tell you about Harry," not a
   summary of post topics.
2. **Store it as a stable artifact** (e.g. `understanding.json` / `soul.md` in
   the repo, regenerated on a cron or manually when the corpus grows
   meaningfully — same cadence as `posts.json`).
3. **Feed it alongside the raw posts**, inside the cached prefix. It only
   regenerates occasionally, so it stays a **byte-stable prefix** between
   regenerations and doesn't break DeepSeek's prompt cache (it slots in cleanly
   next to the corpus — see `lib/buildCorpusPrefix.ts` and `lib/systemPrompt.ts`).

Then every answer — neutral, persona, first-person — draws on an actual model of
Harry and uses the raw posts for evidence and specifics, rather than
re-deriving a thin model under latency pressure.

## Cache-stability note (important)

The understanding artifact goes in the **system message**, between the corpus and
`SHARED_RULES`, as another constant block. Like the corpus, it must be
byte-identical across requests between regenerations. When it regenerates, that's
a deliberate one-time cache re-warm (~$0.06), exactly like a corpus refresh.

## Open design questions for when we pick this up

- What exactly does the analysis pass emit? Freeform prose (`soul.md`) vs
  structured sections (themes / tensions / timeline / over-under-index)?
- Who runs the pass and how often — manual, or a GitHub Action on a cadence?
- Does it draw on excluded/private material that the public corpus doesn't, or
  strictly the same posts the tool can already see?
- How do we keep it honest (anchored to real posts) rather than itself becoming
  a confident over-reading?
