# AlterClaude

Use Claude Code with **any LLM** — not just Claude.

AlterClaude is a fork of Claude Code that adds an OpenAI-compatible provider shim so you can plug in GPT-4o, DeepSeek, Gemini, Llama, Mistral, or any model that speaks the OpenAI chat completions API. It also supports the ChatGPT Codex backend for `codexplan` and `codexspark`, and local inference via [Atomic Chat](https://atomic.chat/) on Apple Silicon.

All of Claude Code's tools work — bash, file read/write/edit, grep, glob, agents, tasks, MCP — just powered by whatever model you choose.

---

## Start Here

If you are new to terminals or just want the easiest path, start with the beginner guides:

- [Non-Technical Setup](docs/non-technical-setup.md)
- [Windows Quick Start](docs/quick-start-windows.md)
- [macOS / Linux Quick Start](docs/quick-start-mac-linux.md)

If you want source builds, Bun workflows, profile launchers, or full provider examples, use:

- [Advanced Setup](docs/advanced-setup.md)

---

## Beginner Install

For most users, install the npm package:

```bash
npm install -g @gitlawb/alterclaude
```

The package name is `@gitlawb/alterclaude`, but the command you run is:

```bash
alterclaude
```

If you install via npm and later see `ripgrep not found`, install ripgrep system-wide and confirm `rg --version` works in the same terminal before starting AlterClaude.

---

## Fastest Setup

### Windows PowerShell

```powershell
npm install -g @gitlawb/alterclaude

$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key-here"
$env:OPENAI_MODEL="gpt-4o"

alterclaude
```

### macOS / Linux

```bash
npm install -g @gitlawb/alterclaude

export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o

alterclaude
```

That is enough to start with OpenAI.

---

### OpenRouter (Fastest)

```bash
npm install -g @gitlawb/alterclaude

export CLAUDE_CODE_USE_OPENROUTER=1
export OPENROUTER_API_KEY=sk-or-your-key-here

alterclaude
```

Default model: `deepseek/deepseek-v4-flash` (haiku → `tencent/hy3-preview`, sonnet → `deepseek/deepseek-v4-flash`, opus → `deepseek/deepseek-v4-pro`). Override with `OPENROUTER_MODEL`.

---

## Choose Your Guide

### Beginner

- Want the easiest setup with copy-paste steps: [Non-Technical Setup](docs/non-technical-setup.md)
- On Windows: [Windows Quick Start](docs/quick-start-windows.md)
- On macOS or Linux: [macOS / Linux Quick Start](docs/quick-start-mac-linux.md)

### Advanced

- Want source builds, Bun, local profiles, runtime checks, or more provider choices: [Advanced Setup](docs/advanced-setup.md)

---

## Common Beginner Choices

### OpenRouter

Best if you want to use any model through OpenRouter (DeepSeek, OpenAI, Anthropic, Gemini, and 200+ more). Set `CLAUDE_CODE_USE_OPENROUTER=1` and `OPENROUTER_API_KEY`.

### OpenAI

Best default if you already have an OpenAI API key.

### Ollama

Best if you want to run models locally on your own machine.

### Codex

Best if you already use the Codex CLI or ChatGPT Codex backend.

---

## What Works

- **All tools**: Bash, FileRead, FileWrite, FileEdit, Glob, Grep, WebFetch, WebSearch, Agent, MCP, LSP, NotebookEdit, Tasks
- **Streaming**: Real-time token streaming
- **Tool calling**: Multi-step tool chains (the model calls tools, gets results, continues)
- **Images**: Base64 and URL images passed to vision models
- **Slash commands**: /commit, /review, /compact, /diff, /doctor, etc.
- **Sub-agents**: AgentTool spawns sub-agents using the same provider
- **Memory**: Persistent memory system

## What's Different

- **No thinking mode**: Anthropic's extended thinking is disabled (OpenAI models use different reasoning)
- **No prompt caching**: Anthropic-specific cache headers are skipped
- **No beta features**: Anthropic-specific beta headers are ignored
- **Token limits**: Defaults to 32K max output — some models may cap lower, which is handled gracefully

---

## How It Works

The shim (`src/services/api/openaiShim.ts`) sits between Claude Code and the LLM API:

```
Claude Code Tool System
        |
        v
  Anthropic SDK interface (duck-typed)
        |
        v
  openaiShim.ts  <-- translates formats
        |
        v
  OpenAI Chat Completions API
        |
        v
  Any compatible model
```

It translates:
- Anthropic message blocks → OpenAI messages
- Anthropic tool_use/tool_result → OpenAI function calls
- OpenAI SSE streaming → Anthropic stream events
- Anthropic system prompt arrays → OpenAI system messages

The rest of Claude Code doesn't know it's talking to a different model.

---

## Model Quality Notes

Not all models are equal at agentic tool use. Here's a rough guide:

| Model | Tool Calling | Code Quality | Speed |
|-------|-------------|-------------|-------|
| GPT-4o | Excellent | Excellent | Fast |
| DeepSeek-V3 | Great | Great | Fast |
| Gemini 2.0 Flash | Great | Good | Very Fast |
| Llama 3.3 70B | Good | Good | Medium |
| Mistral Large | Good | Good | Fast |
| GPT-4o-mini | Good | Good | Very Fast |
| Qwen 2.5 72B | Good | Good | Medium |
| Smaller models (<7B) | Limited | Limited | Very Fast |

For best results, use models with strong function/tool calling support.

---

## Files Changed from Original

```
src/services/api/openaiShim.ts   — NEW: OpenAI-compatible API shim (724 lines)
src/services/api/client.ts       — Routes to shim when CLAUDE_CODE_USE_OPENAI=1
src/utils/model/providers.ts     — Added 'openai' provider type
src/utils/model/configs.ts       — Added openai model mappings
src/utils/model/model.ts         — Respects OPENAI_MODEL for defaults
src/utils/auth.ts                — Recognizes OpenAI as valid 3P provider
```

6 files changed. 786 lines added. Zero dependencies added.

---

## Origin

This is a fork of Claude Code, which originally became publicly accessible through an npm source map exposure on March 31, 2026.

The original Claude Code source is the property of Anthropic. This repository is not affiliated with or endorsed by Anthropic.

---

## License

This repository is provided for educational and research purposes. The original source code is subject to Anthropic's terms. The OpenAI shim additions are public domain.
