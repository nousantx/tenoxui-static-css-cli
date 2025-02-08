import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import fs from 'node:fs'
import path from 'node:path'

const name = '__the_app__'
const fileName = 'index'
const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'))
const banner = `/*!
 * ${packageJson.name} v${packageJson.version} | ${packageJson.license} License
 * Copyright (c) 2024-present NOuSantx
 */`

const config = {
  input: 'src/index.js',
  output: [
    {
      file: `dist/${fileName}.js`,
      format: 'esm',
      banner
    },
    {
      file: `dist/${fileName}.min.js`,
      format: 'esm',
      banner,
      plugins: [
        terser({
          format: {
            comments: false,
            preamble: banner
          },
          mangle: true,
          compress: {
            defaults: true,
            passes: 2
          }
        })
      ]
    }
  ],
  external: ['node:path', 'node:fs', 'glob', 'chokidar', 'cheerio'],
  plugins: [resolve()]
}

export default config
