import { useMemo, useState } from 'react';
import { SlidersHorizontal, Gauge, RotateCcw, Target } from 'lucide-react';
import { PageHeading, QueryError, QueryLoading } from '@/components/page-kit';
import { BackButton } from '@/components/back-button';
import { computeSensitivity, getSensitivityPresets, type SensitivityPreset } from '@/lib/ff-api';
import { useEffect } from 'react';

const RAM_OPTIONS = ['2', '3', '4', '6', '8'];
const DPI_OPTIONS = ['standard', 'high'];

// Popular devices among Indian Free Fire players — brand → list of (model, RAM).
interface DeviceModel { model: string; ram: string }
const DEVICE_LIST: Record<string, DeviceModel[]> = {
  Samsung: [
    { model: 'Galaxy A14 5G', ram: '4' },
    { model: 'Galaxy A25 5G', ram: '6' },
    { model: 'Galaxy A34 5G', ram: '6' },
    { model: 'Galaxy A54 5G', ram: '8' },
    { model: 'Galaxy A55 5G', ram: '8' },
    { model: 'Galaxy S23', ram: '8' },
    { model: 'Galaxy M14 5G', ram: '4' },
  ],
  Vivo: [
    { model: 'Vivo T3x 5G', ram: '4' },
    { model: 'Vivo T3 Pro 5G', ram: '8' },
    { model: 'Vivo V29 5G', ram: '8' },
    { model: 'Vivo Y55', ram: '4' },
    { model: 'Vivo Y78 5G', ram: '6' },
  ],
  'Redmi / Xiaomi': [
    { model: 'Redmi Note 13 5G', ram: '6' },
    { model: 'Redmi Note 13 Pro 5G', ram: '8' },
    { model: 'Redmi Note 12', ram: '4' },
    { model: 'Redmi 13 5G', ram: '6' },
    { model: 'Xiaomi 12 5G', ram: '8' },
  ],
  Realme: [
    { model: 'Realme Narzo 60x', ram: '4' },
    { model: 'Realme Narzo 70 Pro', ram: '8' },
    { model: 'Realme GT Neo 5', ram: '8' },
    { model: 'Realme C65', ram: '4' },
  ],
  POCO: [
    { model: 'POCO X5 5G', ram: '6' },
    { model: 'POCO X5 Pro', ram: '8' },
    { model: 'POCO M5', ram: '4' },
    { model: 'POCO M6 Pro', ram: '8' },
  ],
  iQOO: [
    { model: 'iQOO Z7 5G', ram: '6' },
    { model: 'iQOO Z9 5G', ram: '8' },
  ],
  OPPO: [
    { model: 'OPPO A78 5G', ram: '4' },
    { model: 'OPPO A3x', ram: '4' },
    { model: 'OPPO Reno 11', ram: '8' },
  ],
  OnePlus: [
    { model: 'OnePlus Nord CE 3', ram: '8' },
    { model: 'OnePlus Nord 4', ram: '8' },
  ],
  Motorola: [
    { model: 'Moto G84 5G', ram: '8' },
    { model: 'Moto G54', ram: '8' },
  ],
  iPhone: [
    { model: 'iPhone 11', ram: '4' },
    { model: 'iPhone 12', ram: '4' },
    { model: 'iPhone 13', ram: '4' },
    { model: 'iPhone 14', ram: '6' },
    { model: 'iPhone 15', ram: '6' },
  ],
};
const BRANDS = Object.keys(DEVICE_LIST);
const SCOPE_LABELS: Record<string, string> = {
  general: 'General',
  redDot: 'Red Dot',
  scope2x: '2x Scope',
  scope4x: '4x Scope',
  awm: 'AWM',
  freeLook: 'Free Look',
  gyroGeneral: 'Gyro General',
  gyroRedDot: 'Gyro Red Dot',
  gyroScope2x: 'Gyro 2x Scope',
  gyroScope4x: 'Gyro 4x Scope',
  gyroAwm: 'Gyro AWM',
};

