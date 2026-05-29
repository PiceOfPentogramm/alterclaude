import * as React from 'react'
import { useState, useMemo, useRef, useCallback, useEffect } from 'react'

import type { LocalJSXCommandCall, LocalJSXCommandOnDone } from '../../types/command.js'
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js'
import TextInput from '../../components/TextInput.js'
import {
  Select,
  type OptionWithDescription,
} from '../../components/CustomSelect/index.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { LoadingState } from '../../components/design-system/LoadingState.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import { Box, Text, useInput } from '../../ink.js'
import {
  DEFAULT_CODEX_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  resolveCodexApiCredentials,
  resolveProviderRequest,
} from '../../services/api/providerConfig.js'
import {
  buildCodexProfileEnv,
  buildGeminiProfileEnv,
  buildOllamaProfileEnv,
  buildOpenAIProfileEnv,
  buildOpenRouterProfileEnv,
  createProfileFile,
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  deleteProfileFile,
  loadProfileFile,
  maskSecretForDisplay,
  redactSecretValueForDisplay,
  sanitizeApiKey,
  sanitizeProviderConfigValue,
  saveProfileFile,
  type ProfileEnv,
  type ProfileFile,
  type ProviderProfile,
} from '../../utils/providerProfile.js'
import {
  getGoalDefaultOpenAIModel,
  normalizeRecommendationGoal,
  rankOllamaModels,
  recommendOllamaModel,
  type RecommendationGoal,
} from '../../utils/providerRecommendation.js'
import { hasLocalOllama, listOllamaModels } from '../../utils/providerDiscovery.js'
import {
  fetchOpenRouterModels,
  formatModelDescription,
  type OpenRouterModelInfo,
} from '../addModel/openrouterModels.js'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

type ProviderChoice = 'auto' | ProviderProfile | 'clear' | 'openrouter'

type Step =
  | { name: 'choose' }
  | { name: 'auto-goal' }
  | { name: 'auto-detect'; goal: RecommendationGoal }
  | { name: 'ollama-detect' }
  | { name: 'openai-key'; defaultModel: string; isOpenRouter?: boolean }
  | { name: 'openai-base'; apiKey: string; defaultModel: string; isOpenRouter?: boolean }
  | {
      name: 'openai-model'
      apiKey: string
      baseUrl: string | null
      defaultModel: string
      isOpenRouter?: boolean
    }
  | { name: 'gemini-key' }
  | { name: 'gemini-model'; apiKey: string }
  | { name: 'openrouter-model'; apiKey: string; baseUrl: string }
  | { name: 'codex-check' }

type CurrentProviderSummary = {
  providerLabel: string
  modelLabel: string
  endpointLabel: string
  savedProfileLabel: string
}

type SavedProfileSummary = {
  providerLabel: string
  modelLabel: string
  endpointLabel: string
  credentialLabel?: string
}

type TextEntryDialogProps = {
  title: string
  subtitle?: string
  resetStateKey?: string
  description: React.ReactNode
  initialValue: string
  placeholder?: string
  mask?: string
  allowEmpty?: boolean
  validate?: (value: string) => string | null
  onSubmit: (value: string) => void
  onCancel: () => void
}

type ProviderWizardDefaults = {
  openAIModel: string
  openAIBaseUrl: string
  geminiModel: string
}

function isEnvTruthy(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== '0' && normalized !== 'false' && normalized !== 'no'
}

function getSafeDisplayValue(
  value: string | undefined,
  processEnv: NodeJS.ProcessEnv,
  profileEnv?: ProfileEnv,
  fallback = '(not set)',
): string {
  return (
    redactSecretValueForDisplay(value, processEnv, profileEnv) ?? fallback
  )
}

export function getProviderWizardDefaults(
  processEnv: NodeJS.ProcessEnv = process.env,
): ProviderWizardDefaults {
  const safeOpenAIModel =
    sanitizeProviderConfigValue(processEnv.OPENAI_MODEL, processEnv) ||
    'gpt-4o'
  const safeOpenAIBaseUrl =
    sanitizeProviderConfigValue(processEnv.OPENAI_BASE_URL, processEnv) ||
    DEFAULT_OPENAI_BASE_URL
  const safeGeminiModel =
    sanitizeProviderConfigValue(processEnv.GEMINI_MODEL, processEnv) ||
    DEFAULT_GEMINI_MODEL

  return {
    openAIModel: safeOpenAIModel,
    openAIBaseUrl: safeOpenAIBaseUrl,
    geminiModel: safeGeminiModel,
  }
}

