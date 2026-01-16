#!/bin/bash
# Filter CSV rows where a column matches a value

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: filter.sh <csv_file> <column_number> <value>" >&2
    echo "Example: filter.sh data.csv 3 active" >&2
    exit 1
fi

FILE="$1"
COL="$2"
VALUE="$3"

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

# Print header
head -1 "$FILE"

# Filter rows where column matches value
tail -n +2 "$FILE" | awk -F',' -v col="$COL" -v val="$VALUE" '$col == val'
