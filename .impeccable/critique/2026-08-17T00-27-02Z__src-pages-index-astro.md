---
target: whyttaker.github.io home
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 6
timestamp: 2026-08-17T00-27-02Z
slug: src-pages-index-astro
---
# Critique — whyttaker.github.io (home + case studies + resume)

Method: dual-agent (A: design review, B: detector/browser). Mode: Experience.
Note: repo is mid-refactor (R3F StrataCanvas deleted, src/scripts/rain/ untracked).

## Design Health Score: 22/32 (H7, H10 n/a — Experience surface)
1 Visibility 3 · 2 Match 3 · 3 Control&Freedom 2 · 4 Consistency 3 · 5 Error Prevention 3
6 Recognition 3 · 7 Flexibility n/a · 8 Aesthetic 3 · 9 Error Recovery 2 · 10 Help n/a

## Audit Health Score: 15/20
A11y 3 · Perf 4 · Responsive 2 · Theming 3 · Impl Integrity 3

## Specificity verdict
Distinctive shell, generic content. Rain glyph content + motifs + material system are
unrepeatable. Four case studies are one six-block template; Stack is a 47-item skills
cloud; 3 of 4 covers are key-art posters, not artifacts. Positioning (Amazon distributed
systems) is unsupported by portfolio (3 student games + scheduling app).

## Priority issues
P0 Mobile cover sizing bug — WorkSection.astro:247 overrides aspect-ratio but not
   width:calc(var(--h)*var(--arn)) from :129. Landscape covers overflow 56px (real
   scrollable overflow @390); square covers under-fill by 118px. One fix, both symptoms.
P1 Condensed glass nav destroys legibility of content beneath (tier A blur(3px),
   glass.css:39 + refraction scale 18).
P1 Intro unskippable ~3s, nav at opacity 0 but still tabbable.
P1 Work doesn't back the positioning; no artifacts in 3 of 4 case bodies.
P1 Availago cover art misspells product as "Availigo".
P1 Mobile nav links 40.8x32.5 (below 44pt); footer/contact links 20-26px tall.
P1 scroll-behavior:smooth enabled BY prefers-reduced-motion (global.css:55-59) — inverted.
P2 h1 renders "WhittakerWorland" (no whitespace node, Hero.astro:34-35).
P2 resume.ts:18 three literal spaces collapse — skills lists run together.
P2 No og:image while declaring summary_large_image; no JSON-LD Person.
P2 Resume absent from nav; reachable only from final section.
P2 Dev server Vite cache breaks GlassNav hydration.
P2 --bone hard-coded as literal rgba across 8 files.
P3 Bedrock duplicated in stack.ts:45/:53. Ninth Circle fact drift vs resume.ts:43.
P3 Next-project pill overlaps footer. No 404 page. Dead `strata` export. TEMP debug hook.
P3 Personal mobile number published on /resume.

## Taste-skill pass
Fail: 14 visible em-dashes in content/data (9.G zero-tolerance); "Scroll" cue (9.F ban);
5 true eyebrows vs budget of 2; hero has 5 text elements (max 4) and zero CTA;
pure #000000 base; dark-only, no light mode; Inter as body face.
Pass: 5 distinct layout families across 6 sections; copy self-audit clean; no fake
numbers; no hand-rolled icons; no fake screenshots; zero will-change; 100svh not 100vh;
one accent lock honored; no duplicate CTA intent.
