import TenoxUICLI from './cli.js'
import config from './tenoxui.config.js'
const cli = new TenoxUICLI(config)
const isBuild = false

cli.generate({
  input: ['index.html', 'src/**/*.{jsx,tsx}'],
  output: 'dist/index.css',
  watch: true,
  minify: isBuild,
  sourceMap: isBuild
})