export function SensitivityPage() {
  const [presets, setPresets] = useState<SensitivityPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ram, setRam] = useState('4');
  const [gyro, setGyro] = useState('off');
  const [dpi, setDpi] = useState('standard');
  const [brand, setBrand] = useState('');
  const [values, setValues] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    getSensitivityPresets()
      .then((list) => {
        if (cancelled) return;
        setPresets(list);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    computeSensitivity(ram, gyro, dpi)
      .then((result) => {
        if (cancelled) return;
        setValues(result.values ?? {});
      })
      .catch(() => {
        if (cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [ram, gyro, dpi]);


  const matchedPreset = useMemo(() => {
    const hit = presets.find(
      (p) => p.ram_gb === ram && p.gyro === gyro && p.dpi === dpi,
    );
    return hit ?? presets.find((p) => p.ram_gb === ram && p.gyro === gyro) ?? null;
  }, [presets, ram, gyro, dpi]);

  const valuesToShow = matchedPreset && matchedPreset.values && Object.keys(matchedPreset.values).length > 0 ? matchedPreset.values : (values ?? {});

  function Chip({ label, selected, onClick, dataTestId }: { label: string; selected: boolean; onClick: () => void; dataTestId: string }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`border px-2.5 py-1.5 text-mono text-[9px] uppercase tracking-[.16em] transition ${
          selected ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
        }`}
        data-testid={dataTestId}
      >
        {label}
      </button>
    );
  }

  if (loading) return <QueryLoading label="LOADING SENSITIVITY PRESETS" />;
  if (error) return <QueryError onRetry={() => window.location.reload()} label="Sensitivity presets unavailable." />;

  return (
    <div className="route-in">
      {/* Back navigation for mobile users */}
      <BackButton />
      <PageHeading
        eyebrow="Free Fire utility / device optimizer"
        title="Sensitivity Finder."
        detail="Choose your device RAM, gyroscope preference and screen DPI — get curated sensitivity values instantly. Presets are community-proven recommendations; tune a little up or down to your own feel."
        action={<div className="text-mono border border-primary/30 bg-primary/10 px-3 py-2 text-[10px] uppercase tracking-wider text-primary">{presets.length} presets loaded</div>}
      />

      <section className="border border-border bg-card/60 p-5" aria-label="Device options">
        <div className="text-mono mb-3 text-[9px] uppercase tracking-[.22em] text-muted-foreground">Your device</div>
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs text-muted-foreground">Your phone (optional — RAM auto-fills)</div>
            <div className="flex flex-wrap gap-1.5">
              {BRANDS.map((b) => <Chip key={b} label={b} selected={brand === b} onClick={() => setBrand(brand === b ? '' : b)} dataTestId={`chip-brand-${b.replace(/\/ /g, '')}`} />)}
            </div>
            {brand && DEVICE_LIST[brand] && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {DEVICE_LIST[brand].map((d) => (
                  <Chip key={`${brand}-${d.model}`} label={`${d.model} (${d.ram}GB)`} selected={ram === d.ram && brand === brand} onClick={() => { setRam(d.ram); }} dataTestId={`chip-model-${d.model.replace(/ /g, '')}`} />
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-2 text-xs text-muted-foreground">RAM (GB)</div>
            <div className="flex flex-wrap gap-1.5">
              {RAM_OPTIONS.map((option) => <Chip key={option} label={`${option} GB`} selected={ram === option} onClick={() => setRam(option)} dataTestId={`chip-ram-${option}`} />)}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs text-muted-foreground">Gyroscope</div>
            <div className="flex flex-wrap gap-1.5">
              {['off', 'on'].map((option) => <Chip key={option} label={option === 'on' ? 'On / Always' : 'Off'} selected={gyro === option} onClick={() => setGyro(option)} dataTestId={`chip-gyro-${option}`} />)}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs text-muted-foreground">Screen DPI</div>
            <div className="flex flex-wrap gap-1.5">
              {DPI_OPTIONS.map((option) => <Chip key={option} label={option === 'high' ? 'High / Full HD' : 'Standard'} selected={dpi === option} onClick={() => setDpi(option)} dataTestId={`chip-dpi-${option}`} />)}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-display text-sm font-bold uppercase tracking-wide">
            <SlidersHorizontal size={13} className="text-primary" /> Your sensitivity values
          </div>
          <div className="text-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">
            {ram} GB · Gyro {gyro === 'on' ? 'on' : 'off'} · {dpi} dpi
            {matchedPreset ? ' · preset' : ' · computed'}
          </div>
        </div>
        {Object.keys(valuesToShow).length === 0 ? (
          <div className="border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">No values available for this combination.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(valuesToShow).map(([key, value]) => (
              <div key={key} className="relative overflow-hidden border border-border bg-card p-4 transition hover:border-primary/40">
                <div className="flex items-center justify-between">
                  <div className="text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground">{SCOPE_LABELS[key] ?? key}</div>
                  <RotateCcw size={11} className="text-muted-foreground/60" aria-hidden="true" />
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-display text-4xl font-bold text-foreground">{value}</span>
                  <span className="text-mono text-[9px] uppercase text-muted-foreground">/ 200</span>
                </div>
                <div className="mt-3 h-1.5 w-full bg-secondary">
                  <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${Math.min(100, Math.round((Number(value) ?? 0) / 2))}%` }} aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-5 flex items-start gap-2 border border-border bg-card/50 p-4 text-xs leading-6 text-muted-foreground">
        <Target size={15} className="mt-0.5 shrink-0 text-accent" />
        <span>Recommended values only — every player's grip and thumb speed is different. Set the values, play a ranked match, then adjust ±2–3 points until head tracking feels perfect. High-DPI screens use slightly lower numbers so the effective speed stays constant.</span>
      </div>
    </div>
  );
}
