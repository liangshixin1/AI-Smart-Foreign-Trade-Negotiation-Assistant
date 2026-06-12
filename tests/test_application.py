"""应用内核的契约测试。"""

from __future__ import annotations

import unittest

from negotiation_assistant import AppSettings, create_app


class ApplicationFactoryTestCase(unittest.TestCase):
    def setUp(self) -> None:
        settings = AppSettings(environment="test", testing=True, secret_key="test")
        self.app = create_app(settings, run_startup=False)
        self.client = self.app.test_client()

    def test_health_endpoint_does_not_require_external_services(self) -> None:
        response = self.client.get("/api/system/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")
        self.assertEqual(response.get_json()["environment"], "test")

    def test_unknown_route_returns_json_error(self) -> None:
        response = self.client.get("/api/not-found")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.content_type, "application/json")
        self.assertEqual(response.get_json()["error"], "Not Found")

    def test_business_blueprints_are_registered(self) -> None:
        rules = {rule.rule for rule in self.app.url_map.iter_rules()}

        self.assertIn("/api/login", rules)
        self.assertIn("/api/system/health", rules)
        self.assertIn("/modern/", rules)


if __name__ == "__main__":
    unittest.main()