export function buildCurrentProviderSummary(options?: {
  processEnv?: NodeJS.ProcessEnv
  persisted?: ProfileFile | null
}): CurrentProviderSummary {
  const processEnv = options?.processEnv ?? process.env
  const persisted = options?.persisted ?? loadProfileFile()
  const savedProfileLabel = persisted?.profile ?? 'none'

  if (isEnvTruthy(processEnv.CLAUDE_CODE_USE_GEMINI)) {
    return {
      providerLabel: 'Google Gemini',
      modelLabel: getSafeDisplayValue(
        processEnv.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
        processEnv,
      ),
      endpointLabel: getSafeDisplayValue(
        processEnv.GEMINI_BASE_URL ?? DEFAULT_GEMINI_BASE_URL,
        processEnv,
      ),
      savedProfileLabel,
    }
  }

  if (isEnvTruthy(processEnv.CLAUDE_CODE_USE_OPENAI)) {
    const request = resolveProviderRequest({
      model: processEnv.OPENAI_MODEL,
      baseUrl: processEnv.OPENAI_BASE_URL,
    })

    let providerLabel = 'OpenAI-compatible'
    if (request.transport === 'codex_responses') {
      providerLabel = 'Codex'
    } else if (request.baseUrl.includes('localhost:11434')) {
      providerLabel = 'Ollama'
    } else if (request.baseUrl.includes('localhost:1234')) {
      providerLabel = 'LM Studio'
    }

    return {
      providerLabel,
      modelLabel: getSafeDisplayValue(request.requestedModel, processEnv),
      endpointLabel: getSafeDisplayValue(request.baseUrl, processEnv),
      savedProfileLabel,
    }
  }

  return {
    providerLabel: 'Anthropic',
    modelLabel: getSafeDisplayValue(
      processEnv.ANTHROPIC_MODEL ??
        processEnv.CLAUDE_MODEL ??
        'claude-sonnet-4-6',
      processEnv,
    ),
    endpointLabel: getSafeDisplayValue(
      processEnv.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
      processEnv,
    ),
    savedProfileLabel,
  }
}

function buildSavedProfileSummary(
  profile: ProviderProfile,
  env: ProfileEnv,
): SavedProfileSummary {
  switch (profile) {
    case 'gemini':
      return {
        providerLabel: 'Google Gemini',
        modelLabel: getSafeDisplayValue(
          env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
          process.env,
          env,
        ),
        endpointLabel: getSafeDisplayValue(
          env.GEMINI_BASE_URL ?? DEFAULT_GEMINI_BASE_URL,
          process.env,
          env,
        ),
        credentialLabel:
          maskSecretForDisplay(env.GEMINI_API_KEY) !== undefined
            ? 'configured'
            : undefined,
      }
    case 'codex':
      return {
        providerLabel: 'Codex',
        modelLabel: getSafeDisplayValue(
          env.OPENAI_MODEL ?? 'codexplan',
          process.env,
          env,
        ),
        endpointLabel: getSafeDisplayValue(
          env.OPENAI_BASE_URL ?? DEFAULT_CODEX_BASE_URL,
          process.env,
          env,
        ),
        credentialLabel:
          maskSecretForDisplay(env.CODEX_API_KEY) !== undefined
            ? 'configured'
            : undefined,
      }
    case 'ollama':
      return {
        providerLabel: 'Ollama',
        modelLabel: getSafeDisplayValue(
          env.OPENAI_MODEL,
          process.env,
          env,
        ),
        endpointLabel: getSafeDisplayValue(
          env.OPENAI_BASE_URL,
          process.env,
          env,
        ),
      }
    case 'openrouter':
      return {
        providerLabel: 'OpenRouter',
        modelLabel: getSafeDisplayValue(
          env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
          process.env,
          env,
        ),
        endpointLabel: getSafeDisplayValue(
          env.OPENROUTER_BASE_URL ?? OPENROUTER_BASE_URL,
          process.env,
          env,
        ),
        credentialLabel:
          maskSecretForDisplay(env.OPENROUTER_API_KEY) !== undefined
            ? 'configured'
            : undefined,
      }
    case 'openai':
    default:
      return {
        providerLabel: 'OpenAI-compatible',
        modelLabel: getSafeDisplayValue(
          env.OPENAI_MODEL ?? 'gpt-4o',
          process.env,
          env,
        ),
        endpointLabel: getSafeDisplayValue(
          env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL,
          process.env,
          env,
        ),
        credentialLabel:
          maskSecretForDisplay(env.OPENAI_API_KEY) !== undefined
            ? 'configured'
            : undefined,
      }
  }
}

export function buildProfileSaveMessage(
  profile: ProviderProfile,
  env: ProfileEnv,
  filePath: string,
): string {
  const summary = buildSavedProfileSummary(profile, env)
  const lines = [
    `Saved ${summary.providerLabel} profile.`,
    `Model: ${summary.modelLabel}`,
    `Endpoint: ${summary.endpointLabel}`,
  ]

  if (summary.credentialLabel) {
    lines.push(`Credentials: ${summary.credentialLabel}`)
  }

  lines.push(`Profile: ${filePath}`)
  lines.push('Restart AlterClaude to use it.')

  return lines.join('\n')
}

