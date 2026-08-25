![Status](https://img.shields.io/badge/Status-v0.1.0%20Init-brightgreen "Status") ![React](https://img.shields.io/badge/React-18.3%2B-blue "React") ![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue "TypeScript") ![Vite](https://img.shields.io/badge/Vite-5.0%2B-purple "Vite") ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4%2B-06B6D4 "TailwindCSS")

# Dental_015: Clinical AI Frontend Web Platform

## 개요
Dental_015 모듈은 Dental 마이크로서비스 아키텍처(Dental_001 ~ Dental_014 및 Dental_Panoramic_Reader)의 진단 분석 결과를 시각화하고 통합 관리하는 전용 웹 프론트엔드 플랫폼입니다.

기존 Streamlit 기반 UI 환경을 임상 프로덕션 웹 환경으로 확장하기 위해 Vite, React, TypeScript, TailwindCSS를 기반으로 구축되었습니다.

## 주요 기능
- MSA 백엔드 API 통합 통신 래퍼 (`src/api/client.ts`)
- 반응형 및 다크모드 임상 대시보드 UI
- 덴탈 파노라마 분석 결과 시각화 및 멀티 모듈 결과 합성 화면 제공 예정

## 프로젝트 구조
```
Dental_015/
├── src/
│   ├── api/          # MSA 게이트웨이 및 API 클라이언트
│   ├── types/        # TypeScript 타입 정의
│   ├── App.tsx       # 메인 애플리케이션 컴포넌트
│   ├── main.tsx      # 애플리케이션 진입점
│   └── index.css     # TailwindCSS 스타일 정의
├── public/           # 정적 에셋
├── index.html        # HTML 템플릿
├── package.json      # 프로젝트 의존성
├── tsconfig.json     # TypeScript 설정
├── vite.config.ts    # Vite 빌드 설정
└── README.md
```

## 설치 및 실행 방법

### 개발 환경 필수 조건
- Node.js v18.0.0 이상
- npm v9.0.0 이상

### 1. 패키지 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

### 3. 프로덕션 빌드
```bash
npm run build
```

## 테스트 및 QA 관리
본 모듈의 E2E 및 통합 품질 검증은 중앙 QA 저장소인 `Dental_000` 파이프라인과 연동되어 수행됩니다.
