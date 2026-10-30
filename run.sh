#!/usr/bin/env bash
# ./run.sh [start|stop|restart|status]   (build first with: npm run build)
cd "$(dirname "$0")"
PIDF=server.pid
case "${1:-start}" in
  stop) [ -f $PIDF ] && kill "$(cat $PIDF)" 2>/dev/null; rm -f $PIDF; echo stopped;;
  status) [ -f $PIDF ] && kill -0 "$(cat $PIDF)" 2>/dev/null && echo "running pid $(cat $PIDF)" || echo "not running";;
  restart) "$0" stop; sleep 0.5; "$0" start;;
  start) if [ -f $PIDF ] && kill -0 "$(cat $PIDF)" 2>/dev/null; then echo "already running pid $(cat $PIDF)"; exit 0; fi
     : "${OFFICE_PASSWORD:?OFFICE_PASSWORD not set}"
     nohup node server.js >> server.log 2>&1 &
     echo $! > $PIDF; sleep 0.7; echo "started pid $(cat $PIDF) on port ${PORT:-8787}";;
esac
