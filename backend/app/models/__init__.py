# models package — import all model modules so SQLAlchemy sees them
from app.models.erp import *  # noqa: F401,F403
from app.models.cms import *  # noqa: F401,F403
from app.models.media import *  # noqa: F401,F403
from app.models.suppliers import *  # noqa: F401,F403
from app.models.bim_hub import *  # noqa: F401,F403
from app.models.communications import *  # noqa: F401,F403
from app.models.marketing import *  # noqa: F401,F403
from app.models.security_audit import *  # noqa: F401,F403
from app.models.extensions import *  # noqa: F401,F403
