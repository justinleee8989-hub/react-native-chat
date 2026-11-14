# IM follow-up completion

User approved fixing the five audited gaps, then drafts and message enhancements, retaining official RN UI and existing platform adapters. Preserve original data; only independent QA fixtures. No native/video acceptance or production provider setup.

1. RTC state: invitation expiry only limits fresh admissions; active leases sustain group calls. Separate historical participants from active media members. Backward-compatible Redis snapshots; unit/race regression before implementation.
2. Frontend RTC invitations: authoritative status check; prevent retrying a terminal invitation; provide a clear restart action. No expired room resurrection.
3. Login: transient transport/sync errors retain session and allow retry; only confirmed auth invalidity clears credentials. C2C/group read events validate target conversation and update loaded sender messages.
4. Drafts/typing/mentions: use pinned official SDK APIs, per-user/conversation isolation and async generation checks. Preserve Chat controlled composer/default UI.
5. Edits/reactions: inspect pinned server and SDK before selecting compatible persistent transport. Enforce authenticated actor, original author for text edits, real message/conversation membership, revoked-message refusal; no client-forged attribution. Use official edit/reaction UI. Persist across reload and sync to both clients.
6. Run focused regressions, root lint/typecheck/test/build and example tests/typecheck; rebuild only changed local services. Verify real QA accounts and browser pair, original data untouched. Document exact outcomes and limitations. Lightweight agents handle tests.

File boundaries: rtcauthority/state.go/tests for lifecycle; application/store.ts/events.ts for session/receipt; separate SDK adapters and application modules for composer enhancements; ChatServer extension package/API if the pinned SDK lacks an official operation. No destructive migration or version upgrade.
