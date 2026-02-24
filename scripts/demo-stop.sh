#!/bin/bash
# Stop OpenClaw Memory Demo

echo "🛑 Stopping OpenClaw Memory demo..."

# Kill daemon
if [ -f /tmp/openclaw-demo-daemon.pid ]; then
  DAEMON_PID=$(cat /tmp/openclaw-demo-daemon.pid)
  if kill -0 $DAEMON_PID 2>/dev/null; then
    kill $DAEMON_PID
    echo "   ✓ Daemon stopped (PID: $DAEMON_PID)"
  fi
  rm /tmp/openclaw-demo-daemon.pid
fi

# Kill web
if [ -f /tmp/openclaw-demo-web.pid ]; then
  WEB_PID=$(cat /tmp/openclaw-demo-web.pid)
  if kill -0 $WEB_PID 2>/dev/null; then
    kill $WEB_PID
    echo "   ✓ Web dashboard stopped (PID: $WEB_PID)"
  fi
  rm /tmp/openclaw-demo-web.pid
fi

# Clean up temp files
rm -f /tmp/openclaw-daemon.log
rm -f /tmp/openclaw-web.log
rm -f /tmp/reflect-job.json

echo "✅ Demo stopped"
