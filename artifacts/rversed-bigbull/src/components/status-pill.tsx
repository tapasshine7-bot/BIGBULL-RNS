import { Check, CircleDashed, TriangleAlert, X } from 'lucide-react';
import type { PartnerToolStatus } from '@workspace/api-client-react';

const labels: Record<PartnerToolStatus, string> = {
  online: 'ONLINE',
  checking: 'CHECKING',
  warning: 'DEGRADED',
  offline: 'OFFLINE',
};

export function StatusPill({ status }: { status: PartnerToolStatus }) {
  const Icon = status === 'online' ? Check : status === 'checking' ? CircleDashed : status === 'warning' ? TriangleAlert : X;
  const tones = {
    online: 'border-accent/30 bg-accent/10 text-accent',
    checking: 'border-primary/30 bg-primary/10 text-primary',
    warning: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
    offline: 'border-destructive/30 bg-destructive/10 text-red-300',
  };
  return (
    <span className={`text-mono inline-flex items-center gap-1.5 border px-2 py-1 text-[9px] tracking-[.16em] ${tones[status]}`} data-testid={`status-tool-${status}`}>
      <Icon size={11} className={status === 'checking' ? 'spin-slow' : ''} />
      {labels[status]}
    </span>
  );
}