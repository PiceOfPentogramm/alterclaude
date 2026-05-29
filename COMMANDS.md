# OpenClaude Commands Reference

## Filtering Pipeline

Commands go through 3 filters in order (see `src/commands.ts:486-495`):
1. **`availability`** — `meetsAvailabilityRequirement()`: `['claude-ai']` / `['console']` / `['claude-ai', 'console']`. Commands without this field pass unconditionally.
2. **`isEnabled()`** — defaults to `true` if not defined.
3. **`isHidden`** — only affects `/` menu suggestions; hidden commands can still be invoked by typing.

`isClaudeAISubscriber()` (`src/utils/auth.ts:1569`) = `isAnthropicAuthEnabled() && shouldUseClaudeAIAuth(scopes)`. Returns `false` for ALL 3rd-party providers.

`meetsAvailabilityRequirement()` (`src/commands.ts:427-453`):
- `['claude-ai']` → needs `isClaudeAISubscriber()` → **fails on 3P**
- `['console']` → needs `!isClaudeAISubscriber() && !isUsing3PServices() && isFirstPartyAnthropicBaseUrl()` → **fails on 3P**
- No `availability` → **passes**

## Built-in Commands (all entries in COMMANDS() at `src/commands.ts:263-356`)

| Name | Availability | isEnabled | isHidden | 3P Visible? |
|------|-------------|-----------|----------|-------------|
| add-dir | — | default true | — | YES |
| advisor | — | `canUserConfigureAdvisor()` (GrowthBook + first-party betas) | same as isEnabled | **NO** (GrowthBook false, first-party betas stripped) |
| agents | — | default true | — | YES |
| branch | — | default true | — | YES |
| btw | — | default true | — | YES |
| chrome | `[claude-ai]` | — | — | **NO** (availability filter) |
| clear | — | default true | — | YES |
| color | — | default true | — | YES |
| compact | — | `!DISABLE_COMPACT` | — | YES |
| config | — | default true | — | YES |
| copy | — | default true | — | YES |
| cost | — | default true | `isClaudeAISubscriber()` → false on 3P | **YES** |
| desktop | `[claude-ai]` | `isSupportedPlatform()` | same as isEnabled | **NO** (availability filter) |
| context | — | `!getIsNonInteractiveSession()` | — | YES (interactive) |
| diff | — | default true | — | YES |
| doctor | — | `!DISABLE_DOCTOR_COMMAND` | — | YES |
| effort | — | default true | — | YES |
| exit | — | default true | — | YES |
| fast | `[claude-ai, console]` | `isFastModeEnabled()` = firstParty only | same as isEnabled | **NO** (availability + isEnabled) |
| files | — | `USER_TYPE === 'ant'` | — | **NO** (internal-only) |
| heapdump | — | default true | `true` (hidden) | YES (hidden from menu, callable) |
| help | — | default true | — | YES |
| ide | — | default true | — | YES |
| init | — | default true | — | YES |
| keybindings | — | GrowthBook flag | — | YES (if GB flag — depends on build) |
| install-github-app | `[claude-ai, console]` | — | — | **NO** (availability) |
| install-slack-app | `[claude-ai]` | — | — | **NO** (availability) |
| mcp | — | default true | — | YES |
| memory | — | default true | — | YES |
| mobile | — | default true | — | YES |
| model | — | default true | — | YES |
| onboard-github | — | default true | — | YES |
| output-style | — | default true | `true` (deprecated) | YES (hidden from menu) |
| plugin | — | default true | — | YES |
| provider | — | default true | — | YES |
| pr-comments | — | default true | — | YES |
| release-notes | — | default true | — | YES |
| reload-plugins | — | default true | — | YES |
| rename | — | default true | — | YES |
| resume | — | default true | — | YES |
| session | — | `getIsRemoteMode()` | same as isEnabled | YES (shows error if not remote) |
| skills | — | default true | — | YES |
| stats | — | default true | — | YES |
| status | — | default true | — | YES |
| statusline | — | default true | — | YES |
| stickers | — | default true | — | YES |
| tag | — | `USER_TYPE === 'ant'` | — | **NO** (internal-only) |
| addmodel | — | `!!(OPENROUTER_API_KEY || OPENAI_API_KEY)` | — | YES (conditional on key) |
| removemodel | — | default true | — | YES |
| searchstart | — | default true | — | YES |
| theme | — | default true | — | YES |
| feedback | — | `!(Bedrock\|Vertex\|Foundry \|\| DISABLE_FEEDBACK \|\| DISABLE_BUG \|\| isEssentialTrafficOnly() \|\| USER_TYPE==='ant' \|\| !allow_product_feedback)` | — | YES on OpenRouter/OpenAI/Gemini/GitHub; NO on Bedrock/Vertex/Foundry |
| review | — | default true | — | YES |
| ultrareview | — | `isUltrareviewEnabled()` (GrowthBook) | — | **NO** (GrowthBook stripped in build) |
| rewind | — | default true | — | YES |
| security-review | — | default true | — | YES |
| terminal-setup | — | default true | conditional on terminal | YES |
| upgrade | `[claude-ai]` | `!DISABLE_UPGRADE && subscription !== enterprise` | — | **NO** (availability) |
| extra-usage | — | `isExtraUsageAllowed()` (needs subscriber) | — | **NO** (isEnabled) |
| rate-limit-options | — | `isClaudeAISubscriber()` | `true` (hidden) | **NO** (isEnabled) |
| usage | `[claude-ai]` | — | — | **NO** (availability) |
| insights | — | default true | — | YES |
| vim | — | default true | — | YES |
| think-back | — | Statsig GB flag | — | **NO** (GB stripped) |
| thinkback-play | — | Statsig GB flag | `true` (hidden) | **NO** (GB stripped) |
| permissions | — | default true | — | YES |
| plan | — | default true | — | YES |
| privacy-settings | — | `isConsumerSubscriber()` | — | **NO** (needs claude-ai subscriber) |
| hooks | — | default true | — | YES |
| export | — | default true | — | YES |
| sandbox | — | default true | platform check | YES (if platform supported) |
| passes | — | default true | pass eligibility | **NO** (needs subscriber) |
| tasks | — | default true | — | YES |
| web-setup | `[claude-ai]` | GrowthBook + policy | — | **NO** (availability + GB) |

