import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TenoxUI } from '@tenoxui/static'
import { merge } from '@nousantx/someutils'
import { watch } from 'chokidar'
import { load } from 'cheerio'
import { glob } from 'glob'
import { SourceMapGenerator } from './lib/sourcemap.js'

export class CLIEngine {
  constructor({ config = {}, layer = false, tabs = 2 }) {
    const { apply, reserveClass, ...filteredConfig } = config
    this.config = filteredConfig
    this.tenoxui = new TenoxUI(config)
    this.mapper = new SourceMapGenerator()
    this.watchMode = false
    this.outputPath = ''
    this.inputPatterns = []
    this.layer = layer
    this.tabs = tabs
    this.layers = new Map([
      ['base', ''],
      ['theme', ''],
      ['components', ''],
      ['utilities', '']
    ])
    this.layerOrder = ['base', 'theme', 'components', 'utilities']
    this.options = {
      minify: false,
      sourceMap: false,
      prefix: ''
    }
  }

  /** #?
   * Utilities
   *
   * Basic utilities for make the development easier and more efficient
   */

  addTabs(str, size = 2) {
    return str
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => `${' '.repeat(size)}${line}`)
      .join('\n')
  }

  createTenoxUI(inputConfig = {}) {
    return new TenoxUI(merge(this.config, inputConfig))
  }

  /** #?
   * Layers
   *
   * Methods for layering management for better output styles
   */

  addLayer(layerName) {
    if (!this.layers.has(layerName)) {
      this.layers.set(layerName, '')
      if (!this.layerOrder.includes(layerName)) {
        this.layerOrder.push(layerName)
      }
    }
    return this
  }

  removeLayer(layerName) {
    if (layerName !== 'base' && layerName !== 'theme') {
      this.layers.delete(layerName)
      this.layerOrder = this.layerOrder.filter(layer => layer !== layerName)
    }
    return this
  }

  setLayerOrder(order) {
    const existingLayers = Array.from(this.layers.keys())
    const missingLayers = existingLayers.filter(layer => !order.includes(layer))
    this.layerOrder = [...order, ...missingLayers]
    return this
  }

  /** #?
   * Main Styles Computation
   */

  addStyle(layer = 'base', config = {}) {
    if (!this.layers.has(layer)) {
      this.addLayer(layer)
    }

    const ui = this.createTenoxUI(config).generateStylesheet()
    const currentStyles = this.layers.get(layer)

    this.layers.set(layer, currentStyles + ui)

    return this
  }

  createStyles(finalUtilities = '') {
    // Ensure the layer order contains only existing layers
    const existingLayers = Array.from(this.layers.keys())
    const orderedLayers = this.layerOrder.filter(layer => existingLayers.includes(layer))

    // Generate @layer directive if layer mode is enabled
    let styles = this.layer ? `@layer ${orderedLayers.join(', ')};\n` : ''

    // Append styles from each layer in order
    orderedLayers.forEach(layer => {
      let layerStyles = this.layers.get(layer)

      // Append finalUtilities inside the 'utilities' layer
      if (layer === 'utilities' && finalUtilities.trim()) {
        layerStyles += `\n${finalUtilities}`
      }

      if (layerStyles.trim()) {
        styles += this.layer ? `@layer ${layer} {\n${this.addTabs(layerStyles)}\n}\n` : layerStyles
      }
    })

    return styles
  }

  /** #?
   * File Handler
   *
   * Handle how the we manage the files, and class names extraction.
   */

  resolveFiles(patterns) {
    return Array.from(
      new Set(
        patterns.flatMap(pattern =>
          glob.sync(pattern, { absolute: true }).map(file => path.resolve(file))
        )
      )
    )
  }

  extractClassesFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const classes = new Set()

    switch (path.extname(filePath)) {
      case '.html': {
        const $ = load(content)
        $('[class]').each((_, element) => {
          const classNames = $(element).attr('class').split(/\s+/)
          classNames.forEach(className => classes.add(className))
        })
        break
      }
      case '.jsx':
      case '.tsx':
      case '.vue': {
        // handle className and class attributes
        const classRegex = /class(?:Name)?=["'`]([^"'`]+)["'`]/g
        let match
        while ((match = classRegex.exec(content)) !== null) {
          match[1].split(/\s+/).forEach(className => classes.add(className))
        }
        // handle template literals
        const templateRegex = /class(?:Name)?={\s*`([^`]+)`\s*}/g
        while ((match = templateRegex.exec(content)) !== null) {
          match[1].split(/\s+/).forEach(className => classes.add(className))
        }
        const conditionalRegex = /class(?:Name)?={\s*(?:[^}]+?\?[^:]+?:[^}]+?|\{[^}]+\})\s*}/g
        while ((match = conditionalRegex.exec(content)) !== null) {
          const classString = match[0]
          const potentialClasses = classString.match(/['"`][^'"`]+['"`]/g) || []
          potentialClasses.forEach(cls => {
            cls
              .replace(/['"`]/g, '')
              .split(/\s+/)
              .forEach(className => classes.add(className))
          })
        }
        break
      }
    }

    return Array.from(classes)
  }

  /** #?
   * Config option section
   *
   * From this point onward, was methods for managing configuration.
   */

  applyPrefix(css, prefix) {
    return css.replace(/\.[\w-]+/g, match => `.${prefix}${match.slice(1)}`)
  }

  minifyCSS(css) {
    return css
      .replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, '') // Remove comments and whitespace
      .replace(/ {2,}/g, ' ') // Remove multiple spaces
      .replace(/ ([{:}]) /g, '$1') // Remove spaces around brackets and colons
      .replace(/([;,]) /g, '$1') // Remove spaces after semicolons and commas
      .trim()
  }

  generateSourceMap(css, inputFiles) {
    const outputFileName = path.basename(this.outputPath)
    const sources = inputFiles.map(file => path.relative(process.cwd(), file))

    // Generate placeholder mappings (basic structure)
    const mappings = Array(css.split('\n').length).fill(';')

    return {
      version: 3,
      file: outputFileName,
      sources,
      sourcesContent: sources.map(source => fs.readFileSync(source, 'utf-8')),
      mappings: mappings.join(''),
      names: []
    }
  }

  watchFiles() {
    const watcher = watch(this.inputPatterns, {
      ignored: /(^|[\/\\])\../,
      persistent: true
    })

    let debounceTimer

    watcher
      .on('change', file => {
        const relativePath = path.relative(process.cwd(), file)
        console.log(`\nFile changed: ${relativePath}`)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => this.buildCSS(), 500)
      })
      .on('error', error => console.error(`Watcher error: ${error}`))
  }

  async buildCSS() {
    try {
      const outputDir = path.dirname(this.outputPath)
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

      const files = this.resolveFiles(this.inputPatterns)
      const allClasses = new Set()

      console.log('\nProcessing files:')
      files.forEach(file => {
        console.log(`  → ${path.relative(process.cwd(), file)}`)
        this.extractClassesFromFile(file).forEach(className => allClasses.add(className))
      })

      this.tenoxui.processClassNames(allClasses)
      let css = this.createStyles(this.tenoxui.generateStylesheet())

      if (this.options.prefix) css = this.applyPrefix(css, this.options.prefix)
      if (this.options.minify) css = this.minifyCSS(css)

      // Generate and attach source map
      if (this.options.sourceMap) {
        const sourceMap = this.generateSourceMap(css, files)
        fs.writeFileSync(`${this.outputPath}.map`, JSON.stringify(sourceMap, null, 2))
        css += `\n/*# sourceMappingURL=${path.basename(this.outputPath)}.map */`
      }

      fs.writeFileSync(this.outputPath, css)
      console.log(`\n✨ Generated CSS file at ${this.outputPath}`)
    } catch (error) {
      console.error('Error building CSS:', error)
    }
  }

  async generate(options = {}) {
    const {
      input = ['src/**/*.{html,jsx,tsx,vue}'],
      output = 'dist/output.css',
      watch = false,
      minify = false,
      sourceMap = false,
      prefix = ''
    } = options

    this.watchMode = watch
    this.outputPath = output
    this.inputPatterns = Array.isArray(input) ? input : [input]
    this.options = {
      minify,
      sourceMap,
      prefix
    }

    console.log('🔍 Scanning input files...')
    await this.buildCSS()

    if (watch) {
      console.log('👀 Watching for changes...')
      this.watchFiles()
    }
  }
}

export default { CLIEngine }
