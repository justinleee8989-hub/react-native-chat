# Non-message source parity follow-up — 2026-11-17

Reference: `/Users/czzz/Downloads/openim-redesign-demo.html` (30 `SCREENS` definitions). This is a **source review**, not a rendered PC/mobile visual acceptance result. Browser observation remains blocked by the previously reported security policy; no alternate browser or indirect inspection was attempted. No QA account, message, group, or other server data was mutated.

## Coverage inventory

All rows share the audited RN product tokens, responsive page/header, grouped cards, action sheets, prompts, confirmation dialogs, and toast components. “No additional local change” means the reference structure/actions were inspected and no additional change was made in this pass; it does not assert pixel identity or live backend acceptance.

| Reference screen | Product source | This pass |
| --- | --- | --- |
| chats | conversations/ChatListScreen | Parent owns message/list review; navigation request badges and sidebar primitives updated here. |
| archived | conversations/ChatListScreen | Parent owns list empty-state review. |
| newChat | conversations/NewMessageScreen | Replaced authentication field/generic action with grouped SettingField and primary ProductButton. Real openConversation retained. |
| chat | messages/ChatScreen and parts | Parent owns message/composer/media source review. |
| chatInfo | conversations/ConversationSettingsScreen | Member grid inset, dashed invitation border/color and grouped values aligned; real pin/mute/archive/clear/delete retained. |
| search | messages/HistorySearchScreen | Result section spacing and empty states aligned. Real debounced history search, paging, exact message navigation retained. |
| media | messages/ConversationAssetsScreen | Native ProductSheet items replace incorrectly padded card rows; file/link tiles, link weight and empty states aligned. Real URLs/message targets retained. |
| readers | messages/MessageReadersScreen | Reference title and empty states aligned; server counts and join-time exclusions retained. |
| calls | calls/CallHistoryScreen | Empty state aligned; reference tap behavior is to start another call, retained. Server statuses/timing retained. |
| contacts | contacts/ContactsScreen | Empty state, desktop search inset and shared title styling aligned. Real paginated directory retained. |
| addFriend | contacts/AddFriendScreen | Empty state and grouped field label geometry aligned. Real lookup/pending request restrictions retained. |
| newFriends | contacts/FriendRequestsScreen | Empty state aligned. Incoming/outgoing tabs and actual responses retained. |
| profile | contacts/PersonScreen | Hero title tracking aligned; real block/friend/self restrictions retained. |
| profileMore | contacts/PersonScreen | Reviewed remark/block/delete sheets and prompts; no additional local action changes. Shared confirmation/prompt components retained. |
| groups | groups/GroupsScreen | Empty state aligned; new-group sheet and real pending applications retained. |
| groupCreate | groups/CreateGroupScreen | Shared picker empty state and grouped field geometry aligned. Real creation and post-create retry retained. |
| groupJoin | groups/JoinGroupScreen | Shared field labels aligned; inspected confirmation and actual application; no additional local action changes. |
| groupReqs | groups/GroupRequestsScreen | Empty state aligned; real permission checks and response actions retained. |
| group | groups/GroupScreen | Hero padding/line height/tracking and grouped values aligned. Real member data and calls retained. |
| groupManage | groups/GroupManagementScreen | Shared field/member-tag/grouped-value typography aligned. Permission revalidation and all real operations retained. |
| members | groups/GroupManagementScreen | Shared member tags aligned; existing role ordering, paging, role/transfer/mute/remove actions inspected. |
| groupInvite | groups/InviteGroupScreen | Shared picker empty state aligned; full existing-member paging and pre-submit permission/membership checks retained. |
| me | navigation/MyScreen | Desktop card insets, big profile row spacing and value typography aligned. Real account actions retained. |
| editProfile | profile/SettingsScreen | Shared grouped label/value geometry aligned; real camera/library upload and profile persistence retained. |
| notify | profile/SettingsScreen | Shared value/row primitives reviewed; real global receive option retained. |
| blacklist | profile/SettingsScreen | Reference empty title weight/color/spacing aligned; real list and unblock retained. |
| security | profile/PasswordForm | Shared grouped field geometry aligned; existing validation, confirmation and real password/logout flow inspected. |
| login | auth/LoginScreen + AuthForm | Focus border, disabled opacity, link weight and expanded service spacing aligned. Real login/recovery retained. |
| register | auth/AccountScreen + AuthForm | Shared auth styles aligned. Email service availability and real verification gating retained. |
| reset | auth/AccountScreen + AuthForm | Shared auth styles aligned. Email service availability and real verification gating retained. |

## Shared behavior corrections

- Navigation now counts all pending incoming friend/group application pages, refreshes on SDK directory events, cancels obsolete responses and isolates counts by account/token. Desktop rail and mobile tabs show the result.
- Desktop navigation now saves the actual nested Expo navigation state per section. Root-targeted resets restore its back chain, sidebar selection replaces the old detail chain, and section ownership follows the originating tab. Snapshots reset across account/token changes and omit transient call routes. See the combined follow-up below.
- Shared empty states now use reference title/subtitle color, weight, line height and padding. Shared large headers, big profile rows, grouped label width, member tags and segment weight were corrected.
- Desktop blank panels now include the reference logo tile and constrained centered explanatory text; mobile inactive tab icon color uses the tertiary token.

## Boundaries and remaining uncertainty

- No rendered pixel comparison or live destructive-action acceptance was performed. Responsive source values and real backend callbacks are inspectable, but animation/hover/focus behavior across native/web still needs rendered acceptance.
- The prototype fabricates email verification, media, calls, location and account data. Production availability/error/loading/pagination states intentionally remain real and are not removed to imitate the seed data.
- Desktop stack restoration, origin section and header back depth now have source and automated coverage; rendered browser/native navigation acceptance is still not claimed.
- Parent owns message, composer, media bubble and call source completion and overall validation. No SDK build/restart, commit, or push was performed by this task.

## Verification

- New pending-request tests were observed failing at 0 versus expected paginated totals, then passing with real counting logic.
- New tab-history tests were observed failing at tab roots versus saved targets, then passing with account-scoped memory.
- Final combined targeted contact/group/search/navigation/confirmation/auth/security run: 9 suites / 37 tests passed. `git diff --check` passed.
- Root lint found no errors in owned files; it reported 5 errors in the parent's concurrently edited audio/message files. Parent owns final combined lint.
- Example typecheck passed before parent started the new audio renderer; subsequent temporary errors concerned the parent's in-progress audio API. Final combined verification is recorded by the parent task.
- Jest reports its existing forced-exit/open-handle notice; ESLint reports the existing Node module-type notice. These are not hidden as zero runtime warnings.

## Combined follow-up

Parent completed message/composer/recording/image-preview alignment, real older-quote loading, reader role pagination, and full desktop navigation follow-up. See `2026-11-17-all-pages-alignment.md` for combined verification and the remaining visual acceptance limitation. Earlier intermediate lint/typecheck observations above are historical, not final gate results.

## Follow-up status

The earlier browser restriction described above is historical. Explicit user approval enabled local reference/application observation; see `2026-11-17-all-pages-alignment.md` for the observed desktop/mobile coverage, QA-only mutations and remaining mouse-event acceptance limit.
