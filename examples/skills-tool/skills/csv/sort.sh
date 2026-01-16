#!/bin/bash
# Sort CSV by a column

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: sort.sh <csv_file> <column_number> [--numeric] [--reverse]" >&2
    echo "Example: sort.sh data.csv 2 --numeric --reverse" >&2
    exit 1
fi

FILE="$1"
COL="$2"
shift 2

SORT_OPTS="-t, -k${COL},${COL}"

# Parse options
while [ $# -gt 0 ]; do
    case "$1" in
        --numeric|-n)
            SORT_OPTS="$SORT_OPTS -n"
            ;;
        --reverse|-r)
            SORT_OPTS="$SORT_OPTS -r"
            ;;
    esac
    shift
done

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

# Print header first, then sort the rest
head -1 "$FILE"
tail -n +2 "$FILE" | sort $SORT_OPTS
