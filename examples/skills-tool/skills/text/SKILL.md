---
name: text
description: Analyze and transform text files using bash tools
---

# Text Processing Skill

Process text files using standard bash tools (grep, sed, awk, wc).

## Available Scripts

### stats.sh
Get statistics about a text file (lines, words, characters).
```bash
bash /skills/text/scripts/stats.sh document.txt
```

### search.sh
Search for patterns in text files.
```bash
bash /skills/text/scripts/search.sh <file> <pattern> [--count] [--context <lines>]
```

### extract.sh
Extract specific lines or sections from a file.
```bash
bash /skills/text/scripts/extract.sh <file> --lines <start>-<end>
bash /skills/text/scripts/extract.sh <file> --between <start_pattern> <end_pattern>
```

### wordfreq.sh
Count word frequencies in a text file.
```bash
bash /skills/text/scripts/wordfreq.sh document.txt [--top <n>]
```

## Examples

```bash
# Get file statistics
bash /skills/text/scripts/stats.sh readme.txt

# Search with context
bash /skills/text/scripts/search.sh log.txt "ERROR" --context 2

# Extract lines 10-20
bash /skills/text/scripts/extract.sh file.txt --lines 10-20

# Top 10 most frequent words
bash /skills/text/scripts/wordfreq.sh article.txt --top 10
```
