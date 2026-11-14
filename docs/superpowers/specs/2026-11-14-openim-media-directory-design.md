# OpenIM media, contacts and groups

User approved Explore's official default React Native Chat styling and real OpenIM integration. Keep original Home/Explore demonstrations distinct from real Chats. Reuse official Chat attachment sheet, voice recording, bubbles and theme. New contacts/group screens use React Native primitives, existing theme/avatar/icon components and Expo Router; no HTML replacement UI.

Media: image/video/file selection through official menu, audio through official recorder; platform adapters turn picked local data into OpenIM messages and upload using the SDK. Render persisted remote image/audio/file/video payloads, distinguish uploading/failure, allow retry. Never show a successful bubble for an unsent payload. Camera/location only exposed if implemented.

Directory: read friends, look up user ID, send friend request, accept/refuse, delete friend, open real chat. Groups: list joined groups, create with contacts, open group chat, list members, edit name/notice, invite/remove members by permitted role, leave/dismiss with confirmation. Server enforces authorization; UI hides disallowed actions. Async results scoped to logged-in user; errors visible.

Web is the runtime acceptance target; preserve separate native SDK/media implementation. iOS/Android builds are not claimed verified. Local backend remains isolated; verify uploaded bytes and real deliveries, not only simulated previews. Browser microphone access requires user permission if not already granted. Do not silently record.
