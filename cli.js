#!/usr/bin/env node

import path from 'node:path'
import { CLIEngine } from './src/index.js'

async function cli() {
  const args = process.argv.slice(2)
  const options = {
    input: ['src/**/*.{html,jsx,tsx,vue}'],
    output: 'dist/styles.css',
    watch: false,
    minify: false,
    sourceMap: false,
    prefix: '',
    config: null
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
      case '--watch':
      case '-w':
        options.watch = true
        break
      case '--minify':
      case '-m':
        options.minify = true
        break
      case '--source-map':
      case '-s':
        options.sourceMap = true
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

          options.config = configModule.default
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
  --watch, -w      Watch mode (default: false)
  --minify, -m     Minify output CSS (default: false)
  --source-map, -s Generate source maps (default: false)
  --prefix, -p     Add prefix to all class names (default: "")
  --config, -c     Path to config file
  --help, -h       Show this help message

Examples:
  tui-css-run --input "index.html,src/**/*.jsx" --output dist/styles.css --watch
  tui-css-run -i "components/*.tsx" -o styles.css -m -s
`)
        process.exit(0)
    }
  }
  const cliInstance = new CLIEngine({ config: options.config })

  await cliInstance.generate(options)
}

if (import.meta.url.startsWith('file:')) {
  cli().catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
}


