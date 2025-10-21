#!/bin/bash

# Name of the process to look for
PROCESS_NAME="bun start"

# Command to start the server
START_CMD="bun start"

# File to store the PID
PID_FILE="/tmp/bun_server.pid"

# Check if process is running
if pgrep -f "$PROCESS_NAME" > /dev/null; then
    echo "Server is already running. Restarting..."
    pkill -f "$PROCESS_NAME"
    sleep 2
fi

# Start the server in the background, detached from SSH
nohup $START_CMD > server.log 2>&1 &

# Save PID
echo $! > "$PID_FILE"

echo "Server started with PID $(cat $PID_FILE). Logs: server.log"
