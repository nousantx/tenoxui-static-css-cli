# Static CSS Generator CLI

## Installation

```
npm i tenoxui-static-css-cli
```

## Usage

### CLI

```bash
tui-css-run -h # to show available command
```

### Import

```javascript
import TenoxUICLI from './src/cli.js'

const app = new TenoxUICLI({
  // pass your tenoxui config here
})

app.generate({
  input: ['index.html', 'src/**/*.{jsx,tsx}'],
  output: 'dist/index.css',
  watch: true,
  minify: true,
  sourceMap: false
})
```

## License

MIT
