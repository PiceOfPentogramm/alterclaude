# AGENTS.md — OpenClaude

## What This Is

OpenClaude is a fork of the Claude Code source that adds an OpenAI-compatible provider shim, allowing Claude Code's tool system to work with any LLM (OpenAI, Gemini, DeepSeek, Ollama, OpenRouter, etc.).

## Non-Obvious Constraints

- **Not a git repository** — no git history, branches, or git-based workflows available
- **Lockfile is `bun.lock`** — never `package-lock.json`; always use `bun install` (not npm)
- **Node >=20 required** (`engines.node` in package.json)
- **Built with Bun** — `bun run build` bundles `src/` into `dist/cli.mjs` via `scripts/build.ts`

## Build Pipeline Quirks

The build (`scripts/build.ts`) does more than compile:
- Strips all telemetry/analytics modules via `scripts/no-telemetry-plugin.ts` (GrowthBook, Datadog, 1P event logging, auto-updater, BigQuery, Perfetto tracing)
- Stubs native addons (`audio-capture-napi`, `sharp`, etc.) and optional deps
- Sets all Anthropic-internal feature flags (`VOICE_MODE`, `PROACTIVE`, `BRIDGE_MODE`, etc.) to `false`
- Inlines `MACRO.*` build-time constants (VERSION=99.0.0, DISPLAY_VERSION from package.json)
- `extras` kept external: `@opentelemetry/*`, AWS/GCP/Azure SDKs

## Entrypoint Flow

```
bin/openclaude → dist/cli.mjs (built from src/entrypoints/cli.tsx)
```

The `dev:profile` script (`scripts/provider-launch.ts`) does **doctor → build → launch** sequentially every time.

## Provider System

Activation env vars (checked at `src/services/api/client.ts:157`):
`CLAUDE_CODE_USE_OPENAI`, `CLAUDE_CODE_USE_OPENROUTER`, `CLAUDE_CODE_USE_GEMINI`, `CLAUDE_CODE_USE_GITHUB`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`

Provider profile: `.openclaude-profile.json` (project root or home). Loaded by `buildStartupEnvFromProfile()` → `applyProfileEnvToProcessEnv()`.

API key helpers (3P): `settings.json` fields `openaiApiKeyHelper`, `openrouterApiKeyHelper`, `geminiApiKeyHelper` — shell commands that output API keys to stdout. Resolved at startup by `resolveProviderApiKeyHelpers()` in `cli.tsx:166` (after profile, before SearXNG).

Resolution chain: `src/utils/model/providers.ts` → `getAPIProvider()` → checks `CLAUDE_CODE_USE_*` env vars.

OpenRouter detection: `isAnthropicAuthEnabled()` + `isUsing3PServices()` in `src/utils/auth.ts` — **both** now include `CLAUDE_CODE_USE_OPENROUTER` in their 3P provider lists.

## Provider Model Defaults (`src/utils/model/configs.ts`)

- OpenRouter: opus→`deepseek/deepseek-v4-pro`, sonnet→`deepseek/deepseek-v4-flash`, haiku→`tencent/hy3-preview`
- OpenAI: opus→`gpt-4o`, sonnet→`gpt-4o-mini`, haiku→`gpt-4o-mini`
- Gemini: opus→`gemini-2.5-pro-preview-03-25`, sonnet→`gemini-2.0-flash`, haiku→`gemini-2.0-flash-lite`
- Override any with `OPENAI_MODEL`, `OPENROUTER_MODEL`, `GEMINI_MODEL` env vars

## Key Source Directories

| Directory | Contents |
|-----------|----------|
| `src/services/api/` | API clients, shims (`openaiShim.ts`, `codexShim.ts`), provider config |
| `src/tools/` | Tool implementations (Bash, FileRead, FileWrite, Edit, Grep, Glob, Agent, etc.) |
| `src/cli/` | CLI handling, transports, structured I/O |
| `src/commands/` | Slash command handlers |
| `src/components/` | Ink-based React component TUI |
| `src/utils/model/` | Model configs, provider definitions, model mappings |
| `src/utils/settings/` | Settings system (file-based config, MDM policies) |
| `src/utils/permissions/` | Permission system (bash, filesystem, tool approvals) |
| `src/services/mcp/` | MCP server/client connection management |
| `src/services/lsp/` | LSP client integration |
| `scripts/` | Build, provider bootstrap, launch, diagnostics |
| `src/main.tsx` | ~800KB — main React TUI entry |
| `src/QueryEngine.ts` | Tool-calling loop / LLM interaction core |

## Provider Model Defaults (`src/utils/model/configs.ts`)

- OpenRouter: opus→`deepseek/deepseek-v4-pro`, sonnet→`deepseek/deepseek-v4-flash`, haiku→`tencent/hy3-preview`
- OpenAI: opus→`gpt-4o`, sonnet→`gpt-4o-mini`, haiku→`gpt-4o-mini`
- Gemini: opus→`gemini-2.5-pro-preview-03-25`, sonnet→`gemini-2.0-flash`, haiku→`gemini-2.0-flash-lite`
- Override any with `OPENAI_MODEL`, `OPENROUTER_MODEL`, `GEMINI_MODEL` env vars

## Test Runner

Uses Bun's built-in test runner (`bun test`). No Jest/Vitest. Tests live alongside source as `*.test.ts`.

## Commands

```bash
bun run build                          # Bundle src/ into dist/cli.mjs
bun run smoke                          # Build + --version check
bun run typecheck                      # tsc --noEmit
bun run hardening:check                # smoke + doctor:runtime
bun run hardening:strict               # typecheck + hardening:check

# Focused single test:
bun test src/services/api/openaiShim.test.ts

# Test suites:
bun run test:provider                  # API service tests + context test
bun run test:provider-recommendation   # Provider recommendation tests

# Launch (doctor → build → run):
bun run dev                            # Build + run (no profile)
bun run dev:profile                    # From .openclaude-profile.json
bun run dev:openai                     # OpenAI provider
bun run dev:openrouter                 # OpenRouter provider
bun run dev:ollama                     # Ollama provider

# Profile management:
bun run profile:init -- --provider openai --model gpt-4o
bun run profile:recommend
bun run profile:auto

# Diagnostics:
bun run doctor:runtime                 # System diagnostics
bun run doctor:report                  # Persist to reports/doctor-runtime.json
```

## Commands Reference

See `COMMANDS.md` for complete inventory of all 75+ slash commands, their availability gating (3P vs first-party), and filter logic. Covers every command's `availability`, `isEnabled`, and `isHidden` fields plus all feature-flag-gated commands stripped by the build plugin.

## CI Pipeline (`.github/workflows/pr-checks.yml`)

Runner: `ubuntu-latest`, Node 22, Bun 1.3.11. Steps:
1. `bun install --frozen-lockfile`
2. `bun run smoke`
3. `bun run test:provider`
4. `npm run test:provider-recommendation`

No lint step in CI. No typecheck in CI.