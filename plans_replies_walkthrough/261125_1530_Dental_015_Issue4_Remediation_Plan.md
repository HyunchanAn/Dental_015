# [ 261125 1530 랩탑 개발팀 ] (Dental_015#4 HiTL 무결성 게이트 복구, 임상 UI 수정 및 API/README 정합화 계획서)

## 1. 대상 이슈 및 위치

- 대상 이슈: [Dental_015#4](https://github.com/HyunchanAn/Dental_015/issues/4) (`[P0][보안/임상] HiTL SHA-256 무결성 검증 우회, DICOM 렌더링 실패, 매복치 오표시 및 API/README 정합화`)
- 상위 Umbrella: [Dental_000#18](https://github.com/HyunchanAn/Dental_000/issues/18) (`Dental_000/plans_replies_walkthrough/261125_1530_Dental_Series_Remediation_Umbrella_Plan.md` Track 3)
- 선행 연계: `Dental_Panoramic_Reader#22` (API 응답 스키마·CORS 정합화), `Dental_Core#7` (HiTL 스키마)

---

## 2. 즉시 실행 가능 작업 (`[READY]`)

### 2.1 [보안 P0] HiTL SHA-256 무결성 검증 우회 제거
- 대상 파일: `src/utils/hitlLogic.mjs:175` (`hydrateReportFromHiTLGolden`), `src/App.tsx:351-354`
- 작업 내용:
  - 임포트된 HiTL JSON의 원본 `sha256_hash`를 `overrideSha256`로 덮어쓰는 로직을 제거하여, 타 환자 영상과 불일치하는 HiTL 파일 로드를 차단하는 무결성 게이트 복구.
  - 불일치 차단 단위 테스트 추가.

### 2.2 [임상 UI 버그 P0] 매복치 오표시 및 저신뢰도 우식 박스 노출 수정
- `src/App.tsx:376-409`: `odontogram` `switch`문에 `case 'Impacted'`를 추가하고 폴백 로직에 `impactedTeeth` 검사를 반영하여 매복치가 `Sound`(녹색)로 오표시되는 버그 수정.
- `src/components/PanoramaCanvasViewer.tsx:596-603,678-681`: 우식 확정 기준을 현행 백엔드/범례 기준(`0.45`)으로 1차 통일하고, `< 0.25` 저신뢰도 박스가 `isSuspected` 가드를 통과해 상시 노출되는 버그 수정.

### 2.3 [치주 게이트·API·HiTL 동기화 및 README 현행화]
- `src/App.tsx:781-867`, `src/types/finalReport.ts:146-155`: 임상정보 입력 폼에 `hba1cPercent` 필드 추가 및 `PeriodontalRiskAssessment.hallucinationGuardBlockedClaims` 타입·UI 표시 반영.
- `src/api/client.ts`: `GET /api/v1/hitl/{document_id}` 연동 메서드 추가.
- `src/App.tsx:79-89`: 초기 `9/9 ONLINE` 하드코딩 제거(실제 `/api/v1/health` 응답 기반 표시).
- `src/utils/hitlLogic.mjs:362-385`, `hitlLogic.d.ts`: `toggleToothRestorationTag`의 `supernumeraryTeeth`/`restorations` 동기화 및 `findContainingToothFdi` 타입 선언 추가.
- `README.md`: `8개 모듈(8/8)` -> `9개 모듈(Dental_011 포함)`, 파일 트리(`hitlLogic.mjs` 등), 테스트 건수(`2 -> 3+ passed`) 및 CI 배지 현행화.

---

## 3. `[FREEZE]` 보류 항목 (치과의사 임상 판단 및 오너 승인 필요)

| 항목 | 상태 | 동결 사유 및 역할 |
| :--- | :--- | :--- |
| `src/App.tsx:173,872` & `PanoramaCanvasViewer.tsx:826-835` `.dcm`/`.dicom` 브라우저 렌더링 방식 결정 | `[FREEZE / 오너 승인 필요]` | 브라우저 `new Image()`는 DICOM을 직접 디코딩할 수 없음. (안 1) `Dental_Panoramic_Reader` 서버가 PHI 메타데이터 제거 후 생성한 프리뷰 이미지(PNG/base64)를 수신해 표시, (안 2) 프론트엔드에 클라이언트 DICOM 디코더 라이브러리(`dicom-parser` 등) 추가. PHI 보안 정책과 프론트엔드 독립성 중 채택할 방식을 오너(안현찬)가 승인해야 함. |
| 우식 확정(`0.45`)/의심(`0.25`) 신뢰도 컷오프 및 `hba1cPercent`/치주 위험도 차단 안내 문구 최종 검수 | `[FREEZE / 임상 판단 필요]` | 코드 불일치 해소(1차 `0.45`/`0.25` 정렬 및 입력 필드 추가)는 선행 가능하나, 실제 판독 UI의 임상 컷오프 기준과 치주 위험도 안내 문구 적정성은 치과의사(안현찬)가 직접 검토·확정해야 함. |

---

## 4. 검증 기준

- `npm test` (SHA-256 불일치 차단, 매복치 odontogram 매핑, 저신뢰도 `< 0.25` 숨김, `toggleToothRestorationTag` 동기화 테스트) 및 `npm run build` 통과.
- 원격 GitHub Actions CI 통과 확인.
