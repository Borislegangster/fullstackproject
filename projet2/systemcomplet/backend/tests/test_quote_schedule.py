"""Échéancier de devis saisi en montants : la dernière échéance reçoit le reste exact du total TTC.

Régression : 850 000 / 1 100 000 = 77,2727… % → la somme des % ne valait jamais exactement 100
et l'enregistrement était refusé (« L'échéancier doit totaliser 100 % »).
"""

from __future__ import annotations

from typing import Any

API = "/api/v1/crm/quotes"


def _quote(schedule: list[dict[str, Any]], unit_price: int = 1_100_000) -> dict[str, Any]:
    return {
        "title": "Conception et étude R+2",
        "nature": "etudes",
        "tax_rate": 0,
        "payment_schedule": schedule,
        "lines": [{"designation": "Études R+2", "unit": "forfait", "quantity": 1, "unit_price": unit_price}],
    }


def test_amounts_last_step_gets_rest(client, admin_headers):
    res = client.post(
        API,
        headers=admin_headers,
        json=_quote(
            [
                {"label": "Accompte à la signature", "amount": 850000, "milestone": "livraison des plans"},
                {"label": "Livraison des plans", "amount": None, "milestone": "Plans livrés"},
            ]
        ),
    )
    assert res.status_code == 201, res.text
    steps = res.json()["payment_schedule"]
    assert [s["amount"] for s in steps] == ["850000.00", "250000.00"]
    assert [s["pct"] for s in steps] == [77.27, 22.73]
    assert sum(s["pct"] for s in steps) == 100


def test_amounts_exceeding_total_rejected(client, admin_headers):
    res = client.post(
        API,
        headers=admin_headers,
        json=_quote([{"label": "Acompte", "amount": 1_200_000}, {"label": "Solde"}]),
    )
    assert res.status_code in (400, 409, 422), res.text
    assert "SCHEDULE_NOT_TOTAL" in res.text


def test_explicit_last_amount_must_match(client, admin_headers):
    res = client.post(
        API,
        headers=admin_headers,
        json=_quote([{"label": "Acompte", "amount": 850000}, {"label": "Solde", "amount": 200000}]),
    )
    assert "SCHEDULE_NOT_TOTAL" in res.text
    ok = client.post(
        API,
        headers=admin_headers,
        json=_quote([{"label": "Acompte", "amount": 850000}, {"label": "Solde", "amount": 250000}]),
    )
    assert ok.status_code == 201, ok.text


def test_legacy_percentages_with_decimals_accepted(client, admin_headers):
    res = client.post(
        API,
        headers=admin_headers,
        json=_quote([{"label": "Acompte", "pct": 77.272727}, {"label": "Solde", "pct": 22.727272}]),
    )
    assert res.status_code == 201, res.text
    steps = res.json()["payment_schedule"]
    assert [s["amount"] for s in steps] == ["850000.00", "250000.00"]


def test_update_rechecks_against_new_total(client, admin_headers):
    quote = client.post(
        API, headers=admin_headers, json=_quote([{"label": "Acompte", "amount": 850000}, {"label": "Solde"}])
    ).json()
    res = client.put(
        f"{API}/{quote['id']}",
        headers=admin_headers,
        json=_quote([{"label": "Acompte", "amount": 850000}, {"label": "Solde"}], unit_price=800_000),
    )
    assert "SCHEDULE_NOT_TOTAL" in res.text
