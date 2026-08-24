

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" data-testid="brand-mark">
      <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-primary/50 bg-primary/10">
        <img src="/revanance-lion.png" alt="REVANANCE lion emblem" className="h-9 w-9 object-contain" />
        <span className="absolute -right-1 -top-1 h-2 w-2 bg-primary" />
      </div>
      {!compact && (
        <div>
          <div className="revanance-wordmark text-display text-[17px] font-bold uppercase leading-none tracking-[.14em] text-foreground">REVANANCE</div>
          <div className="text-mono mt-1 text-[9px] uppercase tracking-[.28em] text-primary">PLAYER GATEWAY</div>
        </div>
      )}
    </div>
  );
}
