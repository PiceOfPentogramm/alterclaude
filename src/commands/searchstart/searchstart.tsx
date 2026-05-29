import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { ensureSearXNG, getStatus } from '../../utils/searxng.js'

export async function call(onDone: LocalJSXCommandOnDone): Promise<null> {
  const status = await getStatus()
  if (status.ok && status.running) {
    onDone(`✓ SearXNG: ${status.message}`)
    return null
  }

  const result = await ensureSearXNG()
  if (!result.ok) {
    onDone(`✗ SearXNG: ${result.message}. Make sure Docker Desktop is running.`)
    return null
  }
  onDone(`✓ SearXNG: ${result.message}`)
  return null
}