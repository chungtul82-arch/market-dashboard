# 한국 섹터 히트맵 — 설정 가이드

## 전체 구조

```
market-dashboard/
├── collector/   # Python 수집기 (내 PC에서 실행)
└── dashboard/   # Next.js 웹앱 (Vercel 배포)
```

---

## 1. Firebase 설정

### 1-1. 프로젝트 생성
1. [console.firebase.google.com](https://console.firebase.google.com) 접속
2. **프로젝트 추가** → 프로젝트 이름 입력 (예: `market-dashboard`)
3. Google Analytics: 비활성화 권장

### 1-2. Firestore Database 활성화
1. 좌측 메뉴 **Firestore Database** → **데이터베이스 만들기**
2. 위치: `asia-northeast3 (Seoul)` 선택
3. 보안 규칙: **프로덕션 모드** 선택 (아래 규칙 별도 설정)

### 1-3. Firestore 보안 규칙
Firebase 콘솔 → Firestore → **규칙** 탭에 붙여넣기:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reports/{docId} {
      allow read: if true;    // 웹 대시보드 공개 읽기
      allow write: if false;  // 서비스 계정만 쓰기 (Admin SDK)
    }
  }
}
```

### 1-4. 서비스 계정 키 생성 (수집기용)
1. Firebase 콘솔 → **프로젝트 설정** (⚙️) → **서비스 계정** 탭
2. **새 비공개 키 생성** → JSON 다운로드
3. 파일명을 `firebase-key.json` 으로 변경 후 `collector/` 폴더에 저장

```
collector/
└── firebase-key.json   ← 여기에 저장 (절대 Git 커밋 금지!)
```

### 1-5. 웹 앱 등록 (대시보드용)
1. Firebase 콘솔 → **프로젝트 설정** → **일반** 탭
2. **내 앱** 섹션 → 웹 아이콘(`</>`) 클릭
3. 앱 등록 후 **SDK 설정 및 구성** 값 복사

---

## 2. Python 수집기 설정

### 2-1. 의존성 설치

```bash
cd market-dashboard/collector
pip install -r requirements.txt
```

### 2-2. 환경변수 설정

`collector/.env` 파일 생성 후 입력:

```env
TELEGRAM_BOT_TOKEN=8301921027:AAElzWo9-1S1TcwjN6UrWJmotCRGO5czVA4
TELEGRAM_CHAT_ID=         # @userinfobot 에서 /start 후 확인
DASHBOARD_URL=            # Vercel 배포 후 입력
FIREBASE_PROJECT_ID=      # Firebase 콘솔 프로젝트 ID
```

> Telegram CHAT_ID 확인 방법: [@userinfobot](https://t.me/userinfobot) 에 `/start` 전송

### 2-3. 즉시 실행 (테스트)

```bash
cd collector
python main.py --now
```

### 2-4. 자동 스케줄러 실행 (평일 08:00 KST)

```bash
# 포그라운드
python scheduler.py

# 백그라운드 (macOS/Linux)
nohup python scheduler.py > scheduler.log 2>&1 &
```

---

## 3. Next.js 대시보드 설정

### 3-1. 의존성 설치

```bash
cd market-dashboard/dashboard
npm install
```

### 3-2. 환경변수 설정

`dashboard/.env.local` 파일에 Firebase 웹 앱 설정값 입력:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### 3-3. 로컬 테스트

```bash
# 수집기 먼저 실행 (Firebase에 데이터 업로드)
cd collector && python main.py --now

# 대시보드 로컬 실행
cd dashboard && npm run dev
# → http://localhost:3000 에서 확인
```

---

## 4. Vercel 배포

### 4-1. GitHub 연동

```bash
# dashboard/ 폴더를 별도 GitHub 레포로 push
cd market-dashboard/dashboard
git init
git add .
git commit -m "init dashboard"
git remote add origin https://github.com/YOUR_REPO/market-dashboard.git
git push -u origin main
```

### 4-2. Vercel 배포
1. [vercel.com](https://vercel.com) → **New Project** → GitHub 레포 선택
2. **Root Directory**: `dashboard` 또는 레포 루트 설정
3. **Environment Variables** 탭에 `.env.local` 값 입력
4. **Deploy** 클릭

### 4-3. 배포 완료 후
1. Vercel에서 발급된 URL 복사 (예: `https://market-dashboard-xxx.vercel.app`)
2. `collector/.env` 의 `DASHBOARD_URL` 에 입력
3. 텔레그램 알림에 대시보드 링크가 자동 포함됨

---

## 5. .gitignore 설정

```gitignore
# 민감한 파일
collector/firebase-key.json
collector/.env
dashboard/.env.local

# 빌드 결과물
dashboard/.next/
dashboard/node_modules/
__pycache__/
*.pyc
```

---

## 6. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| Firebase 업로드 실패 | `firebase-key.json` 경로 오류 | `FIREBASE_CREDENTIAL_PATH` 확인 |
| 대시보드 데이터 없음 | 수집기 미실행 | `python main.py --now` 실행 |
| 텔레그램 미발송 | `CHAT_ID` 미입력 | `.env` 파일 확인 |
| yfinance 데이터 없음 | 장 마감 전 실행 | 장 마감 후 (15:30 KST) 실행 권장 |
| pykrx 오류 | 미설치 또는 API 오류 | 외국인 순매수 없이 계속 진행됨 |
