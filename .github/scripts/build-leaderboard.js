#!/usr/bin/env node

/**
 * Scan all agent branches, read experiment result files, and generate
 * LEADERBOARD.md for each project.
 *
 * Supports five domain-specific file formats:
 *   - astrophysics / gpt2-tinystories: best.json (or run-*.json fallback)
 *   - financial-analysis: finance-r*.json (pick highest sharpeRatio)
 *   - skills-and-tools: seed-r*-*.json (pick highest score)
 *   - search-engine: <hash>.json (pick highest ndcg10)
 *   - p2p-network: best.json (or round-*.json fallback)
 *   - academic-papers: best.json (or run-*.json fallback)
 *
 * Runs as a GitHub Actions step — no external dependencies.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Per-project metric configuration
// ---------------------------------------------------------------------------
const PROJECT_METRICS = {
  'astrophysics':       { field: 'valLoss',      label: 'Val Loss',   dir: 'asc',  fmt: v => v.toFixed(4), extract: d => d.result?.valLoss ?? d.valLoss ?? Infinity },
  'gpt2-tinystories':   { field: 'valLoss',      label: 'Val Loss',   dir: 'asc',  fmt: v => v.toFixed(4), extract: d => d.result?.valLoss ?? d.valLoss ?? Infinity },
  'financial-analysis': { field: 'sharpeRatio',   label: 'Sharpe',     dir: 'desc', fmt: v => v.toFixed(3), extract: d => d.sharpeRatio ?? d.result?.sharpeRatio ?? 0 },
  'p2p-network':        { field: 'bestResult',    label: 'Score',      dir: 'desc', fmt: v => v.toFixed(4), extract: d => d.bestResult ?? d.result?.bestResult ?? d.result?.score ?? 0 },
  'search-engine':      { field: 'ndcg10',        label: 'NDCG@10',    dir: 'desc', fmt: v => v.toFixed(4), extract: d => d.ndcg10 ?? d.ndcgAt10 ?? d.result?.ndcg10 ?? d.result?.ndcgAt10 ?? 0 },
  'skills-and-tools':   { field: 'score',         label: 'Score',      dir: 'desc', fmt: v => v.toFixed(4), extract: d => d.score ?? d.result?.score ?? d.overallScore ?? d.result?.overallScore ?? 0 },
  'academic-papers':    { field: 'extractionF1',  label: 'F1',         dir: 'desc', fmt: v => v.toFixed(4), extract: d => d.extractionF1 ?? d.result?.extractionF1 ?? d.score ?? d.result?.score ?? 0 },
};

// Default metric for unknown projects
const DEFAULT_METRIC = { field: 'valLoss', label: 'Val Loss', dir: 'asc', fmt: v => v.toFixed(4), extract: d => d.result?.valLoss ?? d.valLoss ?? Infinity };

// ---------------------------------------------------------------------------
// Discover projects from the projects/ directory
// ---------------------------------------------------------------------------
const projectsDir = path.join(__dirname, '..', '..', 'projects');
const projects = fs.readdirSync(projectsDir)
  .filter(d => !d.startsWith('_') && fs.statSync(path.join(projectsDir, d)).isDirectory());

console.log(`Found projects: ${projects.join(', ')}`);

// ---------------------------------------------------------------------------
// Get all remote branches matching agents/*
// ---------------------------------------------------------------------------
const branchOutput = execSync('git branch -r --list "origin/agents/*"', { encoding: 'utf-8' });
const branches = branchOutput.trim().split('\n')
  .map(b => b.trim())
  .filter(b => b.length > 0);

console.log(`Found ${branches.length} agent branches`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * List all .json files in a directory on a given branch via git ls-tree.
 * Returns an array of basenames (e.g. ['finance-r1.json', 'finance-r2.json']).
 */
