#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import fs from 'fs';

// Redirect console.log to a file for debugging
const logFile = '/tmp/apple-music-tui-console.log';
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

const originalLog = console.log;
const originalError = console.error;

console.log = (...args: any[]) => {
  const timestamp = new Date().toISOString().substring(11, 23);
  logStream.write(`[${timestamp}] ${args.join(' ')}\n`);
};

console.error = (...args: any[]) => {
  const timestamp = new Date().toISOString().substring(11, 23);
  logStream.write(`[${timestamp}] ERROR: ${args.join(' ')}\n`);
};

console.log(`=== Apple Music TUI Debug Log ===`);
console.log(`Started at ${new Date().toISOString()}`);
console.log(`Log file: ${logFile}`);
console.log(`===================================\n`);

render(<App />, { patchConsole: false });
