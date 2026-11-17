# OpenIM RN Product Redesign Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement and review each task.

**Goal:** Match the supplied redesign HTML using actual RN product components and real OpenIM actions.
**Architecture:** Shared semantic tokens and UI primitives, responsive product shell, existing business services and forked Chat/ChatList.
**Tech Stack:** React Native, Expo Router, TypeScript, React Native Chat, OpenIM.

## Execution
Work on existing feat/openim-integration checkout; preserve untracked docs/offline and all runtime/backend data. No dependency reinstall or backend reset. Root review owns browser comparison. Run commands with Yarn4 (`node /tmp/im-tooling/yarn.cjs`).

### 1. Foundation and navigation
- [x] Inspect attachment CSS/navigation and all existing routes; map the 31 reference screens to product routes.
- [x] Create ui/tokens.ts, theme hooks and focused native primitives for header/card/row/search/segment/avatar/action sheet.
- [x] Replace shared/shared.tsx presentation while retaining existing props/actions, confirmation semantics and disabled/error/loading states.
- [x] Implement responsive shell, 900px breakpoint, 72/340/flexible desktop panes and mobile bottom tabs; keep deep links/back/session guards working. Isolate theme from Explore.
- [x] Validate example typecheck and navigation rendering/regression tests; review against reference before next stage.

### 2. Authentication and directory/settings pages
- [x] Reskin auth/AuthForm, LoginScreen, AccountScreen to attachment auth layouts without changing APIs.
- [x] Refactor contacts, groups, profile and navigation/MyScreen into reference hierarchy with grouped cards/headers, input forms, segmented requests, member management and profile actions.
- [x] Keep every existing functional action reachable, hide role-ineligible actions using existing domain rules, and retain error/loading states.
- [x] Validate business tests and UI tests; check reference route coverage.

### 3. Chat, list and secondary screens
- [x] Configure ChatList or use public row render extension to match reference header/search/avatars/rows/selection/archive behavior. Retain real batch actions.
- [x] Configure Chat theme and render hooks to match header/bubbles/composer/menus while preserving recording, attachments, message extras and real call signaling.
- [x] Reskin conversation settings/history/assets/readers, call controls/history and other modal pickers to same tokens.
- [x] Validate message/action regression tests, typechecks and root lint.

### 4. Acceptance and local deployment
- [x] Run root lint/typecheck/test/build and example typecheck/business tests, Expo web export.
- [x] Launch actual application locally with existing services; do not edit original account data. Verify mobile390/desktop, light/dark, all tabs and screen/button/confirmation navigation. Independent tests use inexpensive model.
- [x] Compare actual pages to attachment visually; fix differences and missing behavior, record evidence and exact remaining platform limits.
- [x] Provide actual local product URL and report validation; no unsupported all-complete claim.
