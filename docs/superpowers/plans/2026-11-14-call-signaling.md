# Local call signaling

Goal: complete foreground single-user calling on the existing OpenIM/LiveKit integration, retaining RN default styling and original data.

Design: isolated call controller owns state, expiry, deduplication and peer validation. OpenIM text envelopes carry invite/accept/reject/busy/cancel/end/missed events and durable conversation summaries. The SDK authenticates message sender; ignore mismatched senders, groups and stale calls. Only accepted calls navigate to LiveKit. A root RN overlay handles foreground incoming/outgoing calls; group rooms retain existing invitations. On page exit/background, end calls and release media. Web ringing may require a user gesture; show a manual sound control. No OS incoming-call/push or native acceptance in this scope.

- [x] Controller tests first: accept/reject/busy/timeout/cancel, stale and forged replies, duplicate events, reset/late async sends.
- [x] SDK transport and root RN calling overlay; ringtone platform support.
- [x] Accepted media route, hangup propagation, Chinese history summaries.
- [x] Type/lint/regression and isolated local acceptance. Update verified limitations.

Verified: dedicated owner/observer UI calls: incoming, reject, accept → two LiveKit participants, hangup on either side exits both, caller cancel, 45-second timeout and persisted missed-call message. Busy and group-room reservation covered by controller tests, not a three-browser live test. 93 OpenIM tests and 449 component tests/34 snapshots passed; typecheck, lint and build passed. Camera remains user-owned acceptance.
