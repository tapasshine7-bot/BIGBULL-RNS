import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import {
  adminCreateManagedTool,
  adminDeleteManagedTool,
  adminReorderManagedTools,
  adminUpdateManagedTool,
  type AdminManagedTool,
  type ManagedToolInput,
} from '@/lib/admin';

const emptyDraft = (): ManagedToolInput => ({
  name: '',
  url: '',
  logoUrl: '',
  description: '',
  placement: 'vip',
  enabled: true,
});

type Props = {
  tools: AdminManagedTool[];
  onChanged: () => Promise<void> | void;
  onNotice: (message: string) => void;
};

export function ToolManagerPanel({ tools, onChanged, onNotice }: Props) {
  const [draft, setDraft] = useState<ManagedToolInput>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ordered = useMemo(() => [...tools].sort((a, b) => a.placement.localeCompare(b.placement) || a.position - b.position || a.name.localeCompare(b.name)), [tools]);

  function update<K extends keyof ManagedToolInput>(key: K, value: ManagedToolInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function edit(tool: AdminManagedTool) {
    setEditingId(tool.id);
    setDraft({ name: tool.name, url: tool.url, logoUrl: tool.logoUrl ?? '', description: tool.description, placement: tool.placement, enabled: tool.enabled });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy('save');
    try {
      const result = editingId ? await adminUpdateManagedTool(editingId, draft) : await adminCreateManagedTool(draft);
      if (result.ok) {
        onNotice(editingId ? 'Tool updated and placed on the selected dashboard.' : 'Tool published in the selected dashboard.');
        cancelEdit();
        await onChanged();
      } else {
        onNotice(result.error ?? 'Tool could not be saved.');
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(tool: AdminManagedTool) {
    if (!window.confirm(`Remove ${tool.name}? This removes the public card.`)) return;
    setBusy(`remove-${tool.id}`);
    try {
      const result = await adminDeleteManagedTool(tool.id);
      if (result.ok) {
        onNotice(`${tool.name} was removed.`);
        if (editingId === tool.id) cancelEdit();
        await onChanged();
      } else {
        onNotice(result.error ?? 'Tool could not be removed.');
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggle(tool: AdminManagedTool) {
    setBusy(`toggle-${tool.id}`);
    try {
      const result = await adminUpdateManagedTool(tool.id, {
        name: tool.name,
        url: tool.url,
        logoUrl: tool.logoUrl ?? '',
        description: tool.description,
        placement: tool.placement,
        enabled: !tool.enabled,
      });
      if (result.ok) {
        onNotice(`${tool.name} is now ${tool.enabled ? 'hidden' : 'visible'}.`);
        await onChanged();
      } else onNotice(result.error ?? 'Visibility could not be updated.');
    } finally {
      setBusy(null);
    }
  }

  async function move(tool: AdminManagedTool, direction: -1 | 1) {
    const samePlacement = ordered.filter((entry) => entry.placement === tool.placement);
    const index = samePlacement.findIndex((entry) => entry.id === tool.id);
    const next = samePlacement[index + direction];
    if (!next) return;
    setBusy(`move-${tool.id}`);
    try {
      const result = await adminReorderManagedTools([
        { id: tool.id, position: next.position },
        { id: next.id, position: tool.position },
      ]);
      if (result.ok) await onChanged();
      else onNotice(result.error ?? 'Order could not be updated.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4" data-testid="tool-manager-panel">
      <div className="border border-accent/30 bg-accent/5 p-4">
        <p className="text-mono text-[10px] uppercase tracking-[.18em] text-accent">Owner-managed tools</p>
        <p className="mt-1 text-sm text-muted-foreground">You choose every name, approved HTTPS link, logo image URL, location, visibility, and order. The system never discovers or inserts tools itself.</p>
      </div>

      <form onSubmit={(event) => void save(event)} className="grid gap-3 border border-border bg-card/30 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center justify-between gap-3">
          <h2 className="text-mono text-xs uppercase tracking-[.16em] text-foreground">{editingId ? 'Edit tool card' : 'Add tool card'}</h2>
          {editingId ? <button type="button" onClick={cancelEdit} className="text-xs text-muted-foreground hover:text-foreground">Cancel edit</button> : null}
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">Tool name<input required value={draft.name} onChange={(event) => update('name', event.target.value)} maxLength={80} placeholder="Example: Bio Tool" className="border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent" /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">Approved website link<input required type="url" value={draft.url} onChange={(event) => update('url', event.target.value)} placeholder="https://example.com" className="border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent" /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">Logo image link <span className="text-[10px]">optional HTTPS image URL</span><input type="url" value={draft.logoUrl} onChange={(event) => update('logoUrl', event.target.value)} placeholder="https://example.com/logo.png" className="border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent" /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">Show in<select value={draft.placement} onChange={(event) => update('placement', event.target.value as ManagedToolInput['placement'])} className="border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"><option value="vip">VIP Hub</option><option value="dashboard">Normal dashboard</option></select></label>
        <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">Short description<textarea value={draft.description} onChange={(event) => update('description', event.target.value)} maxLength={240} rows={2} placeholder="What this approved tool provides" className="resize-none border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent" /></label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={draft.enabled} onChange={(event) => update('enabled', event.target.checked)} /> Visible to users</label>
        <div className="flex justify-end"><button disabled={busy === 'save'} className="flex items-center gap-2 border border-accent bg-accent px-4 py-2 text-mono text-[10px] uppercase tracking-[.14em] text-background disabled:opacity-50"><Save size={13} /> {busy === 'save' ? 'Saving…' : editingId ? 'Save tool' : 'Publish tool'}</button></div>
      </form>

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[740px] text-left text-xs">
          <thead className="bg-muted/40 text-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground"><tr><th className="p-3">Tool</th><th className="p-3">Location</th><th className="p-3">Link / logo</th><th className="p-3">Visible</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {ordered.map((tool) => <tr key={tool.id} className="border-t border-border/70"><td className="p-3"><div className="flex items-center gap-2">{tool.logoUrl ? <img src={tool.logoUrl} alt="" className="h-7 w-7 rounded object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <span className="grid h-7 w-7 place-items-center rounded bg-accent/15 text-accent">{tool.name.slice(0, 1).toUpperCase()}</span>}<div><p className="font-medium text-foreground">{tool.name}</p><p className="max-w-[180px] truncate text-muted-foreground">{tool.description || 'No description'}</p></div></div></td><td className="p-3 capitalize text-muted-foreground">{tool.placement === 'vip' ? 'VIP Hub' : 'Dashboard'}</td><td className="p-3"><a href={tool.url} target="_blank" rel="noopener noreferrer" className="max-w-[240px] truncate text-accent hover:underline block">{tool.url}</a></td><td className="p-3"><button onClick={() => void toggle(tool)} disabled={busy === `toggle-${tool.id}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">{tool.enabled ? <Eye size={14} /> : <EyeOff size={14} />}{tool.enabled ? 'Visible' : 'Hidden'}</button></td><td className="p-3"><div className="flex justify-end gap-1"><button title="Move up" disabled={busy === `move-${tool.id}`} onClick={() => void move(tool, -1)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowUp size={14} /></button><button title="Move down" disabled={busy === `move-${tool.id}`} onClick={() => void move(tool, 1)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowDown size={14} /></button><button title="Edit" onClick={() => edit(tool)} className="p-1 text-muted-foreground hover:text-accent"><Pencil size={14} /></button><button title="Remove" disabled={busy === `remove-${tool.id}`} onClick={() => void remove(tool)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button></div></td></tr>)}
            {ordered.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No tool cards yet. Add the first approved tool above.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
