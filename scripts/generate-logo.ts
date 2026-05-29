import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')

const raw = execSync('npx cfonts "ALTER CLAUDE" --font block --colors white --align left --no-gradient 2>&1', {
  encoding: 'utf-8',
  timeout: 30_000,
  cwd: import.meta.dir,
})

const lines = strip(raw).split('\n').filter(l => l.trim())

const outPath = join(import.meta.dir, '..', 'src', 'generated-logo.json')
writeFileSync(outPath, JSON.stringify(lines, null, 2), 'utf-8')
console.log(`[logo] Generated ${lines.length} logo lines → ${outPath}`)
