# ZCAM1 SDK Documentation

This directory contains the documentation site for the ZCAM1 SDK, built with [Vocs](https://vocs.dev/).

## Structure

- `docs/pages/` - Documentation pages in MDX format
  - `sdk/` - SDK API reference with action-based pages
  - `overview/` - High-level concepts and architecture
  - `features/` - Key features and capabilities
  - `getting-started/` - Installation and quickstart guides
  - `usecases/` - Example use cases
  - `technical-docs/` - Technical details and FAQ

## Development

### Start the dev server

```bash
npm run dev
```

This will start the Vocs development server at http://localhost:5173

### Build for production

```bash
npm run build
```

Output will be in `docs/dist/`

### Preview production build

```bash
npm run preview
```

## Updating SDK Documentation

The SDK documentation is maintained manually in `docs/pages/sdk/`. When updating:

1. Edit the relevant `.mdx` files directly
2. Follow the existing structure and format
3. Keep examples practical and concise
4. Test locally with `npm run dev`

### From the repository root:

```bash
npm run docs:dev     # Start dev server
npm run docs:build   # Build production
```

## Documentation Packages

The following React Native packages are documented:

1. **Capture** (`react-native-zcam1-capture`) - Camera capture with C2PA signing
2. **Prove** (`react-native-zcam1-prove`) - Zero-knowledge proof generation
3. **Verify** (`react-native-zcam1-verify`) - C2PA and ZK proof verification
4. **Picker** (`react-native-zcam1-picker`) - Image picker with authenticity badges

## Technology Stack

- **Vocs** - Documentation framework (React + Vite)
- **MDX** - Markdown with JSX support

## Documentation Style

The SDK documentation follows a clean, action-based structure inspired by [Viem](https://viem.sh):

- One page per function/component/hook
- Concise descriptions without import sections
- Practical usage examples
- Clear parameter and return type documentation
