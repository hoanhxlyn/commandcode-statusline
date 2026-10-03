# Agents Guide

Statusline mod for [Command Code](https://commandcode.ai). Renders a styled footer showing path, git branch, model, and billing usage.

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict, `noEmit`)
- **Linter/Formatter:** Biome (not ESLint) — single quotes, no semicolons, 2-space indent
- **Testing:** `bun test` (Bun's built-in test runner)
- **Dependencies:** axios, conf, dayjs, picocolors, remeda

## Commands

```bash
bun run check    # typecheck (tsc --noEmit)
bun test         # run tests
bun run lint     # biome check .
bun run fix      # biome check . --write
bun run build    # bun build index.ts --outdir dist --target bun
```

## Architecture

```
index.ts          → Mod entry point, wires up events/commands/timers
src/
  api.ts          → ApiClient: reads API key, fetches billing/usage from api.commandcode.ai
  config.ts       → axios client factory
  constants.ts    → Colors (picocolors), timing constants, file paths
  renderer.ts     → Renderer: builds statusline string, trims to terminal width
  state.ts        → StateManager: persisted enabled state (Conf), modelId, branch, error tracking
  types.ts        → Shared interfaces (UsageWindow, BillingPeriod, events)
  utils.ts        → formatDuration, toEpochMs, shortPath, terminalWidth
test/             → Unit tests (one per source module)
harness.d.ts      → Type declarations for @commandcode/harness (ModApi)
```

## Conventions

- Functional array pipelines via `remeda` (pipe, filter, sortBy, etc.)
- ANSI escape stripping uses `String.fromCharCode(27)` (not `\x1b`) to satisfy Biome's `noControlCharactersInRegex`
- State persistence uses `conf` package writing to `~/.commandcode/`
- API responses are defensively typed with optional fields (shape varies)
- All timers use `.unref?.()` so the process can exit cleanly

## Rules

- Always run `bun run lint && bun run check && bun test` before committing
- Do not add ESLint — project uses Biome
- Do not change the entry point (`index.ts`) or public mod API contract without discussion
- Keep `harness.d.ts` in sync with any `ModApi` usage changes