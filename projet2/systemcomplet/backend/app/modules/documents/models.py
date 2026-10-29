"""GED : Document, DocumentVersion, DocumentPermission, Approval, Signature, DocumentLink, Watermark (§12).

Règle : aucun document critique n'est écrasé ; toute modification crée une nouvelle version.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, ForeignKey, Index, Integer, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
    SoftDelete,
    Timestamps,
    UUIDPk,
    bigint_col,
    bool_col,
    dt_col,
    fk,
    int_col,
    json_col,
    money_col,
    str_col,
    text_col,
)
from app.core.utils import utcnow

VERSION_STATUSES = ("draft", "in_review", "correction", "validated", "published", "obsolete", "archived")
DOC_TYPES = (
    "plan",
    "contrat",
    "avenant",
    "facture",
    "devis",
    "pv",
    "rapport",
    "note_calcul",
    "cctp",
    "photo",
    "fonciers",
    "administratif",
    "technique",
    "qhse",
    "rh",
    "autre",
)


class Folder(UUIDPk, Timestamps, Base):
    __tablename__ = "document_folders"
    __table_args__ = (UniqueConstraint("parent_id", "project_id", "name"),)

    name: Mapped[str] = str_col(200, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = fk("document_folders.id", ondelete="CASCADE")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="CASCADE")
    path: Mapped[str] = str_col(1000, nullable=False, default="/")
    default_confidentiality: Mapped[str] = str_col(20, nullable=False, default="internal")
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class Document(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_project_type", "project_id", "doc_type"),)

    code: Mapped[str] = str_col(60, nullable=False, unique=True)
    title: Mapped[str] = str_col(300, nullable=False, index=True)
    description: Mapped[str | None] = text_col()
    doc_type: Mapped[str] = str_col(30, nullable=False, default="autre")
    discipline: Mapped[str | None] = str_col(40, index=True)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    folder_id: Mapped[uuid.UUID | None] = fk("document_folders.id")
    confidentiality: Mapped[str] = str_col(20, nullable=False, default="internal", index=True)
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    published_version_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    client_visible: Mapped[bool] = bool_col(False)
    partner_visible: Mapped[bool] = bool_col(False)  # sous-traitants / fournisseurs concernés
    tags: Mapped[list[Any]] = json_col(list)
    retention_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    archived_at: Mapped[datetime | None] = dt_col()
    locked: Mapped[bool] = bool_col(False)
    # Livrable d'études payant : le client le consulte en aperçu filigrané et le valide ; l'original ne lui est remis
    # (téléchargement) qu'une fois la facture d'études liée réglée.
    paid_deliverable: Mapped[bool] = bool_col(False)
    unlock_invoice_id: Mapped[uuid.UUID | None] = fk("client_invoices.id")
    delivered_at: Mapped[datetime | None] = dt_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    deleted_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    deletion_reason: Mapped[str | None] = text_col()

    versions: Mapped[list[DocumentVersion]] = relationship(
        back_populates="document",
        lazy="selectin",
        order_by="DocumentVersion.created_at",
        foreign_keys="DocumentVersion.document_id",
    )


class DocumentVersion(UUIDPk, Base):
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version_major", "version_minor"),)

    document_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    version_major: Mapped[int] = int_col(1)
    version_minor: Mapped[int] = int_col(0)
    parent_version_id: Mapped[uuid.UUID | None] = fk("document_versions.id", index=False)
    file_id: Mapped[uuid.UUID] = fk("stored_files.id", nullable=False)
    checksum_sha256: Mapped[str] = str_col(64, nullable=False)
    size_bytes: Mapped[int] = bigint_col(0)
    mime_type: Mapped[str] = str_col(150, nullable=False)
    original_name: Mapped[str] = str_col(300, nullable=False)
    author_id: Mapped[uuid.UUID | None] = fk("users.id")
    source: Mapped[str] = str_col(20, nullable=False, default="upload")  # upload / generated / sync / bim
    status: Mapped[str] = str_col(20, nullable=False, default="draft", index=True)
    revision_reason: Mapped[str | None] = text_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    submitted_at: Mapped[datetime | None] = dt_col()
    validated_at: Mapped[datetime | None] = dt_col()
    published_at: Mapped[datetime | None] = dt_col()
    obsolete_at: Mapped[datetime | None] = dt_col()
    obsolete_reason: Mapped[str | None] = text_col()
    superseded_by_id: Mapped[uuid.UUID | None] = fk("document_versions.id", index=False)
    archived_at: Mapped[datetime | None] = dt_col()
    locked: Mapped[bool] = bool_col(False)  # verrouillage pendant approbation
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    authenticity_token: Mapped[str] = str_col(64, nullable=False, unique=True)
    anchor_receipt: Mapped[dict[str, Any]] = json_col(dict)
    anchored_at: Mapped[datetime | None] = dt_col()

    document: Mapped[Document] = relationship(back_populates="versions", foreign_keys=[document_id])

    @property
    def label(self) -> str:
        return f"V{self.version_major}.{self.version_minor}"


class DocumentPermission(UUIDPk, Base):
    __tablename__ = "document_permissions"
    __table_args__ = (Index("ix_doc_perm_target", "document_id", "folder_id"),)

    document_id: Mapped[uuid.UUID | None] = fk("documents.id", ondelete="CASCADE", index=False)
    folder_id: Mapped[uuid.UUID | None] = fk("document_folders.id", ondelete="CASCADE", index=False)
    principal_type: Mapped[str] = str_col(20, nullable=False)  # user / role / organization / project_role
    principal_value: Mapped[str] = str_col(120, nullable=False)
    permission: Mapped[str] = str_col(20, nullable=False, default="read")  # read / write / approve / sign / deny
    granted_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class DocumentApprovalStep(UUIDPk, Base):
    __tablename__ = "document_approval_steps"

    version_id: Mapped[uuid.UUID] = fk("document_versions.id", nullable=False, ondelete="CASCADE")
    step_order: Mapped[int] = int_col(1)
    approver_role: Mapped[str | None] = str_col(60)
    approver_id: Mapped[uuid.UUID | None] = fk("users.id")
    status: Mapped[str] = str_col(20, nullable=False, default="pending")  # pending / approved / rejected / skipped
    comment: Mapped[str | None] = text_col()
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class Signature(UUIDPk, Base):
    """Signature électronique (OTP) — preuve horodatée liée à l'empreinte exacte du document signé."""

    __tablename__ = "signatures"

    version_id: Mapped[uuid.UUID | None] = fk("document_versions.id", ondelete="CASCADE")
    entity_type: Mapped[str] = str_col(
        40, nullable=False, default="document_version"
    )  # document_version / quote / contract / decision / subcontract / change_order
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    signer_id: Mapped[uuid.UUID | None] = fk("users.id")
    signer_name: Mapped[str] = str_col(200, nullable=False)
    signer_email: Mapped[str | None] = str_col(254)
    role: Mapped[str | None] = str_col(60)
    method: Mapped[str] = str_col(20, nullable=False, default="otp")  # otp / otp_drawn / webauthn
    signed_hash: Mapped[str] = str_col(64, nullable=False)
    signature_image_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    otp_channel: Mapped[str | None] = str_col(20)
    ip: Mapped[str | None] = str_col(64)
    user_agent: Mapped[str | None] = str_col(400)
    signed_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    certificate: Mapped[dict[str, Any]] = json_col(dict)


