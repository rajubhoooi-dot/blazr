#!/usr/bin/env python3
import os, json, re
from datetime import datetime
from pathlib import Path

BLOGS_DIR = Path("blogs")
INDEX_FILE = BLOGS_DIR / "index.json"

def get_sort_date(p):
    try:
        c = p.read_text(encoding='utf-8')
        m = re.match(r'^---\r?\n(.*?)\r?\n---', c, re.DOTALL)
        if m:
            for line in m.group(1).split('\n'):
                if 'date:' in line.lower():
                    d = line.split(':',1)[1].strip().strip('"\'')
                    return datetime.fromisoformat(d.split('T')[0].replace('/','-'))
    except: pass
    m = re.search(r'(\d{4}[-/]\d{2}[-/]\d{2})', p.stem)
    if m: return datetime.strptime(m.group(1).replace('/','-'), "%Y-%m-%d")
    return datetime.fromtimestamp(p.stat().st_mtime)

def main():
    if not BLOGS_DIR.exists(): print("Error: blogs/ not found"); return
    files = [p for p in BLOGS_DIR.iterdir() if p.suffix.lower() == '.md']
    if not files: print("No .md files"); return

    posts = sorted(files, key=get_sort_date, reverse=True)
    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        json.dump([p.name for p in posts], f, indent=2)
    print(f"SUCCESS: {INDEX_FILE} updated with {len(posts)} posts")

if __name__ == "__main__": main()
