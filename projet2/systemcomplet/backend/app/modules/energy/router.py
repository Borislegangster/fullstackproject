"""API Énergie & confort (I3) : simulateur public, études du client sur son projet, demande d'intégration au projet."""

from __future__ import annotations

import time
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.events import emit
from app.core.middleware import client_ip
from app.core.ratelimit import rate_limit
from app.core.utils import jsonable
from app.modules.energy import service
from app.modules.energy.models import EnergyStudy

router = APIRouter(tags=["Énergie et confort"])
public = APIRouter(prefix="/public/energy", tags=["Énergie et confort (public)"])

Measure = Literal["roof_insulation", "shading", "double_glazing", "inverter_ac", "led", "solar", "battery"]


class SimulationIn(BaseModel):
    surface_m2: float = Field(default=120, ge=20, le=20000)
    levels: int = Field(default=1, ge=1, le=30)
    standing: Literal["standard", "confort", "premium"] = "standard"
    occupants: int = Field(default=4, ge=1, le=200)
    ac_units: int = Field(default=3, ge=0, le=200)
    ac_hours_per_day: float = Field(default=8, ge=0, le=24)
    region: Literal["littoral", "ouest", "centre", "nord"] = "littoral"
    roof_area_m2: float | None = Field(default=None, ge=0, le=50000)
    window_area_m2: float | None = Field(default=None, ge=0, le=20000)
    facade_sun_m2: float | None = Field(default=None, ge=0, le=20000)
    lighting_points: int | None = Field(default=None, ge=0, le=5000)
    measures: list[Measure] = Field(default_factory=list, max_length=7)
    solar_kwp: float | None = Field(default=None, gt=0, le=500)
    battery_kwh: float | None = Field(default=None, gt=0, le=1000)


