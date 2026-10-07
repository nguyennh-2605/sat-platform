# Vocabulary practice and FSRS

Vocabulary starts with a full-width daily practice card, followed by searchable Personal/Library/Assigned collections. The selected collection's summary and searchable word list share one surface, with separate Word, Vietnamese meaning, English definition and Progress columns on desktop and labelled rows on mobile. Daily practice is the primary action; collection actions use quieter buttons. All counts come from API data. Manual flashcards, quizzes, editing, teacher assignment and classroom completion remain available.

Collection descriptions are omitted from the selector and selected summary. Word details use a bordered side sheet with a transparent, unblurred backdrop and no shadow; outside dismissal and Escape remain available. Daily practice and collection quizzes share `VocabularyQuestion` for progress, the target word, A–D choices, Check answer and answer feedback. Daily recall cards use the same shell with Reveal/Forgot/Remembered controls, while daily sessions retain their own FSRS scheduling and recovery logic.

## Scheduling and daily sessions

- The server uses `ts-fsrs` 5.4.2 (FSRS 6 default parameters), target retention 0.90, fuzz enabled, learning steps 1m/10m and relearning step 10m. Retention is a scheduling target, not a guaranteed result. There is no personal parameter optimizer yet.
- Forgot maps to Again; Remembered maps to Good. Quiz answers are graded against the server snapshot and mapped to the same ratings. Client-provided dates, intervals, progress or correctness are never accepted.
- A practice batch selects at most 20 due words followed by 10 new words. Personal collections take priority for new words. These are batch limits, not a daily quota. Learners can repeat practice when more words are available.
- Due words get four automatically shuffled meaning choices when the selected collections provide three distinct distractors. Smaller collections fall back to recall cards. New words always use recall cards with reveal and self-rating.
- Daily practice includes published System words and the learner's unarchived Personal words. Teacher-owned private activity snapshots retain the separate classroom study workflow and completion rules.
- Daily sessions span collections (`isDaily=true`, nullable `setId`) and persist questions and answers. Starting again resumes the active session. Overview handles sessions without a single collection.
- Each answer, progress update, review log and completion update is atomic. A PostgreSQL advisory transaction lock serializes a learner's daily session creation, answers and save/undo operations. A unique question review log prevents duplicate scheduling.
- Stored memory includes due date, stability, difficulty, state, repetitions, lapses and learning steps. Existing coverage and accuracy counters remain. Legacy rows with prior study but no FSRS due date are due for review; their first new answer initializes FSRS. We do not invent historical ratings from aggregate counts.
- `MASTERED` remains the compatibility category for words in the FSRS Review state after a successful answer. Learning/relearning or a forgotten word is `LEARNING`; this is not permanent mastery.
- Today's count is unique words reviewed on the learner's IANA local date. The browser supplies its timezone; the server supplies review timestamps. The page refreshes the schedule on return to the tab and every minute.

## Save word

The English dictionary popover submits only `word` and an optional Personal `setId`. The default destination is a single learner-owned `Saved words` collection, identified by `ownerId + autoKey`, independently of its editable title. Vocabulary has no separate quick-save card; words can also be entered in the collection editor.

Definitions come from the published curated SAT library first, then the existing dictionary service. Translation is optional. We save the word, meaning, available translation and dictionary-attribution flag; `exampleSentence` is null. Passage text, source questions and original source URLs are not copied. Saving the same normalized word in the same collection returns the existing word. Undo is limited to a learner-owned word that has no study progress or study question yet.

Dictionary-derived definitions retain the generated Wiktionary / FreeDictionaryAPI / CC BY-SA credit, including immutable teacher activity and session snapshots. No source-passage field is required. Missing dictionary results can be entered manually in the collection editor. The UI reports provider failures and allows retry.

## API

All routes require the existing Google-authenticated JWT.

| Route | Purpose |
| --- | --- |
| `GET /api/vocabulary/practice?timezone=Asia%2FHo_Chi_Minh` | Due/new counts, unique words practised today, next due time, active session |
| `POST /api/vocabulary/practice/sessions` | Start/resume; optional `focus`: `MIXED`, `REVIEW`, `NEW` |
| `POST /api/vocabulary/saved-words` | Save `word`, optional learner-owned Personal `setId`; 30/minute/learner |
| `DELETE /api/vocabulary/saved-words/:termId` | Undo an unused, learner-owned saved word |
| `GET /api/vocabulary/sessions/:sessionId` | Recover owned persisted session |
| `POST /api/vocabulary/sessions/:sessionId/questions/:questionId/answer` | Existing route; `mastery: KNOW/LEARNING` for recall or `selectedMeaning` for quiz |

## Deployment

1. Install locked server dependencies and generate Prisma Client (the server `postinstall` already generates it).
2. Run `npm run db:migrate:deploy` from `server/` against the intended production database before starting the new backend. This applies pending checked-in migrations, including `20261007130000_vocabulary_fsrs` and `20261007133000_vocabulary_dictionary_credit`. Inspect `prisma migrate status` first if the deployment has older pending migrations.
3. Deploy the backend and client together. No new Google OAuth settings, environment variables, AI key or scheduled job are required.

The vocabulary migrations add columns, indexes and a review-log table and relax the session collection's NOT NULL constraint. They do not reset the database, delete words or rewrite existing progress. Take the normal production database backup before migration; do not use `migrate reset` or `db push --accept-data-loss`.

The development database has these two migrations applied. Production was not accessed or changed during implementation. There are no email/push reminders or background auto-saving of all dictionary lookups; due words appear when learners open Vocabulary.

## Validation

Backend tests cover FSRS learning/graduation/relearning, answer disclosure, timezones, resume, automatic quiz/fallback, save content, duplicate saves, collection ownership and safe undo. Browser tests cover quiz → recall → completion, dictionary saving, lost-response recovery/resume through global Back, focused practice options, shared collection quiz presentation, collection search/layout, lightweight word details with outside/Escape dismissal, empty data and mobile dark overflow. Existing dictionary Practice/Exam/Score Report/Error Log tests remain relevant. Screenshots in ignored `tmp/vocabulary-*.png` use browser test fixtures for reproducible visual QA, not production user data.
