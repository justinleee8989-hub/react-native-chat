# OpenIM Integration Implementation Plan

**Goal:** Retain the official React Native Chat example UI and run real local login, conversations and bidirectional text messaging.

**Architecture:** Platform-specific OpenIM SDK adapters feed a shared session/message store and existing ChatList/Chat components. The local Docker stack provides IM and account services. Web is the first verified runtime; native adapters preserve platform support without claiming simulator verification.

**Tech Stack:** Expo, React Native Web, TypeScript, OpenIM Web/RN SDK, Go services, Docker Compose.

- [x] Deploy a compatible local OpenIM stack, seed two accounts and verify account login.
- [x] Install pinned Yarn dependencies and build the existing library.
- [x] Add platform adapters, authentication/session persistence, conversation mapping, history loading and real message event handling.
- [x] Connect original Chats routes and add a React Native login screen; keep Home/Explore examples separately identified.
- [x] Verify failure handling, deduplication, logout cleanup and text delivery with focused tests.
- [x] Run root lint/typecheck/test/build and example typecheck. Start web and verify two-account exchange plus refresh persistence.
- [x] Document startup, test accounts, limits and local URL.

Approved by user in chat on 2026-11-14. No remote push or publishing is required.

## Verification result

Browser: both email accounts logged in; Alice sent Chinese text, Bob received and replied, Alice received live. Reload restored Alice session and both messages. Bob logout and invalid-password rejection passed; re-login and open userID alice passed.

Root lint/typecheck/build passed. Example typecheck and 7 integration/SSR tests passed. Web static export passed after fixing upstream demo server snapshot. Root test baseline: 443 passed, 2 snapshot failures limited to internal gesture handlerTags; no library source or root lockfile changes, snapshots not overwritten. Native runtime remains unverified.
