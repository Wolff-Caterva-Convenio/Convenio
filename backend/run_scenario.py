import random
import string
import sys
import time
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

import requests

# =========================
# CONFIG
# =========================
BASE_URL = "http://127.0.0.1:8000"

# Make it FAIL FAST instead of "stuck"
TIMEOUT_SECONDS = 5
RETRY_COUNT = 0       # set to 1 if you want a second try
RETRY_SLEEP = 0.5


# =========================
# LOGGING / HELPERS
# =========================
def log(msg: str) -> None:
    print(msg, flush=True)


def rand_email(prefix: str) -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}_{suffix}@example.com"


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def pretty_body(resp: requests.Response) -> str:
    try:
        return str(resp.json())
    except Exception:
        return resp.text


def fail(label: str, extra: str = "") -> None:
    log(f"\n❌ {label} FAILED")
    if extra:
        log(extra)
    sys.exit(1)


def assert_status(resp: requests.Response, expected: int, label: str) -> None:
    if resp.status_code != expected:
        fail(
            label,
            extra=(
                f"Status: {resp.status_code}\n"
                f"URL:    {resp.request.method} {resp.url}\n"
                f"Body:   {pretty_body(resp)}"
            ),
        )
    log(f"✅ {label}")


class Api:
    """
    Wrapper:
    - timeout on every request
    - optional retry
    - prints which request it's doing
    """
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.s = requests.Session()

    def _request(self, method: str, path: str, label: str, **kwargs) -> requests.Response:
        url = f"{self.base_url}{path}"
        last_exc: Optional[Exception] = None

        for attempt in range(RETRY_COUNT + 1):
            try:
                log(f"→ {label}: {method} {url} (attempt {attempt + 1}/{RETRY_COUNT + 1})")
                return self.s.request(method, url, timeout=TIMEOUT_SECONDS, **kwargs)
            except requests.RequestException as e:
                last_exc = e
                log(f"   ! request error: {type(e).__name__}: {e}")
                if attempt < RETRY_COUNT:
                    time.sleep(RETRY_SLEEP)
                    continue
                raise

        # Should never reach, but keep mypy happy
        raise last_exc if last_exc else RuntimeError("Unknown request error")

    def get(self, path: str, label: str, **kwargs) -> requests.Response:
        return self._request("GET", path, label=label, **kwargs)

    def post(self, path: str, label: str, **kwargs) -> requests.Response:
        return self._request("POST", path, label=label, **kwargs)

    def patch(self, path: str, label: str, **kwargs) -> requests.Response:
        return self._request("PATCH", path, label=label, **kwargs)


def preflight(api: Api) -> Dict[str, Any]:
    log("Preflight: checking backend reachability...")
    try:
        r = api.get("/docs", label="Preflight /docs")
        if r.status_code not in (200, 301, 302):
            fail("Preflight /docs", f"Unexpected status {r.status_code}\nBody: {pretty_body(r)}")
        log("✅ Preflight /docs reachable")

        r2 = api.get("/openapi.json", label="Preflight /openapi.json")
        if r2.status_code != 200:
            fail("Preflight /openapi.json", f"Unexpected status {r2.status_code}\nBody: {pretty_body(r2)}")
        log("✅ Preflight /openapi.json reachable")
        return r2.json()

    except requests.RequestException as e:
        fail(
            "Preflight connection",
            extra=(
                f"Could not reach backend at {BASE_URL}\n"
                f"Error: {type(e).__name__}: {e}\n\n"
                f"Fix:\n"
                f"1) Start backend:\n"
                f"   .\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload\n"
                f"2) Open {BASE_URL}/docs in browser.\n"
            ),
        )


def discover_auth_endpoints(openapi: Dict[str, Any]) -> Tuple[str, str]:
    """
    Tries to find likely register + login endpoints from OpenAPI.
    Falls back to /register and /login.
    """
    paths: Dict[str, Any] = openapi.get("paths", {}) or {}

    def candidates(keyword: str) -> List[str]:
        out: List[str] = []
        for path, methods in paths.items():
            if keyword.lower() in path.lower():
                if isinstance(methods, dict) and "post" in methods:
                    out.append(path)
        return out

    reg_cands = candidates("register") + candidates("signup") + candidates("sign-up")
    login_cands = candidates("login") + candidates("token") + candidates("signin") + candidates("sign-in")

    register_path = reg_cands[0] if reg_cands else "/register"
    login_path = login_cands[0] if login_cands else "/login"

    log(f"Auth discovery:")
    log(f"  register endpoint -> {register_path}")
    log(f"  login endpoint    -> {login_path}")
    return register_path, login_path


