import re
import json
from collections import defaultdict, Counter

# Read HTML file
with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()
    html_lines = html_content.split('\n')

# Read all JS files
js_files = [
    'app.js', 'main.js', 'event-handlers.js', 'utils.js', 'state.js',
    'audio.js', 'filters.js', 'browse.js', 'comments.js', 'user.js',
    'junkies.js', 'upload.js', 'lounge.js', 'notifications.js',
    'settings.js', 'manage-sounds.js', 'auth.js'
]

js_content = ''
for js_file in js_files:
    try:
        with open(js_file, 'r', encoding='utf-8') as f:
            js_content += f'\n\n// ===== {js_file} =====\n\n' + f.read()
    except FileNotFoundError:
        print(f'Warning: {js_file} not found')

print("=" * 80)
print("HTML ANALYSIS REPORT - SERIOUS ISSUES")
print("=" * 80)

# 1. Find all IDs in HTML
html_ids = {}
id_pattern = re.compile(r'id="([^"]+)"')
for line_num, line in enumerate(html_lines, 1):
    for match in id_pattern.finditer(line):
        id_name = match.group(1)
        if id_name in html_ids:
            html_ids[id_name].append(line_num)
        else:
            html_ids[id_name] = [line_num]

# 2. Check for duplicate IDs
print("\n1. DUPLICATE IDs (Critical - breaks getElementById):")
print("-" * 80)
duplicates_found = False
for id_name, line_nums in sorted(html_ids.items()):
    if len(line_nums) > 1:
        print(f"   ID '{id_name}' appears {len(line_nums)} times at lines: {line_nums}")
        duplicates_found = True
if not duplicates_found:
    print("   ✓ No duplicate IDs found")

# 3. Find all getElementById calls in JS
print("\n2. MISSING IDs (JavaScript references non-existent elements):")
print("-" * 80)
get_by_id_pattern = re.compile(r"getElementById\(['\"]([^'\"]+)['\"]\)")
js_id_refs = set(get_by_id_pattern.findall(js_content))

missing_ids = []
for js_id in sorted(js_id_refs):
    if js_id not in html_ids:
        # Find which file(s) reference this ID
        files_with_ref = []
        for js_file in js_files:
            try:
                with open(js_file, 'r', encoding='utf-8') as f:
                    if f"getElementById('{js_id}')" in f.read() or f'getElementById("{js_id}")' in open(js_file).read():
                        files_with_ref.append(js_file)
            except:
                pass
        missing_ids.append((js_id, files_with_ref))
        print(f"   ✗ ID '{js_id}' referenced in JS but NOT in HTML")
        print(f"     Referenced in: {', '.join(files_with_ref)}")

if not missing_ids:
    print("   ✓ All JavaScript ID references found in HTML")

# 4. Find onclick handlers
print("\n3. BROKEN ONCLICK HANDLERS (referencing non-existent functions):")
print("-" * 80)
onclick_pattern = re.compile(r'onclick="([^"]+)"')
onclick_handlers = []
for line_num, line in enumerate(html_lines, 1):
    for match in onclick_pattern.finditer(line):
        handler = match.group(1)
        onclick_handlers.append((line_num, handler))

# Extract function names from onclick
function_pattern = re.compile(r'(\w+)\s*\(')
js_functions = set(re.findall(r'function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\()', js_content))
js_functions = {f[0] or f[1] for f in js_functions if f[0] or f[1]}

broken_handlers = []
for line_num, handler in onclick_handlers:
    func_match = function_pattern.search(handler)
    if func_match:
        func_name = func_match.group(1)
        if func_name not in js_functions and not func_name.startswith('window.'):
            broken_handlers.append((line_num, func_name, handler))
            print(f"   ✗ Line {line_num}: onclick='{handler}' - function '{func_name}' may not exist")

if not broken_handlers:
    print("   ✓ No obviously broken onclick handlers found")

# 5. Check for unclosed tags
print("\n4. UNCLOSED TAGS:")
print("-" * 80)
tag_stack = []
self_closing = {'img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'}
unclosed_tags = []

opening_tag = re.compile(r'<(\w+)[^>]*>')
closing_tag = re.compile(r'</(\w+)>')
self_closing_tag = re.compile(r'<(\w+)[^>]*/>')

for line_num, line in enumerate(html_lines, 1):
    # Remove self-closing tags
    for match in self_closing_tag.finditer(line):
        pass  # These are fine

    # Find opening tags
    for match in opening_tag.finditer(line):
        tag_name = match.group(1).lower()
        if tag_name not in self_closing and '</' not in line[match.end():]:
            tag_stack.append((tag_name, line_num))

    # Find closing tags
    for match in closing_tag.finditer(line):
        tag_name = match.group(1).lower()
        if tag_stack and tag_stack[-1][0] == tag_name:
            tag_stack.pop()

if len(tag_stack) > 5:
    print(f"   ⚠ Warning: {len(tag_stack)} potentially unclosed tags detected")
    print(f"   (This is a rough estimate - HTML parsing is complex)")
else:
    print("   ✓ No major tag closure issues detected")

# 6. Check for missing script includes
print("\n5. SCRIPT INCLUDES:")
print("-" * 80)
script_pattern = re.compile(r'<script[^>]+src="([^"]+)"')
included_scripts = []
for match in script_pattern.finditer(html_content):
    src = match.group(1)
    if not src.startswith('http'):
        included_scripts.append(src)

for js_file in js_files:
    if js_file not in included_scripts:
        print(f"   ✗ {js_file} defined in analysis but may not be included in HTML")

print(f"\n   Included local scripts: {', '.join(included_scripts)}")

# 7. Summary
print("\n" + "=" * 80)
print("SUMMARY OF CRITICAL ISSUES:")
print("=" * 80)
total_issues = len([id for id, lines in html_ids.items() if len(lines) > 1]) + len(missing_ids) + len(broken_handlers)
print(f"Total critical issues found: {total_issues}")
if len([id for id, lines in html_ids.items() if len(lines) > 1]) > 0:
    print(f"  - Duplicate IDs: {len([id for id, lines in html_ids.items() if len(lines) > 1])}")
if len(missing_ids) > 0:
    print(f"  - Missing IDs: {len(missing_ids)}")
if len(broken_handlers) > 0:
    print(f"  - Broken onclick handlers: {len(broken_handlers)}")

print("\n" + "=" * 80)
