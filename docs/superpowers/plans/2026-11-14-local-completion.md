# Local IM completion plan

Scope approved: local mail inbox and self-hosted RTC; preserve default RN UI and original accounts/data. Exclude mobile builds/device testing, production SMS/email delivery and mobile push provider activation.

- [x] Enforce owner-only role mutations on server, preserving system-admin bypass and profile checks; unit test with lightweight test agent.
- [x] Deploy localhost-only Mailpit and LiveKit with pinned images; preserve all existing volumes.
- [x] Verify real frontend email registration/reset against Mailpit and enable the local UI flag.
- [x] Harden ChatServer RTC token identity and isolate JWT builders per request.
- [x] Add RN call room screen with web/native media adapters, invitations, join/leave, microphone/camera controls, error handling; no fake successful call state.
- [x] Regression on isolated accounts: roles, mail, calls, core messaging. Lightweight agent runs bounded tests; primary reviews code/results.
- [x] Record tested vs untested behavior and current local access addresses.

RTC room invitations use unpredictable room IDs transmitted through real IM messages, with explicit expiry. Existing conversations retain their original UI; call controls are added to the header. Platform-dependent media rendering stays in adapters, never in domain/application code. Local services have no public port exposure.

Acceptance: local email registration/reset and owner-only role APIs passed on isolated accounts. Two browser accounts joined a local LiveKit room; microphone publishing and remote audio playback verified, then both disconnected. No recording saved. Camera returned device-not-found, so real video frames remain unverified. Native device acceptance and external provider delivery remain excluded. Calls currently use message invitations, not incoming ringing/accept/reject signaling.
