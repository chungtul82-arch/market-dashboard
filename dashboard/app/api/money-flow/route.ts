import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    const snap = await getDoc(doc(db, 'money-flow', 'latest'));
    return NextResponse.json(snap.exists() ? snap.data() : null);
  } catch (e) {
    console.error('[money-flow]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '데이터 로드 실패' },
      { status: 500 },
    );
  }
}
