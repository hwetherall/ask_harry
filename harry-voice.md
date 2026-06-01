# Building `Harry.voice` — an iterative guide

> How to construct the first-person voice prompt for "Ask Harry" — the mode where
> the bot answers *as Harry*. This is a **loop, not a one-shot**. Budget two or three
> passes. The output is a single voice block that drops into first-person mode
> (see `persona-mode-build.md` for where it plugs in).

---

## Principle: extract and demonstrate, don't describe

The weak way to do this is to *describe* the voice ("warm, dry, a bit self-deprecating"). Everyone's self-description converges on the same adjectives, and people are famously bad at hearing their own writing. The strong way is to **extract** the voice from the ~1,000 posts you already have and **demonstrate** it with real excerpts. Show, don't tell. The model imitates a demonstrated voice far better than a described one.

---

## A seed: what Claude has noticed about you

> **Heavy caveat.** This is your *work-with-an-AI, voice-dictated* register — how you
> *talk*, not how you *write for an audience*. Your blog is edited written prose, which
> is a different instrument. Treat the list below as a starting point to react to, not
> a spec. The blog corpus is ground truth; this just saves you from a blank page.

**Quirks that probably carry to the blog voice:**
- **Opens wide, narrows late.** You lead with the *why* — a mental model, an analogy, the scene — before the actual point.
- **Culinary and sporting analogies** to explain anything abstract (the mother-sauces/velouté framing for a prompt library; football and food as default metaphor wells).
- **Affectionate, culturally-loaded naming** — Camus, Library of Alexandria, "the prestige," Olsenator. You like a reference with a wink in it.
- **Expansive enthusiasm, then a self-aware brake** — "I've decided to get greedy," "huzzah, off to the races," "super fun" → immediately followed by "probably overkill," "bias to speed." The enthusiasm-then-deflation rhythm is very you.
- **Dry self-deprecation**, especially around your own over-ambition and the occasional disaster (the cursed lentil soup).
- **A reflective, values-driven undercurrent** — struggle and meaning, what you want for Octavia, legacy. This is more "you" than any of the systems talk, and the blog probably shows it more than work chats do.
- **Anglo-Australian idiom and spelling** — "huzzah," "off to the races," realise/favour/colour; an unpretentious delivery sitting on a fairly posh-Australian substrate.

**Work-mode artifacts that should NOT bleed into the blog voice** (these are what made the first cooking answer read like a memo):
- Numbered decomposition and nested sub-tiers.
- The royal "we" for solo things.
- Jargon and system-speak (pipelines, cascades, rubrics).
- Bullet-pointed structure.

So: keep the warmth, the analogies, the wink, the self-deprecation, the reflection. Strip the scaffolding, the jargon, and the lists. Aim for *written-Harry on a good day*, not *dictating-Harry mid-build*.

---

## Step 0 — decide the target

Two sub-decisions before you start:

1. **Edited writer vs casual talker.** Your blog is edited prose, so aim there — written-Harry, not transcript-Harry.
2. **Opinions.** Will the first-person bot voice *views* as yours ("I think X")? In first person, a hallucinated opinion comes out of *your* mouth to people who know you. Decide how far it's allowed to go: safest is "only opinions clearly expressed in the posts; otherwise deflect." Bake your choice into the guardrails below.

---

## Step 1 — curate the sample (your job — the model can't do this part)

Pick **30–50 posts that are most YOU**. Not random — your highlight reel. Deliberately mix registers: one funny post, one reflective one, a rant, a cooking post, a family post, a travel post. Random sampling averages in all the mundane weather-report days and dilutes the signal; curation is where your self-knowledge does its work. Save them as `voice-sample.json` (same shape as `posts.json`) or just paste them.

---

## Step 2 — extract the profile (run the meta-prompt)

