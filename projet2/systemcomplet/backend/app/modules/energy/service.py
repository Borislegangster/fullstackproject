"""Offre « énergie & confort » (innovation I3) — simulation transparente et paramétrable.

Consommation de référence = usages hors climatisation (intensité par m² selon le standing + part par occupant)
+ climatisation (nombre de splits × consommation annuelle × durée d'usage). Chaque mesure agit sur la part
concernée (isolation de toiture, protections solaires, double vitrage, climatisation inverter → froid ; LED →
éclairage), le photovoltaïque produit selon l'ensoleillement de la région, la batterie augmente l'autoconsommation
et l'autonomie pendant les délestages. Facture calculée sur la grille tarifaire par tranches (Setting « energy »).

Tous les ratios (tarifs, coûts, rendements, gains) sont des paramètres GLOBUS modifiables : le résultat est une
estimation indicative, jamais un engagement — l'étude détaillée est faite par un ingénieur.
"""

from __future__ import annotations

import math
from typing import Any

from sqlalchemy.orm import Session

from app.core.utils import jsonable

DEFAULTS: dict[str, Any] = {
    # grille par tranches de consommation mensuelle (kWh, FCFA/kWh) — à aligner sur la grille en vigueur
    "tariff_tiers": [[110, 50], [400, 79], [None, 94]],
    "intensity_kwh_m2_year": {"standard": 30, "confort": 45, "premium": 65},
    "per_occupant_kwh_year": 250,
    "ac_kwh_per_unit_year": 1800,  # split ~12 000 BTU, 8 h / jour
    "lighting_share": 0.15,
    "pv_yield_kwh_kwp_year": {"littoral": 1200, "ouest": 1300, "centre": 1350, "nord": 1650},
    "costs": {
        "pv_per_kwp": 600000,
        "battery_per_kwh": 300000,
        "roof_insulation_m2": 9000,
        "shading_m2": 25000,
        "double_glazing_m2": 40000,
        "inverter_ac_extra_per_unit": 120000,
        "led_per_point": 4000,
    },
    "savings": {"roof_insulation": 0.25, "shading": 0.10, "double_glazing": 0.08, "inverter_ac": 0.30, "led": 0.50},
    "comfort_degrees": {"roof_insulation": 2.0, "shading": 1.0, "double_glazing": 0.5},
    "self_consumption": {"no_battery": 0.65, "battery": 0.90},
    "battery_depth": 0.8,
    "essential_load_kw": 0.6,
    "grid_co2_kg_kwh": 0.21,
}
MEASURES = {
    "roof_insulation": "Isolation de la toiture",
    "shading": "Protections solaires (brise-soleil, débords)",
    "double_glazing": "Double vitrage",
    "inverter_ac": "Climatisation inverter",
    "led": "Éclairage LED",
    "solar": "Panneaux solaires",
    "battery": "Batterie de stockage",
}


def params(db: Session | None) -> dict[str, Any]:
    if db is None:
        return DEFAULTS
    from app.modules.system.models import Setting

    row = db.get(Setting, "energy")
    custom = row.value if row and isinstance(row.value, dict) else {}
    merged = {**DEFAULTS, **custom}
    for key in ("costs", "savings", "comfort_degrees", "self_consumption", "intensity_kwh_m2_year"):
        merged[key] = {**DEFAULTS[key], **(custom.get(key) or {})}
    return merged


def monthly_bill(kwh_month: float, tiers: list[list[Any]]) -> float:
    """Facture d'un mois sur une grille par tranches [[seuil kWh | None, prix], …]."""
    bill, previous = 0.0, 0.0
    remaining = max(0.0, kwh_month)
    for limit, price in tiers:
        span = remaining if limit is None else max(0.0, min(remaining, float(limit) - previous))
        bill += span * float(price)
        remaining -= span
        previous = float(limit) if limit is not None else previous
        if remaining <= 0:
            break
    return bill


def _annual_bill(kwh_year: float, tiers: list[list[Any]]) -> float:
    return 12 * monthly_bill(kwh_year / 12, tiers)


def normalize(inputs: dict[str, Any]) -> dict[str, Any]:
    surface = max(20.0, float(inputs.get("surface_m2") or 120))
    levels = max(1, int(inputs.get("levels") or 1))
    data = {
        "surface_m2": surface,
        "levels": levels,
        "standing": inputs.get("standing")
        if inputs.get("standing") in ("standard", "confort", "premium")
        else "standard",
        "occupants": max(1, int(inputs.get("occupants") or 4)),
        "ac_units": max(0, int(inputs.get("ac_units") if inputs.get("ac_units") is not None else 3)),
        "ac_hours_per_day": min(24.0, max(0.0, float(inputs.get("ac_hours_per_day") or 8))),
        "region": inputs.get("region")
        if inputs.get("region") in ("littoral", "ouest", "centre", "nord")
        else "littoral",
        "roof_area_m2": float(inputs.get("roof_area_m2") or round(surface / levels * 1.15)),
        "window_area_m2": float(inputs.get("window_area_m2") or round(surface * 0.12)),
        "facade_sun_m2": float(inputs.get("facade_sun_m2") or round(surface * 0.10)),
        "lighting_points": int(inputs.get("lighting_points") or math.ceil(surface / 8)),
        "measures": [m for m in (inputs.get("measures") or []) if m in MEASURES],
        "solar_kwp": float(inputs["solar_kwp"]) if inputs.get("solar_kwp") else None,
        "battery_kwh": float(inputs["battery_kwh"]) if inputs.get("battery_kwh") else None,
    }
    return data


