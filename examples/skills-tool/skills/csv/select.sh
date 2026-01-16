#!/bin/bash
# Select specific columns from a CSV

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: select.sh <csv_file> <columns>" >&2
    echo "Example: select.sh data.csv 1,3,5" >&2
    exit 1
fi

FILE="$1"
COLS="$2"

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

cut -d',' -f"$COLS" "$FILE"
