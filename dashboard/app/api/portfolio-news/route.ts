import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    // latest 먼저, 없으면 어제
    let snap = await getDoc(doc(db, 'portfolio-news', 'latest'));
    if (!snap.exists()) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const d = yesterday.toISOString().slice(0, 10);
      snap = await getDoc(doc(db, 'portfolio-news', d));
    }
    return NextResponse.json(snap.exists() ? snap.data() : { articles: [] });
  } catch (e) {
    console.error('[portfolio-news]', e);
    return NextResponse.json({ articles: [] });
  }
}