def simulate(inputs: dict[str, Any], db: Session | None = None) -> dict[str, Any]:
    p = params(db)
    x = normalize(inputs)
    tiers = p["tariff_tiers"]
    base = x["surface_m2"] * float(p["intensity_kwh_m2_year"][x["standing"]]) + x["occupants"] * float(
        p["per_occupant_kwh_year"]
    )
    lighting = base * float(p["lighting_share"])
    cooling = x["ac_units"] * float(p["ac_kwh_per_unit_year"]) * x["ac_hours_per_day"] / 8
    before = base + cooling
    measures = x["measures"]
    costs, gains = p["costs"], p["savings"]
    cooling_after, lighting_after = cooling, lighting
    lines: list[dict[str, Any]] = []
    comfort = 0.0

    def line(key: str, cost: float, kwh_saved: float, detail: str) -> None:
        lines.append(
            {"key": key, "label": MEASURES[key], "cost": round(cost), "kwh_saved": round(kwh_saved), "detail": detail}
        )

    for key, cost, detail in (
        ("roof_insulation", x["roof_area_m2"] * costs["roof_insulation_m2"], f"{x['roof_area_m2']:.0f} m² de toiture"),
        ("shading", x["facade_sun_m2"] * costs["shading_m2"], f"{x['facade_sun_m2']:.0f} m² de façades exposées"),
        (
            "double_glazing",
            x["window_area_m2"] * costs["double_glazing_m2"],
            f"{x['window_area_m2']:.0f} m² de vitrages",
        ),
        ("inverter_ac", x["ac_units"] * costs["inverter_ac_extra_per_unit"], f"{x['ac_units']} climatiseur(s)"),
    ):
        if key in measures:
            saved = cooling_after * float(gains[key])
            cooling_after -= saved
            comfort += float(p["comfort_degrees"].get(key, 0))
            line(key, cost, saved, detail)
    if "led" in measures:
        saved = lighting_after * float(gains["led"])
        lighting_after -= saved
        line("led", x["lighting_points"] * costs["led_per_point"], saved, f"{x['lighting_points']} points lumineux")
    consumption = (base - lighting) + lighting_after + cooling_after
    yield_kwp = float(p["pv_yield_kwh_kwp_year"].get(x["region"], 1300))
    battery = "battery" in measures
    production = self_used = solo = 0.0
    kwp = 0.0
    battery_kwh = 0.0
    if "solar" in measures:
        kwp = x["solar_kwp"] or max(1.0, round((consumption * 0.6 / yield_kwp) * 2) / 2)
        production = kwp * yield_kwp
        solo = min(production * float(p["self_consumption"]["no_battery"]), consumption)
        ratio = float(p["self_consumption"]["battery" if battery else "no_battery"])
        self_used = min(production * ratio, consumption)
        line("solar", kwp * costs["pv_per_kwp"], solo, f"{kwp:g} kWc · {production:,.0f} kWh/an".replace(",", " "))
    if battery:
        battery_kwh = x["battery_kwh"] or 5.0
        extra = max(0.0, self_used - solo) if production else 0.0  # autoconsommation gagnée grâce au stockage
        line("battery", battery_kwh * costs["battery_per_kwh"], extra, f"{battery_kwh:g} kWh utiles")
    grid_after = max(0.0, consumption - self_used)
    bill_before = _annual_bill(before, tiers)
    bill_after = _annual_bill(grid_after, tiers)
    savings = bill_before - bill_after
    investment = sum(item["cost"] for item in lines)
    # économie attribuée à chaque mesure au prorata de l'énergie évitée (lecture simple pour le client)
    total_saved = sum(item["kwh_saved"] for item in lines) or 1
    for item in lines:
        item["saving_year"] = round(savings * item["kwh_saved"] / total_saved)
        item["payback_years"] = round(item["cost"] / item["saving_year"], 1) if item["saving_year"] > 0 else None
    autonomy = round(battery_kwh * float(p["battery_depth"]) / float(p["essential_load_kw"]), 1) if battery_kwh else 0.0
    return jsonable(
        {
            "inputs": x,
            "before": {
                "kwh_year": round(before),
                "bill_year": round(bill_before),
                "bill_month": round(bill_before / 12),
            },
            "after": {
                "kwh_year": round(consumption),
                "grid_kwh_year": round(grid_after),
                "bill_year": round(bill_after),
                "bill_month": round(bill_after / 12),
            },
            "breakdown": {"cooling": round(cooling), "lighting": round(lighting), "other": round(base - lighting)},
            "solar": {"kwp": kwp, "production_kwh_year": round(production), "self_used_kwh_year": round(self_used)},
            "battery_kwh": battery_kwh,
            "autonomy_hours": autonomy,
            "measures": lines,
            "investment": round(investment),
            "savings_year": round(savings),
            "payback_years": round(investment / savings, 1) if savings > 0 else None,
            "savings_20_years": round(savings * 20 - investment),
            "co2_avoided_kg_year": round((before - grid_after) * float(p["grid_co2_kg_kwh"])),
            "comfort_gain_degrees": round(comfort, 1),
            "disclaimer": "Estimation indicative fondée sur les ratios paramétrés par GLOBUS ; étude détaillée par un "
            "ingénieur avant toute décision.",
        }
    )


__all__ = ["MEASURES", "monthly_bill", "params", "simulate"]
