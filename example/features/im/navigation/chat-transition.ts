/**
 * The push into a chat (and the pages of the `chats` stack). On Android the default push took
 * ~450ms on its own and ios_from_right ~170ms, with the messages already in place as it slides
 * in (docs/openim/entry-perf-2026-11-18/RESULTS_2.md, T3).
 */
export const chatPushAnimation = 'ios_from_right'
