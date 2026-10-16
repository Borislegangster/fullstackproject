"""Métriques compatibles Prometheus (§23.1 : metrics, queue depth, échecs jobs/webhooks)."""

from __future__ import annotations

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram

registry = CollectorRegistry(auto_describe=True)

http_requests = Counter("globus_http_requests_total", "Requêtes HTTP", ["method", "route", "status"], registry=registry)
http_latency = Histogram(
    "globus_http_request_duration_seconds",
    "Durée des requêtes HTTP",
    ["method", "route"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
    registry=registry,
)
outbox_pending = Gauge("globus_outbox_pending", "Événements outbox en attente", registry=registry)
outbox_failures = Counter(
    "globus_outbox_failures_total", "Échecs de traitement outbox", ["event_type"], registry=registry
)
job_runs = Counter("globus_job_runs_total", "Exécutions de jobs planifiés", ["job", "status"], registry=registry)
webhook_events = Counter("globus_webhook_events_total", "Webhooks entrants", ["provider", "status"], registry=registry)
notification_deliveries = Counter(
    "globus_notification_deliveries_total", "Notifications envoyées", ["channel", "status"], registry=registry
)
provider_up = Gauge("globus_provider_up", "Disponibilité des fournisseurs externes", ["provider"], registry=registry)
ws_connections = Gauge("globus_ws_connections", "Connexions WebSocket actives", registry=registry)
