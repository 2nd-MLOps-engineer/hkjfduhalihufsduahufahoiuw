# 시설 데이터 보완과 운동 추천 코드

## 1. 빈 값 확인·크롤링 코드

실행 파일은 [enrich_facilities.py](frontend/management/commands/enrich_facilities.py)입니다.

기본 실행은 DB를 변경하지 않고 리포트만 생성합니다.

```bash
.venv/bin/python manage.py enrich_facilities --limit 100
```

생성 파일:

- `output/facility_enrichment/report_*.json`
- `output/facility_enrichment/report_*.csv`

동작 순서:

```text
facility_processed의 빈 필드 조회
→ 시설명·주소로 카카오 장소 검색
→ 공개 페이지의 robots.txt 확인
→ BeautifulSoup으로 운영 관련 문구 확인
→ 빈 주소·시설 유형에 대한 보완 후보를 리포트에 기록
```

확인된 주소·시설 유형만 DB에 반영하려면 명시적으로 다음 옵션을 사용합니다.

```bash
.venv/bin/python manage.py enrich_facilities --limit 100 --apply
```

## 2. 추천 코드

추천 핵심 코드는 [recommendation_service.py](frontend/recommendation_service.py)의 `make_recommendations()`입니다.

```text
PostgreSQL 시설 조회
→ 현재 위치 또는 지역 기준 거리 계산
→ 선택 운동 종목 필터
→ 날씨·습도·강수·풍속·PM10·PM2.5 반영
→ 거리와 환경 점수 계산
→ 결과가 없을 때만 카카오 장소 검색 fallback
→ 점수순·거리순 추천
```

웹 요청 연결부는 [live_recommendations.py](frontend/live_recommendations.py)입니다.

## 3. 추천 시점의 최신 휴무 확인

추천 결과 상위 후보는 [recommendation_service.py](frontend/recommendation_service.py)의
`_attach_live_operation_evidence()`가 추천 요청마다 공개 운영정보를 다시 확인합니다.

```text
추천 후보 계산
→ 상위 후보의 공개 페이지 URL 확인
→ robots.txt 확인
→ 공개 HTML에서 휴무·휴관·운영시간 문구 추출
→ 추천 카드에 운영정보 표시
→ 오늘 휴무·임시 휴관이면 점수 감점
```

최신 확인 결과는 현재 추천 응답에만 사용하며 DB에는 저장하지 않습니다. 공개 페이지가 없거나 robots 정책상 접근할 수 없는 시설은 `확인 필요` 상태로 남습니다.
