"""Modèles et règles de notification par défaut (données système éditables, pas des données métier).

Les règles relient un événement métier (outbox) à une audience et à des canaux ; les modèles Jinja2
(environnement sandboxé) produisent titres/corps par canal.
"""

from __future__ import annotations

from typing import Any

# (code, titre in-app, corps in-app, lien)
_IN_APP: list[tuple[str, str, str, str]] = [
    (
        "lead.created",
        "Nouveau lead {{ number }}",
        "{{ name }} — {{ universe or 'univers non précisé' }} ({{ source }}). Score {{ score }}/100.",
        "/erp/crm/leads/{{ id }}",
    ),
    (
        "lead.assigned",
        "Lead {{ number }} vous est affecté",
        "{{ name }} — réponse attendue avant {{ response_due_at | dt }}.",
        "/erp/crm/leads/{{ id }}",
    ),
    (
        "lead.sla_breached",
        "SLA dépassé : lead {{ number }}",
        "Aucune prise en charge de {{ name }} dans le délai. Escalade niveau {{ level }}.",
        "/erp/crm/leads/{{ id }}",
    ),
    (
        "quote.accepted",
        "Devis {{ number }} accepté",
        "{{ client }} a accepté le devis « {{ title }} » ({{ total | money }}).",
        "/erp/crm/devis/{{ id }}",
    ),
    (
        "contract.signed",
        "Contrat {{ number }} signé",
        "Le contrat « {{ title }} » a été signé.",
        "/erp/crm/contrats/{{ id }}",
    ),
    (
        "project.member_added",
        "Ajout au projet {{ project_code }}",
        "Vous avez été ajouté(e) au projet « {{ project_name }} » ({{ project_role }}).",
        "/erp/chantiers/{{ project_id }}",
    ),
    (
        "purchase_request.submitted",
        "Demande d'achat {{ number }} à approuver",
        "{{ requester }} — {{ total | money }} ({{ urgency }}) pour {{ project_name }}.",
        "/erp/achats/demandes/{{ id }}",
    ),
    (
        "purchase_request.approved",
        "Demande d'achat {{ number }} approuvée",
        "Votre demande d'achat a été approuvée.",
        "/erp/achats/demandes/{{ id }}",
    ),
    (
        "purchase_request.rejected",
        "Demande d'achat {{ number }} refusée",
        "Motif : {{ reason }}",
        "/erp/achats/demandes/{{ id }}",
    ),
    (
        "purchase_order.confirmed",
        "Livraison attendue — BC {{ number }}",
        "{{ supplier }} a confirmé la commande. Livraison prévue {{ expected_date | d }} sur {{ site_name or project_name }}.",
        "/erp/livraisons?po={{ id }}",
    ),
    (
        "purchase_order.refused",
        "BC {{ number }} refusé par le fournisseur",
        "{{ supplier }} : {{ note }}",
        "/erp/achats/commandes/{{ id }}",
    ),
    (
        "purchase_order.countered",
        "Contre-offre sur le BC {{ number }}",
        "{{ supplier }} propose : {{ note }}",
        "/erp/achats/commandes/{{ id }}",
    ),
    (
        "delivery.announced",
        "Livraison en route — BC {{ po_number }}",
        "{{ supplier }} : arrivée estimée {{ eta | dt }} ({{ carrier or 'transporteur non précisé' }}).",
        "/erp/livraisons/{{ id }}",
    ),
    (
        "goods_receipt.validated",
        "Réception {{ number }} validée",
        "BC {{ po_number }} — {{ lines }} ligne(s) réceptionnée(s).",
        "/erp/livraisons/receptions/{{ id }}",
    ),
    (
        "goods_receipt.exception",
        "Écart de réception {{ number }}",
        "{{ summary }}",
        "/erp/livraisons/receptions/{{ id }}",
    ),
    (
        "supplier_invoice.match_exception",
        "Rapprochement en anomalie — {{ number }}",
        "{{ summary }}",
        "/erp/facturation/fournisseurs/{{ id }}",
    ),
    (
        "supplier_invoice.matched",
        "Facture {{ number }} rapprochée",
        "PO / GRN / facture concordants : prête pour validation finance.",
        "/erp/facturation/fournisseurs/{{ id }}",
    ),
    (
        "payment.succeeded",
        "Paiement {{ number }} confirmé",
        "{{ amount | money }} — {{ counterparty }}.",
        "/erp/finances/paiements/{{ id }}",
    ),
    (
        "payment.failed",
        "Paiement {{ number }} en échec",
        "{{ amount | money }} — motif : {{ reason }}. Une tâche finance a été créée.",
        "/erp/finances/paiements/{{ id }}",
    ),
    (
        "payment.awaiting_approval",
        "Paiement {{ number }} à approuver",
        "{{ amount | money }} — {{ counterparty }}.",
        "/erp/finances/paiements/{{ id }}",
    ),
    (
        "funds_call.issued",
        "Appel de fonds {{ number }}",
        "{{ label }} : {{ amount | money }} à régler avant le {{ due_date | d }}.",
        "/espace-client/finances",
    ),
    (
        "client_invoice.sent",
        "Facture {{ number }}",
        "{{ label }} : {{ amount | money }} à régler avant le {{ due_date | d }}.",
        "/espace-client/finances",
    ),
    (
        "billing.payment_reminder",
        "Rappel de paiement — facture {{ number }}",
        "{{ label }} : {{ amount | money }} restent à régler ({{ stage_label }}, échéance le {{ due_date | d }}).",
        "/espace-client/finances",
    ),
    (
        "client_payment.received",
        "Paiement reçu — merci",
        "Nous avons bien reçu {{ amount | money }} pour {{ project_name }}.",
        "/espace-client/finances",
    ),
    (
        "tender.published",
        "Nouvelle consultation {{ number }}",
        "« {{ title }} » — réponse attendue avant le {{ deadline | dt }}.",
        "/extranet/consultations/{{ id }}",
    ),
    (
        "bid.submitted",
        "Offre reçue — {{ tender_number }}",
        "{{ subcontractor }} : {{ amount | money }} (lot {{ lot }}).",
        "/erp/sous-traitants/consultations/{{ tender_id }}",
    ),
    (
        "bid.awarded",
        "Marché attribué — {{ tender_number }}",
        "Votre offre pour le lot {{ lot }} a été retenue.",
        "/extranet/marches",
    ),
    (
        "situation.submitted",
        "Situation {{ number }} à contrôler",
        "{{ subcontractor }} — {{ gross_amount | money }} brut sur {{ project_name }}.",
        "/erp/situations/{{ id }}",
    ),
    (
        "situation.validated",
        "Situation {{ number }} validée",
        "Montant net validé : {{ net_amount | money }}.",
        "/extranet/situations/{{ id }}",
    ),
    ("situation.rejected", "Situation {{ number }} refusée", "Motif : {{ reason }}", "/extranet/situations/{{ id }}"),
    (
        "situation.blocked",
        "Situation {{ number }} bloquée",
        "Cumul au-delà du marché ({{ excess | money }}) : dérogation requise.",
        "/erp/situations/{{ id }}",
    ),
    (
        "dispute.opened",
        "Litige {{ number }} ouvert",
        "{{ title }} — montant contesté {{ amount | money }}.",
        "/erp/litiges/{{ id }}",
    ),
    ("dispute.updated", "Litige {{ number }} : {{ status }}", "{{ summary }}", "/erp/litiges/{{ id }}"),
    (
        "dispute.escalated",
        "Litige {{ number }} escaladé",
        "Escalade vers {{ escalated_to }} : {{ title }}.",
        "/erp/litiges/{{ id }}",
    ),
    (
        "document.version_published",
        "Nouvelle version : {{ title }}",
        "{{ label }} publiée. {% if previous %}La version {{ previous }} est désormais obsolète.{% endif %}",
        "/erp/ged/documents/{{ document_id }}",
    ),
    (
        "document.obsolete_alert",
        "Plan périmé : {{ title }}",
        "La version {{ previous }} que vous avez consultée est obsolète. Utilisez {{ label }}.",
        "/erp/ged/documents/{{ document_id }}",
    ),
    (
        "document.approval_requested",
        "Document à approuver : {{ title }}",
        "{{ label }} attend votre approbation.",
        "/erp/ged/documents/{{ document_id }}",
    ),
    (
        "deliverables.released",
        "Vos livrables d'études sont disponibles",
        "Facture {{ number }} réglée : {{ count }} livrable(s) vous sont remis ({{ titles }}). Téléchargez les originaux dans votre espace.",
        "/espace-client/documents",
    ),
    (
        "document.client_published",
        "Nouveau document disponible",
        "« {{ title }} » ({{ label }}) est disponible dans votre espace.",
        "/espace-client/documents",
    ),
    ("signature.requested", "Signature demandée", "« {{ title }} » attend votre signature.", "{{ link }}"),
    (
        "bim.issue_assigned",
        "Issue BIM {{ number }} assignée",
        "{{ title }} — priorité {{ priority }}, échéance {{ due_date | d }}.",
        "/erp/hub/issues/{{ id }}",
    ),
    ("bim.issue_resolved", "Issue BIM {{ number }} résolue", "{{ title }}", "/erp/hub/issues/{{ id }}"),
    (
        "bim.version_ready",
        "Maquette prête : {{ model }}",
        "Version {{ number }} traduite et consultable.",
        "/erp/bim/{{ model_id }}",
    ),
    (
        "bim.version_published",
        "Maquette publiée : {{ model }}",
        "Version {{ number }} publiée.",
        "/espace-client/immersion",
    ),
    (
        "decision.requested",
        "Décision attendue : {{ title }}",
        "Impact : {{ price_impact | money }} / {{ delay_impact_days }} jour(s). Échéance {{ due_date | d }}.",
        "/espace-client/validations",
    ),
    (
        "decision.validated",
        "Décision validée : {{ title }}",
        "Validée par {{ validated_by }} le {{ validated_at | dt }} ({{ method }}).",
        "/erp/chantiers/{{ project_id }}/decisions",
    ),
    (
        "change_order.submitted",
        "Avenant {{ number }} à valider",
        "{{ title }} — {{ cost_impact | money }}, {{ delay_impact_days }} jour(s).",
        "/espace-client/validations",
    ),
    (
        "change_order.approved",
        "Avenant {{ number }} approuvé",
        "{{ title }}",
        "/erp/chantiers/{{ project_id }}/avenants",
    ),
    (
        "incident.declared",
        "Incident {{ number }} ({{ severity }})",
        "{{ title }} — {{ site_name or project_name }}.",
        "/erp/qhse/incidents/{{ id }}",
    ),
    ("incident.client_published", "Information chantier", "{{ client_summary }}", "/espace-client/chantier"),
    (
        "corrective_action.overdue",
        "Action corrective en retard : {{ number }}",
        "{{ title }} — échéance {{ due_date | d }}.",
        "/erp/qhse/actions/{{ id }}",
    ),
    (
        "daily_log.critical",
        "Rapport chantier critique",
        "{{ project_name }} : {{ summary }}",
        "/erp/chantiers/{{ project_id }}/journal",
    ),
    ("ticket.created", "Ticket SAV {{ number }}", "{{ subject }} — priorité {{ priority }}.", "/erp/sav/{{ id }}"),
    ("ticket.assigned", "Ticket SAV {{ number }} affecté", "{{ subject }}", "/erp/sav/{{ id }}"),
    ("ticket.client_update", "Votre demande {{ number }}", "{{ message }}", "/espace-client/sav/{{ id }}"),
    ("ticket.sla_breached", "SLA SAV dépassé : {{ number }}", "{{ subject }}", "/erp/sav/{{ id }}"),
    ("call.missed", "Appel manqué", "{{ caller }} a tenté de vous joindre.", "/appels"),
    ("message.new", "Nouveau message — {{ conversation }}", "{{ sender }} : {{ preview }}", "{{ link }}"),
    ("client.digest", "Votre point hebdomadaire — {{ project_name }}", "{{ summary }}", "/espace-client/dashboard"),
    (
        "stock.low",
        "Stock bas : {{ item }}",
        "{{ quantity }} {{ unit }} restant(s) (seuil {{ threshold }}).",
        "/erp/stocks/{{ id }}",
    ),
    (
        "equipment.maintenance_due",
        "Maintenance à prévoir : {{ equipment }}",
        "{{ title }} — échéance {{ due_date | d }}.",
        "/erp/materiel/{{ id }}",
    ),
    (
        "tranquillite.due_soon",
        "Échéance dossier : {{ title }}",
        "{{ category }} — échéance {{ due_date | d }}.",
        "/espace-client/tranquillite",
    ),
    (
        "voice_report.received",
        "Rapport vocal à valider — {{ project_name }}",
        "{{ author }}{% if is_critical %} (point critique){% endif %} : {{ summary }}",
        "/erp/ia?onglet=vocal",
    ),
    (
        "security.new_device",
        "Nouvelle connexion",
        "Connexion depuis un nouvel appareil ({{ device }}).",
        "/compte?onglet=sessions",
    ),
    ("system.alert", "Alerte système : {{ title }}", "{{ message }}", "/erp/parametres/systeme"),
    ("anomaly.detected", "Anomalie détectée : {{ kind }}", "{{ description }}", "/erp/rapports/anomalies"),
    (
        "prediction.risk",
        "Risque de dépassement : {{ project_name }}",
        "{{ explanation }}",
        "/erp/chantiers/{{ project_id }}",
    ),
    # ------------------------------------------------------------------ innovations lot 1
    (
        "project.trust_alert",
        "Indice de confiance en baisse — {{ project_code }}",
        "{{ project_name }} : {{ score }}/100 ({{ level }}){% if previous %}, contre {{ previous }} auparavant{% endif %}."
        " Ouvrez la fiche pour voir les composantes en cause.",
        "/erp/chantiers/{{ project_id }}",
    ),
    (
        "review.invited",
        "Votre avis compte — {{ project_name }}",
        "Bonjour {{ first_name }}, comment s'est passé votre projet avec GLOBUS ? 2 minutes suffisent.",
        "/espace-client/avis/{{ project_id }}",
    ),
    (
        "review.submitted",
        "Nouvel avis client : {{ rating }}/5",
        "{{ project_name }} — {{ author }}{% if consent_publish %} · publication autorisée, à modérer"
        "{% else %} · avis interne (non publiable){% endif %}. « {{ excerpt }} »",
        "/erp/cms?onglet=collections",
    ),
    (
        "payment_plan.requested",
        "Demande d'échéancier {{ number }}",
        "{{ client }} demande {{ count }} échéances pour {{ target }} ({{ amount | money }}).",
        "/erp/finances/echeanciers",
    ),
    (
        "payment_plan.proposed",
        "Échéancier {{ number }} prêt",
        "Votre proposition d'échéancier{% if target %} pour {{ target }}{% endif %} ({{ count }} échéances) est prête :"
        " acceptez-la par code depuis votre espace.",
        "/espace-client/finances",
    ),
    (
        "payment_plan.rejected",
        "Échéancier {{ number }} non retenu",
        "Notre service comptable n'a pas pu retenir cette demande : {{ note }}",
        "/espace-client/finances",
    ),
    (
        "payment_plan.accepted",
        "Échéancier {{ number }} accepté",
        "{{ client }} a accepté l'échéancier de {{ target }} (signature par code).",
        "/erp/finances/echeanciers",
    ),
    (
        "payment_plan.defaulted",
        "Échéancier {{ number }} en défaut",
        "Échéance non réglée au-delà de la tolérance pour {{ target }} : relance personnalisée à prévoir.",
        "/erp/finances/echeanciers",
    ),
    (
        "billing.installment_reminder",
        "Échéance {{ index }}/{{ count }} — {{ amount | money }}",
        "{{ label }} : {{ stage_label }} (le {{ due_date | d }}). Réglez en un clic par Mobile Money ou carte.",
        "/espace-client/finances",
    ),
    (
        "executive_report.ready",
        "Rapport de direction {{ number }}",
        "{{ headline }} — semaine {{ period }}.",
        "/erp/direction/rapports/{{ id }}",
    ),
    (
        "site_panel.message",
        "Message du panneau de chantier — {{ project_name }}",
        "{{ name }} ({{ kind }}) : {{ excerpt }}",
        "{{ link }}",
    ),
    (
        "referral.captured",
        "Nouvelle recommandation {{ number }}",
        "{{ ambassador_name }} recommande {{ referee }}{% if status == 'rejected' %} (non éligible){% endif %}.",
        "/erp/crm/ambassadeurs",
    ),
    (
        "referral.reward_pending",
        "Prime de parrainage à valider — {{ number }}",
        "{{ referee }} a signé le contrat {{ contract_number }} : prime de {{ amount | money }} pour {{ ambassador_name }}.",
        "/erp/crm/ambassadeurs",
    ),
    (
        "referral.approved",
        "Votre prime de parrainage est validée",
        "Merci ! La prime de {{ amount | money }} pour la recommandation de {{ referee }} va vous être versée.",
        "/espace-client/parrainage",
    ),
    (
        "referral.paid",
        "Prime de parrainage versée",
        "{{ amount | money }} viennent de vous être versés. Merci de faire grandir GLOBUS !",
        "/espace-client/parrainage",
    ),
    # ------------------------------------------------------------------ innovations lot 2
    (
        "assistant.handoff",
        "WhatsApp — {{ reason }} : {{ name }}",
        "{% if project_name %}{{ project_name }} · {% endif %}« {{ excerpt }} » ({{ phone }}). Répondez depuis la boîte "
        "de réception de l'assistant.",
        "{{ link }}",
    ),
    (
        "assistant.message",
        "Nouveau message WhatsApp — {{ name }}",
        "« {{ excerpt }} » (conversation reprise par un conseiller).",
        "{{ link }}",
    ),
    (
        "lead.estimate_validated",
        "Votre estimation validée par notre ingénieur",
        "Bonjour {{ first_name }}, fourchette validée : {{ range }}. {{ note }}",
        "{{ link }}",
    ),
    (
        "timelapse.ready",
        "Votre chantier en vidéo — {{ project_name }}",
        "Le time-lapse de la semaine {{ period }} est disponible ({{ frames }} images).",
        "/espace-client/chantier",
    ),
    (
        "procurement.price_alert",
        "Hausse prévue : {{ family }} (+{{ trend_pct }} %)",
        "Commander maintenant {{ quantity }} déjà demandés économiserait environ {{ saving | money }}.",
        "/erp/achats/prix",
    ),
    (
        "planning.risk_detected",
        "{{ count }} risque(s) de retard — {{ project_code }}",
        "{{ project_name }} : pluie, livraison, absence ou dépendance. Propositions de replanification prêtes.",
        "{{ link }}",
    ),
    (
        "planning.replanned",
        "Planning ajusté ({{ tasks }} tâche(s))",
        "{{ risk }}{% if milestones %} — jalon(s) impacté(s) : pensez à prévenir le client{% endif %}.",
        "{{ link }}",
    ),
    (
        "planning.client_notice",
        "Mise à jour de votre planning — {{ project_name }}",
        "{{ message }}",
        "/espace-client/planning",
    ),
    # ------------------------------------------------------------------ innovations lot 3
    (
        "maintenance.due",
        "Entretien à prévoir : {{ title }}",
        "{{ project_name }} — à faire avant le {{ due_on | d }}. Marquez-le « fait » ou planifiez une intervention.",
        "{{ link }}",
    ),
    (
        "maintenance.predictive_alert",
        "SAV prédictif : {{ equipment }}",
        "{{ summary }}. Proposez une visite préventive au client.",
        "{{ link }}",
    ),
    (
        "energy.option_requested",
        "Option énergie demandée — {{ project_name }}",
        "{{ measures }} : investissement {{ investment | money }}, économie estimée {{ savings_year | money }} / an. "
        "Préparer l'avenant chiffré.",
        "{{ link }}",
    ),
    (
        "financing.submitted",
        "Dossier de financement {{ number }} transmis",
        "{{ applicant }} — {{ amount | money }} — établissements : {{ partners }}.",
        "{{ link }}",
    ),
    (
        "financing.partner_response",
        "Réponse de {{ partner }} — dossier {{ number }}",
        "{% if status == 'offer' %}Une offre de financement vous attend : comparez et acceptez-la par code.{% elif status == 'declined' %}"
        "L'établissement n'a pas retenu votre dossier.{% else %}Votre dossier est à l'étude.{% endif %}",
        "{{ link }}",
    ),
    (
        "financing.accepted",
        "Offre de financement acceptée — {{ number }}",
        "Le client a accepté l'offre de {{ partner }}.",
        "{{ link }}",
    ),
    (
        "escrow.deposit",
        "Fonds sous séquestre — {{ number }}",
        "{{ amount | money }} reçus et conservés sous séquestre jusqu'à la validation du jalon.",
        "/espace-client/finances",
    ),
    (
        "escrow.release_requested",
        "Jalon atteint : validez la libération — {{ project_name }}",
        "« {{ milestone }} » est atteint (PV et photos certifiées joints). Validez par code ou contestez sous {{ review_days }} jours.",
        "{{ link }}",
    ),
    (
        "escrow.release_approved",
        "Libération validée par le client — {{ number }}",
        "{{ amount | money }} : double validation Finance / Direction requise.",
        "{{ link }}",
    ),
    (
        "escrow.disputed",
        "Contestation du client — séquestre {{ number }}",
        "Motif : {{ reason }}",
        "{{ link }}",
    ),
    (
        "escrow.released",
        "Fonds libérés — {{ milestone }}",
        "{{ amount | money }} libérés après validation du jalon « {{ milestone }} ».",
        "{{ link }}",
    ),
    (
        "escrow.review_overdue",
        "Séquestre {{ number }} : client sans réponse",
        "Aucune décision du client après {{ days }} jours : prendre contact (aucune libération automatique).",
        "{{ link }}",
    ),
    (
        "twin.validated",
        "Avancement mesuré de votre chantier",
        "Mesure certifiée : {% if overall %}{{ overall }} % d'avancement observé{% else %}voir le détail{% endif %}.",
        "{{ link }}",
    ),
]

