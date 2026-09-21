"""지역 연결 테스트만을 위한 가상 시설 목록. 실제 시설/공공데이터가 아닙니다."""
from copy import deepcopy

AGE_GROUPS = ("10s", "20s", "30s", "40s", "50s", "60_plus")
SPORTS = ("RUNNING", "SWIMMING", "BADMINTON")

# sample_id, city, fictional facility name, sport, fictional program, permitted groups
_ROWS = [
    (101, "서울특별시", "[샘플] 서울 러닝공원", "RUNNING", "전 연령대 러닝 예시", AGE_GROUPS),
    (102, "서울특별시", "[샘플] 서울 수영센터", "SWIMMING", "전 연령대 수영 예시", AGE_GROUPS),
    (103, "서울특별시", "[샘플] 서울 체육관", "BADMINTON", "전 연령대 배드민턴 예시", AGE_GROUPS),
    (104, "서울특별시", "[샘플] 서울 청소년 운동장", "RUNNING", "10대 대상 프로그램 예시", ("10s",)),
    (105, "서울특별시", "[샘플] 서울 생활체육관", "BADMINTON", "60대 이상 대상 프로그램 예시", ("60_plus",)),
    (201, "부산광역시", "[샘플] 부산 러닝공원", "RUNNING", "전 연령대 러닝 예시", AGE_GROUPS),
    (202, "부산광역시", "[샘플] 부산 수영센터", "SWIMMING", "전 연령대 수영 예시", AGE_GROUPS),
    (203, "부산광역시", "[샘플] 부산 체육관", "BADMINTON", "전 연령대 배드민턴 예시", AGE_GROUPS),
    (301, "경기도 수원시", "[샘플] 수원 러닝공원", "RUNNING", "전 연령대 러닝 예시", AGE_GROUPS),
    (302, "경기도 수원시", "[샘플] 수원 수영센터", "SWIMMING", "전 연령대 수영 예시", AGE_GROUPS),
    (303, "경기도 수원시", "[샘플] 수원 체육관", "BADMINTON", "전 연령대 배드민턴 예시", AGE_GROUPS),
]

def select_demo_facilities(profile, sports):
    """서버에서 지역과 샘플 프로그램 대상만 비교합니다. 추천 점수는 계산하지 않습니다."""
    result = []
    for sample_id, city, name, sport, program, groups in _ROWS:
        if city != profile["city"]:
            continue
        if sport not in sports:
            continue
        if profile["age_group"] not in groups:
            continue
        result.append({
            "facility_id": sample_id,
            "facility_name": name,
            "city": city,
            "sport": sport,
            "program_name": program,
            "eligible_age_groups": list(groups),
            "status": "CHECK_REQUIRED",
            "score": None,
            "travel_minutes": None,
            "exercise_minutes": None,
            "reasons": [
                "프로필에 저장한 지역과 같은 지역의 샘플입니다.",
                "선택한 종목과 샘플 프로그램 대상 나이대가 맞습니다.",
            ],
            "warnings": [
                "실제 시설이 아닌 기능 확인용 가상 데이터입니다.",
                "운영시간·잔여석·안전·날씨·대기질은 확인하지 않았습니다.",
                "이동시간과 실제 운동 가능시간은 아직 계산하지 않습니다.",
            ],
        })
    # 빈 지역이라고 다른 지역 자료를 대체 반환하지 않습니다.
    return deepcopy(result)
