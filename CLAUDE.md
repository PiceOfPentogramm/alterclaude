# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

OpenClaude is a fork of the leaked Claude Code source that adds an OpenAI-compatible provider shim, allowing Claude Code's tool system to work with any LLM (OpenAI, Gemini, DeepSeek, Ollama, OpenRouter, etc.).

## Build & Dev Commands

```bash
bun run build              # Bundle src/ into dist/cli.mjs
bun run dev                # Build + run
bun run dev:profile        # Profile-based launch (provider + model from .openclaude-profile.json)
bun run dev:ollama         # Launch with Ollama
bun run dev:openai         # Launch with OpenAI
bun run dev:openrouter     # Launch with OpenRouter

bun run doctor:runtime     # System diagnostics
bun run doctor:runtime:json # JSON diagnostics
bun run doctor:report      # Persist diagnostic report
bun run smoke              # Build + --version check
bun run typecheck          # tsc --noEmit
bun run hardening:check    # smoke + doctor
bun run hardening:strict   # typecheck + hardening:check

bun run profile:init -- --provider openai --model gpt-4o   # Create profile
bun run profile:recommend                                    # Suggest provider
bun run profile:auto                                         # Auto-select + apply

# Test commands
bun test src/services/api/openaiShim.test.ts
bun test src/services/api/codexShim.test.ts
bun test src/utils/context.test.ts
bun run test:provider-recommendation
bun run test:provider
```

## Architecture

### Entrypoint flow
```
bin/openclaude → dist/cli.mjs (built from src/entrypoints/cli.tsx)
```

### Provider system
Three activation mechanisms:
1. **Env vars** at the top of `src/services/api/client.ts:157-168`: `CLAUDE_CODE_USE_OPENAI`, `CLAUDE_CODE_USE_OPENROUTER`, `CLAUDE_CODE_USE_GEMINI`, `CLAUDE_CODE_USE_GITHUB`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`
2. **Profile file** (`.openclaude-profile.json`) loaded by `scripts/provider-launch.ts`
3. **First-party** (default): Anthropic direct/OAuth

Provider resolution chain: `src/utils/model/providers.ts` → `getAPIProvider()`

### Core shim
`src/services/api/openaiShim.ts` — duck-types the Anthropic SDK interface, translating:
- Anthropic message blocks → OpenAI chat messages
- `tool_use`/`tool_result` → OpenAI function calls
- SSE streaming → Anthropic stream events
- System prompt arrays → OpenAI system messages

### Build system (`scripts/build.ts`)
- Uses Bun bundler to produce a single ESM file
- Strips Anthropic-internal feature flags (VOICE_MODE, PROACTIVE, BRIDGE_MODE, etc.) via `bun:bundle` feature() shim
- Stubs native addons (audio-capture-napi, sharp, etc.) and optional dependencies
- Removes telemetry via `scripts/no-telemetry-plugin.ts`

### Key source directories
| Directory | Contents |
|-----------|----------|
| `src/services/api/` | API clients, shims (openaiShim.ts, codexShim.ts), provider config |
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

### Provider model defaults
Claude tiers (opus/sonnet/haiku) are mapped to provider-specific models in `src/utils/model/configs.ts`. For example:
- OpenRouter: opus→deepseek/deepseek-v4-pro, sonnet→deepseek/deepseek-v4-flash, haiku→tencent/hy3-preview
- OpenAI: opus→gpt-4o, sonnet→gpt-4o-mini, haiku→gpt-4o-mini

### Key build-time constants
Defined in `scripts/build.ts:55-66` as `MACRO.*` globals: VERSION, DISPLAY_VERSION, PACKAGE_URL, ISSUES_EXPLAINER.

## Notes
- Not a git repository — no git history
- `.openclaude-profile.json` is gitignored
- `src/main.tsx` (~800KB) is the largest file — the main React TUI entry
- The `QueryEngine.ts` file implements the tool-calling loop / LLM interaction core