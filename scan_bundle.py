import re

js = open('artifacts/rversed-bigbull/dist/public/assets/index-IwZeQCT5.js').read()

# Look for how the generated client resolves the base URL:
# In custom-fetch.ts, applyBaseUrl uses a module-level baseURL state;
# setBaseUrl is called from main.tsx only if VITE_API_BASE_URL is set.
# We look for: the fallback where baseURL is undefined -> relative URL kept.
patterns = [
    r'customFetch',
    r'applyBaseUrl',
    r'VITE_API_BASE_URL',
    r'setBaseUrl',
    r'resolveUrl',
]
for pat in patterns:
    hits = [m.start() for m in re.finditer(pat, js)]
    print(f'{pat}: {len(hits)} hits')
    for start in hits[:2]:
        print('  ...', js[max(0,start-120):start+160].replace('\n',' '), '\n')
