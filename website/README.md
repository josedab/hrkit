# @hrkit documentation website

The documentation site is built with [Docusaurus](https://docusaurus.io/) and managed from the repository root with pnpm.

## Local development

```bash
pnpm install
pnpm docs:dev
```

`docs:dev` regenerates the TypeDoc API reference and package landing-page metadata before starting Docusaurus.

## Validation and production build

```bash
pnpm docs:packages:check
pnpm docs:build
```

Run `pnpm docs:packages` after changing package names, descriptions, or versions. The generator updates package metadata while preserving the curated feature lists and examples in `website/docs/packages/`.

## Deployment

```bash
pnpm --filter website deploy
```

Set the Docusaurus deployment environment variables required by the target hosting provider before running the command.