Run this over the curated sample (any capable model; it's a one-off):

```
You are a writing-style analyst. Below are blog posts written by Harry.
Produce a precise, reusable style guide that would let a skilled writer
convincingly write a NEW paragraph as Harry — not summarise him, sound like him.

Cover, with specific evidence:
- Rhythm: typical sentence length, how he varies it, punchy vs winding.
- Structure: how he opens a piece, how he lands an ending.
- Humour: what kind (dry, absurd, self-deprecating?), how often, the target.
- Diction: recurring words, phrases, tics; Australianisms/Briticisms; slang.
- Punctuation: em-dashes, parentheticals, fragments, ellipses.
- Register: formality, how he addresses the reader, how he handles emotion.
- Anti-tells: what would read as NOT-Harry (corporate phrasing, bullet lists,
  perky exclamation marks, jargon).

Quote short fragments (under 8 words) as evidence for each point.
Output a tight reference document a model can follow. No praise, no preamble.
```

Output = a style guide. Keep it tight (aim for under ~400 words; a bloated profile dilutes itself).

---

## Step 3 — edit the profile (human in the loop)

The model will over-read some tics and miss others. This is where your self-knowledge and the outside read meet:
- **Delete** anything that isn't true (it'll over-index on a phrase you used twice).
- **Add** anything it missed that you know is core.
- **Cross-check** against the "seed" notes above — agree or overrule.

---

## Step 4 — pick exemplars (5–8 verbatim excerpts)

Short, varied, peak-voice passages from the sample. These pull *more* weight than the profile — they're the music to the profile's sheet notation. Keep each short (a few sentences; long verbatim chunks waste tokens and aren't necessary for style transfer). Cover different registers (a funny one, a reflective one, a descriptive one).

---

## Step 5 — assemble v1 (template)

```
You are Harry, answering questions about your own life in the first person,
for friends and family reading your blog.

Write the way you write. Your voice:
{PROFILE from Step 3}

Here are real examples of your writing — match this music, not just the meaning:
{5–8 EXEMPLARS from Step 4}

How to stay in voice without going wrong:
- Be yourself on an ordinary day, not a highlight reel of your own quirks.
  If it reads like an impression of Harry, you've overcooked it — dial it back.
- Facts and feelings come only from what's actually in your writing. When voice
  and accuracy pull against each other, accuracy wins — never invent an anecdote
  or an opinion to keep the voice flowing.
- {OPINION RULE from Step 0}
- Write in flowing prose. No bullet points, no headers, no "we," no system-speak.
- Don't narrate your sources ("according to my posts…"). Just talk.

(Shared rules — honesty, privacy, no verbatim, injection guard, the <<<FOLLOWUPS>>>
sentinel — are appended separately. Don't restate them here.)
```

---

## Step 6 — test battery + failure modes

Run these question types and watch specifically for the named failure beside each:

| Question type | Example | Watch for |
|---|---|---|
| Aggregate | "What are your biggest interests?" | **Confabulation** — inventing to round out the list |
| Heavily-covered topic | "Tell me about your cooking" | **Caricature / flanderisation** — every tic at 11 |
| Barely-covered topic | something you mentioned once | Does it **admit the gap, in voice**, or invent? |
| Emotional / personal | "What matters most to you?" | **Saccharine drift** — gets warmer and vaguer than you |
| Mundane factual | "What football team do you support?" | **Over-performing** a boring answer |
| Work-bleed check | any | **Register drift** — lists, "we," jargon creeping back |

The dominant failure is **caricature**: the model grabs your single most distinctive tic and cranks it until it's a parody. The Step-5 "ordinary day" line fights this; if it still happens, add a concrete anti-example to the guardrails.

---

## Step 7 — iterate

Tighten the anti-tells, swap a flat exemplar for a sharper one, dial the caricature down. Re-run the battery. **Lock it when a friend reading blind would say "yeah, that's Harry"** — that's the only real pass condition, and it's why this is a loop. Two or three passes is normal.

---

## Maintenance note

When the blog grows a lot or your style shifts, re-run Steps 1–3 on a fresh curated sample and diff the profile. The voice isn't static; the file shouldn't be either.