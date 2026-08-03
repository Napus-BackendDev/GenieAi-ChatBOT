import ipaddress

from fastapi import Request

from app.core.config import settings


def get_client_ip(request: Request) -> str:
    """Resolve the first untrusted hop without accepting spoofed proxy headers."""
    peer = request.client.host if request.client else "unknown"
    if not settings.TRUST_PROXY_HEADERS:
        return peer

    try:
        networks = [
            ipaddress.ip_network(value)
            for value in settings.trusted_proxy_networks
        ]
        current = ipaddress.ip_address(peer)
    except ValueError:
        return peer

    forwarded = [
        value.strip()
        for value in request.headers.get("X-Forwarded-For", "").split(",")
        if value.strip()
    ]
    for hop in reversed(forwarded):
        if not any(current in network for network in networks):
            break
        try:
            current = ipaddress.ip_address(hop)
        except ValueError:
            break
    return str(current)
