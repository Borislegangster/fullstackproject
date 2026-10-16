"""Importe tous les modèles pour les enregistrer dans `Base.metadata` (Alembic, tests, scripts)."""

from app.core.database import Base
from app.modules.agenda import models as agenda_models  # noqa: F401
from app.modules.ai import models as ai_models  # noqa: F401
from app.modules.analytics import models as analytics_models  # noqa: F401
from app.modules.assistant import models as assistant_models  # noqa: F401
from app.modules.billing import models as billing_models  # noqa: F401
from app.modules.bim import models as bim_models  # noqa: F401
from app.modules.cms import models as cms_models  # noqa: F401
from app.modules.communications import models as communications_models  # noqa: F401
from app.modules.configurator import models as configurator_models  # noqa: F401
from app.modules.crm import models as crm_models  # noqa: F401
from app.modules.documents import models as documents_models  # noqa: F401
from app.modules.energy import models as energy_models  # noqa: F401
from app.modules.equipment import models as equipment_models  # noqa: F401
from app.modules.escrow import models as escrow_models  # noqa: F401
from app.modules.finance import models as finance_models  # noqa: F401
from app.modules.financing import models as financing_models  # noqa: F401
from app.modules.hr import models as hr_models  # noqa: F401
from app.modules.identity import models as identity_models  # noqa: F401
from app.modules.inventory import models as inventory_models  # noqa: F401
from app.modules.maintenance import models as maintenance_models  # noqa: F401
from app.modules.market import models as market_models  # noqa: F401
from app.modules.newsletter import models as newsletter_models  # noqa: F401
from app.modules.notifications import models as notifications_models  # noqa: F401
from app.modules.panels import models as panels_models  # noqa: F401
from app.modules.procurement import models as procurement_models  # noqa: F401
from app.modules.projects import models as projects_models  # noqa: F401
from app.modules.proofs import models as proofs_models  # noqa: F401
from app.modules.qhse import models as qhse_models  # noqa: F401
from app.modules.referrals import models as referrals_models  # noqa: F401
from app.modules.reports import models as reports_models  # noqa: F401
from app.modules.reviews import models as reviews_models  # noqa: F401
from app.modules.scheduling import models as scheduling_models  # noqa: F401
from app.modules.subcontracting import models as subcontracting_models  # noqa: F401
from app.modules.suppliers import models as suppliers_models  # noqa: F401
from app.modules.support import models as support_models  # noqa: F401
from app.modules.sync import models as sync_models  # noqa: F401
from app.modules.system import models as system_models  # noqa: F401
from app.modules.timelapse import models as timelapse_models  # noqa: F401
from app.modules.twin import models as twin_models  # noqa: F401
from app.modules.visits import models as visits_models  # noqa: F401

metadata = Base.metadata
