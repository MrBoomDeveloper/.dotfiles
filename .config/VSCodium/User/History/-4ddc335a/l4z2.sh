#!/bin/bash

PROCESS_NAME="bun start"
PID_FILE="/tmp/bun_server.pid"

if pgrep -f "$PROCESS_NAME" > /dev/null; then
    echo "Stopping server..."
    pkill -f "$PROCESS_NAME"
    rm -f "$PID_FILE"
    echo "Server stopped."
else
    echo "Server is not running."
fi
