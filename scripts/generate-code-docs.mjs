#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, 'package.json');

if (!fs.existsSync(packageJsonPath)) {
  console.error('package.json introuvable dans le repertoire courant');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const repoName = pkg.name || path.basename(repoRoot);

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.turbo',
  'artifacts',
  '.pnpm-store',
]);

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const scanRoots = getScanRoots(repoRoot);

const codeFiles = [];
for (const relRoot of scanRoots) {
  const absRoot = path.join(repoRoot, relRoot);
  walk(absRoot, relRoot, codeFiles);
}

const routes = [];
const hooks = [];
const components = [];
const tests = [];
const exportsList = [];
const envVars = new Set();

for (const file of codeFiles) {
  const rel = normalizePath(path.relative(repoRoot, file));
  const content = safeRead(file);

  collectNextRoutes(rel, routes);
  collectHooks(rel, hooks);
  collectComponents(rel, components);
  collectTests(rel, tests);
  collectExports(rel, content, exportsList);
  collectEnvVars(content, envVars);
}

routes.sort(sortByRoute);
hooks.sort();
components.sort();
tests.sort();
exportsList.sort((a, b) => {
  if (a.file === b.file) return a.symbol.localeCompare(b.symbol);
  return a.file.localeCompare(b.file);
});

const markdown = buildMarkdown({
  repoName,
  scanRoots,
  codeFiles,
  routes,
  hooks,
  components,
  tests,
  exportsList,
  envVars: [...envVars].sort(),
  scripts: pkg.scripts || {},
});

const outputPath = path.join(repoRoot, 'docs', 'reference', 'CODEBASE-AUTOGEN.md');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, markdown, 'utf8');

console.log(`Documentation generee: ${normalizePath(path.relative(repoRoot, outputPath))}`);

function getScanRoots(root) {
  // whitelabel-vercel : App Router a la racine (`app/`) + code applicatif dans `src/`.
  const preferred = ['app', 'src', 'scripts'];
  return preferred.filter((rel) => fs.existsSync(path.join(root, rel)));
}

function walk(absDir, relDir, files) {
  if (!fs.existsSync(absDir)) return;

  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const absPath = path.join(absDir, entry.name);
    const relPath = normalizePath(path.join(relDir, entry.name));

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(absPath, relPath, files);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name);
    if (CODE_EXTENSIONS.has(ext)) {
      files.push(absPath);
    }
  }
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function collectNextRoutes(relPath, target) {
  // Supporte l'App Router a la racine (`app/`) et sous `src/app/`.
  let withoutPrefix = null;
  if (relPath.startsWith('app/')) {
    withoutPrefix = relPath.replace(/^app\//, '');
  } else if (relPath.startsWith('src/app/')) {
    withoutPrefix = relPath.replace(/^src\/app\//, '');
  } else {
    return;
  }

  const fileName = path.basename(relPath);
  const isRouteFile = /^route\.(ts|tsx|js|jsx)$/.test(fileName);
  const isPageFile = /^page\.(ts|tsx|js|jsx)$/.test(fileName);
  if (!isRouteFile && !isPageFile) return;

  const routePath = normalizeNextAppPath(withoutPrefix);

  target.push({
    source: relPath,
    kind: 'next-app',
    method: isRouteFile ? 'HTTP' : 'PAGE',
    path: routePath,
  });
}

function normalizeNextAppPath(withoutPrefix) {
  const segments = withoutPrefix.split('/');
  segments.pop();

  const routeSegments = [];
  for (const seg of segments) {
    if (!seg) continue;
    if (seg.startsWith('(') && seg.endsWith(')')) continue;

    if (seg.startsWith('[[...') && seg.endsWith(']]')) {
      routeSegments.push(`:${seg.slice(5, -2)}?`);
      continue;
    }

    if (seg.startsWith('[...') && seg.endsWith(']')) {
      routeSegments.push(`:${seg.slice(4, -1)}*`);
      continue;
    }

    if (seg.startsWith('[') && seg.endsWith(']')) {
      routeSegments.push(`:${seg.slice(1, -1)}`);
      continue;
    }

    routeSegments.push(seg);
  }

  if (routeSegments.length === 0) return '/';
  return `/${routeSegments.join('/')}`;
}

function collectHooks(relPath, target) {
  const fileName = path.basename(relPath);
  const isHookFileName = /^use[A-Za-z0-9_-]*\.(ts|tsx|js|jsx)$/.test(fileName);
  const isInHooksDir = relPath.includes('/hooks/');
  if (!isHookFileName && !isInHooksDir) return;
  if (fileName.includes('.test.') || fileName.includes('.spec.') || relPath.includes('/__tests__/')) return;
  target.push(relPath);
}

function collectComponents(relPath, target) {
  if (!relPath.includes('/components/')) return;
  if (!/\.(tsx|jsx|ts|js)$/.test(relPath)) return;
  if (relPath.includes('/__tests__/') || /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(relPath)) return;
  target.push(relPath);
}

function collectTests(relPath, target) {
  if (relPath.includes('/__tests__/') || /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(relPath)) {
    target.push(relPath);
  }
}

function collectExports(relPath, content, target) {
  if (!content) return;

  const patterns = [
    { kind: 'function', regex: /^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm },
    { kind: 'class', regex: /^\s*export\s+class\s+([A-Za-z0-9_]+)/gm },
    { kind: 'const', regex: /^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_]+)/gm },
    { kind: 'type', regex: /^\s*export\s+type\s+([A-Za-z0-9_]+)/gm },
    { kind: 'interface', regex: /^\s*export\s+interface\s+([A-Za-z0-9_]+)/gm },
    { kind: 'enum', regex: /^\s*export\s+enum\s+([A-Za-z0-9_]+)/gm },
  ];

  for (const { kind, regex } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      target.push({ file: relPath, kind, symbol: match[1] });
    }
  }

  if (/^\s*export\s+default\s+/m.test(content)) {
    target.push({ file: relPath, kind: 'default', symbol: 'default' });
  }
}

