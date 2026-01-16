#!/bin/bash
# Search for patterns in text files

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: search.sh <file> <pattern> [--count] [--context <lines>]" >&2
    exit 1
fi

FILE="$1"
PATTERN="$2"
shift 2

COUNT_ONLY=false
CONTEXT=0

while [ $# -gt 0 ]; do
    case "$1" in
        --count|-c)
            COUNT_ONLY=true
            ;;
        --context|-C)
            CONTEXT="$2"
            shift
            ;;
    esac
    shift
done

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

if [ "$COUNT_ONLY" = true ]; then
    MATCHES=$(grep -c "$PATTERN" "$FILE")
    echo "Matches found: $MATCHES"
elif [ "$CONTEXT" -gt 0 ]; then
    grep -n -C "$CONTEXT" "$PATTERN" "$FILE"
else
    grep -n "$PATTERN" "$FILE"
fi