class DocumentLink(UUIDPk, Base):
    __tablename__ = "document_links"
    __table_args__ = (Index("ix_document_links_entity", "entity_type", "entity_id"),)

    document_id: Mapped[uuid.UUID] = fk("documents.id", nullable=False, ondelete="CASCADE")
    version_id: Mapped[uuid.UUID | None] = fk("document_versions.id", index=False)  # référence exacte facultative
    entity_type: Mapped[str] = str_col(
        40, nullable=False
    )  # task / issue / purchase_order / situation / decision / tender / incident…
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class DocumentAccessLog(UUIDPk, Base):
    """Consultations / téléchargements (sert aussi aux alertes « plan périmé »)."""

    __tablename__ = "document_access_logs"
    __table_args__ = (Index("ix_doc_access_version_user", "version_id", "user_id"),)

    document_id: Mapped[uuid.UUID] = fk("documents.id", nullable=False, ondelete="CASCADE")
    version_id: Mapped[uuid.UUID] = fk("document_versions.id", nullable=False, ondelete="CASCADE", index=False)
    user_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    action: Mapped[str] = str_col(20, nullable=False, default="view")  # view / download / print / offline
    application: Mapped[str | None] = str_col(40)
    watermarked: Mapped[bool] = bool_col(False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class DocumentSeal(UUIDPk, Base):
    """Sceau d'authenticité d'un document émis par la plateforme (reçu, devis, proforma, avoir, bon de commande,
    marché, bulletin, rapport…) : le QR code du PDF renvoie vers /verification/{token}, qui affiche les données
    essentielles du document et son statut à jour."""

    __tablename__ = "document_seals"
    __table_args__ = (UniqueConstraint("entity_type", "entity_id", "kind", name="uq_document_seals_entity_kind"),)

    token: Mapped[str] = str_col(64, nullable=False, unique=True)
    kind: Mapped[str] = str_col(40, nullable=False)
    entity_type: Mapped[str] = str_col(40, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    reference: Mapped[str | None] = str_col(80)
    title: Mapped[str | None] = str_col(250)
    issued_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount: Mapped[Any] = money_col(nullable=True, default=None)
    currency: Mapped[str | None] = str_col(3)
    party: Mapped[str | None] = str_col(250)
    sha256: Mapped[str | None] = str_col(64)
    revoked_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now(), onupdate=utcnow)


__all__ = [
    "DOC_TYPES",
    "VERSION_STATUSES",
    "Document",
    "DocumentAccessLog",
    "DocumentApprovalStep",
    "DocumentLink",
    "DocumentPermission",
    "DocumentSeal",
    "DocumentVersion",
    "Folder",
    "Signature",
]
