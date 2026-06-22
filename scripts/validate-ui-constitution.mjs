#!/usr/bin/env node
/**
 * Validates locked dashboard tabs against design/ui-registry.yaml.
 * Analogue of validate-page-blueprint.py on the marketing site.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadRegistry() {
  const path = join(root, 'design', 'ui-registry.yaml')
  if (!existsSync(path)) {
    console.error('Missing design/ui-registry.yaml')
    process.exit(1)
  }
  const raw = readFileSync(path, 'utf8')
  const tabs = {}
  let current = null
  for (const line of raw.split('\n')) {
    const tabMatch = line.match(/^  (\w+):$/)
    if (tabMatch && !line.startsWith('    ')) {
      current = tabMatch[1]
      tabs[current] = { status: 'migrating', files: [], requires: [] }
      continue
    }
    if (!current) continue
    const status = line.match(/^\s+status:\s+(\w+)/)
    if (status) tabs[current].status = status[1]
    const file = line.match(/^\s+-\s+(src\/[^\s]+)/)
    if (file) tabs[current].files.push(file[1])
    const req = line.match(/^\s+requires:\s+\[(.+)\]/)
    if (req) {
      tabs[current].requires = req[1].split(',').map(s => s.trim())
    }
  }
  return tabs
}

const FORBIDDEN = [
  {
    id: 'raw-table-wrapper',
    re: /bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden/,
    message: 'Use DataTableShell / DashboardSection (see design/DESIGN.md)',
  },
  {
    id: 'raw-table-tag',
    re: /<table className="w-full(?!.*uni-data-table)/,
    message: 'Use <DataTable className="uni-data-table …">',
  },
  {
    id: 'gray-thead',
    re: /thead className="bg-gray-50/,
    message: 'Use <DataTableHead> or class uni-data-table-head',
  },
  {
    id: 'inline-page-h1-gray',
    re: /<h1 className="text-2xl font-bold text-gray-900">/,
    message: 'Use TabPageShell for page titles on locked tabs',
  },
]

function checkFile(relPath, locked) {
  const abs = join(root, relPath.replace(/\//g, '\\'))
  const alt = join(root, relPath)
  const path = existsSync(abs) ? abs : alt
  if (!existsSync(path)) {
    return [{ level: 'warn', file: relPath, message: 'File not found (skipped)' }]
  }
  const content = readFileSync(path, 'utf8')
  const issues = []

  for (const rule of FORBIDDEN) {
    if (rule.re.test(content)) {
      issues.push({
        level: locked ? 'error' : 'warn',
        file: relPath,
        rule: rule.id,
        message: rule.message,
      })
    }
  }

  if (locked) {
    const hasTablePrimitive =
      content.includes('DataTable') ||
      content.includes('uni-data-table') ||
      !content.includes('<table')
    if (content.includes('<table') && !hasTablePrimitive) {
      issues.push({
        level: 'error',
        file: relPath,
        rule: 'missing-datatable-import',
        message: 'Locked tab with <table> must use DataTable components',
      })
    }
  }

  return issues
}

const tabs = loadRegistry()
let errors = 0
let warns = 0

console.log('Mission Control UI constitution validate\n')

for (const [name, tab] of Object.entries(tabs)) {
  if (!tab.files?.length) continue
  const locked = tab.status === 'locked'
  console.log(`${name} (${tab.status})`)
  for (const file of tab.files) {
    const issues = checkFile(file, locked)
    for (const i of issues) {
      const tag = i.level === 'error' ? 'ERROR' : 'WARN'
      console.log(`  [${tag}] ${file}: ${i.message}`)
      if (i.level === 'error') errors++
      else warns++
    }
  }
  if (locked && tab.requires?.length) {
    const pageFile = tab.files[0]
    for (const file of tab.files) {
      const abs = join(root, file)
      if (!existsSync(abs)) continue
      const content = readFileSync(abs, 'utf8')
      if (file === pageFile && tab.requires.includes('TabPageShell') && !content.includes('TabPageShell')) {
        console.log(`  [ERROR] ${file}: missing required TabPageShell`)
        errors++
      }
      if (content.includes('<table') && tab.requires.includes('DataTable') && !content.includes('DataTable') && !content.includes('uni-data-table')) {
        console.log(`  [ERROR] ${file}: missing required DataTable`)
        errors++
      }
      if (file === pageFile && tab.requires.includes('FilterShell') && !content.includes('FilterShell')) {
        console.log(`  [ERROR] ${file}: missing required FilterShell`)
        errors++
      }
    }
  }
  console.log('')
}

if (errors > 0) {
  console.log(`Failed: ${errors} error(s), ${warns} warning(s)`)
  process.exit(1)
}
console.log(`OK: ${warns} warning(s) on migrating tabs`)
process.exit(0)
