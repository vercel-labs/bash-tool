#!/bin/bash
# Analyze a CSV file - show structure and statistics

if [ -z "$1" ]; then
    echo "Usage: analyze.sh <csv_file>" >&2
    exit 1
fi

FILE="$1"

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

echo "=== CSV Analysis: $FILE ==="
echo ""

# Row count
TOTAL_ROWS=$(wc -l < "$FILE" | tr -d ' ')
echo "Total rows: $TOTAL_ROWS"

# Column count (from header)
HEADER=$(head -1 "$FILE")
COL_COUNT=$(echo "$HEADER" | awk -F',' '{print NF}')
echo "Columns: $COL_COUNT"

echo ""
echo "=== Header ==="
echo "$HEADER"

echo ""
echo "=== Column Names ==="
echo "$HEADER" | tr ',' '\n' | nl

echo ""
echo "=== First 5 Data Rows ==="
head -6 "$FILE" | tail -5

echo ""
echo "=== Last 3 Data Rows ==="
tail -3 "$FILE"
