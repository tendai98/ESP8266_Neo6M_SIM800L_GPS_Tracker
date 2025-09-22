#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${APP_DIR}/logs"
PID_DIR="${APP_DIR}/pids"
NODE_BIN="${NODE_BIN:-node}"
RETENTION_INTERVAL_MS="${RETENTION_INTERVAL_MS:-21600000}"  # 6h

mkdir -p "$LOG_DIR" "$PID_DIR"

start_one() {
  local name="$1"
  local cmd="$2"
  local log="${LOG_DIR}/${name}.log"
  local pidf="${PID_DIR}/${name}.pid"

  if [[ -f "$pidf" ]] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
    echo "[${name}] already running (pid $(cat "$pidf"))"
    return 0
  fi

  echo "[${name}] starting…"
  nohup bash -c "cd '${APP_DIR}'; exec ${cmd}" >>"$log" 2>&1 < /dev/null &
  echo $! >"$pidf"
  sleep 0.3
  if kill -0 "$(cat "$pidf")" 2>/dev/null; then
    echo "[${name}] started (pid $(cat "$pidf")), logs: $log"
  else
    echo "[${name}] failed to start; check logs: $log"
    rm -f "$pidf"
    return 1
  fi
}

stop_one() {
  local name="$1"
  local pidf="${PID_DIR}/${name}.pid"
  if [[ ! -f "$pidf" ]]; then
    echo "[${name}] not running"
    return 0
  fi
  local pid
  pid="$(cat "$pidf" || true)"
  if [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "[${name}] stopping pid $pid…"
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      echo "[${name}] force kill…"
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$pidf"
  echo "[${name}] stopped"
}

status_one() {
  local name="$1"
  local pidf="${PID_DIR}/${name}.pid"
  if [[ -f "$pidf" ]] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
    echo "[${name}] RUNNING (pid $(cat "$pidf"))"
  else
    echo "[${name}] STOPPED"
  fi
}

case "${1:-}" in
  start)
    start_one "web"       "${NODE_BIN} src/index.js"
    start_one "retention" "RETENTION_INTERVAL_MS=${RETENTION_INTERVAL_MS} ${NODE_BIN} src/retention.js"
    ;;
  stop)
    stop_one "retention"
    stop_one "web"
    ;;
  restart)
    "$0" stop
    "$0" start
    ;;
  status)
    status_one "web"
    status_one "retention"
    ;;
  logs)
    tail -n 200 -f "${LOG_DIR}/${2:-web}.log"
    ;;
  once-retention)
    RETENTION_INTERVAL_MS=0 ${NODE_BIN} src/retention.js --once
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs [web|retention]|once-retention}"
    exit 1
    ;;
esac

