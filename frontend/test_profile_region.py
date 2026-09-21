import json

from django.test import Client, TestCase, override_settings
from django.urls import reverse

from .forms import ProfileStartForm
from .profile_demo import PROFILE_SESSION_KEY


@override_settings(DEBUG=True)
class ProfileRegionTests(TestCase):
    def save_profile(self, city="서울특별시", age_group="20s"):
        session = self.client.session
        session[PROFILE_SESSION_KEY] = {
            "nickname": "운동하는감자",
            "age_group": age_group,
            "city": city,
        }
        session.save()

    def post_demo(self, **extra):
        payload = {
            "sports": ["RUNNING", "SWIMMING", "BADMINTON"],
            "available_minutes": 90,
            "max_travel_minutes": 20,
            "transport": "WALK",
            "latitude": None,
            "longitude": None,
        }
        payload.update(extra)
        return self.client.post(
            reverse("profile_demo_recommendations"),
            json.dumps(payload),
            content_type="application/json",
        )

    def test_no_profile_requires_profile(self):
        self.assertEqual(self.post_demo().status_code, 401)

    def test_seoul_has_only_seoul(self):
        self.save_profile()
        response = self.post_demo()
        self.assertEqual(response.status_code, 200)
        rows = response.json()["recommendations"]
        self.assertTrue(rows)
        self.assertTrue(all(row["city"] == "서울특별시" for row in rows))

    def test_request_cannot_override_session_city_or_age(self):
        self.save_profile()
        data = self.post_demo(city="부산광역시", age_group="60_plus").json()
        self.assertEqual(data["applied_profile"]["city"], "서울특별시")
        self.assertEqual(data["applied_profile"]["age_group"], "20s")
        self.assertNotIn(105, [row["facility_id"] for row in data["recommendations"]])

    def test_profile_change_applies_to_next_request(self):
        self.save_profile("서울특별시")
        self.post_demo()
        self.save_profile("부산광역시")
        rows = self.post_demo().json()["recommendations"]
        self.assertTrue(rows)
        self.assertTrue(all(row["city"] == "부산광역시" for row in rows))

    def test_unknown_city_does_not_fall_back_to_another_city(self):
        self.save_profile("강원특별자치도 속초시")
        self.assertEqual(self.post_demo().json()["recommendations"], [])

    def test_selected_sport_is_respected(self):
        self.save_profile()
        rows = self.post_demo(sports=["SWIMMING"]).json()["recommendations"]
        self.assertTrue(rows)
        self.assertTrue(all(row["sport"] == "SWIMMING" for row in rows))

    def test_age_filters_only_declared_sample_programs(self):
        self.save_profile(age_group="60_plus")
        rows = self.post_demo(sports=["BADMINTON"]).json()["recommendations"]
        self.assertEqual({row["facility_id"] for row in rows}, {103, 105})

    def test_no_invented_score_or_minutes(self):
        self.save_profile()
        rows = self.post_demo().json()["recommendations"]
        self.assertTrue(all(
            row["score"] is None
            and row["travel_minutes"] is None
            and row["exercise_minutes"] is None
            and row["status"] == "CHECK_REQUIRED"
            for row in rows
        ))

    def test_invalid_request_returns_error_not_empty_success(self):
        self.save_profile()
        self.assertEqual(self.post_demo(sports=[]).status_code, 400)
        self.assertEqual(self.post_demo(available_minutes=True).status_code, 400)
        self.assertEqual(self.post_demo(latitude=200, longitude=127).status_code, 400)

    def test_seoul_alias(self):
        form = ProfileStartForm({
            "nickname": "운동하는감자", "age_group": "20s", "city": "서울",
        })
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["city"], "서울특별시")

    def test_ambiguous_gwangju_is_not_guessed(self):
        form = ProfileStartForm({
            "nickname": "운동하는감자", "age_group": "20s", "city": "광주시",
        })
        self.assertFalse(form.is_valid())
        self.assertIn("city", form.errors)

    def test_get_is_not_accepted_by_demo_api(self):
        self.assertEqual(
            self.client.get(reverse("profile_demo_recommendations")).status_code,
            405,
        )

    def test_profile_is_required_for_recommend_page(self):
        self.assertRedirects(
            self.client.get(reverse("recommend")),
            reverse("login"),
            fetch_redirect_response=False,
        )

    def test_csrf_is_not_disabled(self):
        csrf_client = Client(enforce_csrf_checks=True)
        response = csrf_client.post(
            reverse("profile_demo_recommendations"),
            "{}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    @override_settings(DEBUG=False)
    def test_demo_api_is_disabled_in_production(self):
        self.save_profile()
        self.assertEqual(self.post_demo().status_code, 404)
