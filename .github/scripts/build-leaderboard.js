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
        valLoss: data.result?.valLoss ?? data.valLoss ?? Infinity,
        hypothesis: data.hypothesis || '—',
        runNumber: data.runNumber || 0,
        gpu: data.gpu || '—',
        timestamp: data.timestamp || data.result?.timestamp || 0,
      });
    } catch {
      // Branch doesn't have best.json yet — skip
    }
  }

  // Sort by val_loss ascending
  entries.sort((a, b) => a.valLoss - b.valLoss);

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
      totalExperiments += files.split('\n').filter(f => f.match(/run-\d+\.json$/)).length;
    } catch { /* skip */ }
  }

  // Generate LEADERBOARD.md
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const agentCount = entries.length;

  let md = `# Leaderboard: ${project}\n\n`;
  md += `_Last updated: ${now} | ${agentCount} agent${agentCount !== 1 ? 's' : ''} | ${totalExperiments} experiments_\n\n`;
  md += `| Rank | Agent | Val Loss | Hypothesis | Runs | GPU | Last Updated |\n`;
  md += `|------|-------|----------|------------|------|-----|-------------|\n`;

  if (entries.length === 0) {
    md += `| — | — | — | No agent results yet | — | — | — |\n`;
  } else {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const agentShort = `\`${e.peerId.slice(0, 12)}...\``;
      const age = e.timestamp ? formatAge(e.timestamp) : '—';
      md += `| ${i + 1} | ${agentShort} | ${e.valLoss.toFixed(4)} | ${truncate(e.hypothesis, 40)} | ${e.runNumber} | ${e.gpu} | ${age} |\n`;
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
