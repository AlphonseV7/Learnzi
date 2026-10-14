#!/bin/sh
curl -s -o /dev/null localhost:8765/preview.html || (cd /home/claude/dist && setsid nohup python3 -m http.server 8765 >/dev/null 2>&1 < /dev/null & sleep 1)
