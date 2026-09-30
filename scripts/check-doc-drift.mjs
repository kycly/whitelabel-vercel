import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const facetRules = [
  {
    key: "auth-ux",
    label: "Authentification et ecrans de connexion",
    changePatterns: [
      /^app\/auth\/.+\.ts$/,
      /^app\/(login|access-denied|auth-loading)\/page\.tsx$/,
      /^src\/auth\/.+\.ts$/,
      /^src\/components\/screens\/(login|access-denied|auth-loading)-screen\.tsx$/,
    ],
    primaryDocPatterns: [/^docs\/reference\/AUTH-UX\.md$/],
    primaryDocs: ["docs/reference/AUTH-UX.md"],
    secondaryDocs: ["docs/runbooks/env-vars-lifecycle.md", "README.md"],
  },
  {
    key: "session-context",
    label: "Contexte de session et metadata KYC",
    changePatterns: [
      /^src\/lib\/verification\.ts$/,
      /^src\/components\/verify\/verification-workspace\.tsx$/,
      /^app\/verify\/page\.tsx$/,
      /^src\/components\/screens\/session-context-screen\.tsx$/,
    ],
    primaryDocPatterns: [/^docs\/reference\/SESSION-CONTEXT-UX\.md$/],
    primaryDocs: ["docs/reference/SESSION-CONTEXT-UX.md"],
    secondaryDocs: ["docs/PARCOURS-J1.md", "docs/reference/KYCLINK-SDK-INTEGRATION.md"],
  },
  {
    key: "kyclink-flow",
    label: "Proxy KYCLink, sessions et resultats",
    changePatterns: [
      /^src\/server\/kyclink\.ts$/,
      /^app\/api\/kyc\/.+\.ts$/,
      /^app\/(complete|sessions)\/page\.tsx$/,
      /^src\/components\/verify\/verification-(complete|sessions)\.tsx$/,
    ],
    primaryDocPatterns: [
      /^docs\/reference\/KYCLINK-SDK-INTEGRATION\.md$/,
      /^docs\/reference\/KYC-SESSIONS-LIST-CONTRACT\.md$/,
    ],
    primaryDocs: [
      "docs/reference/KYCLINK-SDK-INTEGRATION.md",
      "docs/reference/KYC-SESSIONS-LIST-CONTRACT.md",
    ],
    secondaryDocs: ["docs/PARCOURS-J1.md", "docs/DECISIONS-J1.md"],
  },
  {
    key: "ui-canon",
    label: "Canon UI, ecrans et composants de presentation",
    changePatterns: [
      /^app\/globals\.css$/,
      /^src\/components\/(layout|ui|screens|verify)\/.+\.(ts|tsx)$/,
      /^app\/(welcome|failure|access-denied|login|auth-loading|verify|complete|sessions)\/page\.tsx$/,
    ],
    primaryDocPatterns: [/^docs\/reference\/UI-ESTHETIC-CANON\.md$/],
    primaryDocs: ["docs/reference/UI-ESTHETIC-CANON.md"],
    secondaryDocs: ["docs/PARCOURS-J1.md", "README.md"],
  },
  {
    key: "pwa-mobile-first",
    label: "Shell PWA mobile-first et ergonomie du tunnel critique",
    changePatterns: [
      /^app\/layout\.tsx$/,
      /^app\/(manifest\.ts|manifest\.json)$/,
      /^src\/components\/layout\/(page-shell|protected-screen-shell)\.tsx$/,
      /^src\/components\/ui\/fixed-action-layout\.ts$/,
      /^src\/components\/verify\/verification-(run-screen|prepare-screen|workspace|complete|sessions)\.tsx$/,
      /^src\/components\/screens\/(welcome|login|failure)-screen\.tsx$/,
    ],
    primaryDocPatterns: [/^docs\/reference\/PWA-MOBILE-FIRST-CONTRACT\.md$/],
    primaryDocs: ["docs/reference/PWA-MOBILE-FIRST-CONTRACT.md"],
    secondaryDocs: ["docs/reference/UI-ESTHETIC-CANON.md", "docs/reference/KYCLINK-SDK-INTEGRATION.md"],
  },
  {
    key: "ci-governance",
    label: "CI, hooks Git et gouvernance du repo",
    changePatterns: [
      /^\.github\/.+/,
      /^\.githooks\/.+/,
      /^scripts\/(check-doc-drift|check-sandbox-only|install-githooks)\.mjs$/,
      // `package.json` et `pnpm-lock.yaml` retirés le 2026-09-30 (comme dans partner-node) :
      // tant que ce garde était inerte en CI, les coupler ne coûtait rien ; actif, il
      // aurait exigé le runbook CI pour chaque montée de dépendance.
      /^\.lintstagedrc\.json$/,
    ],
    primaryDocPatterns: [
      /^docs\/runbooks\/cicd-workflow\.md$/,
      /^docs\/runbooks\/repository-governance-setup\.md$/,
    ],
    primaryDocs: [
      "docs/runbooks/cicd-workflow.md",
      "docs/runbooks/repository-governance-setup.md",
    ],
    secondaryDocs: ["docs/runbooks/remote-setup-clickpath.md", "README.md"],
  },
];

