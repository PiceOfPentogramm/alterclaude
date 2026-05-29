import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { execFileNoThrowWithCwd } from './execFileNoThrow.js'
import { registerCleanup } from './cleanupRegistry.js'

let searxngContainerName = 'alterclaude-searxng'
let searxngPort = '8888'
let startedByUs = false
let containerActuallyRunning = false
let dockerPath: string | null = null
let createdConfigDir: string | null = null

const SEARXNG_IMAGE = 'searxng/searxng'

const SETTINGS_YML = `use_default_settings: true
server:
  secret_key: "alterclaude-searxng"
  limiter: false
search:
  formats:
  - html
  - json
engines:
  - name: wikidata
    disabled: true
`

export type SearXNGStatus =
  | { ok: true; running: true; message: string }
  | { ok: true; running: false; message: string }
  | { ok: false; message: string }

export function getSearXNGBaseUrl(): string | null {
  if (process.env.SEARXNG_BASE_URL) {
    try {
      const u = new URL(process.env.SEARXNG_BASE_URL)
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]') {
        return process.env.SEARXNG_BASE_URL
      }
    } catch {
      return null
    }
  }
  return startedByUs ? `http://localhost:${searxngPort}` : null
}

function ensureDefaultSettings(): string {
  const dir = path.join(os.tmpdir(), 'alterclaude-searxng-config')
  fs.mkdirSync(dir, { recursive: true })
  const settingsPath = path.join(dir, 'settings.yml')
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, SETTINGS_YML, 'utf-8')
  }
  createdConfigDir = dir
  return dir
}

async function cleanupConfigDir(): Promise<void> {
  if (!createdConfigDir) return
  try {
    await fs.promises.rm(createdConfigDir, { recursive: true, force: true })
  } catch {}
  createdConfigDir = null
}

async function resolveDocker(): Promise<string | null> {
  if (dockerPath) return dockerPath

  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
    const candidates = [
      `${programFiles}\\Docker\\Docker\\resources\\bin\\docker.exe`,
      `${programFiles}\\Docker\\Docker\\resources\\docker.exe`,
    ]
    for (const c of candidates) {
      const r = await execFileNoThrowWithCwd(c, ['--version'], { timeout: 5000 })
      if (r.code === 0) {
        dockerPath = c
        return c
      }
    }
    return null
  }

  dockerPath = 'docker'
  return 'docker'
}

async function docker(args: string[], timeout = 10000): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const exe = await resolveDocker()
  if (!exe) {
    return { exitCode: -1, stdout: '', stderr: 'docker not found' }
  }
  const result = await execFileNoThrowWithCwd(exe, args, { timeout })
  return { exitCode: result.code, stdout: result.stdout, stderr: result.stderr || '' }
}

async function isContainerRunning(): Promise<boolean> {
  const { exitCode, stdout } = await docker(
    ['ps', '--filter', `name=${searxngContainerName}`, '--format', '{{.Names}}'],
    5000,
  )
  return exitCode === 0 && stdout.trim() === searxngContainerName
}

async function isContainerExists(): Promise<boolean> {
  const { exitCode, stdout } = await docker(
    ['ps', '-a', '--filter', `name=${searxngContainerName}`, '--format', '{{.Names}}'],
    5000,
  )
  return exitCode === 0 && stdout.trim() === searxngContainerName
}

async function isDockerEngineRunning(): Promise<boolean> {
  const { exitCode } = await docker(['info', '--format', '{{.ServerVersion}}'], 5000)
  return exitCode === 0
}

const DOCKER_DESKTOP_PATHS = [
  'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
  `${process.env.LOCALAPPDATA || ''}\\Docker\\Docker Desktop\\Docker Desktop.exe`,
  `${process.env.ProgramW6432 || 'C:\\Program Files'}\\Docker\\Docker\\Docker Desktop.exe`,
]

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function killDockerDesktop(): Promise<void> {
  await execFileNoThrowWithCwd(
    'powershell.exe',
    ['-NoProfile', '-Command', 'Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force'],
    { timeout: 15000 },
  )
  await sleep(3000)
}

