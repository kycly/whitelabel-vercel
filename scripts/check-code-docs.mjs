#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const generatorPath = 'scripts/generate-code-docs.mjs';
const generatedDocPath = 'docs/reference/CODEBASE-AUTOGEN.md';

if (!fs.existsSync(generatorPath)) {
  console.error(`Missing generator script: ${generatorPath}`);
  process.exit(1);
}

run('node', [generatorPath]);

if (!fs.existsSync(generatedDocPath)) {
  console.error(`Missing generated doc file: ${generatedDocPath}`);
  process.exit(1);
}

const diffResult = spawnSync('git', ['diff', '--exit-code', '--', generatedDocPath], {
  stdio: 'inherit',
});

if (diffResult.status !== 0) {
  console.error('Code-generated documentation is out of date.');
  console.error(`Run: pnpm docs:codegen && git add ${generatedDocPath}`);
  process.exit(1);
}

console.log(`Documentation is up to date: ${generatedDocPath}`);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
