import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TenoxUI } from '@tenoxui/static'
import { merge } from '@nousantx/someutils'
import { watch } from 'chokidar'
import { load } from 'cheerio'
import { glob } from 'glob'

export class CLIEngine {
  constructor({
    tenoxui = {},
    input = ['src/**/*.{html,jsx,tsx,vue}'],
    output = 'dist/output.css',
    tabSize = 2,
    layer = false,
    watch = false,
    minify = false,
    prefix = '',
    base = {},
    theme = {},
    components = {},
    utilities = {}
  }) {
    const { apply, reserveClass, ...filteredConfig } = tenoxui
    this.config = filteredConfig
    this.tenoxui = new TenoxUI(tenoxui)
    this.watchMode = false
    this.outputPath = ''
    this.inputPatterns = []
    this.layer = layer
    this.tabSize = tabSize
    this.input = input
    this.output = output
    this.watch = watch
    this.minify = minify
    this.prefix = prefix
    this.baseConfig = base
    this.themeConfig = theme
    this.componentsConfig = components
    this.utilitiesConfig = utilities
    this.layers = new Map([
      ['base', ''],
      ['theme', ''],
      ['components', ''],
      ['utilities', '']
    ])
    this.layerOrder = ['base', 'theme', 'components', 'utilities']
  }

  /** #?
   * Utilities
   *
   * Basic utilities for make the development easier and more efficient
   */

  addTabs(str, size = 2, fixedTabs = false) {
    return str
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => `${' '.repeat(fixedTabs ? sise : this.tabSize)}${line}`)
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
      this.layerOrder = this.layerOrder.filter((layer) => layer !== layerName)
    }
    return this
  }

  setLayerOrder(order) {
    const existingLayers = Array.from(this.layers.keys())
    const missingLayers = existingLayers.filter((layer) => !order.includes(layer))
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
    const existingLayers = Array.from(this.layers.keys())
    const orderedLayers = this.layerOrder.filter((layer) => existingLayers.includes(layer))

    let styles = this.layer ? `@layer ${orderedLayers.join(', ')};\n` : ''

    orderedLayers.forEach((layer) => {
      if (Object.entries(this[`${layer}Config`]).length > 0)
        this.addStyle(layer, this[`${layer}Config`])

      let layerStyles = this.layers.get(layer)

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
        patterns.flatMap((pattern) =>
          glob.sync(pattern, { absolute: true }).map((file) => path.resolve(file))
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
          classNames.forEach((className) => classes.add(className))
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
          match[1].split(/\s+/).forEach((className) => classes.add(className))
        }
        // handle template literals
        const templateRegex = /class(?:Name)?={\s*`([^`]+)`\s*}/g
        while ((match = templateRegex.exec(content)) !== null) {
          match[1].split(/\s+/).forEach((className) => classes.add(className))
        }
        const conditionalRegex = /class(?:Name)?={\s*(?:[^}]+?\?[^:]+?:[^}]+?|\{[^}]+\})\s*}/g
        while ((match = conditionalRegex.exec(content)) !== null) {
          const classString = match[0]
          const potentialClasses = classString.match(/['"`][^'"`]+['"`]/g) || []
          potentialClasses.forEach((cls) => {
            cls
              .replace(/['"`]/g, '')
              .split(/\s+/)
              .forEach((className) => classes.add(className))
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
    return css.replace(/\.[\w-]+/g, (match) => `.${prefix}${match.slice(1)}`)
  }

  minifyCSS(css) {
    return css
      .replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, '') // Remove comments and whitespace
      .replace(/ {2,}/g, ' ') // Remove multiple spaces
      .replace(/ ([{:}]) /g, '$1') // Remove spaces around brackets and colons
      .replace(/([;,]) /g, '$1') // Remove spaces after semicolons and commas
      .trim()
  }

  watchFiles() {
    const watcher = watch(this.inputPatterns, {
      ignored: /(^|[\/\\])\../,
      persistent: true
    })

    let debounceTimer

    watcher
      .on('change', (file) => {
        const relativePath = path.relative(process.cwd(), file)
        console.log(`\nFile changed: ${relativePath}`)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => this.buildCSS(), 500)
      })
      .on('error', (error) => console.error(`Watcher error: ${error}`))
  }

  async buildCSS() {
    try {
      const outputDir = path.dirname(this.outputPath)
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

      const files = this.resolveFiles(this.inputPatterns)
      const allClasses = new Set()

      console.log('\nProcessing files:')
      files.forEach((file) => {
        console.log(`  → ${path.relative(process.cwd(), file)}`)
        this.extractClassesFromFile(file).forEach((className) => allClasses.add(className))
      })

      this.tenoxui.processClassNames(allClasses)
      let css = this.createStyles(this.tenoxui.generateStylesheet())

      if (this.prefix) css = this.applyPrefix(css, this.prefix)
      if (this.minify) css = this.minifyCSS(css)

      fs.writeFileSync(this.outputPath, css)
      console.log(`\n✨ Generated CSS file at ${this.outputPath}`)
    } catch (error) {
      console.error('Error building CSS:', error)
    }
  }

  async generate() {
    this.watchMode = this.watch
    this.outputPath = this.output
    this.inputPatterns = Array.isArray(this.input) ? this.input : [this.input]

    console.log('🔍 Scanning input files...')
    await this.buildCSS()

    if (this.watch) {
      console.log('👀 Watching for changes...')
      this.watchFiles()
    }
  }
}

export default { CLIEngine }
