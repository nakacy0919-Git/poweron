# Power On III — Study Lab (development-only)

This feature is intentionally implemented on a **non-production Git branch**. Do not merge to main or deploy to production without teacher review and an iPad/Safari smoke test.

## New learner experiences

- **Learning Progress**: progress for Lesson 1–10, part and selected paragraph; stores independent completion of sentence reading, deep study, and listening puzzles. The dashboard also shows attempts and best scores from existing Reading Check, Shadowing, and Vocabulary.
- **Sentence Reading**: focus on one sentence, listen using browser SpeechSynthesis (0.65×, 0.85×, 1×), optionally read into browser SpeechRecognition, and review a word-match percentage. 80% match marks a sentence complete. Students without microphone support can explicitly self-report reading.
- **Deep Study**: focus on a sentence, listen, optionally reveal the **whole selected scope's** Japanese translation (not guaranteed sentence-aligned), and self-report understanding.
- **Listening Puzzle**: play one sentence using SpeechSynthesis, tap shuffled word/phrase cards in order, check and retry. A solved sentence is marked complete.

All modes read directly from the existing lessonScripts and advanced-level script dictionaries. No generated content, student IDs, or external server integrations are required.

## Device-local progress

Storage key: \`poweron_study_progress_v1\`. Schema:

\`\`\`json
{
  "version": 1,
  "scopes": {
    "standard:L01_P1_full": {
      "reading": {
        "total": 7,
        "completed": {"0": true},
        "attempts": 1,
        "bestAccuracy": 87,
        "fingerprint": "example",
        "lastAt": "2026-11-13T00:00:00.000Z"
      }
    }
  }
}
\`\`\`

Modes: \`reading\`, \`deep\`, \`puzzle\`, \`readingcheck\`, \`shadowing\`, \`vocabulary\`.

- Progress is kept in localStorage. If storage is unavailable, the app continues in session memory and displays a warning.
- Scope includes level, lesson, part and paragraph; text fingerprint invalidates completion when source text changes.
- Completion represents an activity record, **not a school pass/fail judgment**. Existing Lesson 8 points and gates are unchanged.
- Existing tools are instrumented only when an attempt ends.
- \`PowerOnPractice.getProgress()\` exposes the anonymous schema for a future teacher-dashboard sync adapter.
- The progress dashboard includes an exportable UTF-8 CSV. No personally identifying details are included.
- There is **no** automatic cross-device sync, student identity, teacher class dashboard, or cloud save yet. Browser data may be lost when site data is erased.

## Audio and recognition limitations

Browser SpeechSynthesis is used for sentence-level playback because the original MP3 recordings have no sentence timecodes in this repository. SpeechRecognition is browser-dependent; HTTPS and microphone permission may be needed. The match score measures **recognized word overlap in order**, not pronunciation quality or phoneme-level assessment.

## Tests

Run from the repository root:

\`\`\`bash
node --test tests/practice-core.test.cjs tests/study-lab-smoke.test.cjs
\`\`\`

Existing tests should also be run before merging:

\`\`\`bash
node --test tests/*.test.cjs
\`\`\`

Manual teacher acceptance checklist on iPad Safari:

1. Select Lesson/Part/Paragraph, open each new mode, switch to another selection while the microphone or TTS is active, and confirm playback/recognition has stopped.
2. Check 1-sentence playback, 3 speed settings, permission denied and unsupported speech browser messages.
3. Test a short and long sentence in Listening Puzzle, correct and incorrect orders, and saved results after page reload.
4. Verify Deep Study shows Japanese translation as the **selected text scope** rather than claiming sentence alignment.
5. Verify the Lesson 1–10 progress grid, CSV, and level-specific progress.
6. Verify existing Reading Check, Shadowing, Vocabulary and Lesson 8 scoring still work unchanged.

## Future teacher overview (not implemented)

To collect 30+ student iPads in one dashboard, this local schema needs identity/consent, authenticated class membership, a server-side submission endpoint, explicit retention policy, and a teacher-only read API. Do not silently upload the anonymous local records. A short-lived session code + explicit student submission is a reasonable future integration path.