async function startDockerDesktop(): Promise<boolean> {
  if (process.platform !== 'win32') return false

  // Only kill hung processes if engine is not responding
  if (!await isDockerEngineRunning()) {
    await killDockerDesktop()
  }

  for (const exePath of DOCKER_DESKTOP_PATHS) {
    if (!exePath) continue
    const r = await execFileNoThrowWithCwd(exePath, ['--version'], { timeout: 5000 })
    if (r.code !== 0) continue

    const psCmd = `Start-Process -FilePath "${exePath}" -WindowStyle Hidden`
    await execFileNoThrowWithCwd('powershell.exe', ['-NoProfile', '-Command', psCmd], { timeout: 10000 })

    for (let i = 0; i < 90; i++) {
      await sleep(1000)
      if (await isDockerEngineRunning()) return true
    }
    return false
  }
  return false
}

export async function ensureDockerEngine(): Promise<boolean> {
  if (await isDockerEngineRunning()) return true
  return startDockerDesktop()
}

export async function getStatus(): Promise<SearXNGStatus> {
  const dockerOk = await ensureDockerEngine()
  if (!dockerOk) {
    return { ok: false, message: 'Docker Engine is not running' }
  }

  const exists = await isContainerExists()
  if (!exists) {
    return { ok: false, message: 'Container does not exist' }
  }

  const running = await isContainerRunning()
  return running
    ? { ok: true, running: true, message: 'Running' }
    : { ok: true, running: false, message: 'Stopped' }
}

export async function ensureSearXNG(): Promise<SearXNGStatus> {
  if (process.env.SEARXNG_BASE_URL) {
    return { ok: true, running: true, message: 'Using external SearXNG_BASE_URL' }
  }

  const dockerOk = await ensureDockerEngine()
  if (!dockerOk) {
    return { ok: false, message: 'Docker Engine is not running' }
  }

  const running = await isContainerRunning()
  if (running) {
    startedByUs = true
    containerActuallyRunning = true
    return { ok: true, running: true, message: 'SearXNG container already running' }
  }

  const exists = await isContainerExists()
  if (exists) {
    // Remove old container (may be from before settings.yml fix)
    await docker(['rm', '-f', searxngContainerName], 10000)
  }

  // Create config, pull image, create container
  const configDir = ensureDefaultSettings()
  const { exitCode: pullCode } = await docker(['pull', SEARXNG_IMAGE], 120000)
  if (pullCode !== 0) {
    return { ok: false, message: 'Failed to pull SearXNG image' }
  }

  const { exitCode: runCode, stderr } = await docker(
    ['run', '-d', '--name', searxngContainerName, '--restart', 'no',
     '-v', `${configDir}:/etc/searxng:rw`,
     '-p', `${searxngPort}:8080`, SEARXNG_IMAGE],
    30000,
  )
  if (runCode !== 0) {
    return { ok: false, message: `Failed to start SearXNG container: ${stderr || 'unknown error'}` }
  }

  startedByUs = true
  containerActuallyRunning = true
  return { ok: true, running: true, message: 'SearXNG container created and started' }
}

export async function stopSearXNG(): Promise<void> {
  if (!containerActuallyRunning) return
  await docker(['stop', searxngContainerName], 10000)
  containerActuallyRunning = false
  startedByUs = false
}

export async function initializeSearXNG(): Promise<void> {
  if (process.env.SEARXNG_BASE_URL) return
  startedByUs = true
  try {
    const status = await ensureSearXNG()
    if (status.ok && status.running) {
      containerActuallyRunning = true
    }
  } catch {
    // Silently ignore — WebSearch tool shows friendly error
  }
  registerCleanup(async () => {
    await stopSearXNG()
    await cleanupConfigDir()
  })
}