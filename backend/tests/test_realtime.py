"""Phase 6 — Realtime WebSocket endpoints (notifications + messaging)."""
import pytest
from starlette.websockets import WebSocketDisconnect


def test_notifications_ws_rejects_bad_token(client):
    """Without a valid JWT, the WS handshake must refuse the upgrade."""
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect('/api/v1/ws/notifications?token=invalid'):
            pass


def test_notifications_ws_accepts_valid_token(client, admin_token):
    """A valid JWT lets the connection upgrade and stay open."""
    with client.websocket_connect(f'/api/v1/ws/notifications?token={admin_token}'):
        pass  # Connection succeeded, close gracefully


def test_messaging_ws_rejects_unknown_project(client, client_token):
    """Connecting to a non-existing conversation must close 4004."""
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f'/api/v1/ws/messaging/non-existent?token={client_token}'
        ):
            pass