function OpenRouterModelStep({
  apiKey,
  baseUrl,
  onSave,
  onBack,
  onCancel,
}: {
  apiKey: string
  baseUrl: string
  onSave: (model: string) => void
  onBack: () => void
  onCancel: () => void
}): React.ReactNode {
  const [allModels, setAllModels] = useState<OpenRouterModelInfo[] | null>(null)
  const [query, setQuery] = useState('')
  const [focusIndex, setFocusIndex] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const VISIBLE_COUNT = 7

  const filteredRef = useRef<OpenRouterModelInfo[]>([])
  const focusIndexRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    fetchOpenRouterModels(apiKey, baseUrl).then(models => {
      if (cancelled) return
      if (models.length === 0) {
        setError('Could not fetch model list. Check your API key and connection.')
        setAllModels([])
      } else {
        setAllModels(models.sort((a, b) => a.id.localeCompare(b.id)))
      }
    })
    return () => { cancelled = true }
  }, [apiKey, baseUrl])

  const filtered = useMemo(() => {
    if (!allModels) return []
    const q = query.toLowerCase().trim()
    if (!q) return allModels.slice(0, 25)
    return allModels
      .filter(m => m.id.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q)))
      .slice(0, 50)
  }, [allModels, query])

  filteredRef.current = filtered
  focusIndexRef.current = focusIndex

  useEffect(() => {
    setFocusIndex(0)
    setScrollOffset(0)
  }, [filtered.length])

  const visible = filtered.slice(scrollOffset, scrollOffset + VISIBLE_COUNT)

  useKeybinding('confirm:no', () => onCancel(), { context: 'Settings' })

  useInput((_input, key) => {
    if (key.upArrow) {
      if (focusIndex > 0) {
        setFocusIndex(i => i - 1)
      } else if (scrollOffset > 0) {
        setScrollOffset(s => s - 1)
      }
      return
    }
    if (key.downArrow) {
      if (focusIndex < VISIBLE_COUNT - 1 && focusIndex < filteredRef.current.length - 1 - scrollOffset) {
        setFocusIndex(i => i + 1)
      } else if (scrollOffset + VISIBLE_COUNT < filteredRef.current.length) {
        setScrollOffset(s => s + 1)
      }
      return
    }
    if (key.return) {
      const idx = scrollOffset + focusIndexRef.current
      if (filteredRef.current.length > 0 && idx < filteredRef.current.length) {
        onSave(filteredRef.current[idx].id)
      }
      return
    }
    if (key.backspace || key.delete) {
      setQuery(prev => prev.slice(0, -1))
      return
    }
    if (_input && !key.ctrl && !key.meta) {
      setQuery(prev => prev + _input)
    }
  })

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">{error}</Text>
        <Text dimColor>Press Esc to go back</Text>
      </Box>
    )
  }

  if (allModels === null) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Loading OpenRouter models...</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Box>
        <Text bold>OpenRouter — choose model</Text>
        <Text dimColor> ({allModels.length} available)</Text>
      </Box>
      <Box>
        <Text>Search: </Text>
        <Text inverse>{query || 'type to filter'}</Text>
      </Box>
      {filtered.length === 0 ? (
        <Text dimColor>No models match your search.</Text>
      ) : (
        <Box flexDirection="column" gap={0}>
          {scrollOffset > 0 && (
            <Box paddingLeft={2}>
              <Text dimColor>↑ {scrollOffset} more above</Text>
            </Box>
          )}
          {visible.map((m, i) => {
            const isFocused = i === focusIndex
            const desc = formatModelDescription(m)
            const label = m.name || m.id.split('/').pop() || m.id
            return (
              <Box key={m.id} flexDirection="column">
                <Box>
                  <Text color={isFocused ? 'cyan' : undefined}>
                    {isFocused ? '▸ ' : '  '}{label}
                  </Text>
                </Box>
                {desc && (
                  <Box paddingLeft={2}>
                    <Text dimColor>{desc}</Text>
                  </Box>
                )}
              </Box>
            )
          })}
          {scrollOffset + VISIBLE_COUNT < filtered.length && (
            <Box paddingLeft={2}>
              <Text dimColor>↓ {filtered.length - scrollOffset - VISIBLE_COUNT} more below</Text>
            </Box>
          )}
        </Box>
      )}
      <Box>
        <Text dimColor>↑↓ navigate · Enter select · type to search · Esc back</Text>
      </Box>
    </Box>
  )
}

function buildUsageText(): string {
  const summary = buildCurrentProviderSummary()
  return [
    'Usage: /provider',
    '',
    'Guided setup for saved provider profiles.',
    '',
    `Current provider: ${summary.providerLabel}`,
    `Current model: ${summary.modelLabel}`,
    `Current endpoint: ${summary.endpointLabel}`,
    `Saved profile: ${summary.savedProfileLabel}`,
    '',
    'Choose Auto, Ollama, OpenAI-compatible, Gemini, or Codex, then save a profile for the next AlterClaude restart.',
  ].join('\n')
}

