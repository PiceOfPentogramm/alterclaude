/**
 * AlterClaude startup screen — filled-block text logo with sunset gradient.
 * Called once at CLI startup before the Ink UI renders.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

declare const MACRO: { VERSION: string; DISPLAY_VERSION?: string }

// ─── Generated 3d logo ───────────────────────────────────────────────────────
import LOGO_LINES from '../generated-logo.json' assert { type: 'json' }

const ESC = '\x1b['
const RESET = `${ESC}0m`
const DIM = `${ESC}2m`

type RGB = [number, number, number]
const rgb = (r: number, g: number, b: number) => `${ESC}38;2;${r};${g};${b}m`

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function gradAt(stops: RGB[], t: number): RGB {
  const c = Math.max(0, Math.min(1, t))
  const s = c * (stops.length - 1)
  const i = Math.floor(s)
  if (i >= stops.length - 1) return stops[stops.length - 1]
  return lerp(stops[i], stops[i + 1], s - i)
}

function paintLine(text: string, stops: RGB[], lineT: number): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const t = text.length > 1 ? lineT * 0.5 + (i / (text.length - 1)) * 0.5 : lineT
    const [r, g, b] = gradAt(stops, t)
    out += `${rgb(r, g, b)}${text[i]}`
  }
  return out + RESET
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const LOGO_GRAD: RGB[] = [
  [220, 165, 255],
  [195, 135, 240],
  [170, 105, 215],
  [150, 80, 190],
  [130, 55, 165],
  [105, 35, 140],
]

const ACCENT: RGB = [180, 120, 230]
const CREAM: RGB = [210, 185, 230]
const DIMCOL: RGB = [130, 105, 150]
const BORDER: RGB = [100, 80, 120]

// ─── Provider detection ───────────────────────────────────────────────────────

function detectProvider(): { name: string; model: string; baseUrl: string; isLocal: boolean } {
  const useGemini = process.env.CLAUDE_CODE_USE_GEMINI === '1' || process.env.CLAUDE_CODE_USE_GEMINI === 'true'
  const useGithub = process.env.CLAUDE_CODE_USE_GITHUB === '1' || process.env.CLAUDE_CODE_USE_GITHUB === 'true'
  const useOpenAI = process.env.CLAUDE_CODE_USE_OPENAI === '1' || process.env.CLAUDE_CODE_USE_OPENAI === 'true'
  const useOpenRouter = process.env.CLAUDE_CODE_USE_OPENROUTER === '1' || process.env.CLAUDE_CODE_USE_OPENROUTER === 'true'

  // Try to read custom models from saved settings
  let customModel: string | undefined
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json')
    if (existsSync(settingsPath)) {
      const raw = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      if (raw.customModels?.length > 0) {
        customModel = raw.customModels[0]
      }
    }
  } catch { /* settings file not available */ }

  if (useOpenRouter) {
    const rawModel = process.env.OPENROUTER_MODEL || customModel || 'deepseek/deepseek-v4-flash'
    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
    return { name: 'OpenRouter', model: rawModel, baseUrl, isLocal: false }
  }

  if (useGemini) {
    const model = process.env.GEMINI_MODEL || customModel || 'gemini-2.0-flash'
    const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai'
    return { name: 'Google Gemini', model, baseUrl, isLocal: false }
  }

  if (useGithub) {
    const model = process.env.OPENAI_MODEL || customModel || 'github:copilot'
    const baseUrl =
      process.env.OPENAI_BASE_URL || 'https://models.github.ai/inference'
    return { name: 'GitHub Models', model, baseUrl, isLocal: false }
  }

  if (useOpenAI) {
    const rawModel = process.env.OPENAI_MODEL || customModel || 'gpt-4o'
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl)
    let name = 'OpenAI'
    if (/deepseek/i.test(baseUrl) || /deepseek/i.test(rawModel))       name = 'DeepSeek'
    else if (/together/i.test(baseUrl))                                name = 'Together AI'
    else if (/groq/i.test(baseUrl))                                    name = 'Groq'
    else if (/mistral/i.test(baseUrl) || /mistral/i.test(rawModel))     name = 'Mistral'
    else if (/azure/i.test(baseUrl))                                   name = 'Azure OpenAI'
    else if (/localhost:11434/i.test(baseUrl))                         name = 'Ollama'
    else if (/localhost:1234/i.test(baseUrl))                          name = 'LM Studio'
    else if (/llama/i.test(rawModel))                                     name = 'Meta Llama'
    else if (isLocal)                                                  name = 'Local'
    
    // Resolve model alias to actual model name + reasoning effort
    let displayModel = rawModel
    const codexAliases: Record<string, { model: string; reasoningEffort?: string }> = {
      codexplan: { model: 'gpt-5.4', reasoningEffort: 'high' },
      'gpt-5.4': { model: 'gpt-5.4', reasoningEffort: 'high' },
      'gpt-5.3-codex': { model: 'gpt-5.3-codex', reasoningEffort: 'high' },
      'gpt-5.3-codex-spark': { model: 'gpt-5.3-codex-spark' },
      codexspark: { model: 'gpt-5.3-codex-spark' },
      'gpt-5.2-codex': { model: 'gpt-5.2-codex', reasoningEffort: 'high' },
      'gpt-5.1-codex-max': { model: 'gpt-5.1-codex-max', reasoningEffort: 'high' },
      'gpt-5.1-codex-mini': { model: 'gpt-5.1-codex-mini' },
      'gpt-5.4-mini': { model: 'gpt-5.4-mini', reasoningEffort: 'medium' },
      'gpt-5.2': { model: 'gpt-5.2', reasoningEffort: 'medium' },
    }
    const alias = rawModel.toLowerCase()
    if (alias in codexAliases) {
      const resolved = codexAliases[alias]
      displayModel = resolved.model
      if (resolved.reasoningEffort) {
        displayModel = `${displayModel} (${resolved.reasoningEffort})`
      }
    }
    
    return { name, model: displayModel, baseUrl, isLocal }
  }

  // No explicit provider — check if OPENROUTER_API_KEY suggests OpenRouter
  if (process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    const rawModel = process.env.OPENROUTER_MODEL || customModel || 'deepseek/deepseek-v4-flash'
    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
    return { name: 'OpenRouter', model: rawModel, baseUrl, isLocal: false }
  }

  // Default: Anthropic
  const model = customModel || process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
  const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
  return { name: 'Anthropic', model, baseUrl, isLocal: false }
}