## Feature-Flag-Gated Commands (spread conditionally, all stripped by no-telemetry build plugin)

These are NEVER available in the build because `scripts/no-telemetry-plugin.ts` sets all Anthropic-internal feature flags to `false`:

- **proactive** (`feature('PROACTIVE') || feature('KAIROS')`)
- **brief** (`feature('KAIROS') || feature('KAIROS_BRIEF')`)
- **assistant** (`feature('KAIROS')`)
- **bridge** (`feature('BRIDGE_MODE')`)
- **remoteControlServer** (`feature('DAEMON') && feature('BRIDGE_MODE')`)
- **voice** (`[claude-ai]`, `feature('VOICE_MODE')`)
- **force-snip** (`feature('HISTORY_SNIP')`)
- **workflows** (`feature('WORKFLOW_SCRIPTS')`)
- **fork** (`feature('FORK_SUBAGENT')`)
- **buddy** (`feature('BUDDY')`)
- **peers** (`feature('UDS_INBOX')`)
- **ultraplan** (`feature('ULTRAPLAN')`)
- **torch** (`feature('TORCH')`)
- **subscribe-pr** (`feature('KAIROS_GITHUB_WEBHOOKS')`)

## Login/Logout (conditionally added)

`src/commands.ts:344-347`: `!isUsing3PServices() ? [logout, login()]` — both **HIDDEN** on 3P.

## Services/Infra That Depend on Anthropic First-Party

