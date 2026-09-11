import asyncio

import httpx

from app.main import app


def test_cookie_authenticated_state_change_requires_csrf_token():
    async def exercise():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            rejected = await client.post(
                "/api/auth/logout",
                cookies={"genieai_session": "not-a-real-token"},
            )
            assert rejected.status_code == 403
            assert rejected.json()["detail"] == "CSRF_VALIDATION_FAILED"

            accepted = await client.post(
                "/api/auth/logout",
                cookies={"genieai_session": "not-a-real-token", "genieai_csrf": "csrf-value"},
                headers={"X-CSRF-Token": "csrf-value"},
            )
            assert accepted.status_code == 204

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(exercise())
