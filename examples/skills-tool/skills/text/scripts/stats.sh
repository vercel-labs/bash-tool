#!/bin/bash
# Get statistics about a text file

if [ -z "$1" ]; then
    echo "Usage: stats.sh <file>" >&2
    exit 1
fi

FILE="$1"

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

echo "=== Text Statistics: $FILE ==="
echo ""

LINES=$(wc -l < "$FILE" | tr -d ' ')
WORDS=$(wc -w < "$FILE" | tr -d ' ')
CHARS=$(wc -c < "$FILE" | tr -d ' ')

echo "Lines: $LINES"
echo "Words: $WORDS"
echo "Characters: $CHARS"

echo ""
echo "=== First 5 lines ==="
head -5 "$FILE"

echo ""
echo "=== Last 5 lines ==="
tail -5 "$FILE"
