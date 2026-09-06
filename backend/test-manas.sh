#!/bin/bash
# Quick test for HuggingFace Llama 3.3 70B integration
# Tests the raw HuggingFace API directly first, then tests through the app

echo "=== Test 1: Direct HuggingFace API call ==="
# Retrieve the HF_TOKEN, stripping carriage returns
TOKEN=$(grep HF_TOKEN .env | cut -d= -f2 | tr -d '\r\n ')
MODEL=$(grep HF_MODEL .env | cut -d= -f2 | tr -d '\r\n ')
if [ -z "$MODEL" ]; then
  MODEL="meta-llama/Llama-3.3-70B-Instruct"
fi
echo "Using model: $MODEL"
echo "Using HF_TOKEN length: ${#TOKEN}"

curl -s -X POST "https://router.huggingface.co/v1/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$MODEL"'",
    "messages": [
      {"role": "system", "content": "You are Manas, a warm emotional wellness companion. Respond like a caring friend."},
      {"role": "user", "content": "I have been feeling really stressed about my exams lately"}
    ],
    "max_tokens": 150,
    "temperature": 0.75,
    "stream": false
  }' | python3 -m json.tool || echo "Raw response above"

echo ""
echo "=== Test complete ==="