| Service | File | 3P Behavior |
|---------|------|-------------|
| OAuth / login flow | `src/services/oauth/client.ts` | Not callable (commands hidden) |
| claude.ai MCP discovery | `src/services/mcp/claudeai.ts:43` | Returns empty |
| Official MCP registry | `src/services/mcp/officialRegistry.ts:40` | Fetches from api.anthropic.com |
| Team memory sync | `src/services/teamMemorySync/index.ts:152` | Returns empty |
| Settings cloud sync | `src/services/settingsSync/index.ts:213` | Returns empty |
| Remote managed settings | `src/services/remoteManagedSettings/syncCache.ts:53` | Returns empty |
| Policy limits | `src/services/policyLimits/index.ts:169` | Returns empty |
| Usage/rate-limit API | `src/services/api/usage.ts:34` | Returns empty |
| Ultrareview quota | `src/services/api/ultrareviewQuota.ts:20` | Returns null |
| Referral/passes | `src/services/api/referral.ts:74` | No passes check |
| Metrics opt-out | `src/services/api/metricsOptOut.ts:134` | Short-circuits |
| Transcript sharing | `src/components/FeedbackSurvey/submitTranscriptShare.ts:88` | Posts to api.anthropic.com |
| Teleport/remote sessions | `src/utils/teleport.tsx` | Returns "requires claude.ai login" |
| Background remote | `src/utils/background/remote/preconditions.ts:24` | Returns false |
| Sessions WebSocket | `src/remote/SessionsWebSocket.ts:78` | Connects to api.anthropic.com |
| Billing access | `src/utils/billing.ts:59` | Returns false |
| Extra usage provisioning | `src/utils/extraUsage.ts:9` | Returns false |

## Tool-Level Gating

| Tool | File | 3P Behavior |
|------|------|-------------|
| WebSearch (Anthropic) | `src/tools/WebSearchTool/WebSearchTool.ts:496` | Enabled for firstParty only. **We added SearXNG** as replacement for all providers |
| WebSearch (SearXNG) | `src/tools/WebSearchTool/WebSearchTool.ts:484` | Enabled when `getSearXNGBaseUrl()` returns truthy — works with any provider |
| ToolSearch | `src/utils/toolSearch.ts:270` | On firstParty+gated by proxy. On 3P works via beta headers. **Stripped from OpenAI shim** (`src/services/api/openaiShim.ts:333`) |
| WebFetch domain preflight | `src/tools/WebFetchTool/utils.ts:184` | Calls api.anthropic.com — non-blocking |
| RemoteTriggerTool | `src/tools/RemoteTriggerTool/RemoteTriggerTool.ts:83` | Returns "not authenticated" |
| ConfigTool (voice) | `src/tools/ConfigTool/ConfigTool.ts:246` | Returns "voice requires claude.ai" |

## Model/Infra Features

| Feature | File | 3P Behavior |
|---------|------|-------------|
| Extended thinking (all Claude 4+) | `src/utils/thinking.ts:105` | Only firstParty + Foundry |
| Full context management | `src/utils/betas.ts:127` | Only firstParty + Foundry |
| Interleaved thinking | `src/utils/betas.ts:106` | Only firstParty + Foundry |
| Effort levels (max) | `src/utils/effort.ts:56` | firstParty only |
| Fast mode | `src/utils/fastMode.ts:39` | `false` on 3P |
| Opus 1M context merge | `src/utils/model/model.ts:392` | `false` on 3P |
| Global prompt caching | `src/utils/betas.ts` | firstParty only |
| Structured outputs | `src/utils/betas.ts` | firstParty + Foundry |
| Model capabilities | `src/utils/model/modelCapabilities.ts:48` | `false` on 3P |
| Auto-updater version check | `src/utils/autoUpdater.ts:78` | Skipped on 3P |
| Beta headers (first-party-only) | `src/utils/betas.ts:212` | firstParty + Foundry |

## Commands We Added (custom OpenClaude)

| Name | File | Description |
|------|------|-------------|
| addmodel | `src/commands/addModel/` | Browse OpenRouter models, save to settings.json |
| removemodel | `src/commands/removeModel/` | Delete custom models from settings.json |
| searchstart | `src/commands/searchstart/` | Start/check SearXNG Docker container |
| provider | `src/commands/provider/` | Set up 3rd-party provider profiles (from original codebase, now on 3P) |