# Modèles e-mail transactionnels (corps HTML rendu dans le gabarit de marque).
_EMAIL: list[tuple[str, str, str]] = [
    (
        "auth.password_reset",
        "Réinitialisation de votre mot de passe",
        "<p>Bonjour {{ first_name }},</p><p>Une réinitialisation de mot de passe a été demandée pour votre compte "
        "GLOBUS ENGINEERING.</p><p><a class='btn' href='{{ link }}'>Choisir un nouveau mot de passe</a></p>"
        "<p>Ce lien expire dans {{ ttl_minutes }} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>",
    ),
    (
        "auth.invitation",
        "Invitation à rejoindre GLOBUS ENGINEERING",
        "<p>Bonjour {{ first_name or '' }},</p><p>{{ inviter }} vous invite à rejoindre la plateforme GLOBUS ENGINEERING"
        "{% if role_label %} en tant que <strong>{{ role_label }}</strong>{% endif %}.</p>{% if message %}<p>{{ message }}</p>{% endif %}"
        "<p><a class='btn' href='{{ link }}'>Activer mon compte</a></p><p>Lien valable {{ ttl_days }} jours.</p>",
    ),
    (
        "auth.email_verification",
        "Confirmez votre adresse e-mail",
        "<p>Bonjour {{ first_name }},</p><p>Confirmez votre adresse e-mail pour activer votre espace :</p>"
        "<p><a class='btn' href='{{ link }}'>Confirmer mon e-mail</a></p>",
    ),
    (
        "auth.otp",
        "Votre code de validation",
        "<p>Bonjour {{ first_name }},</p><p>Votre code de validation pour « {{ purpose }} » est :</p>"
        "<p class='code'>{{ code }}</p><p>Il expire dans {{ ttl_minutes }} minutes. Ne le communiquez à personne.</p>",
    ),
    (
        "auth.new_device",
        "Nouvelle connexion à votre compte",
        "<p>Bonjour {{ first_name }},</p><p>Une connexion a eu lieu depuis un nouvel appareil : <strong>{{ device }}</strong> "
        "({{ ip }}) le {{ at | dt }}.</p><p>Si ce n'est pas vous, changez votre mot de passe et révoquez la session depuis "
        "« Compte → Sécurité ».</p>",
    ),
    (
        "lead.auto_reply",
        "Nous avons bien reçu votre projet",
        "<p>Bonjour {{ first_name }},</p><p>Merci d'avoir décrit votre projet à GLOBUS ENGINEERING. Votre demande "
        "<strong>{{ number }}</strong> est enregistrée ; un conseiller vous contacte {{ sla_text }}.</p>"
        "<p>Concevoir. Calculer. Construire. Contrôler.</p>",
    ),
    (
        "quote.sent",
        "Votre devis {{ number }} — {{ title }}",
        "<p>Bonjour {{ first_name }},</p><p>Veuillez trouver votre devis <strong>{{ number }}</strong> d'un montant de "
        "<strong>{{ total | money }}</strong>, valable jusqu'au {{ valid_until | d }}.</p>"
        "<p><a class='btn' href='{{ link }}'>Consulter et valider le devis</a></p>",
    ),
    (
        "purchase_order.sent",
        "Bon de commande {{ number }} — GLOBUS ENGINEERING",
        "<p>Bonjour,</p><p>Veuillez trouver ci-joint notre bon de commande <strong>{{ number }}</strong> "
        "({{ total | money }}), livraison souhaitée le {{ expected_date | d }} à : {{ delivery_address }}.</p>"
        "<p><a class='btn' href='{{ link }}'>Confirmer, refuser ou proposer une contre-offre</a></p>"
        "<p>Merci de mentionner le numéro {{ number }} sur le bon de livraison et la facture.</p>",
    ),
    (
        "funds_call.issued",
        "Appel de fonds {{ number }} — {{ project_name }}",
        "<p>Bonjour {{ first_name }},</p><p>Conformément à l'échéancier de votre projet, un appel de fonds de "
        "<strong>{{ amount | money }}</strong> est émis ({{ label }}), échéance le {{ due_date | d }}.</p>"
        "<p><a class='btn' href='{{ link }}'>Payer en ligne</a></p>",
    ),
    (
        "client_invoice.sent",
        "Facture {{ number }} — {{ project_name }}",
        "<p>Bonjour {{ first_name }},</p><p>Votre facture <strong>{{ number }}</strong> ({{ label }}) d'un montant de "
        "<strong>{{ amount | money }}</strong> est disponible dans votre espace client, échéance le {{ due_date | d }}."
        "</p><p><a class='btn' href='{{ link }}'>Consulter et payer en ligne</a></p>",
    ),
    (
        "billing.payment_reminder",
        "Rappel de paiement — facture {{ number }}",
        "<p>Bonjour {{ first_name }},</p><p>Sauf erreur de notre part, la facture <strong>{{ number }}</strong> "
        "({{ label }}) présente un reste à régler de <strong>{{ amount | money }}</strong> ({{ stage_label }}, "
        "échéance le {{ due_date | d }}).</p><p>Vous pouvez la régler en ligne par MTN MoMo, Orange Money ou carte "
        "bancaire, sans connexion, via ce lien sécurisé.</p><p><a class='btn' href='{{ pay_link or link }}'>Régler maintenant</a></p>"
        "<p>Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.</p>",
    ),
    (
        "payment.receipt",
        "Reçu de paiement {{ number }}",
        "<p>Bonjour {{ first_name }},</p><p>Nous confirmons la réception de <strong>{{ amount | money }}</strong> "
        "le {{ paid_at | dt }} ({{ method }}). Le reçu est disponible dans votre espace client.</p>",
    ),
    (
        "tender.invitation",
        "Consultation {{ number }} — {{ title }}",
        "<p>Bonjour,</p><p>GLOBUS ENGINEERING vous invite à répondre à la consultation <strong>{{ number }}</strong> "
        "« {{ title }} » avant le {{ deadline | dt }}.</p><p><a class='btn' href='{{ link }}'>Accéder au dossier</a></p>",
    ),
    (
        "client.digest",
        "Votre point hebdomadaire — {{ project_name }}",
        "<p>Bonjour {{ first_name }},</p>{{ html | safe }}<p><a class='btn' href='{{ link }}'>Ouvrir mon espace</a></p>",
    ),
    (
        "newsletter.confirm",
        "Confirmez votre inscription",
        "<p>Bonjour,</p><p>Merci de votre intérêt pour GLOBUS ENGINEERING. Confirmez votre inscription :</p>"
        "<p><a class='btn' href='{{ link }}'>Je confirme</a></p><p>Sans confirmation, aucune newsletter ne vous sera envoyée.</p>",
    ),
    (
        "generic.notification",
        "{{ title }}",
        "<p>{{ body }}</p>{% if link %}<p><a class='btn' href='{{ link }}'>Ouvrir</a></p>{% endif %}",
    ),
    (
        "review.invited",
        "Votre avis sur votre projet {{ project_name }}",
        "<p>Bonjour {{ first_name }},</p><p>Votre projet <strong>{{ project_name }}</strong> touche à sa fin : votre "
        "avis nous aide à progresser et guide les futurs clients. Deux minutes suffisent (note, quelques mots, une "
        "photo si vous le souhaitez).</p><p><a class='btn' href='{{ link }}'>Donner mon avis</a></p>"
        "<p>Votre avis n'est publié qu'avec votre accord explicite. Ce lien est personnel : merci de ne pas le "
        "transférer.</p>",
    ),
    (
        "billing.installment_reminder",
        "Échéance {{ index }}/{{ count }} — {{ amount | money }}",
        "<p>Bonjour {{ first_name }},</p><p>Selon l'échéancier <strong>{{ number }}</strong> ({{ label }}), "
        "l'échéance n°{{ index }} de <strong>{{ amount | money }}</strong> est due "
        "({{ stage_label }}, date prévue : {{ due_date | d }}).</p><p><a class='btn' href='{{ pay_link or link }}'>Régler cette "
        "échéance</a></p><p>Lien de paiement sécurisé (MTN MoMo, Orange Money, carte) — aucune connexion requise.</p>",
    ),
    (
        "executive_report.ready",
        "Rapport de direction {{ number }} — {{ headline }}",
        "<p>Bonjour {{ first_name }},</p><p>Le rapport de direction de la semaine {{ period }} est disponible : "
        "<strong>{{ headline }}</strong>.</p><p><a class='btn' href='{{ link }}'>Lire le rapport</a></p>",
    ),
    (
        "payment_plan.proposed",
        "Votre échéancier {{ number }} est prêt",
        "<p>Bonjour {{ first_name }},</p><p>Notre service comptable a préparé votre échéancier "
        "<strong>{{ number }}</strong> ({{ count }} échéances). Consultez-le et acceptez-le par code depuis votre "
        "espace client.</p><p><a class='btn' href='{{ link }}'>Voir l'échéancier</a></p>",
    ),
    (
        "lead.estimate_validated",
        "Votre estimation de projet validée — GLOBUS ENGINEERING",
        "<p>Bonjour {{ first_name }},</p><p>{{ engineer }} a étudié vos photos et votre description : la fourchette "
        "indicative de votre projet est de <strong>{{ range }}</strong>.</p>{% if note %}<p>{{ note }}</p>{% endif %}"
        "<p>Prochaine étape : un rendez-vous pour affiner le programme et établir un devis détaillé.</p>"
        "<p><a class='btn' href='{{ link }}'>Préciser mon projet</a></p>",
    ),
    (
        "timelapse.ready",
        "Votre chantier en vidéo — {{ project_name }}",
        "<p>Bonjour {{ first_name }},</p><p>Le time-lapse de la semaine {{ period }} de votre chantier "
        "<strong>{{ project_name }}</strong> est prêt : {{ frames }} images, de lundi à dimanche.</p>"
        "<p><a class='btn' href='{{ link }}'>Voir la vidéo</a></p>",
    ),
    (
        "planning.client_notice",
        "Mise à jour de votre planning — {{ project_name }}",
        "<p>Bonjour {{ first_name }},</p><p>{{ message }}</p><p><a class='btn' href='{{ link }}'>Voir le planning</a></p>",
    ),
    (
        "financing.partner_dossier",
        "Dossier de financement {{ number }} — client GLOBUS ENGINEERING",
        "<p>Bonjour {{ contact }},</p><p>Un client de GLOBUS ENGINEERING vous transmet son dossier de financement "
        "<strong>{{ number }}</strong> ({{ amount | money }}), avec son accord explicite.</p><p>Le lien ci-dessous, "
        "personnel et valable 30 jours, donne accès au dossier et aux pièces (filigranées) et vous permet de répondre "
        "en ligne (étude, offre ou refus).</p><p><a class='btn' href='{{ link }}'>Ouvrir le dossier</a></p>"
        "<p>Merci de ne pas transférer ce lien.</p>",
    ),
    (
        "maintenance.due",
        "Entretien à prévoir : {{ title }}",
        "<p>Bonjour {{ first_name }},</p><p>Pour garder votre bâtiment en parfait état (et vos garanties), pensez à : "
        "<strong>{{ title }}</strong> avant le {{ due_on | d }}.</p><p><a class='btn' href='{{ link }}'>Mon carnet "
        "d'entretien</a></p>",
    ),
    (
        "escrow.release_requested",
        "Jalon « {{ milestone }} » atteint — validation de la libération",
        "<p>Bonjour {{ first_name }},</p><p>Le jalon <strong>{{ milestone }}</strong> de votre projet {{ project_name }} "
        "est atteint : le procès-verbal et les photos certifiées sont disponibles dans votre espace.</p><p>Validez la "
        "libération des {{ amount | money }} conservés sous séquestre par code à usage unique, ou contestez-la, sous "
        "{{ review_days }} jours.</p><p><a class='btn' href='{{ link }}'>Examiner et valider</a></p>",
    ),
]

