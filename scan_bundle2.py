import re

js = open('artifacts/rversed-bigbull/dist/public/assets/index-IwZeQCT5.js').read()

i = js.find('customFetch')
print('=== customFetch region (preceding 600 chars) ===')
print(js[max(0,i-900):i+400].replace('\n',' '))
