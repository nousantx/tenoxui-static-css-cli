import { CLIEngine } from './src/index.js'
import tenoxui from './tenoxui.config.js'
const cli2 = new CLIEngine({
  tenoxui,
  layer: true,
  tabs: 4
})
  // .addLayer('custom')
  // .setLayerOrder(['custom', 'theme', 'utilities', 'base', 'components'])
  .addStyle('base', {
    apply: {
      '*': 'bg-red',
      'section, main': 'p-2rem'
    }
  })
  .addStyle('utilities', {
    reserveClass: ['bg-red', 'text-blue', 'p-1rem']
  })
  .addStyle('theme', {
    apply: {
      ':root': '[--black]-black [--white]-white',
      '@media (prefers-color-scheme: dark)': {
        ':root': '[--black]-white [--white]-black'
      }
    }
  })

const cli = new CLIEngine({
  input: ['index.html', 'src/**/*.{jsx,tsx}'],
  output: 'dist/styles.css',
  tenoxui,
  layer: true,
  tabSize: 4,
  watch: false,
  base: {
    apply: {
      '*': '[m,p]-0 [box-sizing]-border-box'
    }
  }
})

cli.generate()
