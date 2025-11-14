#!/bin/bash

# Test script with logging
# Redirects all console output to /tmp/apple-music-tui-test.log

LOG_FILE="/tmp/apple-music-tui-test.log"

echo "======================================"
echo "Starting Apple Music TUI with logging"
echo "Output will be saved to: $LOG_FILE"
echo "======================================"
echo ""
echo "Test steps:"
echo "1. Enter a playlist/album"
echo "2. Play the first track"
echo "3. Rapidly press Ctrl+→ until Station is created"
echo "4. After Station entry, press Ctrl+→ a few more times"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Clear previous log
> "$LOG_FILE"

# Run the app with tsx and redirect all output to log file
npx tsx src/index.tsx 2>&1 | tee "$LOG_FILE"

echo ""
echo "======================================"
echo "Test completed. Log saved to: $LOG_FILE"
echo "======================================"
