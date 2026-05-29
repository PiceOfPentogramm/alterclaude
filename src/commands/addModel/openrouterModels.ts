export type OpenRouterModelInfo = {
  id: string
  name: string | null
  promptPrice: number | null
  completionPrice: number | null
  contextLength: number | null
}

export async function fetchOpenRouterModels(
  apiKey: string,
  baseUrl?: string,
): Promise<OpenRouterModelInfo[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const url = `${(baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')}/models`
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    if (!response.ok) return []
    const json = (await response.json()) as {
      data?: Array<{
        id: string
        name?: string
        pricing?: { prompt?: string; completion?: string }
        context_length?: number
      }>
    }
    return (json.data ?? [])
      .filter(m => Boolean(m.id))
      .map(m => ({
        id: m.id,
        name: m.name ?? null,
        promptPrice: m.pricing?.prompt ? parseFloat(m.pricing.prompt) : null,
        completionPrice: m.pricing?.completion
          ? parseFloat(m.pricing.completion)
          : null,
        contextLength: m.context_length ?? null,
      }))
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

function stripTrailingZeros(s: string): string {
  const idx = s.indexOf('.')
  if (idx === -1) return s
  const trimmed = s.replace(/0+$/, '')
  return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed
}

export function formatModelPrice(pricePerToken: number | null): string {
  if (pricePerToken === null || pricePerToken === 0) return 'free'
  const perMToken = pricePerToken * 1_000_000
  if (perMToken >= 100) return `$${stripTrailingZeros(perMToken.toFixed(0))}/M`
  if (perMToken >= 1) return `$${stripTrailingZeros(perMToken.toFixed(2))}/M`
  return `$${stripTrailingZeros(perMToken.toFixed(4))}/M`
}

export function formatContextLength(bytes: number | null): string {
  if (bytes === null) return '?'
  if (bytes >= 1_000_000) return `${(bytes / 1_000).toFixed(0)}K`
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)}K`
  return `${bytes}`
}

export function formatModelDescription(m: OpenRouterModelInfo): string {
  const parts: string[] = []
  if (m.promptPrice !== null || m.completionPrice !== null) {
    parts.push(`${formatModelPrice(m.promptPrice)} in · ${formatModelPrice(m.completionPrice)} out`)
  }
  if (m.contextLength !== null) {
    parts.push(`${formatContextLength(m.contextLength)} ctx`)
  }
  return parts.join(' · ') || 'OpenRouter model'
}