# Full product page alignment — 2026-11-17

Reference: `/Users/czzz/Downloads/openim-redesign-demo.html`.
Implementation: the actual RN/OpenIM product in `example/features/im`; official SDK defaults and Explore remain unchanged.

## Coverage and changes

The 30-page source inventory is in `2026-11-17-non-message-source-parity.md`. This follow-up includes PC and mobile responsive values, not a claim that all rendered pixels have been inspected.

- Login/register/reset: shared focus, disabled, link and service-configuration styles; real authentication retained.
- Conversations/archive/new chat: reference empty states, grouped fields, buttons, sidebar search and selection behavior.
- Contacts/friend requests/profile/blacklist: grouped rows, action sheets, profile typography, real pending badges across all API pages, desktop right-click menus.
- Groups/create/join/applications/manage/members/invite: reference shared field/card/tag/picker styles; existing permissions and real mutations retained. Ordinary member-list spacing corrected.
- Account/edit/notifications/security: shared reference styles, real persistence and existing validation retained.
- Chat settings/search/assets/readers: reference grids, sections, sheets, empty states; reader-role lookup now paginates all members and no longer fabricates a default role for unknown members.
- Chat messages: PC/mobile margins, group sender labels outside bubbles, 30px avatars, flat first-character product avatars, last-message corners, outside reactions, edit label, receipt spacing, and visible retry action.
- Images: real orientation metadata, mobile 210×150 / 170×220 and desktop 280×200 / 220×290; shared frame-scoped black preview with actual images and loading-error feedback. SDK transfer/cancel/retry flow remains authoritative.
- Voice playback: compact waveform appearance and animation, true Expo audio state, SDK playback exclusivity and recorder interruption. Product disables SDK now-playing bar and auto-next; defaults remain unchanged elsewhere.
- Composer: external reply/edit banner, more/emoji panels, reference icon/grid sizes, desktop Enter sends while Shift+Enter and IME composition do not. Sending closes attachments and preserves emoji panel.
- Recording: tap starts real SDK capture, persistent timer/cancel/send row, panels close; startup cancellation and asynchronous stop completion block overlapping restart. Existing recording cleanup and duration validation retained.
- Quote navigation: loads missing history before scrolling/highlighting; repeated taps and stale-result cleanup are covered.
- Calls: existing real authority, terminal records, connected timing, media control and cleanup retained. Source-reviewed call presentation was not replaced with prototype auto-answer or fabricated states.
- Desktop navigation: separate full nested state snapshots per section, origin section preserved, sidebar replaces detail chain, correct back depth, initial credential hydration preserves deep links, session replacement clears snapshots, transient call screens are not restored.

## Data and scope

Original experience accounts, conversations, groups and media were not modified. The resumed visual pass used the independent QA account 安卓对端 (8300960407) and its existing QA peer (2632927198). It created group QA-视觉对照-20261117 (31059607), sent one QA text, started and ended one local managed call with microphone/camera off, and archived then restored only that new conversation. Light/dark appearance was restored to light. No destructive confirmations or credential changes were submitted. No commits or pushes were made; backend deployment was unchanged.

Additive SDK opt-ins (`MessageAudio.renderPlayer`, `VoiceMessageInput.renderControl`, `MessageImage.onPressImage`, browser context-menu opt-in and composer inset width) are documented in README/llms; default behavior remains covered by the SDK suite.

## Verification

Final verification completed:

- Root lint, source typecheck and example typecheck: exit 0.
- SDK tests: 82 suites, 475 tests, 34 snapshots passed.
- Product UI tests: 33 suites, 108 tests passed.
- OpenIM business tests: 234 passed.
- SDK build and final H5 static export passed. Export: `/tmp/im-visual-final-web`.
- `git diff --check` passed.
- Local Metro restarted; `http://127.0.0.1:35881/` returned HTTP 200.

Logs: `/tmp/im-final-sdk.log`, `/tmp/im-final-ui.log`, `/tmp/im-visual-final-openim.log`, `/tmp/im-visual-final-export.log`; earlier gates: `/tmp/im-all-pages-*.log`. The lint run retains a Node package-module-type warning; Jest retains a worker/open-handle warning. These are not represented as zero-warning runs.

The final mobile composer also handles bottom safe-area inset and keyboard height without moving the custom recording control outside the input area.

## Resumed browser comparison after explicit approval

