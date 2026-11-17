# OpenIM product redesign

Approved by user on 2026-11-16: rebuild the actual RN product against `/Users/czzz/Downloads/openim-redesign-demo.html`, retaining real OpenIM integration, RN/native/web support and all original experience data. Explore and the offline demonstration are outside this change.

## Visual contract
Use the attachment's light/dark semantic colors, 32px mobile large titles, 52px mobile navigation, rounded grouped cards, 44px controls, circular avatars, segmented controls, blue outgoing bubbles, white/dark incoming bubbles, action sheets and confirmation dialogs. Desktop at 900px uses 72px rail, 340px list column and flexible detail, bounded by a 1360px/880px frame. Detail settings column max680, chat content max920. Mobile uses three bottom tabs (messages, contacts, my; groups remain inside contacts) and native safe areas; fake device chrome is presentation only and must not replace native system chrome.

## Functional mapping
Authentication: login, registration, reset and account security retain real validation, supercode/service settings, session persistence and failures. Product: chats/archived/new conversation; chat/settings/search/assets/readers; calls/history; contacts/find/received and sent requests/profile/remark/block; groups/create/join/requests/details/manage/members/invite; my/edit profile/notifications/privacy/theme/security. Retain SDK-powered attachment, recording, reply, forward, reactions, edit, revoke, retry, mention, draft, archive and search location functions. Never copy mock replies, fake success or time-based fake calling from reference.

## Architecture
Shared product design primitives in example/features/im/ui; existing domain/application/infrastructure stay authoritative. Product navigation adapts without creating duplicate connected stores or polling. Chat and list use forked @kesha-antonov/react-native-chat public render/theme customization; additive library API changes only if unavoidable and documented. Small focused files, no giant replacement screen or WebView.

## Validation
Compile/lint existing library and example, existing business/UI regression tests, web export, visual comparison against reference at mobile390 and desktop widths, light/dark, fresh/deep navigation, product tabs and key forms/dialogs. Use isolated QA accounts only; no destructive operations on existing data. Video real-media acceptance remains user's responsibility. Document any unavoidable platform difference or unsupported reference action explicitly.
