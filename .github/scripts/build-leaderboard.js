#!/usr/bin/env node

/**
 * Scan all agent branches, read best.json files, and generate LEADERBOARD.md
 * for each project.
 *
 * Runs as a GitHub Actions step — no external dependencies.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Per-project metric configuration
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

// Pattern to match ALL experiment file formats
const EXPERIMENT_FILE_RE = /^(run-\d+|finance-r\d+|round-\d+|search-r\d+|skill-r\d+)\.json$/;

// Discover projects from the projects/ directory
const projectsDir = path.join(__dirname, '..', '..', 'projects');
const projects = fs.readdirSync(projectsDir)
  .filter(d => !d.startsWith('_') && fs.statSync(path.join(projectsDir, d)).isDirectory());

console.log(`Found projects: ${projects.join(', ')}`);

// Get all remote branches matching agents/*
const branchOutput = execSync('git branch -r --list "origin/agents/*"', { encoding: 'utf-8' });
const branches = branchOutput.trim().split('\n')
  .map(b => b.trim())
  .filter(b => b.length > 0);

console.log(`Found ${branches.length} agent branches`);

// For each project, collect results from agent branches
for (const project of projects) {
  const metric = PROJECT_METRICS[project] || DEFAULT_METRIC;
  const entries = [];

  for (const branch of branches) {
    // Branch format: origin/agents/<peerId>/<project>
    const parts = branch.replace('origin/', '').split('/');
    if (parts.length < 3) continue;
    const branchProject = parts.slice(2).join('/');
    if (branchProject !== project) continue;

    const peerId = parts[1];
    const bestPath = `projects/${project}/agents/${peerId}/best.json`;

    try {
      const content = execSync(`git show ${branch}:${bestPath} 2>/dev/null`, { encoding: 'utf-8' });
      const data = JSON.parse(content);
      entries.push({
        peerId,
        metricValue: metric.extract(data),
        hypothesis: data.hypothesis || data.description || '—',
        runNumber: data.runNumber || data.roundNumber || 0,
        gpu: data.gpu || '—',
        timestamp: data.timestamp || data.result?.timestamp || 0,
      });
    } catch {
      // Branch doesn't have best.json yet — skip
    }
  }

  // Sort by metric — ascending for loss metrics, descending for score metrics
  if (metric.dir === 'asc') {
    entries.sort((a, b) => a.metricValue - b.metricValue);
  } else {
    entries.sort((a, b) => b.metricValue - a.metricValue);
  }

  // Count total experiments across all agents for this project
  let totalExperiments = 0;
  for (const branch of branches) {
    const parts = branch.replace('origin/', '').split('/');
    if (parts.length < 3) continue;
    if (parts.slice(2).join('/') !== project) continue;
    const peerId = parts[1];
    try {
      const files = execSync(
        `git ls-tree --name-only ${branch} -- projects/${project}/agents/${peerId}/ 2>/dev/null`,
        { encoding: 'utf-8' }
      );
      totalExperiments += files.split('\n').filter(f => EXPERIMENT_FILE_RE.test(path.basename(f))).length;
    } catch { /* skip */ }
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

function truncate(s, len) {
  if (!s) return '—';
  return s.length > len ? s.slice(0, len - 1) + '...' : s;
}

function formatAge(ts) {
  const diff = Date.now() - ts;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}
