'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Holding } from '@/types';
import { ALL_SECTORS } from './PortfolioTable';

interface Props {
  holding: Holding | null;
  open: boolean;
  onClose: () => void;
  onSave: (symbol: string, updates: Partial<Holding>) => Promise<void>;
}

export function HoldingEditModal({ holding, open, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState<Partial<Holding>>({});

  function reset() { setForm({}); setSaving(false); }

  function val(key: keyof Holding): string {
    if (key in form) return String(form[key] ?? '');
    return String(holding?.[key] ?? '');
  }

  function setNum(key: keyof Holding, v: string) {
    setForm(f => ({ ...f, [key]: v === '' ? '' : parseFloat(v) }));
  }

  async function handleSave() {
    if (!holding) return;
    setSaving(true);
    try {
      const updates: Partial<Holding> = {};
      if ('name'             in form) updates.name             = form.name;
      if ('sector'           in form) updates.sector           = form.sector;
      if ('market'           in form) updates.market           = form.market as Holding['market'];
      if ('quantity'         in form) updates.quantity         = Number(form.quantity);
      if ('avgPurchasePrice' in form) updates.avgPurchasePrice = Number(form.avgPurchasePrice);
      await onSave(holding.symbol, updates);
      onClose(); reset();
    } finally {
      setSaving(false);
    }
  }

  if (!holding) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle>{holding.name || holding.symbol} 수정</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Field label="종목명">
            <input
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              value={val('name')}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </Field>

          <Field label="섹터 (업종)">
            <select
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              value={val('sector')}
              onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
            >
              <option value="">— 미지정</option>
              {ALL_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="시장">
            <select
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              value={val('market')}
              onChange={e => setForm(f => ({ ...f, market: e.target.value as Holding['market'] }))}
            >
              <option value="">— 미지정</option>
              <option value="KOSPI">KOSPI</option>
              <option value="KOSDAQ">KOSDAQ</option>
            </select>
          </Field>

          <Field label="보유 수량">
            <input
              type="number" min="0"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-num"
              value={val('quantity')}
              onChange={e => setNum('quantity', e.target.value)}
            />
          </Field>

          <Field label="평균 매수가 (원)">
            <input
              type="number" min="0"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-num"
              value={val('avgPurchasePrice')}
              onChange={e => setNum('avgPurchasePrice', e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => { onClose(); reset(); }}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}
