#!/usr/bin/env node

import path from 'node:path'
import { CLIEngine } from './dist/index.min.js'

async function cli() {
  const args = process.argv.slice(2)
  const options = {
    input: ['src/**/*.{html,jsx,tsx,vue}'],
    output: 'dist/styles.css',
    watch: false,
    minify: false,
    tabSize: 2,
    layer: false,
    prefix: '',
    tenoxui: null
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--input':
      case '-i':
        options.input = args[++i].split(',')
        break
      case '--output':
      case '-o':
        options.output = args[++i]
        break
      case '--tabs':
      case '-t':
        options.tabSize = args[++i]
        break
      case '--watch':
      case '-w':
        options.watch = true
        break
      case '--layer':
      case '-l':
        options.layer = true
        break
      case '--minify':
      case '-m':
        options.minify = true
        break
      case '--prefix':
      case '-p':
        options.prefix = args[++i]
        break
      case '--config':
      case '-c':
        try {
          const configPath = path.resolve(args[++i])
          const configModule = await import(configPath)

          options.tenoxui = configModule.default
        } catch (error) {
          console.error('Error loading config file:', error)
          process.exit(1)
        }
        break
      case '--help':
      case '-h':
        console.log(`
tx-gen - TenoxUI CSS Static Generator

Options:
  --input, -i      Input files (glob patterns supported, comma-separated)
                   default: "src/**/*.{html,jsx,tsx,vue}"
  --output, -o     Output CSS file (default: "dist/styles.css")
  --layer, -l      Use modern CSS layer query (default: false)
  --tabs, -t       Define spaces for nested styles (default: 2)
  --config, -c     Path to config file
  --watch, -w      Watch mode (default: false)
  --minify, -m     Minify output CSS (default: false)
  --prefix, -p     Add prefix to all class names (default: "")
  --help, -h       Show this help message

Examples:
  tui-css-run --input "index.html,src/**/*.jsx" --output dist/styles.css --watch
  tui-css-run -i "components/*.tsx" -o styles.css -m -s -l
`)
        process.exit(0)
    }
  }
  const cliInstance = new CLIEngine(options)

  await cliInstance.generate()
}

if (import.meta.url.startsWith('file:')) {
  cli().catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
}