The previous browser access blocker was resolved. The user authorized serving the reference on loopback only; an unchanged copy runs at `http://127.0.0.1:36993/`. Reference SHA-256: `65ee5b61dfbdce42551001339772ea74dc3e452888cb55f22422af39d91058f3` (original and served copy independently verified equal). Actual application: `http://127.0.0.1:35881/`.

Observed at desktop 1440×900 and mobile 390×844, with the reference's phone preview:

- Desktop: login, register, password reset and service configuration navigation; My, profile edit, security, notifications, blacklist; contacts, friend request tabs, lookup and contact detail/remark cancellation; group list/create/detail/manage/members/invite/request tabs and canceled owner-transfer prompt; chat list/new-chat, chat details, assets tabs, readers, reply and attachment panels.
- Mobile: message list, chat, read/unread list, contact/group list, join-by-ID form and back navigation, My/security/call history, appearance sheet and dark/light switching, search result positioning, chat details, archive/recovery, forwarding and contact-card picker, and the local call screen followed by an ended invitation.
- Mutating checks were limited to the QA group above. Viewing a prompt does not imply its destructive/server action was executed.

Corrections found in actual browser observation include the Expo `__root` navigation wrapper, blank neighbor-message objects that crashed the first group message, desktop header/input insets, large header minimum height, picker/section spacing, sheet shadows, profile selection ring, group-confirmation labels and archive labeling. Regression tests cover these fixes.

## Follow-up menu and call acceptance — 2026-11-17

This follow-up supersedes the earlier right-click and call-state acceptance limits. The in-app browser delivered actual desktop right-click correctly; the prior Chrome automation failure was not reproduced. All diagnostic instrumentation remains removed.

| Scenario | PC | H5 (390×844) |
| --- | --- | --- |
| Message actions | Right-click opens the complete product menu; reply works | Long press opens menu; copy matches QA text; edit prefilled, then canceled |
| Incoming call | Real caller identity, accept/reject controls | Full-screen incoming presentation; reject and accept exercised |
| Caller cancellation | Overlay closes; canceled message/history | Same real cancellation and history |
| Recipient rejection | Caller shows 对方已拒接, recipient 已拒接 | Incoming rejection and history verified |
| Unanswered timeout | Real server timeout; 未接通话 message/history | Real timeout and missed history verified |
| Connected/end | Real room connection, elapsed timer, hangup | Real connection and hangup; ended record with duration |
| Group call | Group avatar, card centered over whole product frame | Full-screen group presentation; hangup returns to fresh history |

Corrections from browser comparison: standards-compliant SVG radial gradient for Web/native; removal of extra desktop scrim; whole-frame call-card centering; transparent call route preserving the page behind it; stable group avatar identity/shape and rings; tabular timer digits; removal of transient 通话提示 on normal ending; reference history typography; focus-triggered history refresh; call-history deep links belong to My; connecting/signaling reconnect no longer incorrectly say disconnected. The final connection-label fix was observed live as 正在连接… before 已连接.

The reference's fabricated auto-answer is deliberately not used. Browser volume retains the accurate label 声音 rather than implying native earpiece routing. Actual server authority and failure feedback remain intact.

Only the independent QA pair (8300960407/2632927198) and group 31059607 were used. Additional test call records were created; all calls were ended. No original experience messages, contacts, groups, roles, passwords or media were changed. No message deletion/clearing was performed. Cameras stayed off; the browser denied microphone capture, and the real permission feedback was retained. This verifies signaling, presentation and controls, not audio/video quality. User video testing and native-device acceptance remain separate.

Final follow-up gates: UI 34 suites / 124 tests; OpenIM 234 tests; root lint (zero lint errors/warnings, existing Node package-type warning remains), root and example typechecks all exit 0. H5 export succeeded at `/tmp/im-call-parity-final-web`; `git diff --check` passed. SDK was unchanged in this follow-up; its preceding 82-suite / 475-test / 34-snapshot run and build passed. Live source app remains at http://127.0.0.1:35881/.

Evidence logs: `/tmp/im-state-label-ui.log`, `/tmp/im-state-label-openim.log`, `/tmp/im-state-label-lint.log`, `/tmp/im-state-label-root-typecheck.log`, `/tmp/im-state-label-example-typecheck.log`, `/tmp/im-call-parity-final-export.log`.

This is acceptance of the listed menu/call scenarios, not a claim that every unrelated product error or permission state has been exhaustively replayed. No commit or push was made.
