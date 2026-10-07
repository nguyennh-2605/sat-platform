# Landing product screenshots

Captured October 7, 2026 from the actual local SAT Platform client and API using the owner-authorized student account. No credentials, cookies, or tokens are included in the assets or source files.

Assets live in `client/public/landing/`. Each of `practice`, `error-log`, `vocabulary`, and `analytics` has four WebP variants: `-desktop-light`, `-desktop-dark`, `-mobile-light`, and `-mobile-dark` (16 images total). The landing selects the appropriate theme and mobile crop, reserves image space, and handles loading failures.

## Source views

| Feature | Captured view | Data and capture scope |
| --- | --- | --- |
| Practice | Existing Digital SAT Practice Test #1 setup | Captured mode and timing controls before starting. No new attempt was started or submitted. |
| Error Log | Search results for `Worked example` | Two owner-authorized manual notes explain linear equations and words in context. They are labeled worked examples, contain full reflections, and are marked reviewed by the existing API. No existing notes or scored answers were edited. |
| Vocabulary | Existing Official SAT Library flashcard session | Resumed the existing session and captured the word `ubiquitous`. No flashcards were rated and no quiz was submitted. |
| Analytics | Reading & Writing skill performance | Captured actual existing results with Craft and Structure expanded. Values were not altered; accuracy is not an SAT score. |

The two added Error Log entries are `f5301578-7711-43ca-a8b2-c7fa59431ad7` (linear equations) and `5b7d7a63-ad95-485b-861e-ef87a88f4932` (words in context). Both are manual learning examples, not records of a scored test attempt.

## Refreshing the images

1. Use an authorized account and actual API-backed views. Inspect the content for personal information before capture.
2. Capture each view in both themes at desktop and mobile widths. Crop out account identity, sidebar, and unrelated classroom content. Keep explanatory labels and controls readable.
3. Preserve truthful results. Do not add fabricated scores or modify existing learner history for marketing screenshots. Label any manually added teaching examples explicitly.
4. Export WebP, update dimensions in `ProductShowcase.tsx` if crops change, and verify both responsive sources and full-size links.
5. Check the landing in both themes, reduced-motion mode, and narrow mobile widths. Record the new capture date and source changes here.

These are static product illustrations, not a live account dashboard. Captions identify their context; future product UI changes should trigger a screenshot refresh.