// ─── Box drawing ──────────────────────────────────────────────────────────────

function boxRow(content: string, width: number, rawLen: number): string {
  const pad = Math.max(0, width - 2 - rawLen)
  return `${rgb(...BORDER)}\u2502${RESET}${content}${' '.repeat(pad)}${rgb(...BORDER)}\u2502${RESET}`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function printStartupScreen(): void {
  // Skip in non-interactive / CI / print mode
  if (process.env.CI || !process.stdout.isTTY) return

  const p = detectProvider()
  const W = 62
  const out: string[] = []

  out.push('')

  // Gradient logo
  const allLogo = LOGO_LINES as string[]
  const total = allLogo.length
  for (let i = 0; i < total; i++) {
    const t = total > 1 ? i / (total - 1) : 0
    if (allLogo[i] === '') {
      out.push('')
    } else {
      out.push(paintLine(allLogo[i], LOGO_GRAD, t))
    }
  }

  out.push('')

  // Tagline
  out.push(`  ${rgb(...ACCENT)}\u2726${RESET} ${rgb(...CREAM)}Alter your mind. Every model. Zero limits.${RESET} ${rgb(...ACCENT)}\u2726${RESET}`)
  out.push('')

  // Provider info box
  out.push(`${rgb(...BORDER)}\u2554${'\u2550'.repeat(W - 2)}\u2557${RESET}`)

  const lbl = (k: string, v: string, c: RGB = CREAM): [string, number] => {
    const padK = k.padEnd(9)
    return [` ${DIM}${rgb(...DIMCOL)}${padK}${RESET} ${rgb(...c)}${v}${RESET}`, ` ${padK} ${v}`.length]
  }

  const provC: RGB = p.isLocal ? [130, 175, 130] : ACCENT
  let [r, l] = lbl('Provider', p.name, provC)
  out.push(boxRow(r, W, l))
  const ep = p.baseUrl.length > 38 ? p.baseUrl.slice(0, 35) + '...' : p.baseUrl
  ;[r, l] = lbl('Endpoint', ep)
  out.push(boxRow(r, W, l))

  out.push(`${rgb(...BORDER)}\u2560${'\u2550'.repeat(W - 2)}\u2563${RESET}`)

  const sC: RGB = p.isLocal ? [130, 175, 130] : ACCENT
  const sL = p.isLocal ? 'local' : 'cloud'
  const sRow = ` ${rgb(...sC)}\u25cf${RESET} ${DIM}${rgb(...DIMCOL)}${sL}${RESET}    ${DIM}${rgb(...DIMCOL)}Ready \u2014 type ${RESET}${rgb(...ACCENT)}/help${RESET}${DIM}${rgb(...DIMCOL)} to begin${RESET}`
  const sLen = ` \u25cf ${sL}    Ready \u2014 type /help to begin`.length
  out.push(boxRow(sRow, W, sLen))

  out.push(`${rgb(...BORDER)}\u255a${'\u2550'.repeat(W - 2)}\u255d${RESET}`)
  out.push(`  ${DIM}${rgb(...DIMCOL)}alterclaude ${RESET}${rgb(...ACCENT)}v${MACRO.DISPLAY_VERSION ?? MACRO.VERSION}${RESET}`)
  out.push('')

  process.stdout.write(out.join('\n') + '\n')
}