# Règles par défaut : événement → audience → canaux.
DEFAULT_RULES: list[dict[str, Any]] = [
    {
        "event": "lead.created",
        "audience": {"roles": ["COMMERCIAL", "DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "crm",
    },
    {
        "event": "lead.assigned",
        "audience": {"payload_users": ["assigned_to_id"]},
        "channels": ["in_app", "push", "email"],
        "category": "crm",
        "priority": "high",
    },
    {
        "event": "lead.sla_breached",
        "audience": {"payload_users": ["assigned_to_id"], "roles": ["DIRECTION"]},
        "channels": ["in_app", "push", "email"],
        "category": "crm",
        "priority": "high",
    },
    {
        "event": "quote.accepted",
        "audience": {"payload_users": ["owner_id"], "roles": ["DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "crm",
    },
    {
        "event": "contract.signed",
        "audience": {"roles": ["DIRECTION", "FINANCE"]},
        "channels": ["in_app"],
        "category": "crm",
    },
    {
        "event": "project.member_added",
        "audience": {"payload_users": ["user_id"]},
        "channels": ["in_app", "email"],
        "category": "projects",
    },
    {
        "event": "purchase_request.submitted",
        "audience": {"payload_users": ["approver_ids"]},
        "channels": ["in_app", "push"],
        "category": "procurement",
    },
    {
        "event": "purchase_request.approved",
        "audience": {"payload_users": ["requested_by_id"]},
        "channels": ["in_app", "push"],
        "category": "procurement",
    },
    {
        "event": "purchase_request.rejected",
        "audience": {"payload_users": ["requested_by_id"]},
        "channels": ["in_app", "push"],
        "category": "procurement",
    },
    {
        "event": "purchase_order.confirmed",
        "audience": {"payload_users": ["site_manager_id", "created_by_id"], "project_roles": ["chef_chantier"]},
        "channels": ["in_app", "push"],
        "category": "deliveries",
        "priority": "high",
    },
    {
        "event": "purchase_order.refused",
        "audience": {"payload_users": ["created_by_id"], "roles": ["ACHETEUR"]},
        "channels": ["in_app", "push"],
        "category": "procurement",
        "priority": "high",
    },
    {
        "event": "purchase_order.countered",
        "audience": {"payload_users": ["created_by_id"], "roles": ["ACHETEUR"]},
        "channels": ["in_app", "push"],
        "category": "procurement",
    },
    {
        "event": "delivery.announced",
        "audience": {"payload_users": ["site_manager_id"], "project_roles": ["chef_chantier"]},
        "channels": ["in_app", "push"],
        "category": "deliveries",
        "priority": "high",
    },
    {
        "event": "goods_receipt.validated",
        "audience": {"roles": ["ACHETEUR"], "payload_users": ["po_created_by_id"]},
        "channels": ["in_app"],
        "category": "deliveries",
    },
    {
        "event": "goods_receipt.exception",
        "audience": {"roles": ["ACHETEUR"], "project_roles": ["chef_projet"]},
        "channels": ["in_app", "push"],
        "category": "deliveries",
        "priority": "high",
    },
    {
        "event": "supplier_invoice.match_exception",
        "audience": {"roles": ["FINANCE", "ACHETEUR"]},
        "channels": ["in_app", "push"],
        "category": "finance",
        "priority": "high",
    },
    {
        "event": "supplier_invoice.matched",
        "audience": {"roles": ["FINANCE"]},
        "channels": ["in_app"],
        "category": "finance",
    },
    {"event": "payment.succeeded", "audience": {"roles": ["FINANCE"]}, "channels": ["in_app"], "category": "finance"},
    {
        "event": "payment.failed",
        "audience": {"roles": ["FINANCE"]},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
        "priority": "high",
    },
    {
        "event": "payment.awaiting_approval",
        "audience": {"roles": ["FINANCE", "DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "finance",
    },
    {
        "event": "funds_call.issued",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email", "whatsapp"],
        "category": "finance",
        "email_template": "funds_call.issued",
    },
    {
        "event": "client_invoice.sent",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
        "email_template": "client_invoice.sent",
    },
    {
        "event": "billing.payment_reminder",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
        "email_template": "billing.payment_reminder",
    },
    {
        "event": "client_payment.received",
        "audience": {"client": True},
        "channels": ["in_app", "email"],
        "category": "finance",
        "email_template": "payment.receipt",
    },
    {
        "event": "tender.published",
        "audience": {"payload_users": ["invited_user_ids"]},
        "channels": ["in_app", "email"],
        "category": "subcontracting",
        "email_template": "tender.invitation",
    },
    {
        "event": "bid.submitted",
        "audience": {"project_roles": ["chef_projet"], "roles": ["DIRECTION"]},
        "channels": ["in_app"],
        "category": "subcontracting",
    },
    {
        "event": "bid.awarded",
        "audience": {"payload_users": ["subcontractor_user_ids"]},
        "channels": ["in_app", "email"],
        "category": "subcontracting",
    },
    {
        "event": "situation.submitted",
        "audience": {"project_roles": ["chef_projet", "conducteur"]},
        "channels": ["in_app", "push"],
        "category": "subcontracting",
    },
    {
        "event": "situation.validated",
        "audience": {"payload_users": ["subcontractor_user_ids"], "roles": ["FINANCE"]},
        "channels": ["in_app", "email"],
        "category": "subcontracting",
    },
    {
        "event": "situation.rejected",
        "audience": {"payload_users": ["subcontractor_user_ids"]},
        "channels": ["in_app", "email"],
        "category": "subcontracting",
    },
    {
        "event": "situation.blocked",
        "audience": {"roles": ["DIRECTION"], "project_roles": ["chef_projet"]},
        "channels": ["in_app", "push"],
        "category": "subcontracting",
        "priority": "high",
    },
    {
        "event": "dispute.opened",
        "audience": {"payload_users": ["owner_id"], "roles": ["DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "disputes",
        "priority": "high",
    },
    {
        "event": "dispute.updated",
        "audience": {"payload_users": ["owner_id", "party_user_ids"]},
        "channels": ["in_app"],
        "category": "disputes",
    },
    {
        "event": "dispute.escalated",
        "audience": {"roles": ["DIRECTION", "ADMIN"]},
        "channels": ["in_app", "push", "email"],
        "category": "disputes",
        "priority": "critical",
    },
    {
        "event": "document.version_published",
        "audience": {"project_members": True},
        "channels": ["in_app"],
        "category": "documents",
    },
    {
        "event": "document.obsolete_alert",
        "audience": {"payload_users": ["user_ids"]},
        "channels": ["in_app", "push"],
        "category": "documents",
        "priority": "high",
    },
    {
        "event": "document.approval_requested",
        "audience": {"payload_users": ["approver_ids"]},
        "channels": ["in_app", "push"],
        "category": "documents",
    },
    {
        "event": "document.client_published",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "documents",
    },
    {
        "event": "deliverables.released",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "documents",
        "priority": "high",
    },
    {
        "event": "signature.requested",
        "audience": {"payload_users": ["signer_ids"]},
        "channels": ["in_app", "push", "email"],
        "category": "documents",
        "priority": "high",
    },
    {
        "event": "bim.issue_assigned",
        "audience": {"payload_users": ["assignee_id"]},
        "channels": ["in_app", "push"],
        "category": "bim",
    },
    {
        "event": "bim.issue_resolved",
        "audience": {"payload_users": ["created_by_id"]},
        "channels": ["in_app"],
        "category": "bim",
    },
    {
        "event": "bim.version_ready",
        "audience": {"payload_users": ["uploaded_by_id"]},
        "channels": ["in_app"],
        "category": "bim",
    },
    {"event": "bim.version_published", "audience": {"client": True}, "channels": ["in_app", "push"], "category": "bim"},
    {
        "event": "decision.requested",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email", "whatsapp"],
        "category": "decisions",
        "priority": "high",
    },
    {
        "event": "decision.validated",
        "audience": {
            "project_roles": ["chef_projet", "architecte", "conducteur"],
            "payload_users": ["requested_by_id"],
        },
        "channels": ["in_app", "push"],
        "category": "decisions",
    },
    {
        "event": "change_order.submitted",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "decisions",
        "priority": "high",
    },
    {
        "event": "change_order.approved",
        "audience": {"project_roles": ["chef_projet"], "roles": ["FINANCE"]},
        "channels": ["in_app"],
        "category": "decisions",
    },
    {
        "event": "incident.declared",
        "audience": {"roles": ["QHSE"], "project_roles": ["chef_projet", "chef_chantier"]},
        "channels": ["in_app", "push"],
        "category": "qhse",
        "priority": "high",
    },
    {
        "event": "incident.declared",
        "audience": {"roles": ["DIRECTION"]},
        "channels": ["in_app", "push", "email"],
        "category": "qhse",
        "priority": "critical",
        "conditions": {"severity": ["critical"]},
    },
    {"event": "incident.client_published", "audience": {"client": True}, "channels": ["in_app"], "category": "qhse"},
    {
        "event": "corrective_action.overdue",
        "audience": {"payload_users": ["responsible_id"], "roles": ["QHSE"]},
        "channels": ["in_app", "push"],
        "category": "qhse",
    },
    {
        "event": "daily_log.critical",
        "audience": {"project_roles": ["chef_projet"], "roles": ["DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "projects",
        "priority": "high",
    },
    {
        "event": "ticket.created",
        "audience": {"permission": "support:write"},
        "channels": ["in_app", "push"],
        "category": "support",
    },
    {
        "event": "ticket.assigned",
        "audience": {"payload_users": ["assigned_to_id"]},
        "channels": ["in_app", "push"],
        "category": "support",
    },
    {
        "event": "ticket.client_update",
        "audience": {"payload_users": ["requester_id"]},
        "channels": ["in_app", "push", "email"],
        "category": "support",
    },
    {
        "event": "ticket.sla_breached",
        "audience": {"payload_users": ["assigned_to_id"], "roles": ["DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "support",
        "priority": "high",
    },
    {
        "event": "call.missed",
        "audience": {"payload_users": ["user_ids"]},
        "channels": ["in_app", "push"],
        "category": "calls",
    },
    {
        "event": "message.new",
        "audience": {"payload_users": ["offline_user_ids"]},
        "channels": ["push"],
        "category": "chat",
    },
    {
        "event": "client.digest",
        "audience": {"client": True},
        "channels": ["in_app", "email"],
        "category": "digest",
        "email_template": "client.digest",
    },
    {
        "event": "stock.low",
        "audience": {"roles": ["MAGASINIER", "ACHETEUR"]},
        "channels": ["in_app"],
        "category": "inventory",
    },
    {
        "event": "equipment.maintenance_due",
        "audience": {"roles": ["MAGASINIER"]},
        "channels": ["in_app"],
        "category": "equipment",
    },
    {
        "event": "tranquillite.due_soon",
        "audience": {"payload_users": ["responsible_id"], "client": True},
        "channels": ["in_app", "email"],
        "category": "tranquillite",
    },
    {
        "event": "security.new_device",
        "audience": {"payload_users": ["user_id"]},
        "channels": ["in_app", "email"],
        "category": "security",
        "priority": "critical",
        "email_template": "auth.new_device",
    },
    {
        "event": "system.alert",
        "audience": {"roles": ["ADMIN"]},
        "channels": ["in_app", "email"],
        "category": "system",
        "priority": "critical",
    },
    {
        "event": "anomaly.detected",
        "audience": {"roles": ["FINANCE", "DIRECTION"]},
        "channels": ["in_app"],
        "category": "ai",
    },
    {
        "event": "prediction.risk",
        "audience": {"roles": ["DIRECTION"], "project_roles": ["chef_projet"]},
        "channels": ["in_app", "push"],
        "category": "ai",
        "priority": "high",
    },
    # ------------------------------------------------------------------ innovations lot 1 (ajoutées en fin de liste :
    # le nom des règles système dépend de leur rang)
    {
        "event": "project.trust_alert",
        "audience": {"payload_users": ["manager_id"], "roles": ["DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "projects",
        "priority": "high",
    },
    {
        "event": "review.invited",
        "audience": {"payload_users": ["user_id"]},
        "channels": ["in_app", "push"],
        "category": "projects",
    },
    {
        "event": "review.submitted",
        "audience": {"roles": ["MARKETING", "DIRECTION"]},
        "channels": ["in_app"],
        "category": "crm",
    },
    {
        "event": "payment_plan.requested",
        "audience": {"roles": ["FINANCE"]},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
        "priority": "high",
    },
    {
        "event": "payment_plan.proposed",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
        "email_template": "payment_plan.proposed",
    },
    {
        "event": "payment_plan.rejected",
        "audience": {"client": True},
        "channels": ["in_app", "email"],
        "category": "finance",
    },
    {
        "event": "payment_plan.accepted",
        "audience": {"roles": ["FINANCE"]},
        "channels": ["in_app"],
        "category": "finance",
    },
    {
        "event": "payment_plan.defaulted",
        "audience": {"roles": ["FINANCE", "DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "finance",
        "priority": "high",
    },
    {
        "event": "billing.installment_reminder",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
        "email_template": "billing.installment_reminder",
    },
    {
        "event": "executive_report.ready",
        "audience": {"roles": ["DIRECTION", "ADMIN"]},
        "channels": ["in_app", "email"],
        "category": "reports",
        "email_template": "executive_report.ready",
    },
    {
        "event": "site_panel.message",
        "audience": {"payload_users": ["manager_id"], "project_roles": ["chef_projet"]},
        "channels": ["in_app", "push"],
        "category": "projects",
    },
    {
        "event": "site_panel.message",
        "audience": {"roles": ["QHSE"]},
        "channels": ["in_app"],
        "category": "qhse",
        "conditions": {"kind": "riverain"},
    },
    {
        "event": "referral.captured",
        "audience": {"roles": ["MARKETING", "COMMERCIAL"]},
        "channels": ["in_app"],
        "category": "crm",
    },
    {
        "event": "referral.reward_pending",
        "audience": {"roles": ["DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "crm",
    },
    {
        "event": "referral.approved",
        "audience": {"payload_users": ["ambassador_user_id"]},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
    },
    {
        "event": "referral.paid",
        "audience": {"payload_users": ["ambassador_user_id"]},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
    },
    # ------------------------------------------------------------------ innovations lot 2
    {
        "event": "assistant.handoff",
        "audience": {"payload_users": ["manager_id"], "project_roles": ["chef_projet"]},
        "channels": ["in_app", "push"],
        "category": "crm",
        "priority": "high",
    },
    {
        "event": "assistant.handoff",
        "audience": {"roles": ["COMMERCIAL"]},
        "channels": ["in_app", "push"],
        "category": "crm",
        "conditions": {"project_name": None},
    },
    {
        "event": "assistant.message",
        "audience": {"payload_users": ["handled_by_id"]},
        "channels": ["in_app", "push"],
        "category": "crm",
    },
    {
        "event": "timelapse.ready",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "projects",
        "email_template": "timelapse.ready",
    },
    {
        "event": "procurement.price_alert",
        "audience": {"roles": ["ACHETEUR", "DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "procurement",
        "priority": "high",
    },
    {
        "event": "planning.risk_detected",
        "audience": {"payload_users": ["manager_id"], "project_roles": ["chef_projet", "conducteur_travaux"]},
        "channels": ["in_app", "push"],
        "category": "planning",
        "priority": "high",
    },
    {
        "event": "planning.replanned",
        "audience": {"project_roles": ["chef_projet", "conducteur_travaux"]},
        "channels": ["in_app"],
        "category": "planning",
    },
    {
        "event": "planning.client_notice",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "projects",
        "email_template": "planning.client_notice",
    },
    # ------------------------------------------------------------------ innovations lot 3
    {
        "event": "maintenance.due",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "projects",
        "email_template": "maintenance.due",
    },
    {
        "event": "maintenance.predictive_alert",
        "audience": {"permission": "support:write", "project_roles": ["chef_projet"]},
        "channels": ["in_app"],
        "category": "support",
    },
    {
        "event": "energy.option_requested",
        "audience": {"payload_users": ["manager_id"], "roles": ["COMMERCIAL"]},
        "channels": ["in_app", "push"],
        "category": "projects",
    },
    {
        "event": "financing.submitted",
        "audience": {"roles": ["FINANCE", "COMMERCIAL"]},
        "channels": ["in_app"],
        "category": "finance",
    },
    {
        "event": "financing.partner_response",
        "audience": {"payload_users": ["user_id"]},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
    },
    {
        "event": "financing.accepted",
        "audience": {"roles": ["FINANCE", "DIRECTION"]},
        "channels": ["in_app"],
        "category": "finance",
    },
    {
        "event": "escrow.deposit",
        "audience": {"client": True},
        "channels": ["in_app"],
        "category": "finance",
    },
    {
        "event": "escrow.release_requested",
        "audience": {"client": True},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
        "priority": "high",
        "email_template": "escrow.release_requested",
    },
    {
        "event": "escrow.release_approved",
        "audience": {"roles": ["FINANCE", "DIRECTION"]},
        "channels": ["in_app", "push"],
        "category": "finance",
        "priority": "high",
    },
    {
        "event": "escrow.disputed",
        "audience": {"roles": ["DIRECTION"], "project_roles": ["chef_projet"]},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
        "priority": "high",
    },
    {
        "event": "escrow.released",
        "audience": {"client": True, "project_roles": ["chef_projet"]},
        "channels": ["in_app", "push", "email"],
        "category": "finance",
    },
    {
        "event": "escrow.review_overdue",
        "audience": {"roles": ["DIRECTION"]},
        "channels": ["in_app", "email"],
        "category": "finance",
    },
    {
        "event": "twin.validated",
        "audience": {"client": True},
        "channels": ["in_app"],
        "category": "projects",
    },
    # Ajouts : toujours en fin de liste (le nom des règles système dépend de leur rang).
    {
        "event": "voice_report.received",
        "audience": {"payload_users": ["manager_id"], "project_roles": ["chef_projet", "conducteur_travaux"]},
        "channels": ["in_app", "push", "email"],
        "category": "projects",
    },
    {
        "event": "voice_report.received",
        "audience": {"roles": ["DIRECTION"], "project_scoped": True},
        "conditions": {"is_critical": True},
        "channels": ["in_app", "push"],
        "category": "projects",
        "priority": "high",
    },
]


def default_templates() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for code, title, body, link in _IN_APP:
        out.append({"code": code, "channel": "in_app", "subject": title, "body": body + "\n---\n" + link})
        out.append({"code": code, "channel": "push", "subject": title, "body": body})
        out.append({"code": code, "channel": "sms", "subject": None, "body": f"GLOBUS : {title} — {body}"})
        out.append({"code": code, "channel": "whatsapp", "subject": None, "body": f"*{title}*\n{body}"})
    for code, subject, html in _EMAIL:
        out.append({"code": code, "channel": "email", "subject": subject, "body": html})
    return out