function runGit(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Fichiers changés entre deux références. STRICT : une référence absente (checkout
 * superficiel, SHA inconnu) lève au lieu de rendre une liste vide — une liste vide se
 * lirait « rien à vérifier » et le garde passerait sans avoir rien mesuré.
 */
export function getChangedFilesBetweenRefs(baseRef, headRef) {
  const out = execFileSync("git", ["diff", "--name-only", baseRef, headRef, "--", "."], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return [...new Set(out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
}

function getChangedFiles() {
  return [...new Set([
    ...runGit(["diff", "--name-only", "--cached", "--", "."]),
    ...runGit(["diff", "--name-only", "--", "."]),
    ...runGit(["ls-files", "--others", "--exclude-standard"]),
  ])];
}

function matchesAny(filePath, patterns) {
  return patterns.some((pattern) => pattern.test(filePath));
}

function formatMissingFacetMessage(missingFacets) {
  return [
    "Doc-drift check failed: missing primary docs for active facets.",
    ...missingFacets.flatMap((facet) => [
      `- ${facet.label}`,
      `  Triggered by: ${facet.matchedChanges.join(", ")}`,
      `  Required primary docs: ${facet.requiredPrimaryDocs.join(" | ")}`,
      `  Useful secondary docs: ${facet.secondaryDocs.join(" | ")}`,
    ]),
    "Update the canonical docs before pushing.",
  ].join("\n");
}

export function evaluateDocDriftForFiles(changedFiles) {
  const touchedDocs = changedFiles.filter((file) => file.endsWith(".md"));
  const activeFacets = facetRules
    .map((rule) => ({
      ...rule,
      matchedChanges: changedFiles.filter((file) => matchesAny(file, rule.changePatterns)),
    }))
    .filter((rule) => rule.matchedChanges.length > 0);

  if (!activeFacets.length) {
    return {
      ok: true,
      kind: "skip",
      message: "Doc-drift check skipped: no doc-coupled file changed.",
    };
  }

  const missingFacets = activeFacets.filter(
    (rule) => !touchedDocs.some((file) => matchesAny(file, rule.primaryDocPatterns)),
  );

  if (!missingFacets.length) {
    return {
      ok: true,
      kind: "pass",
      activeFacets: activeFacets.map((rule) => rule.key),
      message: `Doc-drift check passed: primary docs updated for active facets: ${activeFacets.map((rule) => rule.label).join(", ")}.`,
    };
  }

  const missingDetails = missingFacets.map((rule) => ({
    key: rule.key,
    label: rule.label,
    matchedChanges: rule.matchedChanges,
    requiredPrimaryDocs: rule.primaryDocs,
    secondaryDocs: rule.secondaryDocs,
  }));

  return {
    ok: false,
    kind: "fail",
    activeFacets: activeFacets.map((rule) => rule.key),
    missingFacets: missingDetails,
    message: formatMissingFacetMessage(missingDetails),
  };
}

export function evaluateDocDrift({ baseRef = null, headRef = null } = {}) {
  if (baseRef || headRef) {
    if (!baseRef || !headRef) {
      throw new Error("--base-ref et --head-ref vont ensemble.");
    }
    return evaluateDocDriftForFiles(getChangedFilesBetweenRefs(baseRef, headRef));
  }
  return evaluateDocDriftForFiles(getChangedFiles());
}

function parseCliArgs(argv) {
  const parsed = { jsonMode: false, baseRef: null, headRef: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--json") parsed.jsonMode = true;
    else if (argv[i] === "--base-ref") { parsed.baseRef = argv[i + 1] ?? null; i += 1; }
    else if (argv[i] === "--head-ref") { parsed.headRef = argv[i + 1] ?? null; i += 1; }
  }
  return parsed;
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  const args = parseCliArgs(process.argv.slice(2));
  let result;
  try {
    result = evaluateDocDrift(args);
  } catch (error) {
    // Échec FERMÉ : une comparaison impossible n'est pas une comparaison vide.
    process.stderr.write(
      `Doc-drift check failed: comparaison impossible (${error instanceof Error ? error.message.split("\n")[0] : String(error)}).\n`,
    );
    process.exit(1);
  }
  const jsonMode = args.jsonMode;

  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (result.ok) {
    process.stdout.write(`${result.message}\n`);
  } else {
    process.stderr.write(`${result.message}\n`);
  }

  process.exit(result.ok ? 0 : 1);
}