#!/bin/bash
# Keep-Alive ping script for MyMindTherapyFriend Backend
# Usage: ./ping-keepalive.sh [optional_url]

URL="${1:-https://zonelive.fun}"
ENDPOINT="${URL%/}/health"

echo "[$(date)] Pinging $ENDPOINT ..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$ENDPOINT")

echo "$RESPONSE"
