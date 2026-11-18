# PowerOn Grammar Visualizer — Lesson 8/9 pilot

## Scope
- **Standard** level only for Lessons 8 and 9 (the exact approved textbook sentences).
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
Each approved record provides:

- `lesson`: 8 or 9
- `match`: a unique anchor that must be in the actual sentence
- `tag`: teacher-friendly grammatical feature
- `focus`: exact text to highlight in amber
- `target`: exact related phrase to highlight in blue
- `explain`: Japanese commentary for the specific sentence
- `blocks` (optional): reviewed S/V/O/C or clause breakdown `[{role, text}]`

The viewer uses `textContent` for textbook and notes, never injected HTML. Unrecognized texts never receive unverified parsing labels. Other lessons and non-Standard levels do not expose the grammar button.

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
