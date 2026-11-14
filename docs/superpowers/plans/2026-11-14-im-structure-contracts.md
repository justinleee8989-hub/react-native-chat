# IM structure and contract alignment

User approved incremental cleanup before additional features. Preserve official UI, routes, existing work and backend data. No push or dependency upgrades.

## Design

Keep src/ as reusable official library. Keep Expo example runtime but isolate actual business under example/features/im: auth, conversations, messages, contacts, groups, shared, application, domain, infrastructure. Route files only mount screens. Official Explore/demo code remains in components/chat-examples and chat-list; business never imports demo data/state. Share directory operations via a typed SDK port; only unwrap responses at platform boundary. Split login HTTP, event subscriptions and message actions away from session coordinator. Do not add a second framework or backend gateway.

## Execution

- [x] Record deployed server/chat tags and SDK package versions; inspect source using deployed tags rather than assuming current checkout equals running image.
- [x] Add contract tests for login token separation/malformed responses and normalized SDK directory results; run before implementation.
- [x] Move real screens and adapters to feature folders, update explicit imports and existing tests, remove old duplicate modules.
- [x] Extract auth API, runtime state, message actions and event subscription from store; retain account-generation safeguards; test late events after logout.
- [x] Share contact/group service operations behind native/web SDK ports with result validation; use domain types and normal multiline UI formatting.
- [x] Run root lint/typecheck/tests/build and example typecheck/tests/Web export, then restart local service and browser-check login, persisted media, contacts/groups and real text delivery.
- [x] Document architecture, exact backend baseline, scope and remaining native verification. No backend business changes unless contract evidence demands them.

Acceptance: old routes work; no raw SDK imports in business screens; no demo-data imports in real screens; platform-specific response differences stay in infrastructure; tokens remain distinct; existing and new regressions pass. Native build remains unverified, explicitly reported.

## Verification result

2026-11-14: root 449 tests / 73 suites / 34 snapshots passed; 27 OpenIM/SSR/boundary tests passed; root and example typechecks, root lint, library build, Web export passed. Browser: fresh Alice login/logout, session restore, contacts Bob/Charlie, group list/details and save response, Alice→Bob and Bob→Alice new messages, persisted image/file display and voice playback passed after migration. Test messages at 15:31 local. Existing Chrome wallet extension injects an unrelated setServer error; browser trace identifies chrome-extension origin and it was dismissed without modifying extension or application error handling.

No backend code/schema changes, dependency version changes, commits or pushes. Runtime remains localhost:35881. Native builds remain unverified. Backup before migration: /tmp/im-structure-before-20261114. Layout stays in Expo example runtime, real business separated under features/im.
