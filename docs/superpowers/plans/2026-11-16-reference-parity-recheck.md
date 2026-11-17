# Reference parity recheck

Reference: `/Users/czzz/Downloads/openim-redesign-demo.html`.
Scope: actual RN/OpenIM application; preserve original experience data, backend permissions and platform adapters. All testing uses independent QA fixtures.

## Work checklist
- [x] Shared list vs grouped rows, primary/pill buttons, action sheets, centered headers, switches and fixed page controls.
- [x] Auth/contacts/groups/profile page hierarchy, modal semantics and success navigation.
- [x] Chat list/menus/composer/rich messages/mentions/search and source navigation.
- [x] Source review of every reference screen and real-data exceptions.
- [x] Browser comparison in light/dark and desktop/phone layout; navigation, menu, dialog cancellation, validation and return paths. Destructive submissions are covered by guarded regression tests rather than live deletion.
- [x] Lint/typechecks/regressions/build and local deployment.

## Reference screen coverage
Auth: login, register, reset.
Conversation: chats, archived, newChat, chat, chatInfo, search, media, readers.
Calls: calls, callHTML overlay and connected call.
Directory: contacts, addFriend, newFriends, profile, profileMore.
Groups: groups, groupCreate, groupJoin, groupReqs, group, groupManage, members (view/manage), groupInvite.
Account: me, editProfile, notify, blacklist, security.
Overlays: list action sheets, contact/member sheets, appearance/avatar sheets, prompts/confirmations, message context/reactions, attachment/emoji/mention, card/location, forwarding, image preview.

## Real-service differences that must not be faked
No mock contacts/media, fake online states, timed auto-answer, simulated incoming call, demo reset, fabricated delivery/read counts or call duration. Server validation, pagination, error/busy states and credential security remain. Media permissions and destructive account operations are not executed against original data.

## Recheck progress — 2026-11-17
- Directory/auth/account: 22 reference screens implemented and source-reviewed. Root lint, example typecheck and 27 focused tests passed. Final review found bounded-value truncation, success toasts, contextual delete return and Web prompt focus outline for the integration cleanup.
- Browser directory check: independent QA B covered login, contact/request/group/profile/settings navigation, modal cancellation and light/dark/phone layouts. QA A separately checked owner management/member menus. No original experience data was edited. Write operations were not exercised by this pass. A QA-only call was accidentally initiated during navigation and immediately cancelled; no media was enabled.
- Chat/composer/search/context-menu and call-overlay parity is in progress. Final build, settled-runtime browser verification and full regression gates remain pending.

## Final result — 2026-11-17
All source-review findings from this recheck were resolved. The 30 reference screens and their shared overlays were reviewed against the attachment. Actual browser checks used only the independent redesign QA accounts; original experience accounts/data were not changed.

### Corrections
- Separate list/card row geometry, inset separators, centered headers, primary/pill buttons, branded switches, itemized action sheets with independent cancel, frame-constrained overlays, prompt dimensions/theme/keyboard handling.
- Real registration-to-login flow with safe login-only retry, creation-to-group-chat navigation, success feedback, contextual return paths, bounded long values, and role-checked group actions.
- Direct chat-information entry, corrected list/menu/composer dimensions, real friend-card/member pickers and location form, trailing-@ behavior, rich payload presentation, 6-reaction custom menus with no inactive actions on unsent messages.
- Debounced server history search with stale-response protection, source-message return without duplicate navigation, actual group counts/read data where provided, fixed file/link rows and image/call overlay containment.
- Fixed the runtime RN Web empty-list warning by giving custom empty content a measurable View instead of a Fragment. Rebuilt and verified that an unmatched search no longer raises the warning.

### Verification evidence
- Root lint/typecheck and example typecheck: pass.
- SDK: 77 suites / 463 tests / 34 snapshots: pass.
- Product UI: 17 suites / 58 tests: pass.
- OpenIM business suite: 221 tests: pass (no further business changes after this run).
- Final SDK build and Expo web export: pass, 60 web bundles; export at `/tmp/im-parity-web-export-final`.
- Browser: auth/directory/group/account navigation, owner/member menu visibility, prompts/cancel, light/dark and desktop/phone layouts; chat menus, auto-search/result positioning/back, assets/source jump, @ picker with single insertion and draft cleanup, readers, card/forward pickers, emoji, location validation and cancel. Local app remains at `http://127.0.0.1:35881/`.
- Detailed local reports: `/tmp/im-parity-directory-qa.json`, `/tmp/im-parity-chat-qa.json`; final gate logs `/tmp/im-parity-final-*.log`.

### Limits and intentional real-service differences
- Original data was not used for destructive write tests. Native physical-device/soft-keyboard and real audio/video capture were not retested in this visual recheck.
- Real session, validation, permissions, errors, busy states and pagination remain. No demo reset, fake incoming calls, automatic answers, simulated media or fabricated online/delivery/read/duration values were added.
- List search covers names and loaded message bodies; full accessible history is queried per conversation through the existing server endpoint.
- Tests emitted existing Node module-type/Jest open-handle warnings; all commands exited 0. No code was committed or pushed in this recheck.