function collectEnvVars(content, set) {
  if (!content) return;

  const processEnvPattern = /process\.env\.([A-Z0-9_]+)/g;
  const processEnvBracketPattern = /process\.env\[['"]([A-Z0-9_]+)['"]\]/g;

  let match;
  while ((match = processEnvPattern.exec(content)) !== null) {
    set.add(match[1]);
  }
  while ((match = processEnvBracketPattern.exec(content)) !== null) {
    set.add(match[1]);
  }
}

function sortByRoute(a, b) {
  if (a.path === b.path) {
    if (a.method === b.method) return a.source.localeCompare(b.source);
    return a.method.localeCompare(b.method);
  }
  return a.path.localeCompare(b.path);
}

function buildMarkdown(data) {
  const lines = [];

  lines.push('# Codebase Auto-Generated Reference');
  lines.push('');
  lines.push('> Source unique: analyse statique du code.');
  lines.push('> Ce fichier est auto-genere. Ne pas modifier manuellement.');
  lines.push('');
  lines.push(`- Repo: ${data.repoName}`);
  lines.push('- Generation: deterministic (no timestamp)');
  lines.push(`- Racines scannees: ${data.scanRoots.join(', ') || '(aucune)'}`);
  lines.push('');

  lines.push('## Resume');
  lines.push('');
  lines.push('| Metrique | Valeur |');
  lines.push('|---|---:|');
  lines.push(`| Fichiers code scannes | ${data.codeFiles.length} |`);
  lines.push(`| Routes detectees | ${data.routes.length} |`);
  lines.push(`| Hooks detectes | ${data.hooks.length} |`);
  lines.push(`| Composants detectes | ${data.components.length} |`);
  lines.push(`| Exports detectes | ${data.exportsList.length} |`);
  lines.push(`| Fichiers de tests detectes | ${data.tests.length} |`);
  lines.push(`| Variables d'environnement detectees | ${data.envVars.length} |`);
  lines.push('');

  lines.push('## Scripts npm/pnpm (package.json)');
  lines.push('');
  if (Object.keys(data.scripts).length === 0) {
    lines.push('_Aucun script detecte._');
  } else {
    lines.push('| Script | Commande |');
    lines.push('|---|---|');
    for (const [name, cmd] of Object.entries(data.scripts)) {
      lines.push(`| ${escapeCell(name)} | ${escapeCell(String(cmd))} |`);
    }
  }
  lines.push('');

  lines.push("## Variables d'environnement (detectees dans le code)");
  lines.push('');
  if (data.envVars.length === 0) {
    lines.push('_Aucune variable detectee._');
  } else {
    for (const envVar of data.envVars) {
      lines.push(`- ${envVar}`);
    }
  }
  lines.push('');

  lines.push('## Inventaire des routes');
  lines.push('');
  if (data.routes.length === 0) {
    lines.push('_Aucune route detectee._');
  } else {
    lines.push('| Type | Methode | Path | Source |');
    lines.push('|---|---|---|---|');
    for (const route of data.routes) {
      lines.push(`| ${route.kind} | ${route.method} | ${escapeCell(route.path)} | ${escapeCell(route.source)} |`);
    }
  }
  lines.push('');

  lines.push('## Hooks');
  lines.push('');
  if (data.hooks.length === 0) {
    lines.push('_Aucun hook detecte._');
  } else {
    for (const hook of data.hooks) {
      lines.push(`- ${hook}`);
    }
  }
  lines.push('');

  lines.push('## Composants');
  lines.push('');
  if (data.components.length === 0) {
    lines.push('_Aucun composant detecte._');
  } else {
    for (const component of data.components) {
      lines.push(`- ${component}`);
    }
  }
  lines.push('');

  lines.push('## Exports publics');
  lines.push('');
  if (data.exportsList.length === 0) {
    lines.push('_Aucun export detecte._');
  } else {
    lines.push('| Kind | Symbol | Source |');
    lines.push('|---|---|---|');
    for (const item of data.exportsList) {
      lines.push(`| ${item.kind} | ${escapeCell(item.symbol)} | ${escapeCell(item.file)} |`);
    }
  }
  lines.push('');

  lines.push('## Fichiers de tests');
  lines.push('');
  if (data.tests.length === 0) {
    lines.push('_Aucun test detecte._');
  } else {
    for (const file of data.tests) {
      lines.push(`- ${file}`);
    }
  }
  lines.push('');

  lines.push('## Regeneration');
  lines.push('');
  lines.push('```bash');
  lines.push('pnpm docs:codegen');
  lines.push('```');
  lines.push('');
  lines.push('> Documentation Sync: code-derived (baseline code-only: docs/reference/CODEBASE-AUTOGEN.md)');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function escapeCell(value) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}