function finishProfileSave(
  onDone: LocalJSXCommandOnDone,
  profile: ProviderProfile,
  env: ProfileEnv,
): void {
  try {
    const profileFile = createProfileFile(profile, env)
    const filePath = saveProfileFile(profileFile)
    onDone(buildProfileSaveMessage(profile, env, filePath), {
      display: 'system',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    onDone(`Failed to save provider profile: ${message}`, {
      display: 'system',
    })
  }
}

export function TextEntryDialog({
  title,
  subtitle,
  resetStateKey,
  description,
  initialValue,
  placeholder,
  mask,
  allowEmpty = false,
  validate,
  onSubmit,
  onCancel,
}: TextEntryDialogProps): React.ReactNode {
  const { columns } = useTerminalSize()
  const [value, setValue] = React.useState(initialValue)
  const [cursorOffset, setCursorOffset] = React.useState(initialValue.length)
  const [error, setError] = React.useState<string | null>(null)

  React.useLayoutEffect(() => {
    setValue(initialValue)
    setCursorOffset(initialValue.length)
    setError(null)
  }, [initialValue, resetStateKey])

  const inputColumns = Math.max(30, columns - 6)

  const handleSubmit = React.useCallback(
    (nextValue: string) => {
      if (!allowEmpty && nextValue.trim().length === 0) {
        setError('A value is required for this step.')
        return
      }

      const validationError = validate?.(nextValue)
      if (validationError) {
        setError(validationError)
        return
      }

      setError(null)
      onSubmit(nextValue)
    },
    [allowEmpty, onSubmit, validate],
  )

  return (
    <Dialog title={title} subtitle={subtitle} onCancel={onCancel}>
      <Box flexDirection="column" gap={1}>
        <Text>{description}</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          mask={mask}
          columns={inputColumns}
          cursorOffset={cursorOffset}
          onChangeCursorOffset={setCursorOffset}
          focus
          showCursor
        />
        {error ? <Text color="error">{error}</Text> : null}
      </Box>
    </Dialog>
  )
}

function ProviderChooser({
  onChoose,
  onCancel,
}: {
  onChoose: (value: ProviderChoice) => void
  onCancel: () => void
}): React.ReactNode {
  const summary = buildCurrentProviderSummary()
  const options: OptionWithDescription<ProviderChoice>[] = [
    {
      label: 'Auto',
      value: 'auto',
      description:
        'Prefer local Ollama when available, otherwise guide you into OpenAI-compatible setup',
    },
    {
      label: 'Ollama',
      value: 'ollama',
      description: 'Use a local Ollama model with no API key',
    },
    {
      label: 'OpenAI-compatible',
      value: 'openai',
      description:
        'GPT-4o, DeepSeek, Groq, LM Studio, and similar APIs',
    },
    {
      label: 'OpenRouter',
      value: 'openrouter',
      description:
        'Uses the OpenAI shim with an OpenRouter API key and base URL',
    },
    {
      label: 'Gemini',
      value: 'gemini',
      description: 'Use a Google Gemini API key',
    },
    {
      label: 'Codex',
      value: 'codex',
      description: 'Use existing ChatGPT Codex CLI auth or env credentials',
    },
  ]

  if (summary.savedProfileLabel !== 'none') {
    options.push({
      label: 'Clear saved profile',
      value: 'clear',
      description: 'Remove .alterclaude-profile.json and return to normal startup',
    })
  }

  return (
    <Dialog
      title="Set up a provider profile"
      subtitle={`Current provider: ${summary.providerLabel}`}
      onCancel={onCancel}
    >
      <Box flexDirection="column" gap={1}>
        <Text>
          Save a provider profile for the next AlterClaude restart without
          editing environment variables first.
        </Text>
        <Box flexDirection="column">
          <Text dimColor>Current model: {summary.modelLabel}</Text>
          <Text dimColor>Current endpoint: {summary.endpointLabel}</Text>
          <Text dimColor>Saved profile: {summary.savedProfileLabel}</Text>
        </Box>
        <Select
          options={options}
          inlineDescriptions
          visibleOptionCount={options.length}
          onChange={onChoose}
          onCancel={onCancel}
        />
      </Box>
    </Dialog>
  )
}

function AutoGoalChooser({
  onChoose,
  onBack,
}: {
  onChoose: (goal: RecommendationGoal) => void
  onBack: () => void
}): React.ReactNode {
  const options: OptionWithDescription<RecommendationGoal>[] = [
    {
      label: 'Balanced',
      value: 'balanced',
      description: 'Strong everyday default for most users',
    },
    {
      label: 'Coding',
      value: 'coding',
      description: 'Prefer coding-oriented local models or GPT-4o defaults',
    },
    {
      label: 'Latency',
      value: 'latency',
      description: 'Prefer faster local models or gpt-4o-mini defaults',
    },
  ]

  return (
    <Dialog title="Auto setup goal" onCancel={onBack}>
      <Box flexDirection="column" gap={1}>
        <Text>Pick the goal Auto setup should optimize for.</Text>
        <Select
          options={options}
          defaultValue="balanced"
          defaultFocusValue="balanced"
          inlineDescriptions
          visibleOptionCount={options.length}
          onChange={onChoose}
          onCancel={onBack}
        />
      </Box>
    </Dialog>
  )
}

function AutoRecommendationStep({
  goal,
  onBack,
  onSave,
  onNeedOpenAI,
  onCancel,
}: {
  goal: RecommendationGoal
  onBack: () => void
  onSave: (profile: ProviderProfile, env: ProfileEnv) => void
  onNeedOpenAI: (defaultModel: string) => void
  onCancel: () => void
}): React.ReactNode {
  const [status, setStatus] = React.useState<
    | {
        state: 'loading'
      }
    | {
        state: 'ollama'
        model: string
        summary: string
      }
    | {
        state: 'openai'
        defaultModel: string
      }
    | {
        state: 'error'
        message: string
      }
  >({ state: 'loading' })

  React.useEffect(() => {
    let cancelled = false

    void (async () => {
      const defaultModel = getGoalDefaultOpenAIModel(goal)
      try {
        const ollamaAvailable = await hasLocalOllama()
        if (!ollamaAvailable) {
          if (!cancelled) {
            setStatus({ state: 'openai', defaultModel })
          }
          return
        }

        const models = await listOllamaModels()
        const recommended = recommendOllamaModel(models, goal)
        if (!recommended) {
          if (!cancelled) {
            setStatus({ state: 'openai', defaultModel })
          }
          return
        }

        if (!cancelled) {
          setStatus({
            state: 'ollama',
            model: recommended.name,
            summary: recommended.summary,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            state: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [goal])

  if (status.state === 'loading') {
    return <LoadingState message="Checking local providers…" />
  }

  if (status.state === 'error') {
    return (
      <Dialog title="Auto setup failed" onCancel={onCancel} color="warning">
        <Box flexDirection="column" gap={1}>
          <Text>{status.message}</Text>
          <Select
            options={[
              { label: 'Back', value: 'back' },
              { label: 'Cancel', value: 'cancel' },
            ]}
            onChange={value => (value === 'back' ? onBack() : onCancel())}
            onCancel={onCancel}
          />
        </Box>
      </Dialog>
    )
  }

  if (status.state === 'openai') {
    return (
      <Dialog title="Auto setup fallback" onCancel={onCancel}>
        <Box flexDirection="column" gap={1}>
          <Text>
            No viable local Ollama chat model was detected. Auto setup can
            continue into OpenAI-compatible setup with a default model of{' '}
            {status.defaultModel}.
          </Text>
          <Select
            options={[
              { label: 'Continue to OpenAI-compatible setup', value: 'continue' },
              { label: 'Back', value: 'back' },
              { label: 'Cancel', value: 'cancel' },
            ]}
            onChange={value => {
              if (value === 'continue') {
                onNeedOpenAI(status.defaultModel)
              } else if (value === 'back') {
                onBack()
              } else {
                onCancel()
              }
            }}
            onCancel={onCancel}
          />
        </Box>
      </Dialog>
    )
  }

  return (
    <Dialog title="Save recommended profile?" onCancel={onBack}>
      <Box flexDirection="column" gap={1}>
        <Text>
          Auto setup recommends a local Ollama profile for {goal} based on the
          models currently available on this machine.
        </Text>
        <Text dimColor>
          Recommended model: {status.model}
          {status.summary ? ` · ${status.summary}` : ''}
        </Text>
        <Select
          options={[
            { label: 'Save recommended Ollama profile', value: 'save' },
            { label: 'Back', value: 'back' },
            { label: 'Cancel', value: 'cancel' },
          ]}
          onChange={value => {
            if (value === 'save') {
              onSave(
                'ollama',
                buildOllamaProfileEnv(status.model, {
                  getOllamaChatBaseUrl,
                }),
              )
            } else if (value === 'back') {
              onBack()
            } else {
              onCancel()
            }
          }}
          onCancel={onBack}
        />
      </Box>
    </Dialog>
  )
}

function OllamaModelStep({
  onSave,
  onBack,
  onCancel,
}: {
  onSave: (profile: ProviderProfile, env: ProfileEnv) => void
  onBack: () => void
  onCancel: () => void
}): React.ReactNode {
  const [status, setStatus] = React.useState<
    | { state: 'loading' }
    | {
        state: 'ready'
        options: OptionWithDescription<string>[]
        defaultValue?: string
      }
    | { state: 'unavailable'; message: string }
  >({ state: 'loading' })

  React.useEffect(() => {
    let cancelled = false

    void (async () => {
      const available = await hasLocalOllama()
      if (!available) {
        if (!cancelled) {
          setStatus({
            state: 'unavailable',
            message:
              'Could not reach Ollama at http://localhost:11434. Start Ollama first, then run /provider again.',
          })
        }
        return
      }

      const models = await listOllamaModels()
      if (models.length === 0) {
        if (!cancelled) {
          setStatus({
            state: 'unavailable',
            message:
              'Ollama is running, but no installed models were found. Pull a chat model such as qwen2.5-coder:7b or llama3.1:8b first.',
          })
        }
        return
      }

      const ranked = rankOllamaModels(models, 'balanced')
      const recommended = recommendOllamaModel(models, 'balanced')
      if (!cancelled) {
        setStatus({
          state: 'ready',
          defaultValue: recommended?.name ?? ranked[0]?.name,
          options: ranked.map(model => ({
            label: model.name,
            value: model.name,
            description: model.summary,
          })),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (status.state === 'loading') {
    return <LoadingState message="Checking local Ollama models…" />
  }

  if (status.state === 'unavailable') {
    return (
      <Dialog title="Ollama setup" onCancel={onCancel} color="warning">
        <Box flexDirection="column" gap={1}>
          <Text>{status.message}</Text>
          <Select
            options={[
              { label: 'Back', value: 'back' },
              { label: 'Cancel', value: 'cancel' },
            ]}
            onChange={value => (value === 'back' ? onBack() : onCancel())}
            onCancel={onCancel}
          />
        </Box>
      </Dialog>
    )
  }

  return (
    <Dialog title="Choose an Ollama model" onCancel={onBack}>
      <Box flexDirection="column" gap={1}>
        <Text>
          Pick one of the installed Ollama models to save into a local provider
          profile.
        </Text>
        <Select
          options={status.options}
          defaultValue={status.defaultValue}
          defaultFocusValue={status.defaultValue}
          inlineDescriptions
          visibleOptionCount={Math.min(8, status.options.length)}
          onChange={value => {
            onSave(
              'ollama',
              buildOllamaProfileEnv(value, {
                getOllamaChatBaseUrl,
              }),
            )
          }}
          onCancel={onBack}
        />
      </Box>
    </Dialog>
  )
}

function CodexCredentialStep({
  onSave,
  onBack,
  onCancel,
}: {
  onSave: (profile: ProviderProfile, env: ProfileEnv) => void
  onBack: () => void
  onCancel: () => void
}): React.ReactNode {
  const credentials = resolveCodexCredentials(process.env)

  if (!credentials.ok) {
    return (
      <Dialog title="Codex setup" onCancel={onCancel} color="warning">
        <Box flexDirection="column" gap={1}>
          <Text>{credentials.message}</Text>
          <Select
            options={[
              { label: 'Back', value: 'back' },
              { label: 'Cancel', value: 'cancel' },
            ]}
            onChange={value => (value === 'back' ? onBack() : onCancel())}
            onCancel={onCancel}
          />
        </Box>
      </Dialog>
    )
  }

  const options: OptionWithDescription<string>[] = [
    {
      label: 'codexplan',
      value: 'codexplan',
      description: 'GPT-5.4 with higher reasoning on the Codex backend',
    },
    {
      label: 'codexspark',
      value: 'codexspark',
      description: 'Faster Codex Spark tool loop profile',
    },
  ]

  return (
    <Dialog title="Choose a Codex profile" onCancel={onBack}>
      <Box flexDirection="column" gap={1}>
        <Text>
          Reuse your existing Codex credentials from{' '}
          {credentials.sourceDescription} and save a model alias profile.
        </Text>
        <Select
          options={options}
          defaultValue="codexplan"
          defaultFocusValue="codexplan"
          inlineDescriptions
          visibleOptionCount={options.length}
          onChange={value => {
            const env = buildCodexProfileEnv({
              model: value,
              processEnv: process.env,
            })
            if (env) {
              onSave('codex', env)
            }
          }}
          onCancel={onBack}
        />
      </Box>
    </Dialog>
  )
}

function resolveCodexCredentials(processEnv: NodeJS.ProcessEnv):
  | { ok: true; sourceDescription: string }
  | { ok: false; message: string } {
  const credentials = resolveCodexApiCredentials(processEnv)

  if (!credentials.apiKey) {
    const authHint = credentials.authPath
      ? `Expected auth file: ${credentials.authPath}.`
      : 'Set CODEX_API_KEY or re-login with the Codex CLI.'
    return {
      ok: false,
      message: `Codex setup needs existing credentials. Re-login with the Codex CLI or set CODEX_API_KEY. ${authHint}`,
    }
  }

  if (!credentials.accountId) {
    return {
      ok: false,
      message:
        'Codex auth is missing chatgpt_account_id. Re-login with the Codex CLI or set CHATGPT_ACCOUNT_ID/CODEX_ACCOUNT_ID first.',
    }
  }

  return {
    ok: true,
    sourceDescription:
      credentials.source === 'env'
        ? 'the current shell environment'
        : credentials.authPath ?? DEFAULT_CODEX_BASE_URL,
  }
}

function ProviderWizard({ onDone }: { onDone: LocalJSXCommandOnDone }): React.ReactNode {
  const defaults = getProviderWizardDefaults()
  const [step, setStep] = React.useState<Step>({ name: 'choose' })

  switch (step.name) {
    case 'choose':
      return (
        <ProviderChooser
          onChoose={value => {
            if (value === 'auto') {
              setStep({ name: 'auto-goal' })
            } else if (value === 'ollama') {
              setStep({ name: 'ollama-detect' })
            } else if (value === 'openai') {
              setStep({
                name: 'openai-key',
                defaultModel: defaults.openAIModel,
              })
            } else if (value === 'openrouter') {
              setStep({
                name: 'openai-key',
                defaultModel: defaults.openAIModel,
                isOpenRouter: true,
              })
            } else if (value === 'gemini') {
              setStep({ name: 'gemini-key' })
            } else if (value === 'clear') {
              const filePath = deleteProfileFile()
              onDone(`Removed saved provider profile at ${filePath}. Restart AlterClaude to go back to normal startup.`, {
                display: 'system',
              })
            } else {
              setStep({ name: 'codex-check' })
            }
          }}
          onCancel={() => onDone()}
        />
      )

    case 'auto-goal':
      return (
        <AutoGoalChooser
          onChoose={goal => setStep({ name: 'auto-detect', goal })}
          onBack={() => setStep({ name: 'choose' })}
        />
      )

    case 'auto-detect':
      return (
        <AutoRecommendationStep
          goal={step.goal}
          onBack={() => setStep({ name: 'auto-goal' })}
          onSave={(profile, env) => finishProfileSave(onDone, profile, env)}
          onNeedOpenAI={defaultModel =>
            setStep({ name: 'openai-key', defaultModel })
          }
          onCancel={() => onDone()}
        />
      )

    case 'ollama-detect':
      return (
        <OllamaModelStep
          onSave={(profile, env) => finishProfileSave(onDone, profile, env)}
          onBack={() => setStep({ name: 'choose' })}
          onCancel={() => onDone()}
        />
      )

    case 'openai-key':
      const isOR = step.isOpenRouter
      return (
        <TextEntryDialog
          resetStateKey={step.name}
          title={isOR ? 'OpenRouter setup' : 'OpenAI-compatible setup'}
          subtitle="Step 1 of 3"
          description={
            process.env.OPENAI_API_KEY
              ? 'Enter an API key, or leave this blank to reuse the current OPENAI_API_KEY from this session.'
              : `Enter the API key for your ${isOR ? 'OpenRouter' : 'OpenAI-compatible'} provider.`
          }
          initialValue=""
          placeholder="sk-..."
          mask="*"
          allowEmpty={Boolean(process.env.OPENAI_API_KEY)}
          validate={value => {
            const candidate = value.trim() || process.env.OPENAI_API_KEY || ''
            return sanitizeApiKey(candidate)
              ? null
              : 'Enter a real API key. Placeholder values like SUA_CHAVE are not valid.'
          }}
          onSubmit={value => {
            const apiKey = value.trim() || process.env.OPENAI_API_KEY || ''
            setStep({
              name: 'openai-base',
              apiKey,
              defaultModel: step.defaultModel,
              isOpenRouter: step.isOpenRouter,
            })
          }}
          onCancel={() => setStep({ name: 'choose' })}
        />
      )

    case 'openai-base':
      const isORbase = step.isOpenRouter
      return (
        <TextEntryDialog
          resetStateKey={step.name}
          title={isORbase ? 'OpenRouter setup' : 'OpenAI-compatible setup'}
          subtitle="Step 2 of 3"
          description={
            isORbase
              ? 'OpenRouter base URL is pre-filled. Press Enter to accept.'
              : `Optionally enter a base URL. Leave blank for ${DEFAULT_OPENAI_BASE_URL}.`
          }
          initialValue={
            isORbase
              ? OPENROUTER_BASE_URL
              : defaults.openAIBaseUrl === DEFAULT_OPENAI_BASE_URL
                ? ''
                : defaults.openAIBaseUrl
          }
          placeholder={isORbase ? OPENROUTER_BASE_URL : DEFAULT_OPENAI_BASE_URL}
          allowEmpty
          onSubmit={value => {
            const baseUrl = value.trim() || (isORbase ? OPENROUTER_BASE_URL : null)
            if (step.isOpenRouter) {
              // Go to model picker step
              setStep({
                name: 'openrouter-model',
                apiKey: step.apiKey,
                baseUrl: baseUrl || OPENROUTER_BASE_URL,
              })
            } else {
              setStep({
                name: 'openai-model',
                apiKey: step.apiKey,
                baseUrl,
                defaultModel: step.defaultModel,
              })
            }
          }}
          onCancel={() =>
            setStep({
              name: 'openai-key',
              defaultModel: step.defaultModel,
              isOpenRouter: step.isOpenRouter,
            })
          }
        />
      )

    case 'openai-model':
      const isORmodel = step.isOpenRouter
      return (
        <TextEntryDialog
          resetStateKey={step.name}
          title={isORmodel ? 'OpenRouter setup' : 'OpenAI-compatible setup'}
          subtitle="Step 3 of 3"
          description={`Enter a model name. Leave blank for ${step.defaultModel}.`}
          initialValue={defaults.openAIModel ?? step.defaultModel}
          placeholder={step.defaultModel}
          allowEmpty
          onSubmit={value => {
            if (step.isOpenRouter) {
              const env = buildOpenRouterProfileEnv({
                apiKey: step.apiKey,
                baseUrl: step.baseUrl,
                model: value.trim() || step.defaultModel,
                processEnv: {},
              })
              if (env) {
                finishProfileSave(onDone, 'openrouter', env)
              }
            } else {
              const env = buildOpenAIProfileEnv({
                goal: normalizeRecommendationGoal(null),
                apiKey: step.apiKey,
                baseUrl: step.baseUrl,
                model: value.trim() || step.defaultModel,
                processEnv: {},
              })
              if (env) {
                finishProfileSave(onDone, 'openai', env)
              }
            }
          }}
          onCancel={() =>
            setStep({
              name: 'openai-base',
              apiKey: step.apiKey,
              defaultModel: step.defaultModel,
              isOpenRouter: step.isOpenRouter,
            })
          }
        />
      )

    case 'openrouter-model':
      return (
        <OpenRouterModelStep
          apiKey={step.apiKey}
          baseUrl={step.baseUrl}
          onSave={(model) => {
            const env = buildOpenRouterProfileEnv({
              apiKey: step.apiKey,
              baseUrl: step.baseUrl,
              model,
              processEnv: {},
            })
            if (env) {
              finishProfileSave(onDone, 'openrouter', env)
            }
          }}
          onBack={() =>
            setStep({
              name: 'openai-base',
              apiKey: step.apiKey,
              defaultModel: getGoalDefaultOpenAIModel(normalizeRecommendationGoal(null)),
              isOpenRouter: true,
            })
          }
          onCancel={() => onDone()}
        />
      )

    case 'gemini-key':
      return (
        <TextEntryDialog
          resetStateKey={step.name}
          title="Gemini setup"
          subtitle="Step 1 of 2"
          description={
            process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
              ? 'Enter a Gemini API key, or leave this blank to reuse the current GEMINI_API_KEY/GOOGLE_API_KEY from this session.'
              : 'Enter a Gemini API key. You can create one at https://aistudio.google.com/apikey.'
          }
          initialValue=""
          placeholder="AIza..."
          mask="*"
          allowEmpty={Boolean(
            process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
          )}
          onSubmit={value => {
            const apiKey =
              value.trim() ||
              process.env.GEMINI_API_KEY ||
              process.env.GOOGLE_API_KEY ||
              ''
            setStep({ name: 'gemini-model', apiKey })
          }}
          onCancel={() => setStep({ name: 'choose' })}
        />
      )

    case 'gemini-model':
      return (
        <TextEntryDialog
          resetStateKey={step.name}
          title="Gemini setup"
          subtitle="Step 2 of 2"
          description={`Enter a Gemini model name. Leave blank for ${DEFAULT_GEMINI_MODEL}.`}
          initialValue={defaults.geminiModel}
          placeholder={DEFAULT_GEMINI_MODEL}
          allowEmpty
          onSubmit={value => {
            const env = buildGeminiProfileEnv({
              apiKey: step.apiKey,
              model: value.trim() || DEFAULT_GEMINI_MODEL,
              processEnv: {},
            })
            if (env) {
              finishProfileSave(onDone, 'gemini', env)
            }
          }}
          onCancel={() => setStep({ name: 'gemini-key' })}
        />
      )

    case 'codex-check':
      return (
        <CodexCredentialStep
          onSave={(profile, env) => finishProfileSave(onDone, profile, env)}
          onBack={() => setStep({ name: 'choose' })}
          onCancel={() => onDone()}
        />
      )
  }
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const normalizedArgs = args?.trim().toLowerCase() || ''

  if (COMMON_INFO_ARGS.includes(normalizedArgs)) {
    onDone(buildUsageText(), { display: 'system' })
    return null
  }

  if (COMMON_HELP_ARGS.includes(normalizedArgs)) {
    onDone(buildUsageText(), { display: 'system' })
    return null
  }

  if (normalizedArgs) {
    onDone('Usage: /provider', { display: 'system' })
    return null
  }

  return <ProviderWizard onDone={onDone} />
}
