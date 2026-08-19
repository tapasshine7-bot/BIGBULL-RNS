import re

js = open('artifacts/rversed-bigbull/dist/public/assets/index-IwZeQCT5.js').read()

# Find all 'new URL(' occurrences — this is how relative URLs get resolved
for m in re.finditer(r'.{150}new URL\(.{150}', js):
    print(m.group(0).replace('\n',' '))
    print('=====')
