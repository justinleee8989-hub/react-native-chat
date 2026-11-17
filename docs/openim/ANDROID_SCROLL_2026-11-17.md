# Android focused regression - 2026-11-17

Device: Android 14 / 24053PY09C, ARM64 Debug APK, Metro 35881. Existing app data retained. Only newly created QA accounts and group 1386688880 (Android QA 75e48277) used. Original experience data untouched. Recording and video are user-tested.

## Fixes confirmed on device

- StartupSkeleton accessibilityRole=status crashed Android RCTText. Replaced with accessibilityLiveRegion=polite; regression test added.
- Per-keystroke draft writes accumulated behind native SDK calls. After restart, already-sent intermediate text returned as draft. Coalesce pending text writes; invalidate superseded writes after delivery. Long-text send followed by cold restart now restores no old draft. Existing account/server isolation and failed-send recovery tests remain green.
- History insertion and row measurement corrections animated row positions, producing transient large gaps/misalignment in fling screenshots. Disable itemLayoutAnimation in product Chat listProps; SDK defaults and gradient remain unchanged. Final ten checkpoints do not show those large gaps/misalignment.

## Verified scope

- QA login and cold-start session restoration.
- Real short/long text sends; delivered draft stays cleared after restart.
- Cold-start history pagination beyond 30 messages: automatically reached QA-scroll-001 without tapping load-more.
- Ten 100ms up/down flings with gradient and mixed-height text rows; screenshots in evidence/2026-11-17-android-scroll.
- Messages, contacts, My, chat-info entrances; clear-history confirmation and Android-back cancellation. No deletion executed.
- UI 212 tests, business 266 tests, example types, root lint, Web export passed. SDK unchanged this round; full SDK gates not rerun.

## Limits and evidence quality

Debug sampling: earlier 1890 frames / 8.15% jank; final 314 frames / 20.06% jank. Different sampling duration/load phases: NOT a valid improvement comparison. Functional/screenshot results do not establish smoothness. Release performance acceptance remains pending.
This is a focused regression, not all Android feature/error-state acceptance. Gallery/files/recording/video were not fully retested.
An initial fixed-coordinate fixture script was interrupted by keyboard/layout changes; its claimed batch output is not accepted as success evidence. Subsequent sends verified each screen. Ordinary-user server send API denied access; fixtures were sent through the real client instead, without bypassing permissions.
Credentials only in /tmp/im-android-scroll-qa-accounts.json (0600), never in repository. No commit/push.
