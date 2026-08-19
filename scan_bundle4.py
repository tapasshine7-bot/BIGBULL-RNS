import re

js = open('artifacts/rversed-bigbull/dist/public/assets/index-IwZeQCT5.js').read()

# The custom-fetch source uses: bg = isRequest, mT = resolveMethod,
# applyBaseUrl applied via `a = applyBaseUrl(a)` before Gi body.
# But in the bundle, `a=a` appears: check for 'a=' assignment patterns
# and any origin/URL fallback. Also locate the generated API path usage.

# In unminified main.tsx: setBaseUrl(apiUrl.origin) only if env var set.
# If not set, baseURL remains undefined; applyBaseUrl returns input unchanged,
# so fetch('/api/gateway') -> relative to page origin. Confirm no string with
# http anywhere near '/api/gateway'.

idx = js.find('/api/gateway')
print(js[idx-400:idx+100].replace('\n',' '))
print('====')
# count fetch( occurrences
print('fetch( count:', js.count('fetch('))
# any absolute origins?
abs_urls = set(re.findall(r'https?://[a-z0-9.\-]+', js.lower()))
print('abs urls:', abs_urls)
