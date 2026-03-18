'use strict';

const { spawnSync } = require('child_process');

module.exports = async function macosAdhocSign(options) {
  const appPath = options.app;

  console.log(`[macos-adhoc-sign] Applying ad-hoc codesign to ${appPath}`);
  spawnSync('xattr', ['-cr', appPath], { encoding: 'utf-8' });

  const result = spawnSync('codesign', [
    '--force',
    '--deep',
    '--no-strict',
    '--sign',
    '-',
    appPath,
  ], {
    encoding: 'utf-8',
    timeout: 120000,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(`Ad-hoc codesign failed${stderr ? `: ${stderr}` : ''}`);
  }

  console.log('[macos-adhoc-sign] ✓ Ad-hoc codesign applied');
};
