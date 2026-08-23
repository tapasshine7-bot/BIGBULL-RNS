/**
 * Owner-only control surface served from /control by the production API Worker.
 * It intentionally uses the existing /api/admin session API and never embeds
 * credentials or values from the database in the page source.
 */
export function ownerControlPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>RNS BIGBULL · Owner Tool Manager</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; --ink:#edf7ff; --muted:#a9bdd0; --line:#29435b; --panel:rgba(11,24,38,.92); --blue:#16c4ff; --pink:#ff6988; --gold:#f9c64a; }
    * { box-sizing:border-box; } body { margin:0; min-height:100vh; color:var(--ink); background:radial-gradient(circle at 8% 0%,#172d4b 0,transparent 32rem),radial-gradient(circle at 96% 4%,#48223b 0,transparent 30rem),#07111c; }
    body::before { content:""; pointer-events:none; position:fixed; inset:0; opacity:.25; background-image:linear-gradient(rgba(22,196,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(22,196,255,.06) 1px,transparent 1px); background-size:34px 34px; }
    main { position:relative; width:min(1080px,calc(100% - 28px)); margin:0 auto; padding:28px 0 60px; } header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:16px 0 24px; border-bottom:1px solid var(--line); }
    h1 { margin:0; font-size:clamp(1.55rem,4vw,2.25rem); letter-spacing:.04em; } h1 span { color:var(--blue); } .eyebrow { color:var(--gold); font-size:.72rem; font-weight:800; letter-spacing:.18em; margin:0 0 8px; } .subtitle { color:var(--muted); max-width:650px; margin:9px 0 0; line-height:1.55; }
    .back { color:var(--ink); border:1px solid var(--line); padding:10px 13px; border-radius:10px; font-weight:700; text-decoration:none; white-space:nowrap; } .back:hover { border-color:var(--blue); color:var(--blue); }
    .notice { display:none; margin:20px 0; padding:13px 15px; border-radius:10px; border:1px solid #4c7193; background:rgba(22,196,255,.1); color:#d9f7ff; } .notice.error { display:block; border-color:#a94259; background:rgba(255,105,136,.12); color:#ffdce4; } .notice.success { display:block; border-color:#42795f; background:rgba(82,217,151,.12); color:#dffff0; }
    .panel { margin-top:22px; padding:clamp(18px,4vw,30px); border:1px solid var(--line); border-radius:18px; background:var(--panel); box-shadow:0 18px 70px rgba(0,0,0,.28); } .hidden { display:none !important; }
    h2 { margin:0 0 8px; font-size:1.3rem; } .hint { margin:0 0 20px; color:var(--muted); line-height:1.5; } form { display:grid; gap:15px; } .form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:15px; } label { display:grid; gap:7px; color:#dbe9f3; font-size:.9rem; font-weight:700; } input, select, textarea { width:100%; padding:12px 13px; color:var(--ink); background:#091722; border:1px solid #36526a; border-radius:9px; font:inherit; } input:focus, select:focus, textarea:focus { outline:2px solid var(--blue); outline-offset:2px; border-color:var(--blue); } textarea { min-height:86px; resize:vertical; } .check { display:flex; align-items:center; gap:9px; color:var(--muted); } .check input { width:18px; height:18px; accent-color:var(--blue); }
    button { border:0; border-radius:9px; padding:12px 16px; color:#07111c; background:var(--blue); cursor:pointer; font:inherit; font-weight:900; } button:hover { filter:brightness(1.08); } button:disabled { opacity:.55; cursor:wait; } button.danger { background:var(--pink); } button.secondary { color:var(--ink); background:#22394e; } .actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; } .actions button { padding:9px 12px; font-size:.84rem; }
    .tools-head { display:flex; justify-content:space-between; align-items:center; gap:15px; margin-top:34px; } .count { color:var(--muted); font-size:.9rem; } .tool-list { display:grid; gap:12px; margin-top:15px; } .tool { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:15px; padding:16px; border:1px solid #2c4961; border-radius:13px; background:rgba(5,14,23,.7); } .tool h3 { margin:0; font-size:1rem; } .tool p { color:var(--muted); margin:7px 0 0; line-height:1.4; word-break:break-word; } .tool a { color:var(--blue); text-decoration:none; } .tags { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; } .tag { color:#c9e7fa; background:#123049; border:1px solid #28577b; padding:4px 7px; border-radius:6px; font-size:.72rem; font-weight:800; } .tag.off { color:#ffcad4; background:#40232d; border-color:#784353; } .tool-actions { display:flex; align-items:flex-start; flex-wrap:wrap; justify-content:flex-end; gap:8px; } .empty { padding:20px; color:var(--muted); border:1px dashed #38546a; border-radius:11px; text-align:center; }
    @media (max-width:680px) { header { flex-direction:column; } .form-grid { grid-template-columns:1fr; } .tool { grid-template-columns:1fr; } .tool-actions { justify-content:flex-start; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div><p class="eyebrow">RNS BIGBULL · OWNER ONLY</p><h1>Tool <span>Manager</span></h1><p class="subtitle">Add, update, hide, reorder, or permanently remove the public tool cards shown on your Dashboard and VIP Hub.</p></div>
      <a class="back" href="/gateway">← Main site</a>
    </header>
    <p id="notice" class="notice" role="status"></p>
    <section id="login-panel" class="panel">
      <h2>Owner login</h2><p class="hint">Use the same Admin password that already works on your main site. This page does not change your existing Admin ID or password.</p>
      <form id="login-form"><label>Admin password<input id="password" type="password" autocomplete="current-password" required /></label><div class="actions"><button type="submit">Open Tool Manager</button></div></form>
    </section>
    <section id="manager" class="hidden">
      <section class="panel">
        <h2 id="form-title">Add a tool</h2><p class="hint">Tool links and optional logo links must use HTTPS. Choose where the tool card appears, then save it.</p>
        <form id="tool-form">
          <div class="form-grid"><label>Tool name<input id="name" maxlength="100" required placeholder="Example: Partner Tool" /></label><label>Placement<select id="placement"><option value="vip">VIP Hub</option><option value="dashboard">Normal dashboard</option></select></label></div>
          <label>HTTPS tool link<input id="url" type="url" inputmode="url" placeholder="https://partner.example" required /></label>
          <label>Optional HTTPS logo link<input id="logo" type="url" inputmode="url" placeholder="https://partner.example/logo.png" /></label>
          <label>Description<textarea id="description" maxlength="280" placeholder="Short description for your visitors"></textarea></label>
          <label class="check"><input id="enabled" type="checkbox" checked /> Show this tool publicly now</label>
          <div class="actions"><button id="save" type="submit">Add Tool</button><button id="cancel" class="secondary hidden" type="button">Cancel edit</button></div>
        </form>
      </section>
      <section class="panel"><div class="tools-head"><div><h2>Your tools</h2><p class="hint">Use arrows to set order. Remove permanently deletes a tool card.</p></div><span id="count" class="count">Loading…</span></div><div id="tool-list" class="tool-list"></div></section>
    </section>
  </main>
  <script>
    const tokenKey = 'rnsBigbullOwnerToken';
    const $ = (selector) => document.querySelector(selector);
    const notice = $('#notice'); let token = localStorage.getItem(tokenKey) || ''; let tools = []; let editingId = '';
    function show(message, tone) { notice.textContent = message; notice.className = 'notice ' + tone; }
    function headers(json) { const h = { 'x-admin-token': token }; if (json) h['content-type'] = 'application/json'; return h; }
    async function api(path, options) { const response = await fetch('/api/admin' + path, Object.assign({ headers: headers(false) }, options || {})); let body = {}; try { body = await response.json(); } catch (_) {} if (!response.ok) throw new Error(body.error || 'Request failed'); return body; }
    function resetForm() { editingId = ''; $('#form-title').textContent = 'Add a tool'; $('#save').textContent = 'Add Tool'; $('#cancel').classList.add('hidden'); $('#tool-form').reset(); $('#enabled').checked = true; }
    function tag(text, off) { const node = document.createElement('span'); node.className = 'tag' + (off ? ' off' : ''); node.textContent = text; return node; }
    function action(text, style, fn) { const button = document.createElement('button'); button.type = 'button'; button.className = style || 'secondary'; button.textContent = text; button.addEventListener('click', fn); return button; }
    function render() { const list = $('#tool-list'); list.replaceChildren(); $('#count').textContent = tools.length + (tools.length === 1 ? ' tool' : ' tools'); if (!tools.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No managed tools yet. Add your first one above.'; list.append(empty); return; } tools.forEach((tool, index) => { const card = document.createElement('article'); card.className = 'tool'; const info = document.createElement('div'); const title = document.createElement('h3'); title.textContent = tool.name; const link = document.createElement('a'); link.href = tool.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = tool.url; const desc = document.createElement('p'); desc.textContent = tool.description || 'No description added.'; const tags = document.createElement('div'); tags.className = 'tags'; tags.append(tag(tool.placement === 'vip' ? 'VIP Hub' : 'Dashboard')); tags.append(tag(tool.enabled ? 'Visible' : 'Hidden', !tool.enabled)); if (tool.logoUrl) tags.append(tag('Logo set')); info.append(title, link, desc, tags); const actions = document.createElement('div'); actions.className = 'tool-actions'; actions.append(action('Edit', 'secondary', () => edit(tool)), action('↑', 'secondary', () => move(index, -1)), action('↓', 'secondary', () => move(index, 1)), action('Remove', 'danger', () => remove(tool))); card.append(info, actions); list.append(card); }); }
    async function load() { const data = await api('/tools'); tools = Array.isArray(data.tools) ? data.tools : []; render(); }
    function edit(tool) { editingId = tool.id; $('#form-title').textContent = 'Edit ' + tool.name; $('#save').textContent = 'Save changes'; $('#cancel').classList.remove('hidden'); $('#name').value = tool.name; $('#url').value = tool.url; $('#logo').value = tool.logoUrl || ''; $('#description').value = tool.description || ''; $('#placement').value = tool.placement; $('#enabled').checked = Boolean(tool.enabled); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    async function move(index, direction) { const other = index + direction; if (other < 0 || other >= tools.length) return; const next = tools.slice(); const temp = next[index]; next[index] = next[other]; next[other] = temp; await api('/tools/reorder', { method: 'POST', headers: headers(true), body: JSON.stringify({ tools: next.map((tool, position) => ({ id: tool.id, position: (position + 1) * 10 })) }) }); tools = next; render(); show('Tool order saved.', 'success'); }
    async function remove(tool) { if (!confirm('Permanently remove "' + tool.name + '"?')) return; try { await api('/tools/' + encodeURIComponent(tool.id), { method: 'DELETE' }); show('Tool removed.', 'success'); await load(); } catch (error) { show(error.message, 'error'); } }
    $('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const button = event.submitter; button.disabled = true; try { const password = $('#password').value; const data = await api('/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) }); token = data.token; localStorage.setItem(tokenKey, token); $('#password').value = ''; $('#login-panel').classList.add('hidden'); $('#manager').classList.remove('hidden'); await load(); show('Owner login successful.', 'success'); } catch (error) { show(error.message || 'Login failed. Try again.', 'error'); } finally { button.disabled = false; } });
    $('#tool-form').addEventListener('submit', async (event) => { event.preventDefault(); const button = $('#save'); button.disabled = true; const payload = { name: $('#name').value, url: $('#url').value, logoUrl: $('#logo').value, description: $('#description').value, placement: $('#placement').value, enabled: $('#enabled').checked }; try { await api(editingId ? '/tools/' + encodeURIComponent(editingId) : '/tools', { method: 'POST', headers: headers(true), body: JSON.stringify(payload) }); show(editingId ? 'Tool updated.' : 'Tool added.', 'success'); resetForm(); await load(); } catch (error) { show(error.message, 'error'); } finally { button.disabled = false; } });
    $('#cancel').addEventListener('click', resetForm);
    if (token) { $('#login-panel').classList.add('hidden'); $('#manager').classList.remove('hidden'); load().catch(() => { localStorage.removeItem(tokenKey); token = ''; $('#login-panel').classList.remove('hidden'); $('#manager').classList.add('hidden'); show('Your owner session expired. Please log in again.', 'error'); }); }
  </script>
</body></html>`;
}
