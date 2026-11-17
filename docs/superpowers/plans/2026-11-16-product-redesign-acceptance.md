# Product redesign acceptance — 2026-11-16

Reference: `/Users/czzz/Downloads/openim-redesign-demo.html`.
Actual RN product: http://127.0.0.1:35881/chats . Branch: feat/openim-integration. No commit or push performed.

## Implementation
The product uses the forked Chat/ChatList and RN primitives, real OpenIM services and existing platform adapters. Shared semantic tokens, responsive shell, authentication, contacts/groups/settings, chat/composer, search/assets/read receipts, forwarding and call views follow the supplied reference. Explore defaults remain isolated. SDK changes are additive: optional toolbar placement/recording appearance and public existing attachment picker helpers.

## Verified
- SDK build and root typecheck passed; SDK regression: 461 tests and 34 snapshots passed.
- Final root lint and example typecheck passed.
- Final UI regression: 37 tests / 14 suites passed.
- OpenIM business regression: 221 tests passed.
- Final Expo web export passed to `/tmp/im-redesign-web-export`.
- Independent browser QA used only new accounts A 1494717211, B 6629292356 and new group 646751305. Original experience data was not changed.
- Login/register/reset navigation, contacts/request tabs/profile/remark cancellation, group/member/invite/management visibility, My/settings and reversible QA notification change checked.
- Real two-way text/emoji messaging, list update, draft restoration, message/list menus, batch cancellation and new-chat picker checked.
- Real local file upload appeared in chat and file directory. Asset original-message navigation and actual history search result location passed.
- Group read/unread screen returned real 0 read / 1 unread member and owner role in independent QA.
- Call outgoing/cancel/notice dismissal and server history checked without activating microphone or camera.
- Desktop, 390px product phone preview, light/dark and return navigation checked. Width-change message overlap fixed via Legend List size-only cache refresh; input and draft survive layout changes.
- Clear/delete confirmations opened and canceled only; no destructive data acceptance performed.

## Limits and operational notes
This run validates H5 and shared RN source; Android/iOS native gestures, keyboards, permissions and actual video/audio media require device acceptance and were not newly claimed as passed. Browser viewport override did not change IAB dimensions, so narrow-layout evidence is the product 390px preview, not a physical mobile browser. No fake online/call states, mock incoming calls or demo reset controls were introduced. Production email/SMS/push and earlier external-service exclusions remain outside this redesign.

First web export encountered a cached path from an older temporary offline copy; source/config were correct. Export with `--clear` resolved it, and the subsequent final export passed without the flag.

## Desktop navigation follow-up — 2026-11-17

The shared ProductFrame now owns account-and-token-scoped navigation snapshots for desktop web. Rail switches restore real root and nested stack state through a root-targeted RESET action, preserving the section's complete back trail. The nearest underlying `(tabs)` route determines the section, so My → call history stays in My and chat → profile stays in Messages. Unvisited sections start at their tab root; sidebar entries clear the preceding detail trail before opening their new detail. Active call routes are excluded from saved snapshots. Native/mobile retain ordinary router navigation. Initial credential hydration preserves deep links; replacing an authenticated account clears saved section history and the previous detail stack.

Default desktop page headers hide Back at the first detail and expose it deeper in the section. The archived list follows the same visibility rule; custom authentication callbacks remain unchanged. The obsolete last-target-only history helper and tests were removed.

Validation for this navigation change: targeted Jest run passed 6 suites / 20 tests, covering full-stack restoration, root-targeted reset, master reset-before-push, account isolation, call-route pruning, native fallback, section depth, page Back visibility, and existing shell/sidebar regressions. Navigation/header targeted lint passed. The example typecheck reported no production navigation errors, but the overall command remained blocked by concurrent message/SDK declaration changes and test-file typing at that checkpoint; the parent acceptance run owns the final full gates. No browser, device, build, server restart, backend data mutation, commit, or deployment was performed in this navigation follow-up. Runtime visual acceptance of these follow-up changes remains unverified.
