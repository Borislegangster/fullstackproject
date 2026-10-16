"""RH : employés, équipes, rôles, pointage QR, horaires, heures, paie, fiches, documents RH, historique (§17)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, Float, ForeignKey, Index, Numeric, Time, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
    SoftDelete,
    Timestamps,
    UUIDPk,
    Versioned,
    bool_col,
    dt_col,
    fk,
    int_col,
    json_col,
    money_col,
    str_col,
    text_col,
)
from app.core.security import EncryptedString
from app.core.utils import utcnow


class Employee(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "employees"

    matricule: Mapped[str] = str_col(30, nullable=False, unique=True)
    user_id: Mapped[uuid.UUID | None] = fk("users.id")
    first_name: Mapped[str] = str_col(120, nullable=False)
    last_name: Mapped[str] = str_col(120, nullable=False)
    gender: Mapped[str | None] = str_col(10)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    phone: Mapped[str | None] = str_col(40)
    email: Mapped[str | None] = str_col(254)
    address: Mapped[str | None] = text_col()
    job_title: Mapped[str] = str_col(150, nullable=False)
    trade: Mapped[str | None] = str_col(80)
    department: Mapped[str | None] = str_col(80)
    team_id: Mapped[uuid.UUID | None] = fk("teams.id")
    contract_type: Mapped[str] = str_col(20, nullable=False, default="CDI")  # CDI / CDD / journalier / stage / interim
    hire_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    base_salary: Mapped[Decimal] = money_col()
    hourly_rate: Mapped[Decimal] = money_col()
    daily_rate: Mapped[Decimal] = money_col()
    pay_frequency: Mapped[str] = str_col(10, nullable=False, default="monthly")  # monthly / daily / weekly
    national_id: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    social_security_number: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)  # n° CNPS
    bank_account: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    mobile_money_number: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    emergency_contact: Mapped[str | None] = str_col(250)
    status: Mapped[str] = str_col(20, nullable=False, default="active", index=True)  # active / suspended / left
    badge_token: Mapped[str] = str_col(64, nullable=False, unique=True)  # QR de pointage
    current_project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    photo_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class WorkSchedule(UUIDPk, Timestamps, Base):
    """Horaires de travail."""

    __tablename__ = "work_schedules"

    name: Mapped[str] = str_col(120, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    break_minutes: Mapped[int] = int_col(60)
    working_days: Mapped[list[Any]] = json_col(lambda: [0, 1, 2, 3, 4, 5])
    overtime_threshold_hours: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False, default=Decimal("8"))
    is_default: Mapped[bool] = bool_col(False)


class Attendance(UUIDPk, Timestamps, Versioned, Base):
    __tablename__ = "attendances"
    __table_args__ = (
        UniqueConstraint("employee_id", "work_date", "project_id"),
        Index("ix_attendances_date", "work_date"),
    )

    employee_id: Mapped[uuid.UUID] = fk("employees.id", nullable=False, ondelete="CASCADE")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in: Mapped[datetime | None] = dt_col()
    check_out: Mapped[datetime | None] = dt_col()
    method: Mapped[str] = str_col(20, nullable=False, default="qr")  # qr / manual / mobile / badge
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    inside_geofence: Mapped[bool | None] = mapped_column(nullable=True)
    hours_worked: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    overtime_hours: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    status: Mapped[str] = str_col(20, nullable=False, default="present")  # present / absent / late / leave / sick
    recorded_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    notes: Mapped[str | None] = str_col(300)
    client_mutation_id: Mapped[str | None] = str_col(80, unique=True)


class LeaveRequest(UUIDPk, Timestamps, Base):
    __tablename__ = "leave_requests"

    employee_id: Mapped[uuid.UUID] = fk("employees.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(20, nullable=False, default="conge")  # conge / maladie / sans_solde / autre
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False, default=Decimal("1"))
    reason: Mapped[str | None] = text_col()
    status: Mapped[str] = str_col(20, nullable=False, default="pending")  # pending / approved / rejected / cancelled
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()


class PayrollRun(UUIDPk, Timestamps, Base):
    __tablename__ = "payroll_runs"
    __table_args__ = (UniqueConstraint("period"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    period: Mapped[str] = str_col(7, nullable=False)  # AAAA-MM
    status: Mapped[str] = str_col(
        20, nullable=False, default="draft"
    )  # draft / computed / validated / paid / cancelled
    total_gross: Mapped[Decimal] = money_col()
    total_deductions: Mapped[Decimal] = money_col()
    total_employer_charges: Mapped[Decimal] = money_col()
    total_net: Mapped[Decimal] = money_col()
    parameters: Mapped[dict[str, Any]] = json_col(dict)  # taux de cotisations utilisés (traçabilité)
    computed_at: Mapped[datetime | None] = dt_col()
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    paid_at: Mapped[datetime | None] = dt_col()

    items: Mapped[list[PayrollItem]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class PayrollItem(UUIDPk, Base):
    __tablename__ = "payroll_items"
    __table_args__ = (UniqueConstraint("run_id", "employee_id"),)

    run_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("payroll_runs.id", ondelete="CASCADE"), index=True)
    employee_id: Mapped[uuid.UUID] = fk("employees.id", nullable=False)
    days_worked: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False, default=Decimal("0"))
    hours_worked: Mapped[Decimal] = mapped_column(Numeric(7, 2), nullable=False, default=Decimal("0"))
    overtime_hours: Mapped[Decimal] = mapped_column(Numeric(7, 2), nullable=False, default=Decimal("0"))
    base_amount: Mapped[Decimal] = money_col()
    overtime_amount: Mapped[Decimal] = money_col()
    bonuses: Mapped[Decimal] = money_col()
    allowances: Mapped[Decimal] = money_col()
    gross: Mapped[Decimal] = money_col()
    deductions: Mapped[Decimal] = money_col()
    deduction_details: Mapped[dict[str, Any]] = json_col(dict)
    employer_charges: Mapped[Decimal] = money_col()
    advances: Mapped[Decimal] = money_col()
    net: Mapped[Decimal] = money_col()
    payslip_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    cost_allocation: Mapped[dict[str, Any]] = json_col(dict)  # répartition par projet (heures)


class HRDocument(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "hr_documents"

    employee_id: Mapped[uuid.UUID] = fk("employees.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(
        40, nullable=False
    )  # contrat / cni / diplome / certificat_medical / avertissement / attestation / fiche_paie
    title: Mapped[str] = str_col(250, nullable=False)
    file_id: Mapped[uuid.UUID] = fk("stored_files.id", nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    confidentiality: Mapped[str] = str_col(20, nullable=False, default="confidential")
    uploaded_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class HRHistory(UUIDPk, Base):
    __tablename__ = "hr_history"

    employee_id: Mapped[uuid.UUID] = fk("employees.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(
        30, nullable=False
    )  # embauche / promotion / salaire / affectation / sanction / depart / formation
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = text_col(nullable=False)
    details: Mapped[dict[str, Any]] = json_col(dict)
    recorded_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


__all__ = [
    "Attendance",
    "Employee",
    "HRDocument",
    "HRHistory",
    "LeaveRequest",
    "PayrollItem",
    "PayrollRun",
    "WorkSchedule",
]
