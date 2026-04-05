#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { runExport } from '../src/commands/export.mjs';

program
  .name('claude-sync')
  .description('Backup and restore your Claude Code environment')
  .version('0.1.0');

program
  .command('export')
  .description('Export Claude Code environment to a portable archive')
  .argument('[output]', 'Output file path (default: ./claude-sync-YYYY-MM-DD.tar.gz)')
  .option('--include <types>', 'Comma-separated data types to include (overrides defaults)')
  .option('--exclude <types>', 'Comma-separated data types to exclude from defaults')
  .option('--skip-secret-scan', 'Skip secret scanning of settings.json before export')
  .action(async (output, options) => {
    try {
      await runExport(output, options);
    } catch (err) {
      console.error(chalk.red('Export failed: ' + err.message));
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);