@public.get("/parameters")
def public_parameters(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Mesures disponibles et hypothèses publiques du simulateur (transparence)."""
    p = service.params(db)
    return {
        "measures": service.MEASURES,
        "pv_yield_kwh_kwp_year": p["pv_yield_kwh_kwp_year"],
        "tariff_tiers": p["tariff_tiers"],
    }


@public.post("/simulate", dependencies=[Depends(rate_limit("energy", "60/hour"))])
def public_simulate(data: SimulationIn, db: Session = Depends(get_db)) -> dict[str, Any]:
    return service.simulate(data.model_dump(), db)


class EnergyLeadIn(BaseModel):
    simulation: SimulationIn
    first_name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    consent: bool = False
    rendered_at: int | None = None
    website: str | None = Field(default=None, max_length=200)


@public.post("/lead", status_code=201, dependencies=[Depends(rate_limit("energy_lead", "10/hour"))])
def public_lead(data: EnergyLeadIn, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """« Recevoir l'étude détaillée » : lead CRM avec la simulation jointe."""
    from app.modules.crm.service import create_lead

    if data.website or (data.rendered_at and time.time() - data.rendered_at < 3):
        return {"status": "received"}
    result = service.simulate(data.simulation.model_dump(), db)
    measures = ", ".join(service.MEASURES[m] for m in data.simulation.measures) or "aucune mesure"
    lead = create_lead(
        db,
        data={
            "first_name": data.first_name,
            "email": str(data.email) if data.email else None,
            "phone": data.phone,
            "message": (
                f"Étude énergie & confort : {data.simulation.surface_m2:.0f} m², {measures}. "
                f"Facture estimée {result['before']['bill_month']} → {result['after']['bill_month']} FCFA/mois, "
                f"investissement {result['investment']} FCFA, retour {result['payback_years']} an(s)."
            ),
        },
        source="energy_simulator",
        form_key="energy_simulator",
        consents={"contact": data.consent},
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
    )
    db.add(
        EnergyStudy(lead_id=lead.id, inputs=jsonable(data.simulation.model_dump()), results=result, status="requested")
    )
    db.commit()
    return {"status": "received", "reference": lead.number}


# ---------------------------------------------------------------------------- espace client
def _project(db: Session, access: Access, project_id: uuid.UUID) -> Any:
    from app.modules.projects.models import Project

    access.require_project(project_id)
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Projet introuvable")
    return project


def _defaults(project: Any) -> dict[str, Any]:
    from app.modules.scheduling.service import region

    return {
        "surface_m2": float(project.surface_m2 or 120),
        "levels": project.levels or 1,
        "standing": {"PREMIUM": "premium", "BUSINESS": "confort"}.get(project.universe or "", "standard"),
        "region": region(project),
    }


def _out(study: EnergyStudy) -> dict[str, Any]:
    return jsonable(
        {
            "id": study.id,
            "title": study.title,
            "status": study.status,
            "inputs": study.inputs,
            "results": study.results,
            "created_at": study.created_at,
        }
    )


@router.get("/client/projects/{project_id}/energy")
def client_energy(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("client:portal")
    project = _project(db, access, project_id)
    studies = db.execute(
        select(EnergyStudy).where(EnergyStudy.project_id == project.id).order_by(EnergyStudy.created_at.desc())
    ).scalars()
    return {"defaults": _defaults(project), "measures": service.MEASURES, "studies": [_out(s) for s in studies]}


class StudyIn(BaseModel):
    title: str = Field(default="Étude énergie & confort", max_length=200)
    simulation: SimulationIn


@router.post("/client/projects/{project_id}/energy/studies", status_code=201)
def client_save(
    project_id: uuid.UUID, data: StudyIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("client:portal")
    project = _project(db, access, project_id)
    study = EnergyStudy(
        project_id=project.id,
        user_id=access.p.id,
        title=data.title,
        inputs=jsonable(data.simulation.model_dump()),
        results=service.simulate(data.simulation.model_dump(), db),
    )
    db.add(study)
    db.commit()
    return _out(study)


@router.post("/client/energy/studies/{study_id}/request")
def client_request(
    study_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """« Intégrer à mon projet » : le chef de projet prépare l'avenant chiffré (décision client ensuite)."""
    from app.modules.projects.models import Project

    access.require("client:portal")
    study = db.get(EnergyStudy, study_id)
    if study is None or study.project_id is None:
        raise NotFound("Étude introuvable")
    access.require_project(study.project_id)
    if study.status != "draft":
        raise BusinessRuleError("Demande déjà transmise")
    project = db.get(Project, study.project_id)
    study.status = "requested"
    emit(
        db,
        "energy.option_requested",
        {
            "id": study.id,
            "project_id": study.project_id,
            "project_name": project.name if project else "",
            "manager_id": project.manager_id if project else None,
            "measures": ", ".join(service.MEASURES.get(m, m) for m in study.inputs.get("measures", [])),
            "investment": study.results.get("investment"),
            "savings_year": study.results.get("savings_year"),
            "link": f"/erp/chantiers/{study.project_id}?onglet=energie",
        },
        aggregate_type="energy_study",
        aggregate_id=study.id,
        project_id=study.project_id,
    )
    db.commit()
    return _out(study)


@router.get("/projects/{project_id}/energy/studies")
def staff_studies(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("projects:read")
    project = _project(db, access, project_id)
    rows = db.execute(
        select(EnergyStudy).where(EnergyStudy.project_id == project.id).order_by(EnergyStudy.created_at.desc())
    ).scalars()
    return [_out(s) for s in rows]


@router.post("/energy/studies/{study_id}/quoted")
def staff_quoted(
    study_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Avenant chiffré transmis au client (circuit des avenants) : l'étude passe à « chiffrée »."""
    access.require("projects:write")
    study = db.get(EnergyStudy, study_id)
    if study is None or study.project_id is None:
        raise NotFound("Étude introuvable")
    access.require_project(study.project_id)
    if study.status != "requested":
        raise BusinessRuleError("Étude non demandée par le client")
    study.status = "quoted"
    db.commit()
    return _out(study)
