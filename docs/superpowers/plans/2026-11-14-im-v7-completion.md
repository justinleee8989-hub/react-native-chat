# IM v7 reliability and conversation details implementation plan

Goal: Fix the five audited gaps, add true group read/unread details and conversation assets, preserve original RN UI and platform adapters, deploy and verify only isolated QA data.
Architecture: Keep official Chat/ChatList components. Attachment work is an account-scoped resumable batch, preserving original message IDs for retry and newer drafts. Read details come from an authenticated ChatServer endpoint using OpenIM messages, current group membership and real read cursors; never expose admin credentials. Assets use locally synchronized SDK history with image/file/link tabs and original message links. Existing dirty checkout is continued in place; no commit, reset or data migration.

- [x] TDD refresh epoch guards and resumable attachment batches (failed preparation/send/caption, newer draft, retry without duplication, account isolation). Put state machine outside ChatScreen; native media lifetime kept until send/discard. Show pending/retry controls in existing themed RN style.
- [x] Replace old demo profile route with actual conversation assets page; add image/file/link tabs, pagination, errors, safe URL opening and jump to original message. Add route tests and extraction tests (edited text, revoked exclusion, no duplicate items).
- [x] Harden OTP generation with crypto/rand; remove plaintext code logs; implement atomic failed-attempt reservation and send throttling in source and exact-tag deployed counterpart. Preserve real Mailpit env override; do not mistake default YAML for effective config. Test without sending to original accounts.
- [x] Add ChatServer group read-status endpoint: auth, current membership, own existing group message ID/seq validation, input limits; exclude sender and members joined after message, compare server read seq to message seq, bound upstream concurrency and paginate UI; fail explicitly on unavailable upstream data. Add denial and classification tests.
- [x] Add themed RN read-status screen with tabs/counts/refresh/pagination and message action on own sent group messages. No guessed SDK methods or fabricated read state.
- [x] Lightweight models run targeted regressions and complete root/example checks plus Go race. Main reviews diffs, builds with Metro stopped, deploys only ChatServer v7 preserving volumes, restarts 35881.
- [x] Fault-injection regression for pending retry/draft preservation; QA-only browser/API acceptance for gallery/files/links jumps, read/unread update and forbidden reader access, Mailpit OTP valid/invalid/limit behavior. Never edit original Alice/Bob/Charlie or group2085621744. User video/native acceptance excluded.
- [x] Update reproducible exact-tag patch, deployment docs and acceptance report with verified results and limitations.

Verification recorded so far (2026-11-14):
- Root lint/typecheck/build passed; root Jest 73 suites, 455 tests and 34 snapshots passed (worker shutdown warning; all suites passed). Example typecheck and 174 business tests passed.
- Source and exact-tag Go race tests passed for API, RPC, verification-code model and database packages. Crypto code, atomic attempts, sliding-window reservations and failed-send release have isolated Mongo coverage.
- Live Mailpit QA registration/reset/password checks passed. Live 32 wrong-code attempts admitted exactly 5 failures; correct code rejected after exhaustion. Following 2 sends, 24 concurrent send requests admitted 8 and rejected 16 against a 10/day limit.
- Real reader API testing exposed the official JoinTime millisecond unit; added realistic timestamp and exact-join-boundary regression, confirmed RED then GREEN, corrected comparison and deployed v7.1. Nonempty result now classifies 2 real QA members and matches OpenIM read cursors.
- Local image: local/openim-chat:v1.8.4-patch.5-audit-v7.1. Only ChatServer replaced; frontend remains http://127.0.0.1:35881/chats. Exact-tag patch applies cleanly (35 files).

Final acceptance (completed 2026-11-15 local):
- Browser QA: conversation settings asset entry and legacy profile route render real data; image/file/link tabs each contain one real QA item. Image preview opens/closes and locates the original image (seq11); link and file original-message jumps succeeded.
- File opening produced real browser downloads: three matching qa-file*.txt downloads, each 78 bytes, byte-identical to the uploaded QA object. System file-picker automation is excluded; attachment failure/resume/caption behavior is covered by controlled regression tests.
- Own-message menu opens group readers; two current non-sender members display, read/unread tabs and refresh work. Separate API QA verified unread→read transition with final counts 1 read / 1 unread.
- Screenshots: /tmp/openim-v7-assets-links.png, /tmp/openim-v7-assets-preview.png, /tmp/openim-v7-readers.png. Reports are in local-deploy/v7-{readers,otp,assets-fixtures}-verification.json and omit credentials.
- Original Alice/Bob/Charlie and group2085621744 were not operated on; only isolated QA messages, files, accounts, mail and QA read cursors changed. Native-device acceptance and user video acceptance remain outside this round. No commits or pushes.
