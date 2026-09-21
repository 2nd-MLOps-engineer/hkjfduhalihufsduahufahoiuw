#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_URL="http://127.0.0.1:8000"
LOG_FILE="/tmp/holy-django.log"

echo "우심운까 데모를 시작합니다..."
echo "(이 창을 닫지 않아도 서버는 계속 실행됩니다.)"
echo

cd "$PROJECT_DIR"

if curl -fsS "$WEB_URL" >/dev/null 2>&1; then
  echo "이미 실행 중인 서버를 사용합니다."
else
  nohup "$PROJECT_DIR/.venv/bin/python" manage.py runserver 127.0.0.1:8000 >"$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  echo "서버를 시작했습니다. PID: $SERVER_PID"

  for i in {1..30}; do
    if curl -fsS "$WEB_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if curl -fsS "$WEB_URL" >/dev/null 2>&1; then
  echo
  echo "준비 완료! 브라우저를 엽니다: $WEB_URL"
  open "$WEB_URL"
else
  echo
  echo "서버 시작에 실패했습니다. 로그: $LOG_FILE"
  exit 1
fi

echo
echo "서버 로그: $LOG_FILE"
echo "서버를 중지하려면 다음 명령어를 실행하세요:"
echo "kill \$(lsof -ti tcp:8000)"
echo
read -p "아무 키나 누르면 이 창을 닫습니다..." -n 1 -r
