#!/usr/bin/env node

const args = process.argv.slice(2)

const getArg = (name, fallback = '') => {
  const exact = args.find((arg) => arg.startsWith(`${name}=`))
  if (exact) return exact.slice(name.length + 1)
  const index = args.indexOf(name)
  if (index >= 0) return args[index + 1] ?? fallback
  return fallback
}

const baseRaw = getArg('--base', process.env.SMOKE_BASE_URL || 'http://localhost:4173')
const base = baseRaw.replace(/\/+$/, '')
let distDir = getArg('--dist', '')
if (!distDir) {
  const positional = args.filter((arg) => !arg.startsWith('--'))
  if (positional.length === 1) {
    const guess = positional[0]
    if (guess && !/^https?:\/\//i.test(guess)) {
      distDir = guess
    }
  }
}

const checkDistMode = async (dir) => {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')

  const requiredFiles = [
    '.htaccess',
    'api/health.php',
    'api/leaderboard-get.php',
    'api/matchmake-status.php',
  ]

  let failed = false
  for (const relative of requiredFiles) {
    const filePath = path.join(dir, relative)
    try {
      await fs.access(filePath)
      console.log(`[OK]   file ${relative}`)
    } catch {
      failed = true
      console.error(`[FAIL] file missing ${relative}`)
    }
  }

  try {
    const htaccess = await fs.readFile(path.join(dir, '.htaccess'), 'utf8')
    const hasApiGuard =
      htaccess.includes('RewriteRule ^api/ - [L]') &&
      htaccess.includes('RewriteCond %{REQUEST_URI} !^/api/')
    if (hasApiGuard) {
      console.log('[OK]   rewrite api guard found')
    } else {
      failed = true
      console.error('[FAIL] rewrite api guard missing in .htaccess')
    }
  } catch {
    failed = true
    console.error('[FAIL] unable to read .htaccess')
  }

  if (failed) process.exit(1)
  console.log('Smoke dist O2Switch: OK')
}

if (distDir) {
  await checkDistMode(distDir)
  process.exit(0)
}

const checks = [
  { name: 'health', path: '/api/health', expectedStatuses: [200, 503] },
  {
    name: 'leaderboard-auth',
    path: '/api/leaderboard-get?scope=global&page=1&pageSize=1',
    expectedStatuses: [200, 401],
  },
  { name: 'matchmake-status-auth', path: '/api/matchmake-status', expectedStatuses: [200, 401] },
]

const isJsonResponse = (contentType, body) => {
  const trimmed = body.trim()
  if ((contentType || '').toLowerCase().includes('json')) return true
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

const isHtmlResponse = (contentType, body) => {
  const trimmed = body.trim()
  if ((contentType || '').toLowerCase().includes('text/html')) return true
  return /^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)
}

let hasFailure = false

for (const check of checks) {
  const url = `${base}${check.path}`
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    const body = await response.text()
    const contentType = response.headers.get('content-type') || ''
    const html = isHtmlResponse(contentType, body)
    const json = isJsonResponse(contentType, body)

    const statusOk = check.expectedStatuses.includes(response.status)
    const formatOk = json && !html

    if (!statusOk || !formatOk) {
      hasFailure = true
      console.error(`[FAIL] ${check.name} ${response.status} ${url}`)
      console.error(`       content-type=${contentType || '(none)'}`)
      continue
    }

    console.log(`[OK]   ${check.name} ${response.status} ${url}`)
  } catch (error) {
    hasFailure = true
    console.error(`[FAIL] ${check.name} request error: ${String(error)}`)
  }
}

if (hasFailure) {
  process.exit(1)
}

console.log('Smoke API O2Switch: OK')
