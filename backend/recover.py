import json

log_path = r'C:\Users\boris\.gemini\antigravity-ide\brain\7f7a3311-9cee-4967-9250-86aaa4254155\.system_generated\logs\transcript.jsonl'
lines = []

for line in open(log_path, encoding='utf-8'):
    try:
        d = json.loads(line)
    except:
        continue
    
    content = str(d)
    if 'erp.py' in content:
        lines.append(content)

with open("erp_history.txt", "w", encoding="utf-8") as f:
    f.write("\n\n---\n\n".join(lines))


