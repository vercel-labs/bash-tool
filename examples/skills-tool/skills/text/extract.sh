#!/bin/bash
# Extract specific lines or sections from a file

if [ -z "$1" ]; then
    echo "Usage: extract.sh <file> --lines <start>-<end>" >&2
    echo "       extract.sh <file> --between <start_pattern> <end_pattern>" >&2
    exit 1
fi

FILE="$1"
shift

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

case "$1" in
    --lines|-l)
        RANGE="$2"
        START=$(echo "$RANGE" | cut -d'-' -f1)
        END=$(echo "$RANGE" | cut -d'-' -f2)
        sed -n "${START},${END}p" "$FILE"
        ;;
    --between|-b)
        START_PAT="$2"
        END_PAT="$3"
        sed -n "/${START_PAT}/,/${END_PAT}/p" "$FILE"
        ;;
    *)
        echo "Unknown option: $1" >&2
        echo "Use --lines or --between" >&2
        exit 1
        ;;
esac
