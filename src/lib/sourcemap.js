import fs from 'node:fs'
import path from 'node:path'

export class SourceMapGenerator {
  constructor() {
    this.mappings = []
    this.sources = []
    this.names = []
    this.lineOffset = 0
    this.columnOffset = 0
  }
  static toVLQSigned(value) {
    const vlq = value < 0 ? (-value << 1) + 1 : value << 1
    return vlq
  }

  static base64VLQ(value) {
    const VLQ_BASE_SHIFT = 5
    const VLQ_BASE = 1 << VLQ_BASE_SHIFT
    const VLQ_BASE_MASK = VLQ_BASE - 1
    const VLQ_CONTINUATION_BIT = VLQ_BASE
    const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

    let encoded = ''
    value = SourceMapGenerator.toVLQSigned(value)

    do {
      let digit = value & VLQ_BASE_MASK
      value >>>= VLQ_BASE_SHIFT
      if (value > 0) {
        digit |= VLQ_CONTINUATION_BIT
      }
      encoded += BASE64_CHARS[digit]
    } while (value > 0)

    return encoded
  }

  addMapping(generated, original, source, name) {
    const mapping = {
      generated,
      original,
      source: source ? this.addSource(source) : null,
      name: name ? this.addName(name) : null
    }
    this.mappings.push(mapping)
  }

  addSource(source) {
    const index = this.sources.indexOf(source)
    if (index !== -1) return index
    this.sources.push(source)
    return this.sources.length - 1
  }

  addName(name) {
    const index = this.names.indexOf(name)
    if (index !== -1) return index
    this.names.push(name)
    return this.names.length - 1
  }

  generateMappings() {
    let previousGeneratedLine = 1
    let previousGeneratedColumn = 0
    let previousOriginalLine = 0
    let previousOriginalColumn = 0
    let previousSource = 0
    let previousName = 0
    let mappingsStr = ''
    let firstInLine = true

    this.mappings.sort((a, b) => {
      if (a.generated.line !== b.generated.line) {
        return a.generated.line - b.generated.line
      }
      return a.generated.column - b.generated.column
    })

    for (const mapping of this.mappings) {
      if (mapping.generated.line !== previousGeneratedLine) {
        previousGeneratedColumn = 0
        while (previousGeneratedLine < mapping.generated.line) {
          mappingsStr += ';'
          previousGeneratedLine++
        }
        firstInLine = true
      } else if (!firstInLine) {
        mappingsStr += ','
      }

      mappingsStr += SourceMapGenerator.base64VLQ(
        mapping.generated.column - previousGeneratedColumn
      )
      previousGeneratedColumn = mapping.generated.column

      if (mapping.source !== null) {
        mappingsStr += SourceMapGenerator.base64VLQ(mapping.source - previousSource)
        previousSource = mapping.source

        mappingsStr += SourceMapGenerator.base64VLQ(
          mapping.original.line - 1 - previousOriginalLine
        )
        previousOriginalLine = mapping.original.line - 1

        mappingsStr += SourceMapGenerator.base64VLQ(
          mapping.original.column - previousOriginalColumn
        )
        previousOriginalColumn = mapping.original.column

        if (mapping.name !== null) {
          mappingsStr += SourceMapGenerator.base64VLQ(mapping.name - previousName)
          previousName = mapping.name
        }
      }

      firstInLine = false
    }

    return mappingsStr
  }

  generate(sourceContent) {
    const map = {
      version: 3,
      file: path.basename(sourceContent.file),
      sourceRoot: '',
      sources: this.sources.map(s => path.basename(s)),
      names: this.names,
      mappings: this.generateMappings(),
      sourcesContent: [sourceContent.content]
    }

    return JSON.stringify(map)
  }

  generateCSSMap(cssContent, originalPath) {
    const lines = cssContent.split('\n')
    lines.forEach((line, lineIndex) => {
      this.addMapping(
        { line: lineIndex + 1, column: 0 },
        { line: lineIndex + 1, column: 0 },
        originalPath
      )
    })

    return this.generate({
      file: originalPath,
      content: cssContent
    })
  }

  generateJSMap(jsContent, originalPath) {
    const lines = jsContent.split('\n')
    lines.forEach((line, lineIndex) => {
      this.addMapping(
        { line: lineIndex + 1, column: 0 },
        { line: lineIndex + 1, column: 0 },
        originalPath
      )
    })

    return this.generate({
      file: originalPath,
      content: jsContent
    })
  }
}


export function generateSourceMapForCSS(cssContent, originalPath, outputPath) {
  const generator = new SourceMapGenerator()
  const sourceMap = generator.generateCSSMap(cssContent, originalPath)
  fs.writeFileSync(outputPath, sourceMap)
  const sourceMapFileName = path.basename(outputPath)
  const cssWithSourceMap = `${cssContent}\n/*# sourceMappingURL=${sourceMapFileName} */`

  return cssWithSourceMap
}

export function generateSourceMapForJS(jsContent, originalPath, outputPath) {
  const generator = new SourceMapGenerator()
  const sourceMap = generator.generateJSMap(jsContent, originalPath)
  fs.writeFileSync(outputPath, sourceMap)
  const sourceMapFileName = path.basename(outputPath)
  const jsWithSourceMap = `${jsContent}\n//# sourceMappingURL=${sourceMapFileName}`
  return jsWithSourceMap
}

export default {
  SourceMapGenerator,
  generateSourceMapForCSS,
  generateSourceMapForJS
}
