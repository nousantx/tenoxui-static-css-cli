# Static CSS Generator CLI

A lightweight and fast TenoxUI Static CSS Generator.

This package contains two mode to execute the script. You can either use this package as ready-to-use CLI tool, or you can create your runner with customizable rules.

## Installation

```bash
npm i tenoxui-static-css-cli --save-dev
```

_Or use `-g` flag to install it globally as CLI tool_

## Usage

### CLI

```bash
tui-css-run -h
```

### Import

```javascript
import { CLIEngine } from 'tenoxui-static-css-cli'

const cli = new CLIEngine({
  input: ['index.html', 'src/**/*.{jsx,tsx}'],
  output: 'dist/index.css',
  tenoxui: {
    /* TenoxUI main configuration here */
  },
  tabSize: 2,
  watch: false,
  minify: false,
  prefix: '',
  layer: false,
  // additional tenoxui config for different layers
  base: {},
  theme: {},
  components: {},
  utilities: {}
})

cli.run()
```

Run the script :

```bash
node script.js
```

## License

MIT © 2025
