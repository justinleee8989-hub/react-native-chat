# OpenIM Media and Directory Implementation Plan

**Goal:** Add real attachments, voice, contacts and group management using official default RN UI.
**Architecture:** Existing shared OpenIM store with platform-specific SDK adapters; independent directory SDK modules and RN screens. SDK accessor is the narrow shared boundary. Existing Web assets keep native ES module worker resolution.
**Tech Stack:** React Native, Expo, TypeScript, official OpenIM WASM/RN SDK, local Go services/MinIO.

- [x] Media: test image/file/audio/video mapping and failures, extend client adapters and types, upload SDK-created media messages, wire official Chat callbacks, retain remote playback and retries.
- [x] Directory: add tested permission/pagination helpers, platform SDK adapters, RN contacts/friend requests/groups screens with real server mutations and visible errors.
- [x] Integration: add contacts/groups entry points, group conversation type routing and group details entry. Preserve original theme and pure RN UI.
- [x] Backend: verify MinIO advertised endpoints/CORS/upload and fetch, fix only IM-local settings if needed; no other project changes.
- [x] Verification: strict lint/types, focused new regressions and existing tests/build; run Web, verify two accounts exchanging uploaded file/media and group text plus contacts and group CRUD. Record native/microphone limitations accurately.
- [x] Document supported functionality and leave tested local service running with access address and accounts.

User confirmed implementation in chat. Continue existing feature branch and uncommitted first-phase work; do not reset or push.

## Verified 2026-11-14

449 library tests / 34 snapshots, 19 adapter tests; lint, root/example types, library build passed. Web export passed before the final recorder compatibility fix; final recorder was rebuilt and verified through Metro. Actual browser flow: file/image upload and reception, friend request acceptance, create/update/invite group, group text delivery, Chrome two-second microphone capture → Bob sends → Alice receives and plays. Audio persisted as type103/status2, duration2, 33140 bytes, HTTP200. Leave/dismiss/remove confirmation paths and native iOS/Android builds were not exercised end to end. No commits or pushes.
