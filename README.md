![Status](https://img.shields.io/badge/Status-v1.0.0%20Release-brightgreen "Status") ![React](https://img.shields.io/badge/React-18.3%2B-blue "React") ![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue "TypeScript") ![Vite](https://img.shields.io/badge/Vite-5.0%2B-purple "Vite") ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4%2B-06B6D4 "TailwindCSS") ![License](https://img.shields.io/badge/License-MIT-green "License")

# Dental_015: Interactive Clinical Dashboard & Panorama Overlay Viewer

## 개요
`Dental_015` 모듈은 Dental 마이크로서비스 아키텍처(`Dental_001` ~ `Dental_014` 및 `Dental_Panoramic_Reader`)의 진단 분석 결과를 시각화하고 통합 관리하는 전용 임상 웹 프론트엔드 플랫폼입니다.
Vite, React, TypeScript, TailwindCSS를 기반으로 구축되었으며, 실추론 결과와 데모 데이터를 명확히 분리하고 이미지 무결성(SHA-256) 검증 및 치아 FDI 번호 수동 보정 인터페이스를 제공합니다.

## 주요 기능
- [초기 빈 리포트 시작 및 명시적 DEMO 모드 분리 (`isDemoMode`)]:
  - 앱 초기 구동 시 고정 목업 데이터를 실추론 결과처럼 자동 표시하지 않으며, 빈 리포트(`emptyReport`) 상태로 시작합니다.
  - `[데모 불러오기 (Load Demo)]` 및 `[데모 리포트 초기화 / 비우기]` 토글을 제공하며, 데모 모드 활성화 시 캔버스 상단에 고정 경고 배너(`DEMO DATA — 실제 환자 판독 결과가 아닌 데모 화면입니다`)와 호박색(Amber) 경계선을 상시 렌더링합니다.
- [SHA-256 해시 불일치 방어 게이트 (`crypto.subtle.digest`)]:
  - 사용자가 파노라마 영상 파일을 선택할 때 브라우저 내 `crypto.subtle.digest('SHA-256', buffer)`로 즉시 해시를 계산합니다.
  - 현재 로드된 이미지의 SHA-256 해시와 리포트 메타데이터(`imageMetadata.sha256_hash`)가 일치하지 않을 경우 오버레이 렌더링을 즉시 차단하고 해시 불일치 경고를 표시합니다.
- [불확실(`uncertain`) 치아 FDI 수동 보정 UI]:
  - 검출된 치아 목록 및 `uncertain: true` 알림 패널에서 임상의가 개별 치아를 클릭하여 FDI 번호(`11`~`48`)를 직접 수정할 수 있으며, 수정 시 `uncertain: false`, `clinicianCorrected: true` 상태 및 보정 배지(`✓#FDI`)가 즉시 반영됩니다.
- [32치아 FDI 오돈토그램 및 치료 우선순위 큐 (`ClinicalSynthesis`)]:
  - 우식(002), 치조골 소실(003), 치아 식별(008), 매복치(009), 결손치(010), 치근단 병소(012), 수복물(013), 골다공증 스크리닝(014) 결과를 통합 시각화합니다.

## 프로젝트 구조
```text
Dental_015/
├── src/
│   ├── api/          # MSA 게이트웨이 및 API 클라이언트 (client.ts)
│   ├── components/   # 파노라마 캔버스 뷰어 (PanoramaCanvasViewer.tsx)
│   ├── mocks/        # 데모 전용 샘플 리포트 (mockFinalReport.ts)
│   ├── types/        # TypeScript 리포트 스키마 정의 (finalReport.ts)
│   ├── App.tsx       # 메인 임상 대시보드 및 FDI 수동 보정 컴포넌트
│   ├── main.tsx      # 애플리케이션 진입점
│   └── index.css     # TailwindCSS 스타일 정의
├── public/           # 정적 에셋 (sample_panorama.png)
├── LICENSE           # MIT 라이선스
├── package.json      # 프로젝트 의존성
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

## 샘플 에셋 출처 및 라이선스 (Sample Asset Attribution & License)
- [샘플 파노라마 영상 (`public/sample_panorama.png`)]:
  - 출처: DENTEX Challenge Public Dataset Sample (치과 파노라마 방사선 공개 벤치마크 샘플).
  - 에셋 라이선스: `CC BY-NC-SA 4.0` (비영리·연구 시연 목적).
- [소스 코드 라이선스]:
  - 본 저장소의 모든 프론트엔드 소스 코드는 MIT License 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하십시오.