def main() -> None:
    log("Scenario starting...")
    log(f"BASE_URL = {BASE_URL}")
    api = Api(BASE_URL)

    openapi = preflight(api)
    register_path, login_path = discover_auth_endpoints(openapi)

    # --- Dates for booking ---
    check_in = date.today() + timedelta(days=7)
    check_out = date.today() + timedelta(days=10)

    # --- Create users ---
    host_email = rand_email("host")
    guest_email = rand_email("guest")
    password = "Password123!"

    log(f"Creating users:\n  host={host_email}\n  guest={guest_email}")

    # REGISTER (host)
    try:
        r = api.post(
            register_path,
            label="Register host",
            json={"email": host_email, "password": password},
        )
    except requests.RequestException as e:
        fail(
            "Register host (request)",
            extra=(
                f"Request to {register_path} failed.\n"
                f"{type(e).__name__}: {e}\n\n"
                f"Important: check the uvicorn window to see if it logged a POST {register_path}.\n"
                f"If it logged nothing, the request never reached the backend.\n"
            ),
        )
    assert_status(r, 201, "Register host")

    # REGISTER (guest)
    r = api.post(
        register_path,
        label="Register guest",
        json={"email": guest_email, "password": password},
    )
    assert_status(r, 201, "Register guest")

    # LOGIN (host)
    r = api.post(
        login_path,
        label="Login host",
        json={"email": host_email, "password": password},
    )
    assert_status(r, 200, "Login host")
    host_token = r.json().get("access_token")
    if not host_token:
        fail("Login host", f"Response missing access_token.\nBody: {pretty_body(r)}")

    # LOGIN (guest)
    r = api.post(
        login_path,
        label="Login guest",
        json={"email": guest_email, "password": password},
    )
    assert_status(r, 200, "Login guest")
    guest_token = r.json().get("access_token")
    if not guest_token:
        fail("Login guest", f"Response missing access_token.\nBody: {pretty_body(r)}")

    # --- Host creates venue (draft) ---
    venue_payload = {
        "title": "Test Venue",
        "description": "Scenario runner venue",
        "city": "Vienna",
        "capacity": 3,
        "payout_net_per_night": 5000,
    }
    r = api.post("/venues", label="Create venue", json=venue_payload, headers=auth_headers(host_token))
    assert_status(r, 201, "Create venue")
    venue = r.json()
    venue_id = venue.get("id")
    if not venue_id:
        fail("Create venue", f"Response missing id.\nBody: {pretty_body(r)}")
    log(f"   venue_id = {venue_id}")

    # --- Host sets rules (required to publish) ---
    r = api.patch(
        f"/venues/{venue_id}/rules",
        label="Set rules",
        json={"rules_and_restrictions": "No smoking. No parties."},
        headers=auth_headers(host_token),
    )
    assert_status(r, 200, "Set rules")

    # --- Publish venue ---
    r = api.post(f"/venues/{venue_id}/publish", label="Publish venue", headers=auth_headers(host_token))
    assert_status(r, 200, "Publish venue")

    # --- Host creates an availability block that does NOT overlap booking dates ---
    block_payload = {
        "start_date": str(date.today() + timedelta(days=1)),
        "end_date": str(date.today() + timedelta(days=3)),
        "reason": "Host maintenance",
    }
    r = api.post(
        f"/venues/{venue_id}/availability-blocks",
        label="Create availability block",
        json=block_payload,
        headers=auth_headers(host_token),
    )
    assert_status(r, 201, "Create availability block")

    # --- Guest searches venues in Vienna (published only) ---
    r = api.get("/venues/search", label="Search venues", params={"city": "Vienna"})
    assert_status(r, 200, "Search venues")
    results = r.json()
    if not isinstance(results, list):
        fail("Search venues", f"Expected a list.\nBody: {pretty_body(r)}")
    if not any(v.get("id") == venue_id for v in results if isinstance(v, dict)):
        fail("Search venues", "Created venue not found in search results")
    log("✅ Search venues contains our venue")

    # --- Guest books dates ---
    booking_payload = {"check_in": str(check_in), "check_out": str(check_out)}
    r = api.post(
        f"/venues/{venue_id}/bookings",
        label="Create booking",
        json=booking_payload,
        headers=auth_headers(guest_token),
    )
    assert_status(r, 201, "Create booking")
    booking = r.json()
    booking_id = booking.get("id")
    if not booking_id:
        fail("Create booking", f"Response missing id.\nBody: {pretty_body(r)}")
    log(f"   booking_id = {booking_id}")
    if "status" in booking:
        log(f"   booking_status = {booking['status']}")

    # --- Guest tries to double-book same dates (should 409) ---
    r2 = api.post(
        f"/venues/{venue_id}/bookings",
        label="Double-book attempt",
        json=booking_payload,
        headers=auth_headers(guest_token),
    )
    if r2.status_code != 409:
        fail(
            "Double-book protection",
            extra=(f"Expected 409, got {r2.status_code}\nBody: {pretty_body(r2)}"),
        )
    log("✅ Double-book protection (409)")

    # --- Guest cancels ---
    r = api.post(
        f"/venues/bookings/{booking_id}/cancel",
        label="Cancel booking",
        headers=auth_headers(guest_token),
    )
    assert_status(r, 200, "Cancel booking")
    cancelled = r.json()
    if "status" in cancelled:
        log(f"   cancelled_status = {cancelled['status']}")

    log("\n🎉 Scenario finished successfully.")


if __name__ == "__main__":
    main()