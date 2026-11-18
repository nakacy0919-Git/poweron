# PowerOn Grammar Visualizer — Lesson 8/9 pilot

## Scope
- **Standard** level only for Lessons 8 and 9 (the existing textbook sentences stored in the repository).
- Works inside the existing **Story Theater** via the “✦ 文法解説” button.
- Keeps each current scene image as a subdued background. Original playback, narration, aligned Japanese captions, progress tracking and Step 2 navigation remain separate and unchanged.
- Scene groups containing multiple sentences let the learner choose which sentence to inspect.
- 104 original English sentences have at least one curated explanation: **115 manually authored grammar explanation points**, including **27 sentence/phrase structure diagrams**.
- No server, external parser, paid AI API, localStorage entries or new user data collection.

## Teaching interaction
1. Choose Lesson 8 or 9, **Standard**, then select a Part and open **Watch & Listen / Story Theater**.
2. Press **✦ 文法解説** (active audio playback pauses).
3. Use **前の文 / 次の文** to move through sentences *within the same scene*.
4. Tap explanatory point chips or **次のポイント** to move through grammatical relationships.
5. Close the grammar layer or press Escape to return to the same scene without exiting theater.
6. Normal scene navigation still works. Changing scenes resets the grammar view to the new scene's first sentence.

## Data contract
`js/grammarNotes.js` exports `{ entries, forSentence(lesson, sentence) }`.
Each draft annotation record provides:

- `lesson`: 8 or 9
- `match`: a unique anchor that must be in the actual sentence
- `tag`: teacher-friendly grammatical feature
- `focus`: exact text to highlight in amber
- `target`: exact related phrase to highlight in blue
- `explain`: Japanese commentary for the specific sentence
- `blocks` (optional): manually specified S/V/O/C or clause breakdown `[{role, text}]`

The viewer uses `textContent` for textbook and notes, never injected HTML. Unrecognized texts never receive unverified parsing labels. Other lessons and non-Standard levels do not expose the grammar button.

## Responsive classroom layout (development pilot)
- Grammar mode uses a dynamic viewport-constrained stage on phones and iPads; while visible it temporarily hides narration-specific controls to prioritize the English sentence and structure diagram.
- Short/narrow screens collapse the Japanese explanation by default. The **解説を見る / 解説を隠す** control restores it without changing the scene.
- Very long sentences use reduced type sizes with an internal scroll fallback, rather than scrolling the whole theater.
- ArrowLeft/ArrowRight switch sentences while the overlay is open; Escape closes only the grammar layer. Keyboard focus stays within visible grammar controls and original captions are removed from the tab order.
- Cleanup disconnects the grammar ResizeObserver when exiting.

## Verification status
- 104 / 104 source sentences matched an annotation; 115 explanations and 27 structural diagrams.
- Five focused in-memory JavaScript tests passed, including compact screen behavior. This is not equivalent to Safari/iPad visual inspection or the full project's Node test suite.
- **Teacher review of all grammar explanations is still required before production**.

## Review checklist before any production merge
- [ ] Verify grammar definitions and intended dependencies against publisher content, especially multi-clause examples and quoted speech.
- [ ] Verify every annotation has focus/target present in its sentence: `node --test tests/grammar-visualizer.test.cjs`.
- [ ] Run full project test suite: `node --test tests/*.test.cjs`.
- [ ] Manually inspect layouts at desktop, iPad landscape/portrait and phone in Chrome/Safari.
- [ ] Inspect long sentences, two/three-sentence scenes, audio pause, navigating away, captions toggle, focus order, and Escape.
- [ ] Check optional blocks and the last scene/last point disabled behavior.
- [ ] Confirm no unintended GitHub Pages or Vercel production deployment.

## Deployment
**Development branch only.** Do not merge into `main` or trigger production deployment as part of this pilot.

## Classroom viewport & regression improvements (2026-11-19)
- Full-stage faded theater imagery now sits behind the grammar overlay, including portrait iPad layouts.
- Viewport measurement uses the actual grammar panel when available; compact layout and long-sentence font-fitting respond to real content height.
- Overlapping grammar spans are segmented safely so neither grammatical relationship silently disappears.
- The grammar category remains visible when students collapse the longer Japanese explanation. Manual reveal remains possible.
- The stage remains fixed to dynamic viewport height with internal fallback scrolling for exceptionally long passages; this avoids scrolling the entire theater page.
- Small-portrait footer prioritizes essential navigation buttons. Scene controls and original MP3 playback remain intact when returning from Grammar mode.
- Runtime-independent tests cover 104/104 sentence notes, compact view, focus/target overlaps, constrained-height fallback and Story Theater narration/session logic.
- **Remaining QA before merge:** run real desktop and iPad Safari/Chrome visual checks at 1024×768, 768×1024, 1366×768, 390×844, 844×390; run all Node regression tests in a local checkout. No live browser was launched by these tests.
