'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SectorRS {
  name: string;
  rs_score: number;
}

function rsColor(score: number) {
  if (score >= 70) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
  if (score >= 55) return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
  if (score >= 40) return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
  return 'bg-red-500/20 text-red-400 border-red-500/40';
}

export function LeadingSectorBar() {
  const [sectors, setSectors] = useState<SectorRS[]>([]);

  useEffect(() => {
    getDoc(doc(db, 'reports', 'latest')).then(snap => {
      if (!snap.exists()) return;
      const raw = snap.data()?.sectors ?? {};
      const list: SectorRS[] = Object.entries(raw)
        .map(([name, v]: [string, unknown]) => ({
          name,
          rs_score: (v as { rs_score?: number }).rs_score ?? 50,
        }))
        .sort((a, b) => b.rs_score - a.rs_score);
      setSectors(list);
    });
  }, []);

  if (!sectors.length) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {sectors.map(s => (
        <span
          key={s.name}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${rsColor(s.rs_score)}`}
        >
          {s.name}
          <span className="opacity-70">{s.rs_score.toFixed(0)}</span>
        </span>
      ))}
    </div>
  );
}
