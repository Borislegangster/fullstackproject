"""Lightweight in-process counters exposed at /metrics.

No external dependency — we emit Prometheus text format directly. Any module
can call `metrics.inc("counter_name")` and the value will show up at the next
scrape. Useful labels can be encoded into the counter name (e.g.
`http_requests_total{route="/api/v1/auth/login",status="200"}`).

For multi-instance deployments swap this for `prometheus_client` and let the
exporter coordinate, but for a single FastAPI process this is enough to spot
trends from a Grafana / Datadog scrape.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Dict


_lock = threading.Lock()
_counters: Dict[str, float] = defaultdict(float)
_gauges: Dict[str, float] = defaultdict(float)
_started_at = time.time()


def inc(name: str, value: float = 1.0) -> None:
    with _lock:
        _counters[name] = _counters.get(name, 0.0) + value


def gauge(name: str, value: float) -> None:
    with _lock:
        _gauges[name] = value


def reset_for_tests() -> None:
    """Test-only helper — never call from production code."""
    with _lock:
        _counters.clear()
        _gauges.clear()


def render_prometheus() -> str:
    """Return the metrics in Prometheus text-exposition format.

    We emit each counter with its TYPE line. Names that already contain a
    label block (`foo{bar="baz"}`) are stripped down to their bare name for
    the TYPE declaration so Prometheus doesn't reject the payload.
    """
    lines: list[str] = []
    seen_types: set[str] = set()
    with _lock:
        snapshot_counters = dict(_counters)
        snapshot_gauges = dict(_gauges)

    def _bare(name: str) -> str:
        return name.split("{", 1)[0]

    for name, val in sorted(snapshot_counters.items()):
        bare = _bare(name)
        if bare not in seen_types:
            lines.append(f"# TYPE {bare} counter")
            seen_types.add(bare)
        lines.append(f"{name} {val}")

    for name, val in sorted(snapshot_gauges.items()):
        bare = _bare(name)
        if bare not in seen_types:
            lines.append(f"# TYPE {bare} gauge")
            seen_types.add(bare)
        lines.append(f"{name} {val}")

    # Always emit an uptime gauge so dashboards have one universal line.
    lines.append("# TYPE process_uptime_seconds gauge")
    lines.append(f"process_uptime_seconds {time.time() - _started_at:.0f}")
    lines.append("")  # trailing newline expected by Prometheus
    return "\n".join(lines)
