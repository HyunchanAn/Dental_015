# [ 261125 1709 랩탑 개발팀 ] (목요일 20:00 체어사이드 UAT·좌표계 검증 및 HF 배포 결정 계획서)

## 1. 일정 및 목적

- 예정 일시: 2026-11-26 (목) 20:00 KST
- 수행 주체: 안현찬 (치과의사 / 프로젝트 총괄) + 랩탑 개발팀
- 목적:
  1. `Dental_015` 프론트엔드와 `Dental_Panoramic_Reader` 백엔드 간 실제 파노라마·DICOM 영상 기반 좌표계 정합성 및 신규 임상 UI(`015#4`, `Reader#21/#22`) 육안 검증(UAT).
  2. UAT 통과 확인 후 보류 중인 [Dental_Panoramic_Reader#15](https://github.com/HyunchanAn/Dental_Panoramic_Reader/issues/15) (비공개 Hugging Face Space 실배포) 착수 여부 최종 결정.

---

## 2. UAT 실행 환경 기동 절차

### 2.1 백엔드 (`Dental_Panoramic_Reader`, 포트 `8000`)
```powershell
cd d:\Github\Dental_Panoramic_Reader
$env:DPR_API_TOKEN = "local-uat-token"
uvicorn api_server:app --host 127.0.0.1 --port 8000
```
- 확인: `http://127.0.0.1:8000/api/v1/health` 에서 모듈 로드 상태(`configured`, `loaded`, `ready`) 확인.

### 2.2 프론트엔드 (`Dental_015`, 포트 `3000` 또는 `5173`)
```powershell
cd d:\Github\Dental_015
npm run dev
```
- 브라우저에서 접속 후 좌측 상단 API 토큰 입력 또는 `localStorage.setItem('DPR_API_TOKEN', 'local-uat-token')` 설정.

---

## 3. 체어사이드 육안 검증 체크리스트 (5단계)

- [ ] [1. 레터박스 및 좌표계 정합성]:
  - 일반 파노라마(PNG/JPG) 및 데모(`sample_panorama.png`)에서 치아(`008`), 수복물(`013`), 매복치(`009`), 우식(`002`), 치조골 소실(`003`), 정중선(`midline_x`) 오버레이가 실제 해부학적 위치와 밀림 없이 일치하는지 확인.
  - 브라우저 창 크기 변경 및 `use_004=True` (2배 초해상화) 활성화 시에도 좌표가 어긋나지 않는지 확인.
- [ ] [2. DICOM(`.dcm`/`.dicom`) 서버 프리뷰 렌더링]:
  - `.dcm` 파일 업로드 -> `[Analyze]` 실행 후 서버가 반환한 `previewImageDataUrl`이 캔버스에 정상 출력되고, 오버레이 좌표 및 SHA-256 해시 게이트가 정상 통과하는지 확인.
- [ ] [3. 신규 임상 UI 및 컷오프 검수]:
  - 매복치(`#18/#28/#38/#48`)가 오돈토그램에서 `Impacted`(주황색)로 정상 표기되는지 확인 (`Sound` 녹색 오표시 해소 검증).
  - 우식 확정(`>= 0.45`) / 의심(`0.25 ~ 0.45`, 토글 제어) / 저신뢰도(`< 0.25` 상시 숨김) 동작 확인.
  - `hba1cPercent` 입력 및 치주 위험도 게이트(`hallucinationGuardBlockedClaims`) 표출 확인.
- [ ] [4. HiTL 편집 및 SHA-256 무결성 차단 게이트]:
  - 캔버스에서 치아/우식 박스 이동·리사이즈 -> Golden JSON 내보내기 -> 다른 파노라마 이미지가 선택된 상태에서 해당 JSON 재임포트 시 `[BLOCKED] 이미지 해시(SHA-256) 불일치` 차단이 정상 작동하는지 확인.
- [ ] [5. 배포 착수 결정 (`Dental_Panoramic_Reader#15`)]:
  - 위 1~4번 항목 이상 없음 확인 시 `Dental_Panoramic_Reader/plans_replies_walkthrough/261124_1624_HF_Private_Space_Token_and_Deploy_Runbook.md` 절차에 따라 비공개 HF Space 배포 진행.

---

## 4. 사전 참고사항

- `Dental_002`, `Dental_006`, `Dental_008` 로컬 폴더는 기존 `.git` 손상/미동기화 이력이 있으므로, 추후 해당 모듈 코드를 수정할 일이 생기면 `origin/main` 기준으로 재동기화한 뒤 작업할 것.
