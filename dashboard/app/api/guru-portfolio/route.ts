import { NextResponse } from 'next/server';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    // 거장 포트폴리오
    const guruSnap = await getDoc(doc(db, 'guru-portfolios', 'latest'));
    const guruData = guruSnap.exists() ? guruSnap.data() : null;

    // 내 포트폴리오 (첫 번째)
    const portfolioSnap = await getDocs(collection(db, 'portfolios'));
    const myPortfolio = portfolioSnap.empty ? null : portfolioSnap.docs[0].data();

    return NextResponse.json({ guruPortfolios: guruData, myPortfolio });
  } catch (e) {
    console.error('[guru-portfolio]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '데이터 로드 실패' },
      { status: 500 },
    );
  }
}
