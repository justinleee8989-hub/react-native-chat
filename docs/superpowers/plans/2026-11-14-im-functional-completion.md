# IM functional completion

User requested continuing remaining pages after architecture cleanup. Keep official Explore Chat/ChatList UI, pure RN screens, platform SDK adapters, real local OpenIM. Existing feature branch is dirty; preserve all prior changes. No pushes, no backend data resets.

Scope domains run independently: (1) message quote/forward/revoke/search and readable notifications; (2) group applications, owner/admin actions, mute/transfer; (3) contact profile/remarks/blacklist, self profile and account flows supported by current ChatServer; (4) conversation pin/mute/search/clear/delete and settings entry integration.

Before implementation inspect pinned Web/RN SDK signatures and deployed server tags (server v3.8.3-patch.18, chat v1.8.4-patch.5). SDK-unsupported capabilities must be reported honestly, not simulated. External SMS/email verification cannot be faked; retain visible prerequisite/error states.

Test-first for new adapters/policy; keep business screens separated from SDK modules. All dangerous UI mutations use confirmation and backend permission checks. Never execute permanent destructive test actions without user confirmation. No real external calls/SMS or external recipient messages.

Root integrates routes and entries, runs root lint/typecheck/449+ tests/build, example typecheck/contracts and Web export. Restart localhost35881 and inspect all new routes; verify non-destructive real flows with Alice/Bob/Charlie. Record exact verified/missing scope and native limitations.
