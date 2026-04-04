#!/usr/bin/env node

import { program } from 'commander';

program
  .name('claude-sync')
  .description('Backup and restore your Claude Code environment')
  .version('0.1.0');

program
  .command('export')
  .description('Export Claude Code environment to a portable archive')
  .action(() => {
    console.log('export not yet implemented');
  });

await program.parseAsync(process.argv);
