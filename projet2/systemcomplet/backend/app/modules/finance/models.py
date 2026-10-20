"""Finance : budget versionné, engagements, dépenses, petite caisse, paiements (clients / fournisseurs /
sous-traitants), allocations, comptes et rapprochements bancaires, appels de fonds, transactions provider (§16)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, ForeignKey, Index, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
    SoftDelete,
    Timestamps,
    UUIDPk,
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

COST_CATEGORIES = ("materiaux", "main_oeuvre", "sous_traitance", "materiel", "etudes", "frais_generaux", "autre")


class Budget(UUIDPk, Timestamps, Base):
    """Budget projet versionné (initial puis révisions)."""

    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("project_id", "version_number"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    version_number: Mapped[int] = int_col(1)
    label: Mapped[str] = str_col(150, nullable=False, default="Budget initial")
    status: Mapped[str] = str_col(20, nullable=False, default="draft")  # draft / approved / superseded
    total: Mapped[Decimal] = money_col()
    revenue_target: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    notes: Mapped[str | None] = text_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    approved_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    approved_at: Mapped[datetime | None] = dt_col()

    lines: Mapped[list[BudgetLine]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class BudgetLine(UUIDPk, Base):
    __tablename__ = "budget_lines"

    budget_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("budgets.id", ondelete="CASCADE"), index=True)
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    category: Mapped[str] = str_col(30, nullable=False, default="materiaux")
    label: Mapped[str] = str_col(250, nullable=False)
    amount: Mapped[Decimal] = money_col()


class Commitment(UUIDPk, Timestamps, Base):
    """Engagement (BC, marché sous-traitant, contrat de location…)."""

    __tablename__ = "commitments"
    __table_args__ = (UniqueConstraint("source_type", "source_id"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    category: Mapped[str] = str_col(30, nullable=False, default="materiaux")
    source_type: Mapped[str] = str_col(30, nullable=False)  # purchase_order / subcontract / other
    source_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    label: Mapped[str] = str_col(250, nullable=False)
    amount: Mapped[Decimal] = money_col()
    consumed: Mapped[Decimal] = money_col()
    status: Mapped[str] = str_col(20, nullable=False, default="open")  # open / partially_consumed / closed / cancelled


class Expense(UUIDPk, Timestamps, SoftDelete, Base):
    """Coût réel / dépense imputée au projet et au lot."""

    __tablename__ = "expenses"
    __table_args__ = (Index("ix_expenses_project_date", "project_id", "expense_date"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    category: Mapped[str] = str_col(30, nullable=False, default="materiaux")
    label: Mapped[str] = str_col(250, nullable=False)
    amount: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    source_type: Mapped[str] = str_col(
        30, nullable=False, default="manual"
    )  # supplier_invoice / subcontractor_invoice / payroll / petty_cash / equipment / manual
    source_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    commitment_id: Mapped[uuid.UUID | None] = fk("commitments.id")
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    client_visible: Mapped[bool] = bool_col(False)  # « Livraisons et dépenses » du passeport projet


class PettyCashFund(UUIDPk, Timestamps, Base):
    __tablename__ = "petty_cash_funds"

    name: Mapped[str] = str_col(150, nullable=False)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    custodian_id: Mapped[uuid.UUID | None] = fk("users.id")
    ceiling: Mapped[Decimal] = money_col()
    balance: Mapped[Decimal] = money_col()
    is_active: Mapped[bool] = bool_col(True)


class PettyCashTransaction(UUIDPk, Base):
    __tablename__ = "petty_cash_transactions"

    fund_id: Mapped[uuid.UUID] = fk("petty_cash_funds.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(10, nullable=False)  # in / out
    amount: Mapped[Decimal] = money_col()
    purpose: Mapped[str] = str_col(300, nullable=False)
    category: Mapped[str] = str_col(30, nullable=False, default="autre")
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    receipt_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    status: Mapped[str] = str_col(20, nullable=False, default="pending")  # pending / validated / rejected
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class FundsCall(UUIDPk, Timestamps, Base):
    """Appel de fonds client (lié à un jalon / échéancier)."""

    __tablename__ = "funds_calls"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    milestone_id: Mapped[uuid.UUID | None] = fk("milestones.id")
    label: Mapped[str] = str_col(250, nullable=False)
    amount: Mapped[Decimal] = money_col()
    amount_paid: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = str_col(
        20, nullable=False, default="draft", index=True
    )  # draft / issued / partially_paid / paid / overdue / cancelled
    issued_at: Mapped[datetime | None] = dt_col()
    client_invoice_id: Mapped[uuid.UUID | None] = fk("client_invoices.id")
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class BankAccount(UUIDPk, Timestamps, Base):
    __tablename__ = "bank_accounts"

    name: Mapped[str] = str_col(150, nullable=False)
    bank_name: Mapped[str | None] = str_col(150)
    account_number: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    kind: Mapped[str] = str_col(20, nullable=False, default="bank")  # bank / mobile_money / provider
    is_active: Mapped[bool] = bool_col(True)


class Payment(UUIDPk, Timestamps, Base):
    """Paiement entrant (client) ou sortant (fournisseur, sous-traitant, salarié…)."""

    __tablename__ = "payments"
    __table_args__ = (Index("ix_payments_counterparty", "counterparty_type", "counterparty_id"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    direction: Mapped[str] = str_col(5, nullable=False)  # in / out
    counterparty_type: Mapped[str] = str_col(20, nullable=False)  # client / supplier / subcontractor / employee / other
    counterparty_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    counterparty_label: Mapped[str | None] = str_col(250)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    amount: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    method: Mapped[str] = str_col(
        20, nullable=False, default="bank_transfer"
    )  # card / mobile_money / bank_transfer / cash / cheque
    provider: Mapped[str] = str_col(
        20, nullable=False, default="manual"
    )  # stripe / flutterwave / cinetpay / sandbox / manual
    provider_reference: Mapped[str | None] = str_col(200, index=True)
    status: Mapped[str] = str_col(
        20, nullable=False, default="pending", index=True
    )  # pending / awaiting_approval / processing / succeeded / failed / cancelled / refunded
    failure_reason: Mapped[str | None] = text_col()
    bank_account_id: Mapped[uuid.UUID | None] = fk("bank_accounts.id")
    initiated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    approved_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    approved_at: Mapped[datetime | None] = dt_col()
    paid_at: Mapped[datetime | None] = dt_col()
    value_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # encaissement hors ligne : date de valeur
    confirmed_by: Mapped[str | None] = str_col(20)  # webhook / reconciliation / manual
    proof_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    receipt_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    idempotency_key: Mapped[str | None] = str_col(200, unique=True)
    notes: Mapped[str | None] = text_col()

    allocations: Mapped[list[PaymentAllocation]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class PaymentAllocation(UUIDPk, Base):
    __tablename__ = "payment_allocations"

    payment_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("payments.id", ondelete="CASCADE"), index=True)
    target_type: Mapped[str] = str_col(
        30, nullable=False
    )  # client_invoice / funds_call / supplier_invoice / subcontractor_invoice / payroll_item
    target_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    amount: Mapped[Decimal] = money_col()


class PaymentTransaction(UUIDPk, Timestamps, Base):
    """Opération chez un prestataire : encaissement (checkout carte / Mobile Money) ou transfert sortant."""

    __tablename__ = "payment_transactions"

    payment_id: Mapped[uuid.UUID] = fk("payments.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = mapped_column(
        String(10), nullable=False, default="collection", server_default="collection"
    )  # collection / payout
    provider: Mapped[str] = str_col(20, nullable=False)
    provider_session_id: Mapped[str | None] = str_col(200, index=True)
    provider_transaction_id: Mapped[str | None] = str_col(200, index=True)
    checkout_url: Mapped[str | None] = str_col(1000)
    status: Mapped[str] = str_col(
        20, nullable=False, default="created"
    )  # created / pending / succeeded / failed / expired / cancelled
    amount: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    customer_email: Mapped[str | None] = str_col(254)
    customer_phone: Mapped[str | None] = str_col(40)
    raw_status: Mapped[str | None] = str_col(60)
    failure_reason: Mapped[str | None] = text_col()
    expires_at: Mapped[datetime | None] = dt_col()
    completed_at: Mapped[datetime | None] = dt_col()
    # Empreinte SHA-256 du jeton de notification propre à la transaction (Orange Money « notif_token »).
    webhook_token_hash: Mapped[str | None] = str_col(64, index=True)
    last_checked_at: Mapped[datetime | None] = dt_col()  # dernière relecture du statut chez le prestataire


class BankTransaction(UUIDPk, Base):
    """Ligne de relevé bancaire importée pour rapprochement."""

    __tablename__ = "bank_transactions"
    __table_args__ = (UniqueConstraint("bank_account_id", "fingerprint"),)

    bank_account_id: Mapped[uuid.UUID] = fk("bank_accounts.id", nullable=False, ondelete="CASCADE")
    import_batch: Mapped[str] = str_col(60, nullable=False)
    value_date: Mapped[date] = mapped_column(Date, nullable=False)
    label: Mapped[str] = str_col(400, nullable=False)
    reference: Mapped[str | None] = str_col(200)
    amount: Mapped[Decimal] = money_col()  # positif = crédit, négatif = débit
    fingerprint: Mapped[str] = str_col(64, nullable=False)
    status: Mapped[str] = str_col(20, nullable=False, default="unmatched")  # unmatched / matched / ignored
    matched_payment_id: Mapped[uuid.UUID | None] = fk("payments.id")
    matched_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    matched_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class CashForecastEntry(UUIDPk, Base):
    """Prévision de trésorerie saisie (complète les échéances calculées)."""

    __tablename__ = "cash_forecast_entries"

    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    label: Mapped[str] = str_col(250, nullable=False)
    direction: Mapped[str] = str_col(5, nullable=False)
    amount: Mapped[Decimal] = money_col()
    expected_date: Mapped[date] = mapped_column(Date, nullable=False)
    probability: Mapped[int] = int_col(100)
    details: Mapped[dict[str, Any]] = json_col(dict)


__all__ = [
    "COST_CATEGORIES",
    "BankAccount",
    "BankTransaction",
    "Budget",
    "BudgetLine",
    "CashForecastEntry",
    "Commitment",
    "Expense",
    "FundsCall",
    "Payment",
    "PaymentAllocation",
    "PaymentTransaction",
    "PettyCashFund",
    "PettyCashTransaction",
]