function listJsonFiles(branch, dirPath) {
  try {
    const output = execSync(
      `git ls-tree --name-only ${branch} -- ${dirPath}/ 2>/dev/null`,
      { encoding: 'utf-8' }
    );
    return output.split('\n')
      .map(f => path.basename(f))
      .filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
}

/**
 * Read and parse a JSON file from a branch via git show.
 * Returns null on any error.
 */
function readJsonFromBranch(branch, filePath) {
  try {
    const content = execSync(
      `git show ${branch}:${filePath} 2>/dev/null`,
      { encoding: 'utf-8' }
    );
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Extract the best result for an agent on a given project branch.
 *
 * Strategy per domain:
 *   1. If best.json exists, use it (astrophysics, p2p-network, etc.)
 *   2. Otherwise, read ALL .json files, extract the metric from each,
 *      and pick the best one (highest for desc, lowest for asc).
 *
 * Returns { data, experimentCount } or null if nothing found.
 */
function extractBestResult(branch, project, peerId, metric) {
  const agentDir = `projects/${project}/agents/${peerId}`;
  const jsonFiles = listJsonFiles(branch, agentDir);

  // Filter to only experiment files (exclude README.md, dag-snapshot.json, etc.)
  const experimentFiles = jsonFiles.filter(f => {
    if (f === 'README.md') return false;
    if (f === 'dag-snapshot.json') return false;
    return true;  // all other .json files are experiments
  });

  if (experimentFiles.length === 0) return null;

  // Strategy 1: try best.json first (fast path)
  if (experimentFiles.includes('best.json')) {
    const data = readJsonFromBranch(branch, `${agentDir}/best.json`);
    if (data) {
      return { data, experimentCount: experimentFiles.filter(f => f !== 'best.json').length };
    }
  }

  // Strategy 2: scan all experiment files and pick the best
  let bestData = null;
  let bestValue = metric.dir === 'asc' ? Infinity : -Infinity;
  let count = 0;

  for (const file of experimentFiles) {
    if (file === 'best.json') continue;

    const data = readJsonFromBranch(branch, `${agentDir}/${file}`);
    if (!data) continue;
    count++;

    const value = metric.extract(data);
    const isBetter = metric.dir === 'asc'
      ? value < bestValue
      : value > bestValue;

    if (isBetter) {
      bestValue = value;
      bestData = data;
    }
  }

  if (!bestData) return null;
  return { data: bestData, experimentCount: count };
}

/**
 * Extract round/run number from experiment data or filename.
 */
function extractRunNumber(data) {
  if (data.runNumber != null) return data.runNumber;
  if (data.roundNumber != null) return data.roundNumber;
  if (data.skillVersion != null) return data.skillVersion;
  // Try to parse from runId like "finance-r36" or "seed-r153-text-similarity"
  if (data.runId) {
    const m = data.runId.match(/r(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  if (data.skillId) {
    const m = data.skillId.match(/r(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return 0;
}

/**
 * Extract a timestamp from experiment data. Handles both numeric ms timestamps
 * and ISO date strings.
 */
function extractTimestamp(data) {
  const raw = data.timestamp ?? data.result?.timestamp ?? data.publishedAt ?? data.adoptedAt ?? 0;
  if (typeof raw === 'string') return new Date(raw).getTime();
  return raw;
}

// ---------------------------------------------------------------------------
// Main loop: process each project
// ---------------------------------------------------------------------------
for (const project of projects) {
  const metric = PROJECT_METRICS[project] || DEFAULT_METRIC;
  const entries = [];
  let totalExperiments = 0;

  for (const branch of branches) {
    // Branch format: origin/agents/<peerId>/<project>
    const parts = branch.replace('origin/', '').split('/');
    if (parts.length < 3) continue;
    const branchProject = parts.slice(2).join('/');
    if (branchProject !== project) continue;

    const peerId = parts[1];
    const result = extractBestResult(branch, project, peerId, metric);
    if (!result) continue;

    const { data, experimentCount } = result;
    totalExperiments += experimentCount;

    entries.push({
      peerId,
      metricValue: metric.extract(data),
      hypothesis: data.hypothesis || data.description || data.name || '—',
      runNumber: extractRunNumber(data),
      gpu: data.gpu || '—',
      timestamp: extractTimestamp(data),
    });
  }

  // Sort by metric — ascending for loss metrics, descending for score metrics
  if (metric.dir === 'asc') {
    entries.sort((a, b) => a.metricValue - b.metricValue);
  } else {
    entries.sort((a, b) => b.metricValue - a.metricValue);
  }

  // Generate LEADERBOARD.md
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const agentCount = entries.length;

  let md = `# Leaderboard: ${project}\n\n`;
  md += `_Last updated: ${now} | ${agentCount} agent${agentCount !== 1 ? 's' : ''} | ${totalExperiments} experiments_\n\n`;
  md += `| Rank | Agent | ${metric.label} | Hypothesis | Runs | GPU | Last Updated |\n`;
  md += `|------|-------|${'-'.repeat(metric.label.length + 2)}|------------|------|-----|-------------|\n`;

  if (entries.length === 0) {
    md += `| — | — | — | No agent results yet | — | — | — |\n`;
  } else {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const agentShort = `\`${e.peerId.slice(0, 12)}...\``;
      const age = e.timestamp ? formatAge(e.timestamp) : '—';
      const metricStr = metric.fmt(e.metricValue);
      md += `| ${i + 1} | ${agentShort} | ${metricStr} | ${truncate(e.hypothesis, 40)} | ${e.runNumber} | ${e.gpu} | ${age} |\n`;
    }
  }

  md += `\n_This leaderboard is auto-updated every 6 hours by scanning agent branches._\n`;

  const outPath = path.join(projectsDir, project, 'LEADERBOARD.md');
  fs.writeFileSync(outPath, md);
  console.log(`Updated ${outPath} (${entries.length} entries, ${totalExperiments} experiments)`);
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------
function truncate(s, len) {
  if (!s) return '—';
  return s.length > len ? s.slice(0, len - 1) + '...' : s;
}

function formatAge(ts) {
  const diff = Date.now() - ts;
  if (diff < 0) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}
