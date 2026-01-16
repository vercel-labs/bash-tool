#!/bin/bash
# Count word frequencies in a text file

if [ -z "$1" ]; then
    echo "Usage: wordfreq.sh <file> [--top <n>]" >&2
    exit 1
fi

FILE="$1"
TOP=0
shift

while [ $# -gt 0 ]; do
    case "$1" in
        --top|-t)
            TOP="$2"
            shift
            ;;
    esac
    shift
done

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

# Convert to lowercase, split into words, count and sort
RESULT=$(tr '[:upper:]' '[:lower:]' < "$FILE" | \
    tr -cs '[:alpha:]' '\n' | \
    grep -v '^$' | \
    sort | \
    uniq -c | \
    sort -rn)

if [ "$TOP" -gt 0 ]; then
    echo "$RESULT" | head -"$TOP"
else
    echo "$RESULT"
fi
