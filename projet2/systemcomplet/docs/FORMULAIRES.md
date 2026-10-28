# Inventaire des formulaires de la plateforme GLOBUS

> Généré automatiquement depuis le code (`node apps/web/scripts/forms-inventory.mjs`) — ne pas modifier à la main.
> Chaque formulaire : où il se trouve, le bouton qui l'ouvre, le titre de la fenêtre, puis ses champs **dans l'ordre affiché**, avec leur libellé exact. **Oui** = champ obligatoire (marqué d'un astérisque rouge à l'écran).

311 formulaires.

## `/activation`

### formulaire

validation : **Activer et continuer** · `/auth/invitations/accept` · composant `ActivationForm`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Prénom |  | texte |  |
| 2 | Nom |  | texte |  |
| 3 | Téléphone (WhatsApp) |  | téléphone |  |
| 4 | Choisissez votre mot de passe | **Oui** | mot de passe |  |
| 5 | Confirmez le mot de passe | **Oui** | mot de passe |  |

## `/blog/[slug]`

### formulaire

validation : **Publier** · `/public/blog/posts/${encodeURIComponent(slug)}/comments` · composant `CommentForm`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte |  |
| 2 | E-mail (non publié) |  | adresse e-mail |  |
| 3 | parentId ? "Votre réponse" : "Votre commentaire" | **Oui** | texte long |  |

## `/connexion`

### formulaire

validation : **Vérifier · Utiliser ma clé de sécurité · Se connecter** · `/auth/email/verify` · composant `LoginForm`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code de l'application d'authentification |  | saisie |  |
| 2 | Code de secours |  | texte |  |
| 3 | Faire confiance à cet appareil pendant 30 jours |  | case à cocher |  |
| 4 | Adresse e-mail |  | adresse e-mail |  |
| 5 | Mot de passe |  | texte |  |
| 6 | Rester connecté |  | case à cocher |  |

## `/decrire-mon-projet`

### formulaire

validation : **Retour · Continuer · Envoyer ma demande** · `/public/estimate` · composant `DescribeProjectWizard`

Aussi dans : `/services/[slug]`, `/aide/[slug]`, `/blog/[slug]`, Site web › Contenus (CMS) (`/erp/cms`), `/expertises/[slug]`, `/offres/[universe]`, `/offres/[universe]/[offer]`, `/projets/[slug]`, `/`, `/[...slug]`, `/aide`, `/blog`, Site web › Contenus (CMS) (`/erp/cms/pages/[id]`), `/expertises`, `/faq`, `/offres`, `/projets`, `/services`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type de projet | **Oui** | liste : maison individuelle · immeuble · commerce · bureaux · industriel · Rénovation · Extension · Études · suivi · Autre |  |
| 2 | Localisation du projet (ville, quartier) |  | texte |  |
| 3 | Disposez-vous d'un terrain ? |  | liste : Oui · Non, pas encore |  |
| 4 | Statut du terrain |  | liste : Titre foncier · En cours · Acte de vente / attestation · Terrain coutumier · À vérifier |  |
| 5 | Surface du terrain (m²) |  | nombre |  |
| 6 | Surface à construire (m²) |  | nombre |  |
| 7 | Nombre de niveaux |  | nombre |  |
| 8 | Nombre de pièces |  | nombre |  |
| 9 | Standing |  | liste : Standard · Confort · Premium |  |
| 10 | Style souhaité |  | texte |  |
| 11 | Budget minimum |  | nombre |  |
| 12 | Budget maximum |  | nombre |  |
| 13 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 14 | Délai souhaité |  | liste : Immédiat · Sous 3 mois · Sous 6 mois · Sous 12 mois · Non déterminé |  |
| 15 | Financement |  | liste : Fonds propres · Crédit bancaire · Mixte · Investisseurs / associés · À définir |  |
| 16 | Décrivez votre projet en quelques mots |  | texte long |  |
| 17 | Prénom | **Oui** | texte |  |
| 18 | Nom |  | texte |  |
| 19 | E-mail |  | adresse e-mail |  |
| 20 | Téléphone |  | téléphone |  |
| 21 | WhatsApp |  | téléphone |  |
| 22 | Société (facultatif) |  | texte |  |
| 23 | Pays de résidence |  | texte |  |
| 24 | Ville |  | texte |  |
| 25 | Canal de contact préféré |  | liste : WhatsApp · Téléphone · E-mail |  |

## `/devis/[token]`

### formulaire

validation : **Recevoir mon code de validation · J'accepte le devis** · `/public/quotes/${encodeURIComponent(token)}/otp` · composant `PublicQuote`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code reçu | **Oui** | saisie |  |
| 2 | Nom et prénom du signataire | **Oui** | texte |  |
| 3 | J'ai lu le devis et j'accepte ses conditions. |  | case à cocher |  |

## `/espace-client/energie`

### formulaire

validation : **Enregistrer · Intégrer à mon projet** · `/client/energy/studies/${s.id}/request` · composant `EnergyContent`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom de l'étude |  | texte |  |

## `/espace-client/financement`

### formulaire

validation : **Retirer mon accord · Transmettre le dossier · Accepter cette offre** · `/client/financing/applications/${app.id}/documents` · composant `Dossier`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type de pièce |  | liste : Pièce d'identité · Justificatifs de revenus · Relevés bancaires (3 mois) · Titre foncier / attestation · Devis ou contrat GLOBUS · Autre pièce |  |
| 2 | …… |  | case à cocher |  |
| 3 | J'autorise GLOBUS ENGINEERING à transmettre mon dossier et mes pièces aux établissements cochés pour l'étude de mon financement. |  | case à cocher |  |

## `/espace-client/finances`

### Paiement en ligne

validation : **Annuler · Payer** · `/client/checkout` · composant `PayDialog`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Numéro Mobile Money à débiter |  | téléphone | Vous recevrez une demande de paiement à valider avec votre code secret. |
| 2 | Montant |  | nombre | Reste à régler : … — paiement partiel possible. |

### Contester la demande de libération

validation : **Valider la libération · Contester · Annuler** · `/client/escrow/items/${approving?.id}/otp` · composant `EscrowPanel`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Motif (15 caractères minimum) | **Oui** | texte long |  |

## `/espace-client/sav/[id]`

### Affecter le ticket

validation : **Enregistrer** · `POST /support/tickets/{ticket_id}/assign` · composant `TicketDetail`

Aussi dans : Commercial › SAV (`/erp/sav/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Technicien / responsable | **Oui** | liste des utilisateurs |  |

### Diagnostic

validation : **Enregistrer** · `POST /support/tickets/{ticket_id}/diagnosis` · composant `TicketDetail`

Aussi dans : Commercial › SAV (`/erp/sav/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Diagnostic | **Oui** | texte long (8000 car. max, 5 car. min) |  |

### Décision de garantie

validation : **Enregistrer** · `POST /support/tickets/{ticket_id}/warranty` · composant `TicketDetail`

Aussi dans : Commercial › SAV (`/erp/sav/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Décision | **Oui** | liste : Couvert · Non couvert · Partiel |  |
| 2 | Motif | **Oui** | texte long (4000 car. max, 5 car. min) |  |
| 3 | Partie responsable |  | liste : GLOBUS · Sous-traitant · Fournisseur · Client |  |

### Planifier une intervention

validation : **Enregistrer** · `POST /support/tickets/{ticket_id}/interventions` · composant `TicketDetail`

Aussi dans : Commercial › SAV (`/erp/sav/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Technicien |  | liste des utilisateurs |  |
| 2 | Planifié le | **Oui** | date et heure |  |

### Rapport d'intervention

validation : **Enregistrer** · `POST /support/interventions/{intervention_id}/finish` · composant `TicketDetail`

Aussi dans : Commercial › SAV (`/erp/sav/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Rapport | **Oui** | texte long (8000 car. max, 5 car. min) |  |
| 2 | Temps passé (h) |  | nombre (≥ 0, ≤ 500) |  |
| 3 | Fournitures utilisées |  | saisie dédiée (MaterialsEditor) |  |
| 4 | Main-d'œuvre |  | nombre (≥ 0) |  |
| 5 | Coût matériel |  | nombre (≥ 0) |  |
| 6 | Preuves de l'intervention (photos avant / après) |  | saisie dédiée (ProofPicker) |  |

### Affecter le ticket / Diagnostic / Décision de garantie / Planifier une intervention / Rapport d'intervention / Valider l'intervention / Rouvrir le ticket

validation : **Affecter · Diagnostic · Décision garantie · Planifier une intervention · Proposer une réponse (IA) · Valider l'intervention · Rouvrir · Démarrer · Terminer · Envoyer · Envoyer les fichiers · Valider** · `/support/tickets/${t.id}/ai-draft` · composant `TicketDetail`

Aussi dans : Commercial › SAV (`/erp/sav/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Note interne (invisible du client) |  | case à cocher |  |

## `/espace-client/sav`

### Nouvelle demande SAV

validation : **Envoyer la demande** · `POST /support/tickets` · composant `page:/espace-client/sav`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Catégorie |  | liste : Étanchéité · Plomberie · Électricité · Fissure · Menuiserie · Peinture · Équipement · Autre |  |
| 3 | Priorité |  | liste : Faible · Normale · Élevée · Urgente |  |
| 4 | Objet | **Oui** | texte (250 car. max, 3 car. min) |  |
| 5 | Description |  | texte long (8000 car. max) |  |
| 6 | Localisation |  | texte (250 car. max) |  |

## `/estimation-instantanee`

### formulaire

validation : **Arrêter · Réenregistrer / Enregistrer · … / … Obtenir mon estimation** · `/public/instant-estimate` · composant `InstantEstimate`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Univers |  | liste : Maison (Home) · Professionnel · Premium · Diaspora |  |
| 2 | Surface habitable (m²) |  | nombre | Laisser vide si inconnue |
| 3 | Niveaux |  | nombre |  |
| 4 | Standing |  | liste : Standard · Confort · Premium |  |
| 5 | Localisation du terrain |  | texte |  |
| 6 | Votre projet en quelques mots |  | texte long |  |
| 7 | Prénom | **Oui** | texte |  |
| 8 | Nom |  | texte |  |
| 9 | Ville de résidence |  | texte |  |
| 10 | Pays de résidence |  | texte | Vous vivez hors du Cameroun ? Indiquez votre pays. |
| 11 | E-mail |  | adresse e-mail |  |
| 12 | Téléphone / WhatsApp |  | téléphone |  |
| 13 | J'accepte que GLOBUS ENGINEERING analyse mes éléments et me recontacte au sujet de mon projet. |  | case à cocher |  |
| 14 | J'accepte d'être contacté(e) sur WhatsApp. |  | case à cocher |  |

## `/extranet/commandes/[id]`

### Proposer une contre-offre / Annoncer une expédition / Déposer une facture

validation : **Confirmer la commande · Proposer une contre-offre · Refuser · Annoncer une expédition · Déposer une facture · Annuler · Confirmer / Refuser · Envoyer la contre-offre · Annoncer · Déposer la facture** · composant `SupplierOrderView`

Aussi dans : `/fournisseur/commande/[token]`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Votre nom |  | texte |  |
| 2 | dialog === "refuse" ? "Motif du refus" : "Commentaire (facultatif)" | **Oui** | texte long |  |
| 3 | Date de livraison proposée |  | date |  |
| 4 | Votre nom |  | texte |  |
| 5 | Message |  | texte long |  |
| 6 | Arrivée estimée | **Oui** | date et heure |  |
| 7 | Transporteur |  | texte |  |
| 8 | N° de suivi |  | texte |  |
| 9 | Immatriculation |  | texte |  |
| 10 | N° bon de livraison |  | texte |  |
| 11 | Chauffeur |  | texte |  |
| 12 | Téléphone du chauffeur |  | téléphone |  |
| 13 | Numéro de votre facture | **Oui** | texte |  |
| 14 | Date de facture | **Oui** | date |  |
| 15 | Échéance |  | date |  |
| 16 | Montant de TVA |  | nombre |  |
| 17 | Facture (PDF ou image) | **Oui** | fichier(s) à déposer |  |

## `/extranet/consultations/[id]`

### formulaire

validation : **Poste complémentaire · Annuler · Déposer l'offre** · `${BASE}/tenders/${tender.id}/bids` · composant `BidForm`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Délai d'exécution proposé (jours) |  | nombre |  |
| 2 | Mémoire technique (PDF) |  | fichier(s) à déposer |  |
| 3 | Réserves / exclusions |  | texte long |  |
| 4 | Il s'agit d'une variante |  | case à cocher |  |
| 5 | Description de la variante | **Oui** | texte long | 5 caractères minimum |

### Offre — lot … … / Décliner la consultation / Contre-proposition

validation : **Décliner · … / Remettre une offre · Retirer · Accepter · Contre-proposer · Envoyer** · `${BASE}/bids/${b.id}/withdraw` · composant `TenderPage`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Motif (plan de charge, hors compétences…) | **Oui** | texte long | 5 caractères minimum |
| 2 | Montant HT proposé | **Oui** | nombre |  |
| 3 | Délai (jours) |  | nombre |  |
| 4 | Commentaire |  | texte long |  |

## `/extranet/documents`

### Déposer un document

validation : **Déposer un document · Déposer** · `/extranet/supplier/documents` · composant `SupplierDocuments`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type |  | liste : Attestation de régularité fiscale · Assurance · Certification · RCCM (registre du commerce) · NIU (identifiant fiscal) · Fiche technique · Autre |  |
| 2 | Intitulé |  | texte |  |
| 3 | Valable jusqu'au |  | date |  |

## `/extranet/litiges`

### Ouvrir un litige

validation : **Ouvrir un litige · Ouvrir le litige** · `${BASE}/disputes` · composant `DisputesInbox`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Marché |  | liste : — |  |
| 2 | Situation contestée |  | liste : — |  |
| 3 | Objet | **Oui** | texte | 3 caractères minimum |
| 4 | Exposé des faits (10 caractères minimum) | **Oui** | texte long |  |
| 5 | Montant contesté |  | nombre |  |
| 6 | Pièces justificatives |  | fichier(s) à déposer |  |

## `/extranet/marches/[id]`

### formulaire

validation : **Annuler · Créer la situation** · `${BASE}/subcontracts/${contract.id}/situations` · composant `SituationCreate`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Début de période | **Oui** | date |  |
| 2 | Fin de période | **Oui** | date |  |

### Nouvelle situation de travaux

validation : **Signer le marché · Nouvelle situation** · `${BASE}/subcontracts/${id}/sign/otp` · composant `ContractPage`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom et qualité du signataire | **Oui** | texte | 3 caractères minimum ; cochez aussi l'acceptation ci-dessous. |
| 2 | J'ai lu le contrat et j'accepte ses conditions ; ma signature électronique engage mon entreprise. |  | case à cocher |  |

## `/extranet/profil`

### formulaire

validation : **Enregistrer** · `${BASE}/profile` · composant `SubcontractorProfile`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | E-mail |  | adresse e-mail |  |
| 2 | Téléphone / WhatsApp |  | texte |  |
| 3 | Adresse |  | texte |  |
| 4 | Effectif |  | nombre |  |
| 5 | Zones d'intervention |  | mots-clés (taper puis Entrée) |  |
| 6 | Assurance RC jusqu'au |  | date |  |
| 7 | Décennale jusqu'au |  | date |  |

### formulaire

validation : **Enregistrer** · `/extranet/supplier/profile` · composant `SupplierProfile`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | E-mail |  | adresse e-mail |  |
| 2 | Téléphone |  | texte |  |
| 3 | WhatsApp (bons de commande) |  | texte |  |
| 4 | Recevoir les commandes par WhatsApp |  | case à cocher |  |
| 5 | Adresse |  | texte |  |
| 6 | Ville |  | texte |  |
| 7 | Zones de livraison |  | mots-clés (taper puis Entrée) |  |
| 8 | Délai habituel (jours) |  | nombre |  |

## `/extranet/reclamations`

### Nouvelle réclamation

validation : **Nouvelle réclamation · Déposer** · `${BASE}/claims` · composant `ClaimsInbox`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Marché concerné |  | liste : — |  |
| 2 | Objet | **Oui** | texte | 3 caractères minimum |
| 3 | Exposé |  | texte long |  |
| 4 | Montant demandé HT |  | nombre |  |

## `/extranet/situations/[id]`

### Facture de la situation

validation : **Soumettre · Déposer la facture · Envoyer les photos · Déposer** · `${BASE}/situations/${id}/photos` · composant `SituationPage`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | N° de facture | **Oui** | texte |  |
| 2 | Date | **Oui** | date |  |
| 3 | Montant TTC | **Oui** | nombre | Montant attendu : … (net à payer, plus la TVA du marché le cas échéant) |
| 4 | Facture (PDF ou image) | **Oui** | fichier(s) à déposer |  |

## `/payer/[token]`

### formulaire

validation : **Payer** · `/public/pay/${encodeURIComponent(token)}/checkout` · composant `PayLink`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom du payeur | **Oui** | texte |  |
| 2 | Numéro Mobile Money à débiter | **Oui** | téléphone | Vous recevrez une demande de paiement à valider avec votre code secret. |
| 3 | E-mail pour le reçu (facultatif) |  | adresse e-mail |  |

## `/reset`

### formulaire

validation : **Enregistrer** · `/auth/password/reset` · composant `ResetForm`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nouveau mot de passe |  | mot de passe |  |
| 2 | Confirmer |  | mot de passe |  |

## `/services/[slug]`

### formulaire

validation : **Envoyer** · `/public/forms/${encodeURIComponent(form.key)}/submit` · composant `CmsForm`

Aussi dans : `/aide/[slug]`, `/blog/[slug]`, Site web › Contenus (CMS) (`/erp/cms`), `/expertises/[slug]`, `/offres/[universe]`, `/offres/[universe]/[offer]`, `/projets/[slug]`, `/`, `/[...slug]`, `/aide`, `/blog`, `/decrire-mon-projet`, Site web › Contenus (CMS) (`/erp/cms/pages/[id]`), `/expertises`, `/faq`, `/offres`, `/projets`, `/services`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | f.label | **Oui** | texte long |  |

## Achats et logistique › Achats (`/erp/achats/commandes/[id]`)

### Expédition annoncée par le fournisseur

validation : **Enregistrer** · `POST /procurement/orders/{order_id}/shipment` · composant `OrderDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Arrivée estimée | **Oui** | date et heure |  |
| 2 | Transporteur |  | texte (150 car. max) |  |
| 3 | N° de suivi |  | texte (150 car. max) |  |
| 4 | Immatriculation du véhicule |  | texte (30 car. max) |  |
| 5 | Chauffeur |  | texte (150 car. max) |  |
| 6 | Téléphone du chauffeur |  | texte (40 car. max) |  |
| 7 | N° bon de livraison |  | texte (80 car. max) |  |

### Noter le fournisseur

validation : **Enregistrer** · `POST /procurement/orders/{order_id}/ratings` · composant `OrderDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Qualité | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 2 | Ponctualité | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 3 | Conformité | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 4 | Communication | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 5 | Commentaire |  | texte long (2000 car. max) |  |

### Modifier la commande

validation : **Enregistrer** · `PATCH /procurement/orders/{order_id}` · composant `OrderDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Date prévue |  | date |  |
| 2 | Adresse de livraison |  | texte long (1000 car. max) |  |
| 3 | Conditions de paiement |  | texte (120 car. max) |  |
| 4 | Notes |  | texte long (4000 car. max) |  |
| 5 | Lignes |  | tableau de lignes : Produit fournisseur, Article de stock, Référence, Description ★, Quantité ★, Unité, Prix unitaire ★, Taux de TVA |  |

## Achats et logistique › Achats (`/erp/achats/demandes/[id]`)

### Commande chez … / Annuler la demande

validation : **Soumettre · Approuver · Refuser · Annuler · Classer les fournisseurs · Commander · Créer le bon de commande · Confirmer** · `/procurement/requests/${id}/submit` · composant `RequestDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Livraison souhaitée |  | date |  |
| 2 | Canal d'envoi |  | liste : WhatsApp · E-mail · SMS |  |
| 3 | Notes pour le fournisseur |  | texte long |  |
| 4 | Envoyer immédiatement au fournisseur (si le montant ne requiert pas d'approbation) |  | case à cocher |  |

## Achats et logistique › Achats (`/erp/achats`)

### Demandes d'achat — Création

Bouton **Nouvelle demande** · fenêtre « Nouvelle demande » · validation : **Créer** · `POST /procurement/requests` · composant `RequestsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet | **Oui** | liste des projets |  |
| 2 | Chantier |  | liste des sites du projet |  |
| 3 | Zone |  | texte (120 car. max) |  |
| 4 | Lot |  | liste des lots du projet |  |
| 5 | Catégorie |  | texte (80 car. max) |  |
| 6 | Centre de coût |  | texte (80 car. max) |  |
| 7 | Urgence |  | liste : Normale · Urgente · Critique |  |
| 8 | Justification | **Oui** | texte long (4000 car. max) | Obligatoire pour soumettre : à quoi sert l'achat (ex. « Coulage des fondations »). |
| 9 | Besoin pour le |  | date |  |
| 10 | Lignes | **Oui** | tableau de lignes : Article de stock, Produit fournisseur, Description ★, Quantité ★, Unité, Prix unitaire estimé, Notes |  |
| 11 | Soumettre immédiatement |  | case à cocher |  |

### Bons de commande — Création

Bouton **Commande directe** · fenêtre « Commande directe » · validation : **Créer** · `POST /procurement/orders` · composant `OrdersList`

Aussi dans : Achats et logistique › Fournisseurs (`/erp/fournisseurs/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet | **Oui** | liste des projets |  |
| 2 | Chantier |  | liste des sites du projet |  |
| 3 | Lot |  | liste des lots du projet |  |
| 4 | Fournisseur | **Oui** | liste des fournisseurs |  |
| 5 | Urgent |  | case à cocher |  |
| 6 | Date prévue |  | date |  |
| 7 | Adresse de livraison |  | texte long (1000 car. max) |  |
| 8 | Conditions de paiement |  | texte (120 car. max) |  |
| 9 | Notes |  | texte long (4000 car. max) |  |
| 10 | Justification | **Oui** | texte long (2000 car. max, 10 car. min) | Commande sans demande d'achat : justification obligatoire (exception tracée). |
| 11 | Lignes | **Oui** | tableau de lignes : Produit fournisseur, Article de stock, Référence, Description ★, Quantité ★, Unité, Prix unitaire ★, Taux de TVA |  |

### formulaire

validation : **Approuver · Refuser · Confirmer** · `/procurement/requests/${decide.request.id}/decision` · composant `PendingApprovals`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | decide?.approve ? "Commentaire (facultatif)" : "Motif du refus" | **Oui** | texte long |  |

## Achats et logistique › Fournisseurs (`/erp/fournisseurs/[id]`)

### Catalogue — Création

Bouton **Nouveau produit** · fenêtre « Nouveau produit » · validation : **Créer** · `POST /supplier-products` · composant `SupplierDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Article de stock |  | liste des articles de stock |  |
| 2 | Référence | **Oui** | texte (80 car. max) |  |
| 3 | Nom | **Oui** | texte (250 car. max) |  |
| 4 | Catégorie |  | texte (80 car. max) |  |
| 5 | Unité |  | texte (20 car. max) |  |
| 6 | Prix unitaire |  | nombre |  |
| 7 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 8 | Quantité minimum |  | nombre |  |
| 9 | Délai de livraison (jours) |  | nombre entier |  |
| 10 | Stock disponible |  | nombre |  |
| 11 | Prix valable jusqu'au |  | date |  |
| 12 | Actif |  | case à cocher |  |

### Catalogue — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /supplier-products/{item_id}` · composant `SupplierDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Article de stock |  | liste des articles de stock |  |
| 2 | Référence |  | texte (80 car. max) |  |
| 3 | Nom |  | texte (250 car. max) |  |
| 4 | Catégorie |  | texte (80 car. max) |  |
| 5 | Unité |  | texte (20 car. max) |  |
| 6 | Prix unitaire |  | nombre |  |
| 7 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 8 | Quantité minimum |  | nombre |  |
| 9 | Délai de livraison (jours) |  | nombre entier |  |
| 10 | Stock disponible |  | nombre |  |
| 11 | Prix valable jusqu'au |  | date |  |
| 12 | Actif |  | case à cocher |  |

### Incidents fournisseur — Création

Bouton **Déclarer un incident** · fenêtre « Déclarer un incident » · validation : **Créer** · `POST /supplier-incidents` · composant `SupplierDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type | **Oui** | liste : En retard · Endommagé · Mauvais produit · Manquant · price · Facture · Retour |  |
| 2 | Bon de commande concerné |  | liste des bons de commande |  |
| 3 | Réception concernée |  | liste des réceptions |  |
| 4 | Description |  | texte long |  |
| 5 | Impact financier |  | nombre |  |

### Incidents fournisseur — Action

Bouton **Résoudre (dans la fiche)** · fenêtre « Résoudre » · validation : **Résoudre** · `POST /supplier-incidents/{incident_id}/resolve` · composant `SupplierDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Résolution | **Oui** | texte long (4000 car. max, 5 car. min) |  |
| 2 | Impact financier |  | nombre |  |

### Contacts — Création

Bouton **Nouveau contact** · fenêtre « Nouveau contact » · validation : **Créer** · `POST /supplier-contacts` · composant `SupplierDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type |  | liste : Commercial · Logistique · Facturation · Direction |  |
| 2 | Nom | **Oui** | texte (200 car. max) |  |
| 3 | E-mail |  | texte (254 car. max) |  |
| 4 | Téléphone |  | texte (40 car. max) |  |
| 5 | WhatsApp |  | texte (40 car. max) |  |
| 6 | Principal |  | case à cocher |  |

### Contacts — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /supplier-contacts/{item_id}` · composant `SupplierDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type |  | liste : Commercial · Logistique · Facturation · Direction |  |
| 2 | Nom |  | texte (200 car. max) |  |
| 3 | E-mail |  | texte (254 car. max) |  |
| 4 | Téléphone |  | texte (40 car. max) |  |
| 5 | WhatsApp |  | texte (40 car. max) |  |
| 6 | Principal |  | case à cocher |  |

### Modifier le fournisseur

validation : **Enregistrer** · `PATCH /suppliers/{supplier_id}` · composant `SupplierDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Raison sociale |  | texte (250 car. max, 2 car. min) |  |
| 2 | Nom commercial |  | texte (250 car. max) |  |
| 3 | Forme juridique |  | texte (60 car. max) |  |
| 4 | NIU |  | texte (60 car. max) |  |
| 5 | RCCM |  | texte (80 car. max) |  |
| 6 | Adresse |  | texte long (1000 car. max) |  |
| 7 | Ville |  | texte (120 car. max) |  |
| 8 | Pays |  | texte (80 car. max) |  |
| 9 | Catégories |  | mots-clés (taper puis Entrée) |  |
| 10 | Zones de livraison |  | mots-clés (taper puis Entrée) |  |
| 11 | Conditions de paiement |  | texte (120 car. max) |  |
| 12 | Délai de paiement (jours) |  | nombre entier (≥ 0, ≤ 365) |  |
| 13 | Commande minimum |  | nombre (≥ 0) |  |
| 14 | Délai de livraison (jours) |  | nombre entier (≥ 0, ≤ 365) |  |
| 15 | E-mail |  | adresse e-mail |  |
| 16 | Téléphone |  | texte (40 car. max) |  |
| 17 | Numéro SMS |  | texte (40 car. max) |  |
| 18 | Numéro WhatsApp |  | texte (40 car. max) |  |
| 19 | Accepte WhatsApp |  | case à cocher |  |
| 20 | Canal préféré |  | liste : WhatsApp · E-mail · SMS |  |
| 21 | Banque |  | texte (150 car. max) |  |
| 22 | Compte bancaire (IBAN/RIB) |  | texte (80 car. max) |  |
| 23 | Numéro Mobile Money |  | texte (40 car. max) |  |
| 24 | Notes |  | texte long (4000 car. max) |  |
| 25 | Organisation (accès extranet) |  | liste des organisations de type fournisseur | Organisation de type « fournisseur » créée dans Administration › Utilisateurs et rôles › Organisations : ses comptes ouvriront l'extranet fournisseur de cette fiche. |

### Statut du fournisseur

validation : **Enregistrer** · `POST /suppliers/{supplier_id}/status` · composant `SupplierDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Statut | **Oui** | liste : En attente · Actif · Suspendu · Liste noire |  |
| 2 | Motif | **Oui** | texte long (2000 car. max, 5 car. min) |  |

### Ajouter un document

validation : **Enregistrer** · `POST /suppliers/{supplier_id}/documents` · composant `SupplierDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type | **Oui** | liste : RCCM (registre du commerce) · NIU (identifiant fiscal) · Attestation de régularité fiscale · Attestation CNPS · Assurance · Certification · RIB (coordonnées bancaires) · Fiche technique · Autre |  |
| 2 | Titre | **Oui** | texte (250 car. max, 2 car. min) |  |
| 3 | Valable jusqu'au |  | date |  |
| 4 | Fichier | **Oui** | fichier à déposer |  |

### Noter le fournisseur

validation : **Enregistrer** · `POST /suppliers/{supplier_id}/ratings` · composant `SupplierDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Bon de commande |  | liste des bons de commande |  |
| 2 | Qualité | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 3 | Ponctualité | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 4 | Conformité | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 5 | Communication | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 6 | Commentaire |  | texte long (2000 car. max) |  |

## Achats et logistique › Fournisseurs (`/erp/fournisseurs`)

### Fournisseurs — Création

Bouton **Nouveau fournisseur** · fenêtre « Nouveau fournisseur » · validation : **Créer** · `POST /suppliers` · composant `SuppliersList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code |  | texte (30 car. max) |  |
| 2 | Raison sociale | **Oui** | texte (250 car. max, 2 car. min) |  |
| 3 | Nom commercial |  | texte (250 car. max) |  |
| 4 | Forme juridique |  | texte (60 car. max) |  |
| 5 | NIU |  | texte (60 car. max) |  |
| 6 | RCCM |  | texte (80 car. max) |  |
| 7 | Adresse |  | texte long (1000 car. max) |  |
| 8 | Ville |  | texte (120 car. max) |  |
| 9 | Pays |  | texte (80 car. max) |  |
| 10 | Catégories |  | mots-clés (taper puis Entrée) |  |
| 11 | Zones de livraison |  | mots-clés (taper puis Entrée) |  |
| 12 | Conditions de paiement |  | texte (120 car. max) |  |
| 13 | Délai de paiement (jours) |  | nombre entier (≥ 0, ≤ 365) |  |
| 14 | Commande minimum |  | nombre (≥ 0) |  |
| 15 | Délai de livraison (jours) |  | nombre entier (≥ 0, ≤ 365) |  |
| 16 | E-mail |  | adresse e-mail |  |
| 17 | Téléphone |  | texte (40 car. max) |  |
| 18 | Numéro SMS |  | texte (40 car. max) |  |
| 19 | Numéro WhatsApp |  | texte (40 car. max) |  |
| 20 | Accepte WhatsApp |  | case à cocher |  |
| 21 | Canal préféré |  | liste : WhatsApp · E-mail · SMS |  |
| 22 | Banque |  | texte (150 car. max) |  |
| 23 | Compte bancaire (IBAN/RIB) |  | texte (80 car. max) |  |
| 24 | Numéro Mobile Money |  | texte (40 car. max) |  |
| 25 | Notes |  | texte long (4000 car. max) |  |
| 26 | Organisation (accès extranet) |  | liste des organisations de type fournisseur | Organisation de type « fournisseur » créée dans Administration › Utilisateurs et rôles › Organisations : ses comptes ouvriront l'extranet fournisseur de cette fiche. |
| 27 | Contacts |  | tableau de lignes : Type, Nom ★, E-mail, Téléphone, WhatsApp, Principal |  |

## Achats et logistique › Livraisons (`/erp/livraisons/[id]`)

### Arrivée sur chantier

validation : **Enregistrer** · `POST /deliveries/{delivery_id}/arrived` · composant `DeliveryDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Latitude |  | nombre (≥ -90, ≤ 90) |  |
| 2 | Longitude |  | nombre (≥ -180, ≤ 180) |  |
| 3 | Notes |  | texte long (2000 car. max) |  |

## Achats et logistique › Livraisons (`/erp/livraisons/receptions/[id]`)

### Retour fournisseur

validation : **Enregistrer** · `POST /goods-receipts/{receipt_id}/returns` · composant `ReceiptDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Motif | **Oui** | liste : Endommagé · Non conforme · Excédent · Qualité · Autre |  |

## Achats et logistique › Livraisons (`/erp/livraisons/receptions/nouvelle`)

### formulaire

validation : **Rechercher · Position relevée (±… m) / Relever la position GPS · Enregistrer en brouillon · Enregistrer et valider** · `/goods-receipts` · composant `NewReceipt`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | N° de bon de commande ou contenu du QR |  | texte |  |
| 2 | Destination |  | liste : Affectation chantier · Stock (dépôt) |  |
| 3 | Dépôt | **Oui** | liste des entrepôts |  |
| 4 | Chantier |  | liste des sites du projet |  |
| 5 | Chauffeur |  | texte |  |
| 6 | Immatriculation |  | texte |  |
| 7 | N° bon de livraison |  | texte |  |
| 8 | Notes |  | texte long |  |

## Achats et logistique › Livraisons (`/erp/livraisons`)

### Retours fournisseurs — Action

Bouton **Mettre à jour (dans la fiche)** · fenêtre « Mettre à jour » · validation : **Mettre à jour** · `POST /supplier-returns/{return_id}/status` · composant `SupplierReturns`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Statut | **Oui** | liste : Expédié · Soldée par avoir · Clôturé |  |
| 2 | Avoir du fournisseur | **Oui** | liste des avoirs fournisseurs (affiché seulement si : condition) | Avoir enregistré en facturation (Finance › Facturation › Avoirs) pour ce retour. |

## Achats et logistique › Matériel (`/erp/materiel/[id]`)

### Plans de maintenance préventive — Création

Bouton **Nouveau plan** · fenêtre « Nouveau plan » · validation : **Créer** · `POST /maintenance-plans` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre | **Oui** | texte (200 car. max) |  |
| 2 | Intervalle (jours) |  | nombre entier |  |
| 3 | Intervalle (heures moteur) |  | nombre entier |  |
| 4 | Dernière réalisation |  | date |  |
| 5 | Compteur à la dernière réalisation |  | nombre |  |
| 6 | Prochaine échéance |  | date |  |
| 7 | Actif |  | case à cocher |  |

### Plans de maintenance préventive — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /maintenance-plans/{item_id}` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre |  | texte (200 car. max) |  |
| 2 | Intervalle (jours) |  | nombre entier |  |
| 3 | Intervalle (heures moteur) |  | nombre entier |  |
| 4 | Dernière réalisation |  | date |  |
| 5 | Compteur à la dernière réalisation |  | nombre |  |
| 6 | Prochaine échéance |  | date |  |
| 7 | Actif |  | case à cocher |  |

### Ordres de maintenance — Action avec confirmation

Bouton **Démarrer (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/maintenance-orders/${r.id}/start`` · composant `EquipmentDetail`

_Aucun champ à saisir (confirmation simple)._

### Ordres de maintenance — Action

Bouton **Terminer (dans la fiche)** · fenêtre « Terminer » · validation : **Terminer** · `POST /maintenance-orders/{order_id}/complete` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Coût |  | nombre (≥ 0) |  |
| 2 | Immobilisation (h) |  | nombre (≥ 0) |  |
| 3 | Rapport | **Oui** | texte long (8000 car. max, 5 car. min) |  |
| 4 | État |  | liste : Nouveau · Bon · Moyen · Mauvais |  |

### Consommables — Création

Bouton **Nouveau consommable** · fenêtre « Nouveau consommable » · validation : **Créer** · `POST /equipment-consumables` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Article de stock |  | liste des articles de stock |  |
| 2 | Nom | **Oui** | texte (200 car. max) |  |
| 3 | Intervalle de remplacement (h) |  | nombre entier |  |
| 4 | Dernier remplacement |  | date |  |
| 5 | Quantité par remplacement |  | nombre |  |
| 6 | Unité |  | texte (20 car. max) |  |
| 7 | Notes |  | texte (300 car. max) |  |

### Consommables — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /equipment-consumables/{item_id}` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Article de stock |  | liste des articles de stock |  |
| 2 | Nom |  | texte (200 car. max) |  |
| 3 | Intervalle de remplacement (h) |  | nombre entier |  |
| 4 | Dernier remplacement |  | date |  |
| 5 | Quantité par remplacement |  | nombre |  |
| 6 | Unité |  | texte (20 car. max) |  |
| 7 | Notes |  | texte (300 car. max) |  |

### Modifier le matériel

validation : **Enregistrer** · `PATCH /equipment/{equipment_id}` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (200 car. max, 2 car. min) |  |
| 2 | Marque |  | texte (100 car. max) |  |
| 3 | Modèle |  | texte (100 car. max) |  |
| 4 | N° de série |  | texte (100 car. max) |  |
| 5 | Immatriculation |  | texte (40 car. max) |  |
| 6 | État |  | liste : Nouveau · Bon · Moyen · Mauvais |  |
| 7 | Statut |  | liste : Disponible · En panne · Réformé |  |
| 8 | Coût horaire |  | nombre (≥ 0) |  |
| 9 | Coût journalier |  | nombre (≥ 0) |  |
| 10 | Balise GPS |  | texte (100 car. max) |  |
| 11 | Géolocalisation |  | case à cocher |  |
| 12 | Assurance jusqu'au |  | date |  |
| 13 | Contrôle technique valable jusqu'au |  | date |  |
| 14 | Notes |  | texte long (4000 car. max) |  |

### Affecter à un chantier

validation : **Enregistrer** · `POST /equipment/{equipment_id}/assign` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet | **Oui** | liste des projets |  |
| 2 | Chantier |  | liste des sites du projet |  |
| 3 | Opérateur |  | liste des utilisateurs |  |
| 4 | Date de début |  | date |  |
| 5 | Date de fin |  | date |  |
| 6 | Notes |  | texte long (2000 car. max) |  |

### Retour au dépôt

validation : **Enregistrer** · `POST /equipment/{equipment_id}/return` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | État |  | liste : Nouveau · Bon · Moyen · Mauvais |  |
| 2 | Notes |  | texte long (2000 car. max) |  |

### Relevé d'utilisation

validation : **Enregistrer** · `POST /equipment/{equipment_id}/usage` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Date d'utilisation |  | date |  |
| 2 | Heures |  | nombre (≥ 0, ≤ 24) |  |
| 3 | Kilomètres |  | nombre (≥ 0, ≤ 5000) |  |
| 4 | Carburant (L) |  | nombre (≥ 0) |  |
| 5 | Coût carburant |  | nombre (≥ 0) |  |
| 6 | Projet |  | liste des projets |  |
| 7 | Chantier |  | liste des sites du projet |  |
| 8 | Opérateur |  | liste des utilisateurs |  |
| 9 | Notes |  | texte (300 car. max) |  |

### Position du matériel

validation : **Enregistrer** · `POST /equipment/{equipment_id}/location` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Latitude | **Oui** | nombre (≥ -90, ≤ 90) |  |
| 2 | Longitude | **Oui** | nombre (≥ -180, ≤ 180) |  |
| 3 | Date |  | date et heure |  |

### Ajouter un document

validation : **Enregistrer** · `POST /equipment/{equipment_id}/documents` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Fichier | **Oui** | fichier à déposer |  |

### Ordre de maintenance

validation : **Enregistrer** · `POST /equipment/{equipment_id}/maintenance-orders` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type |  | liste : Préventive · Corrective |  |
| 2 | Plan de maintenance |  | liste |  |
| 3 | Description |  | texte long (4000 car. max) |  |
| 4 | Date planifiée |  | date |  |
| 5 | Technicien |  | liste des utilisateurs |  |
| 6 | Prestataire |  | texte (200 car. max) |  |

### Déclarer un incident

validation : **Enregistrer** · `POST /equipment/{equipment_id}/incidents` · composant `EquipmentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type |  | liste : Panne · Dommage · Vol · Accident |  |
| 2 | Survenu le | **Oui** | date et heure |  |
| 3 | Gravité |  | liste : Faible · Moyenne · Élevée · Critique |  |
| 4 | Description |  | texte long (4000 car. max) |  |
| 5 | Projet |  | liste des projets |  |
| 6 | Coût |  | nombre (≥ 0) |  |

## Achats et logistique › Matériel (`/erp/materiel`)

### Matériel — Création

Bouton **Nouveau matériel** · fenêtre « Nouveau matériel » · validation : **Créer** · `POST /equipment` · composant `EquipmentList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code |  | texte (40 car. max) |  |
| 2 | Nom | **Oui** | texte (200 car. max, 2 car. min) |  |
| 3 | Catégorie |  | liste : Engin · Véhicule · Outillage · Échafaudage · Topographie · Informatique |  |
| 4 | Marque |  | texte (100 car. max) |  |
| 5 | Modèle |  | texte (100 car. max) |  |
| 6 | N° de série |  | texte (100 car. max) |  |
| 7 | Immatriculation |  | texte (40 car. max) |  |
| 8 | Date d'acquisition |  | date |  |
| 9 | Coût d'acquisition |  | nombre (≥ 0) |  |
| 10 | Propriété |  | liste : Propriété · Location · Crédit-bail |  |
| 11 | Loueur |  | liste des fournisseurs |  |
| 12 | État |  | liste : Nouveau · Bon · Moyen · Mauvais |  |
| 13 | Coût horaire |  | nombre (≥ 0) |  |
| 14 | Coût journalier |  | nombre (≥ 0) |  |
| 15 | Compteur horaire |  | nombre (≥ 0) |  |
| 16 | Compteur kilométrique |  | nombre (≥ 0) |  |
| 17 | Balise GPS |  | texte (100 car. max) |  |
| 18 | Géolocalisation |  | case à cocher |  |
| 19 | Assurance jusqu'au |  | date |  |
| 20 | Contrôle technique valable jusqu'au |  | date |  |
| 21 | Notes |  | texte long (4000 car. max) |  |

## Achats et logistique › Prix des matériaux (`/erp/achats/prix`)

### Écarter la recommandation

validation : **Actualiser · Anticiper · Écarter** · `/market/refresh` · composant `MarketPage`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Motif | **Oui** | texte long |  |

## Achats et logistique › Stocks (`/erp/stocks`)

### Inventaires — Création

Bouton **Lancer un inventaire** · fenêtre « Lancer un inventaire » · validation : **Créer** · `POST /inventory-counts` · composant `InventoryCounts`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Dépôt | **Oui** | liste des entrepôts |  |
| 2 | Notes |  | texte long (2000 car. max) |  |

### Inventaires — Action avec confirmation

Bouton **Saisir / valider (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · composant `InventoryCounts`

_Aucun champ à saisir (confirmation simple)._

### Affectations chantier — Création

Bouton **Réserver pour un chantier** · fenêtre « Réserver pour un chantier » · validation : **Créer** · `POST /stock-allocations` · composant `Allocations`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Article | **Oui** | liste des articles de stock |  |
| 2 | Dépôt | **Oui** | liste des entrepôts |  |
| 3 | Projet | **Oui** | liste des projets |  |
| 4 | Chantier |  | liste des sites du projet |  |
| 5 | Lot |  | liste des lots du projet |  |
| 6 | Tâche |  | liste des tâches du projet |  |
| 7 | Quantité | **Oui** | nombre (≥ 0) |  |

### Affectations chantier — Action

Bouton **Sortir (dans la fiche)** · fenêtre « Sortir » · validation : **Sortir** · `POST /stock-allocations/{allocation_id}/issue` · composant `Allocations`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Quantité | **Oui** | nombre (≥ 0) |  |
| 2 | Dépôt |  | liste des entrepôts |  |
| 3 | Motif |  | texte long (1000 car. max) |  |

### Affectations chantier — Action

Bouton **Retour (dans la fiche)** · fenêtre « Retour » · validation : **Retour** · `POST /stock-allocations/{allocation_id}/return` · composant `Allocations`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Quantité | **Oui** | nombre (≥ 0) |  |
| 2 | Dépôt |  | liste des entrepôts |  |
| 3 | Motif |  | texte long (1000 car. max) |  |

### Affectations chantier — Action avec confirmation

Bouton **Consommé (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/stock-allocations/${r.id}/consume`` · composant `Allocations`

_Aucun champ à saisir (confirmation simple)._

### Affectations chantier — Action avec confirmation

Bouton **Annuler (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/stock-allocations/${r.id}/cancel`` · composant `Allocations`

_Aucun champ à saisir (confirmation simple)._

### Articles — Création

Bouton **Nouvel article** · fenêtre « Nouvel article » · validation : **Créer** · `POST /stock-items` · composant `StockReferentials`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Référence (SKU) | **Oui** | texte (60 car. max) |  |
| 2 | Nom | **Oui** | texte (250 car. max) |  |
| 3 | Catégorie |  | texte (80 car. max) |  |
| 4 | Unité |  | texte (20 car. max) |  |
| 5 | Seuil d'alerte |  | nombre |  |
| 6 | Quantité de réapprovisionnement |  | nombre |  |
| 7 | Fournisseur préféré |  | liste des fournisseurs |  |
| 8 | Consommable |  | case à cocher |  |
| 9 | Actif |  | case à cocher |  |
| 10 | Code-barres |  | texte (80 car. max) |  |
| 11 | Description |  | texte long |  |

### Dépôts — Création

Bouton **Nouveau dépôt** · fenêtre « Nouveau dépôt » · validation : **Créer** · `POST /warehouses` · composant `StockReferentials`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code | **Oui** | texte (30 car. max) |  |
| 2 | Nom | **Oui** | texte (200 car. max) |  |
| 3 | Type |  | liste : Central · Chantier |  |
| 4 | Chantier |  | liste des sites du projet |  |
| 5 | Projet |  | liste des projets |  |
| 6 | Adresse |  | texte long |  |
| 7 | Responsable |  | liste des utilisateurs |  |
| 8 | Actif |  | case à cocher |  |

### Dépôts — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /warehouses/{item_id}` · composant `StockReferentials`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code |  | texte (30 car. max) |  |
| 2 | Nom |  | texte (200 car. max) |  |
| 3 | Type |  | liste : Central · Chantier |  |
| 4 | Chantier |  | liste des sites du projet |  |
| 5 | Projet |  | liste des projets |  |
| 6 | Adresse |  | texte long |  |
| 7 | Responsable |  | liste des utilisateurs |  |
| 8 | Actif |  | case à cocher |  |

### Emplacements — Création

Bouton **Nouvel emplacement** · fenêtre « Nouvel emplacement » · validation : **Créer** · `POST /stock-locations` · composant `StockReferentials`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Dépôt | **Oui** | liste des entrepôts |  |
| 2 | Code | **Oui** | texte (40 car. max) |  |
| 3 | Libellé |  | texte (150 car. max) |  |

### Emplacements — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /stock-locations/{item_id}` · composant `StockReferentials`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Dépôt |  | liste des entrepôts |  |
| 2 | Code |  | texte (40 car. max) |  |
| 3 | Libellé |  | texte (150 car. max) |  |

## Administration › Mon compte (`/erp/compte`)

### formulaire

validation : **Enregistrer** · `/auth/me` · composant `ProfileTab`

Aussi dans : `/espace-client/compte`, `/extranet/compte`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Prénom | **Oui** | texte |  |
| 2 | Nom | **Oui** | texte |  |
| 3 | Téléphone |  | téléphone |  |
| 4 | WhatsApp |  | téléphone |  |
| 5 | Fonction |  | texte |  |
| 6 | Fuseau horaire |  | liste : Africa/Douala · Europe/Paris · Europe/Brussels · America/New York · America/Toronto · Africa/Abidjan · Africa/Lagos · Europe/London |  |

### formulaire

validation : **Modifier le mot de passe** · `/auth/password/change` · composant `PasswordCard`

Aussi dans : `/espace-client/compte`, `/extranet/compte`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Mot de passe actuel |  | mot de passe |  |
| 2 | Nouveau mot de passe |  | mot de passe |  |
| 3 | Confirmation |  | mot de passe |  |

### Configurer l'application d'authentification / Vos codes de secours / Régénérer les codes de secours / Désactiver la double authentification

validation : **Configurer une application d'authentification · Régénérer les codes de secours · Ajouter une clé / biométrie · Désactiver le MFA · Activer · J'ai conservé mes codes · Télécharger · Régénérer · Désactiver** · `/auth/mfa/totp/setup` · composant `MfaCard`

Aussi dans : `/espace-client/compte`, `/extranet/compte`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code à 6 chiffres |  | saisie |  |
| 2 | Code de votre application d'authentification |  | saisie |  |
| 3 | Mot de passe |  | mot de passe |  |
| 4 | Code TOTP ou code de secours |  | texte |  |

## Administration › Paramètres (`/erp/parametres/systeme`)

### Remise à zéro des données d'exploitation

validation : **Préparer la remise à zéro · Aller à la connexion · Remettre à zéro** · `/admin/break-glass` · composant `ResetPlatformCard`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | E-mail du nouvel administrateur |  | adresse e-mail | Il recevra une invitation pour choisir son mot de passe ; la double authentification lui sera demandée. |
| 2 | Prénom de l'administrateur | **Oui** | texte |  |
| 3 | Nom de l'administrateur | **Oui** | texte |  |
| 4 | Justification (20 caractères minimum) |  | texte long |  |
| 5 | Votre code MFA |  | texte |  |
| 6 | Tapez … pour confirmer |  | texte |  |

### Restauration de production

validation : **Lancer · Sauvegarder maintenant · Vérifier · Test de restauration · Restaurer · Garder la version serveur / Garder ma version** · `/admin/jobs/${j.name}/run` · composant `SystemAdmin`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Justification (20 caractères minimum) |  | texte long |  |
| 2 | Votre code MFA |  | texte |  |
| 3 | Tapez RESTAURER pour confirmer |  | texte |  |

## Administration › Paramètres (`/erp/parametres`)

### formulaire

validation : **Paramètre · Modifier · Enregistrer** · composant `GeneralSettings`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Clé |  | texte | Lettres, chiffres, points et soulignés. |
| 2 | Catégorie |  | texte |  |
| 3 | Exposé publiquement (lecture sans connexion) |  | case à cocher |  |
| 4 | Description |  | texte |  |

### formulaire

validation : **Fonctionnalité · Régler · Enregistrer** · `/admin/feature-flags/${encodeURIComponent(key)}` · composant `FeatureFlags`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Clé |  | texte |  |
| 2 | Description |  | texte |  |
| 3 | Pourcentage d'utilisateurs |  | nombre |  |
| 4 | Activée |  | case à cocher |  |

### Modèle … (…)

validation : **Règle · Modifier · Enregistrer** · `/admin/notification-templates/${template?.id}` · composant `NotificationsAdmin`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Objet |  | texte |  |
| 2 | Contenu |  | texte long | Variables Jinja2 (environnement isolé) : {{ number }}, {{ title }}, {{ link }}… |
| 3 | Modèle WhatsApp approuvé (Meta) |  | texte |  |
| 4 | Actif |  | case à cocher |  |
| 5 | Nom |  | texte |  |
| 6 | Événement déclencheur |  | texte |  |
| 7 | Code du modèle |  | texte |  |
| 8 | Priorité |  | liste : Faible · Normale · Élevée · Critique |  |
| 9 | Catégorie (préférences utilisateur) |  | texte |  |
| 10 | Canaux |  | saisie dédiée (Checkbox) |  |
| 11 | Active |  | case à cocher |  |

### … — … / Journal — …

validation : **Renouveler / Définir · Webhook · Tester · Journal · Modifier · Enregistrer** · `/admin/webhooks/${w.id}/test` · composant `IntegrationsAdmin`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Valeur |  | mot de passe |  |
| 2 | Nom |  | texte |  |
| 3 | URL (HTTPS) |  | texte |  |
| 4 | hook.id ? "Nouveau secret de signature (facultatif)" : "Secret de signature (16 caractères min.)" |  | mot de passe |  |
| 5 | Événements |  | saisie dédiée (Checkbox) |  |
| 6 | Actif |  | case à cocher |  |

### formulaire

validation : **Renouveler / Définir · Enregistrer —** · `/admin/integrations/config` · composant `IntegrationsActivation`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | f.label |  | saisie dédiée (Checkbox) |  |
| 2 | f.label |  | liste de choix |  |

## Administration › Sécurité (`/erp/securite`)

### Nouvelle clé d'API / Clé créée / Révoquer la clé …

validation : **Nouvelle clé · Révoquer · Créer** · `/api-keys` · composant `ApiKeys`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte |  |
| 2 | Portées (permissions accordées) |  | sélection multiple dans une liste |  |
| 3 | Expiration |  | date et heure |  |
| 4 | Adresses IP autorisées (vide = toutes) |  | mots-clés (taper puis Entrée) |  |

## Administration › Utilisateurs et rôles (`/erp/utilisateurs`)

### Utilisateurs — Création

Bouton **Nouvel utilisateur** · fenêtre « Nouvel utilisateur » · validation : **Créer** · `POST /users` · composant `UsersList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | E-mail | **Oui** | adresse e-mail |  |
| 2 | Prénom | **Oui** | texte (120 car. max) |  |
| 3 | Nom | **Oui** | texte (120 car. max) |  |
| 4 | Téléphone |  | texte (40 car. max) |  |
| 5 | WhatsApp |  | texte (40 car. max) |  |
| 6 | Fonction |  | texte (150 car. max) |  |
| 7 | Métier |  | liste des métiers |  |
| 8 | Disciplines |  | cases à cocher : disciplines | Disciplines BIM suivies par la personne (référentiel global du Hub BIM). |
| 9 | Organisation |  | liste des organisations | Laisser vide pour le personnel de l'entreprise (rattaché automatiquement). Obligatoire pour un fournisseur ou un sous-traitant : son organisation (de son type), qui ouvre sa fiche dans l'extranet. |
| 10 | Rôles | **Oui** | cases à cocher : rôles |  |
| 11 | Projets |  | sélection multiple dans une liste |  |
| 12 | Rôle sur le projet |  | liste : Membre · Chef de projet · Conducteur de travaux · Chef de chantier · Ingénieur · Architecte · BIM manager · Acheteur · QHSE · Comptable · Client · Partenaire |  |
| 13 | Envoyer l'invitation |  | case à cocher |  |
| 14 | Envoyer l'accès par |  | cases à cocher : E-mail · WhatsApp (numéro requis) | Lien d'activation personnel à usage unique : l'utilisateur choisit son mot de passe, puis active la double authentification (obligatoire pour les clients). Aucun mot de passe n'est transmis. |
| 15 | Message |  | texte long (1000 car. max) | Message personnel joint à l'invitation. |

### Utilisateurs — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /users/{user_id}` · composant `UsersList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Prénom |  | texte (120 car. max) |  |
| 2 | Nom |  | texte (120 car. max) |  |
| 3 | Téléphone |  | texte (40 car. max) |  |
| 4 | WhatsApp |  | texte (40 car. max) |  |
| 5 | Fonction |  | texte (150 car. max) |  |
| 6 | Métier |  | liste des métiers |  |
| 7 | Disciplines |  | cases à cocher : disciplines | Disciplines BIM suivies par la personne (référentiel global du Hub BIM). |
| 8 | Organisation |  | liste des organisations |  |

### Organisations — Création

Bouton **Nouvelle organisation** · fenêtre « Nouvelle organisation » · validation : **Créer** · `POST /organizations` · composant `OrganizationsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (200 car. max, 2 car. min) |  |
| 2 | Type | **Oui** | liste : Interne · Client · Fournisseur · Sous-traitant · Partenaire |  |
| 3 | Raison sociale |  | texte |  |
| 4 | Forme juridique |  | texte |  |
| 5 | NIU |  | texte |  |
| 6 | RCCM |  | texte |  |
| 7 | E-mail |  | adresse e-mail |  |
| 8 | Téléphone |  | texte |  |
| 9 | WhatsApp |  | texte |  |
| 10 | Adresse |  | texte long |  |
| 11 | Ville |  | texte |  |
| 12 | Pays |  | texte |  |
| 13 | Site web |  | texte |  |
| 14 | Notes |  | texte long |  |
| 15 | Actif |  | case à cocher |  |

### Organisations — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /organizations/{org_id}` · composant `OrganizationsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (200 car. max, 2 car. min) |  |
| 2 | Type |  | liste : Interne · Client · Fournisseur · Sous-traitant · Partenaire |  |
| 3 | Raison sociale |  | texte |  |
| 4 | Forme juridique |  | texte |  |
| 5 | NIU |  | texte |  |
| 6 | RCCM |  | texte |  |
| 7 | E-mail |  | adresse e-mail |  |
| 8 | Téléphone |  | texte |  |
| 9 | WhatsApp |  | texte |  |
| 10 | Adresse |  | texte long |  |
| 11 | Ville |  | texte |  |
| 12 | Pays |  | texte |  |
| 13 | Site web |  | texte |  |
| 14 | Notes |  | texte long |  |
| 15 | Actif |  | case à cocher |  |

### Équipes — Création

Bouton **Nouvelle équipe** · fenêtre « Nouvelle équipe » · validation : **Créer** · `POST /teams` · composant `TeamsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (150 car. max, 2 car. min) |  |
| 2 | Organisation |  | liste des organisations |  |
| 3 | Chef d'équipe |  | liste des utilisateurs |  |
| 4 | Métier |  | liste des métiers |  |
| 5 | Description |  | texte long |  |
| 6 | Membres |  | sélection multiple dans une liste |  |
| 7 | Actif |  | case à cocher |  |

### Équipes — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /teams/{team_id}` · composant `TeamsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (150 car. max, 2 car. min) |  |
| 2 | Organisation |  | liste des organisations |  |
| 3 | Chef d'équipe |  | liste des utilisateurs |  |
| 4 | Métier |  | liste des métiers |  |
| 5 | Description |  | texte long |  |
| 6 | Membres |  | sélection multiple dans une liste |  |
| 7 | Actif |  | case à cocher |  |

### Renvoyer l'invitation

validation : **Renvoyer** · composant `ResendInvitationDialog`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Envoyer le lien par |  | saisie dédiée (Checkbox) |  |
| 2 | Message (facultatif) |  | texte long |  |

### Déconnecter toutes les sessions / Désactiver le compte / Réinitialiser la double authentification

validation : **Enregistrer les rôles · Annuler · Renvoyer l&apos;invitation · Déverrouiller · Ne plus exiger la MFA / Exiger la MFA · Déconnecter partout · Réinitialiser la MFA · Désactiver / Réactiver · Confirmer (accès d'urgence)** · `/users/${user.id}/revoke-sessions` · composant `UserPanel`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Justification (20 caractères minimum) |  | texte long |  |
| 2 | Votre code MFA |  | texte |  |

### Supprimer le rôle …

validation : **Nouveau rôle · Modifier / Voir · Enregistrer** · `/roles/${editing.id}` · composant `RolesAdmin`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte |  |
| 2 | Public |  | liste de choix |  |
| 3 | Description |  | texte long |  |
| 4 | Accès à tous les projets (sinon : projets dont l'utilisateur est membre) |  | case à cocher |  |
| 5 | Double authentification obligatoire |  | case à cocher |  |

## Assistants IA (`/erp/ia`)

### formulaire

validation : **Demander** · `/ai/document-versions/${doc.current_version.id}/ask` · composant `DocumentAssistant`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Document (version en vigueur) |  | liste |  |

### formulaire

validation : **Générer la synthèse · Copier** · `/ai/projects/${projectId}/summary` · composant `SiteSummary`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Du |  | date |  |
| 3 | Au |  | date |  |
| 4 | Destinataire |  | liste : Direction (technique) · Client (pédagogique, sans jargon) |  |

### formulaire

validation : **Arrêter · Enregistrer · Envoyer le rapport** · `/ai/voice-reports` · composant `VoiceRecorder`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Site concerné (facultatif) |  | liste des sites du projet |  |
| 2 | Transcription (facultatif — sinon transcription serveur) |  | texte long |  |

### formulaire

validation : **Envoyer la transcription · Valider et journaliser · Rejeter** · `/ai/voice-reports/${report.id}/transcript` · composant `VoicePanel`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Transcription manuelle |  | texte long |  |
| 2 | Texte du journal de chantier (modifiable) |  | texte long |  |

### formulaire

validation : **Lire la pièce · Valider l'extraction · Rejeter** · `/ai/ocr` · composant `OcrTool`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type de pièce |  | liste : Facture fournisseur · Bon de livraison · Autre document |  |
| 2 | Projet |  | liste des projets |  |

## Commercial › Ambassadeurs (`/erp/crm/ambassadeurs`)

### Règles du programme

validation : **Règles · … / … Fermer le programme / Ouvrir le programme · Enregistrer** · `/ambassadors/program` · composant `ProgramCard`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type de prime |  | liste : Pourcentage du contrat · Montant fixe |  |
| 2 | Pourcentage (%) |  | nombre |  |
| 3 | Montant fixe (FCFA) |  | nombre |  |
| 4 | Plafond de prime (FCFA) |  | nombre |  |
| 5 | Montant minimum du contrat (FCFA) |  | nombre |  |
| 6 | Durée de suivi du lien (jours) |  | nombre |  |
| 7 | Délai de signature du contrat (jours) |  | nombre |  |
| 8 | Avantage proposé au filleul |  | texte |  |

### Nouveau prescripteur / Refuser la prime

validation : **Nouveau prescripteur · Valider · Refuser · Initier le paiement · Suspendre / Réactiver · Inscrire** · `/referrals/${r.id}/approve` · composant `AmbassadorsPage`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type |  | liste : Partenaire prescripteur · Collaborateur |  |
| 2 | Nom complet | **Oui** | texte |  |
| 3 | E-mail |  | adresse e-mail |  |
| 4 | Téléphone |  | téléphone |  |
| 5 | Numéro Mobile Money |  | téléphone |  |
| 6 | Opérateur |  | liste : MTN · Orange |  |
| 7 | Notes |  | texte long |  |
| 8 | Motif (visible par l'ambassadeur) | **Oui** | texte long |  |

## Commercial › CRM (`/erp/crm/contrats/[id]`)

### Enregistrer la signature du contrat

validation : **Enregistrer la signature · Rattacher au projet … / Créer le projet · Enregistrer · Rattacher au projet / Créer le projet** · `/crm/files` · composant `CrmContractDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Signataire | **Oui** | texte |  |
| 2 | Mode de signature |  | liste : Signature manuscrite scannée · Code OTP · Signature électronique |  |
| 3 | Date de signature |  | date |  |
| 4 | Contrat signé scanné | **Oui** | fichier(s) à déposer |  |
| 5 | Chef de projet |  | liste des utilisateurs | Seulement si le projet n'en a pas encore. |
| 6 | Nom du projet |  | texte |  |
| 7 | Chef de projet |  | liste des utilisateurs |  |
| 8 | Comptes clients existants à rattacher |  | sélection multiple dans une liste |  |
| 9 | Inviter le client par e-mail |  | adresse e-mail | Crée son accès à l'espace client, limité à ce projet. |

## Commercial › CRM (`/erp/crm/devis/[id]`)

### formulaire

validation : **Ligne · Échéance · Annuler · Enregistrer / Créer le devis** · `/crm/quotes/${quote.id}` · composant `QuoteEditor`

Aussi dans : Commercial › CRM (`/erp/crm`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Intitulé du devis | **Oui** | texte |  |
| 2 | Valable jusqu'au |  | date |  |
| 3 | Nature du devis |  | liste : Travaux · Études et conception | Travaux : construction (rattachée au projet d'études s'il existe). Études : honoraires de conception. |
| 4 | Opportunité |  | liste des opportunités |  |
| 5 | Client (organisation) |  | liste des organisations |  |
| 6 | Contact |  | liste des contacts |  |
| 7 | Devise |  | liste : FCFA (XAF) · Euro · Dollar US |  |
| 8 | TVA (%) |  | nombre | 19,25 % au Cameroun ; 0 si exonéré. |
| 9 | Remise globale (montant) |  | nombre | Montant déduit du sous-total HT ; 0 si aucune. |
| 10 | Introduction |  | texte long | Texte d'accueil affiché en tête du devis (contexte, objet des travaux). |
| 11 | Conditions particulières |  | texte long |  |

## Commercial › CRM (`/erp/crm/leads/[id]`)

### Nouvelle activité

validation : **Enregistrer** · `POST /crm/activities` · composant `ActivityTimeline`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type | **Oui** | liste : Appel · E-mail · Réunion · WhatsApp · SMS · Note · Visite · Tâche · Relance |  |
| 2 | Objet | **Oui** | texte (250 car. max, 2 car. min) |  |
| 3 | Contenu |  | texte long |  |
| 4 | Échéance |  | date et heure |  |
| 5 | Fait |  | case à cocher |  |
| 6 | Sens |  | liste : Sortant · Entrant |  |
| 7 | Résultat |  | texte (250 car. max) |  |

### Qualification du lead

validation : **Enregistrer** · `PATCH /crm/leads/{lead_id}` · composant `LeadDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Prénom |  | texte (120 car. max) |  |
| 2 | Nom |  | texte (120 car. max) |  |
| 3 | Société |  | texte (200 car. max) |  |
| 4 | E-mail |  | adresse e-mail |  |
| 5 | Téléphone |  | texte (40 car. max) |  |
| 6 | WhatsApp |  | texte (40 car. max) |  |
| 7 | Pays |  | texte (80 car. max) |  |
| 8 | Ville |  | texte (120 car. max) |  |
| 9 | Canal préféré |  | liste : E-mail · Téléphone · WhatsApp |  |
| 10 | Type de projet |  | texte (120 car. max) |  |
| 11 | Localisation du projet |  | texte (200 car. max) |  |
| 12 | Terrain disponible |  | case à cocher |  |
| 13 | Statut du terrain |  | liste : Titre foncier · En cours · Acte de vente / attestation · Terrain coutumier · À vérifier |  |
| 14 | Univers |  | liste : Globus Home · Globus Business · Globus Premium · Globus Diaspora · Engineering Services |  |
| 15 | Offre visée |  | liste des offres du site |  |
| 16 | Budget minimum |  | nombre |  |
| 17 | Budget maximum |  | nombre |  |
| 18 | Délai souhaité |  | liste : Immédiat · Sous 3 mois · Sous 6 mois · Sous 12 mois · Non déterminé |  |
| 19 | Urgence |  | liste : Normale · Urgente |  |
| 20 | Étiquettes |  | mots-clés (taper puis Entrée) |  |

### Statut du lead

validation : **Enregistrer** · `PATCH /crm/leads/{lead_id}` · composant `LeadDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Statut |  | liste : Nouveau · Contacté · Qualifié · En maturation (à relancer) · Non qualifié · Perdu · Converti |  |
| 2 | Motif de perte | **Oui** | texte long (1000 car. max) (affiché seulement si : condition) | Pourquoi le prospect ne donne pas suite (prix, délai, concurrent, projet abandonné…). |

### Affecter le lead

validation : **Enregistrer** · `PATCH /crm/leads/{lead_id}` · composant `LeadDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Commercial |  | liste des utilisateurs |  |

### Convertir en opportunité

validation : **Enregistrer** · `POST /crm/leads/{lead_id}/convert` · composant `LeadDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre |  | texte (250 car. max) |  |
| 2 | Montant estimé |  | nombre (≥ 0) |  |
| 3 | Étape |  | liste : Qualification · Découverte · Proposition · Négociation |  |
| 4 | Date de décision attendue |  | date |  |
| 5 | Créer l'organisation |  | case à cocher |  |

## Commercial › CRM (`/erp/crm`)

### Nouvelle opportunité

validation : **Enregistrer** · `POST /crm/opportunities` · composant `OpportunitiesBoard`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre | **Oui** | texte (250 car. max) |  |
| 2 | Lead |  | liste des leads |  |
| 3 | Contact |  | liste des contacts |  |
| 4 | Organisation |  | liste des organisations |  |
| 5 | Univers |  | liste : Globus Home · Globus Business · Globus Premium · Globus Diaspora · Engineering Services |  |
| 6 | Offre |  | liste des offres du site |  |
| 7 | Montant estimé |  | nombre |  |
| 8 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 9 | Date de signature prévue |  | date |  |
| 10 | Responsable |  | liste des utilisateurs |  |
| 11 | Notes |  | texte long |  |

### fenêtre

validation : **Enregistrer** · `PATCH /crm/opportunities/{item_id}` · composant `OpportunitiesBoard`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre |  | texte (250 car. max) |  |
| 2 | Contact |  | liste des contacts |  |
| 3 | Organisation |  | liste des organisations |  |
| 4 | Univers |  | liste : Globus Home · Globus Business · Globus Premium · Globus Diaspora · Engineering Services |  |
| 5 | Offre |  | liste des offres du site |  |
| 6 | Montant estimé |  | nombre |  |
| 7 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 8 | Date de signature prévue |  | date |  |
| 9 | Responsable |  | liste des utilisateurs |  |
| 10 | Notes |  | texte long |  |

### Démarrer les études

validation : **Démarrer les études** · `POST /crm/opportunities/{opportunity_id}/start-studies` · composant `OpportunitiesBoard`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom du projet |  | texte (250 car. max) |  |
| 2 | Chef de projet |  | liste des utilisateurs |  |
| 3 | E-mail du client |  | adresse e-mail | Laisser vide pour inviter le contact de l'opportunité. |

### Contacts — Création

Bouton **Nouveau contact** · fenêtre « Nouveau contact » · validation : **Créer** · `POST /crm/contacts` · composant `ContactsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Organisation |  | liste des organisations |  |
| 2 | Prénom | **Oui** | texte (120 car. max) |  |
| 3 | Nom |  | texte (120 car. max) |  |
| 4 | E-mail |  | texte (254 car. max) |  |
| 5 | Téléphone |  | texte (40 car. max) |  |
| 6 | WhatsApp |  | texte (40 car. max) |  |
| 7 | Fonction |  | texte (150 car. max) |  |
| 8 | Ville |  | texte (120 car. max) |  |
| 9 | Pays |  | texte (80 car. max) |  |
| 10 | Diaspora |  | case à cocher |  |
| 11 | Responsable |  | liste des utilisateurs |  |
| 12 | Notes |  | texte long |  |
| 13 | Étiquettes |  | réglage structuré |  |

### Contacts — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /crm/contacts/{item_id}` · composant `ContactsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Organisation |  | liste des organisations |  |
| 2 | Prénom |  | texte (120 car. max) |  |
| 3 | Nom |  | texte (120 car. max) |  |
| 4 | E-mail |  | texte (254 car. max) |  |
| 5 | Téléphone |  | texte (40 car. max) |  |
| 6 | WhatsApp |  | texte (40 car. max) |  |
| 7 | Fonction |  | texte (150 car. max) |  |
| 8 | Ville |  | texte (120 car. max) |  |
| 9 | Pays |  | texte (80 car. max) |  |
| 10 | Diaspora |  | case à cocher |  |
| 11 | Responsable |  | liste des utilisateurs |  |
| 12 | Notes |  | texte long |  |
| 13 | Étiquettes |  | réglage structuré |  |

### Activités et relances — Action avec confirmation

Bouton **Marquer faite (dans la fiche)** · fenêtre « confirmation — Résultat » · validation : **Confirmer** · `(r) => `/crm/activities/${r.id}/done`` · composant `ActivitiesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Résultat | **Oui** | texte long |  |

### Règles d'affectation des leads — Création

Bouton **Nouvelle règle** · fenêtre « Nouvelle règle » · validation : **Créer** · `POST /crm/assignment-rules` · composant `CrmSettings`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (150 car. max) |  |
| 2 | Priorité |  | nombre entier |  |
| 3 | Critères |  | saisie dédiée (CriteriaEditor) |  |
| 4 | Commerciaux |  | sélection multiple dans une liste |  |
| 5 | Stratégie |  | liste : Tour de rôle · Moins chargé |  |
| 6 | Actif |  | case à cocher |  |

### Règles d'affectation des leads — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /crm/assignment-rules/{item_id}` · composant `CrmSettings`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (150 car. max) |  |
| 2 | Priorité |  | nombre entier |  |
| 3 | Critères |  | saisie dédiée (CriteriaEditor) |  |
| 4 | Commerciaux |  | sélection multiple dans une liste |  |
| 5 | Stratégie |  | liste : Tour de rôle · Moins chargé |  |
| 6 | Actif |  | case à cocher |  |

### Politiques SLA — Création

Bouton **Nouvelle politique** · fenêtre « Nouvelle politique » · validation : **Créer** · `POST /crm/sla-policies` · composant `CrmSettings`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Entité | **Oui** | liste : Lead · Ticket |  |
| 2 | Nom | **Oui** | texte (150 car. max) |  |
| 3 | Priorité |  | liste : Faible · Normale · Élevée · Urgente |  |
| 4 | Délai de réponse (min) |  | nombre entier |  |
| 5 | Délai de résolution (min) |  | nombre entier |  |
| 6 | Escalade |  | saisie dédiée (EscalationEditor) |  |
| 7 | Heures ouvrées uniquement |  | case à cocher |  |
| 8 | Actif |  | case à cocher |  |

### Politiques SLA — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /crm/sla-policies/{item_id}` · composant `CrmSettings`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Entité |  | liste : Lead · Ticket |  |
| 2 | Nom |  | texte (150 car. max) |  |
| 3 | Priorité |  | liste : Faible · Normale · Élevée · Urgente |  |
| 4 | Délai de réponse (min) |  | nombre entier |  |
| 5 | Délai de résolution (min) |  | nombre entier |  |
| 6 | Escalade |  | saisie dédiée (EscalationEditor) |  |
| 7 | Heures ouvrées uniquement |  | case à cocher |  |
| 8 | Actif |  | case à cocher |  |

### formulaire

validation : **Annuler · Créer le lead** · `/crm/leads` · composant `LeadCreate`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Prénom | **Oui** | texte |  |
| 2 | Nom |  | texte |  |
| 3 | Entreprise |  | texte |  |
| 4 | Origine du contact | **Oui** | liste : Site web · Décrire mon projet · Estimateur · Téléphone · WhatsApp · E-mail · Salon / événement · Recommandation · Visite en agence · Assistant en ligne · Réseaux sociaux · Autre |  |
| 5 | E-mail |  | adresse e-mail |  |
| 6 | Téléphone |  | téléphone |  |
| 7 | WhatsApp |  | téléphone |  |
| 8 | Ville |  | texte |  |
| 9 | Pays de résidence |  | texte | Hors Cameroun : le lead est marqué « diaspora ». |
| 10 | Univers |  | liste : Non précisé |  |
| 11 | Offre visée |  | liste des offres du site | Offre du site qui intéresse le prospect (facultatif). |
| 12 | Canal de contact préféré |  | liste : Selon ses consentements |  |
| 13 | Type de projet |  | texte |  |
| 14 | Localisation du projet |  | texte |  |
| 15 | Budget minimum (FCFA) |  | nombre |  |
| 16 | Budget maximum (FCFA) |  | nombre |  |
| 17 | Échéance |  | liste : Non précisée |  |
| 18 | Urgence |  | liste : Normale · Urgente |  |
| 19 | Besoin exprimé |  | texte long |  |
| 20 | Étiquettes |  | mots-clés (taper puis Entrée) | Mots-clés libres (salon, recommandation, terrain titré…). |
| 21 | Commercial affecté |  | liste des utilisateurs | Laisser vide : affectation automatique selon les règles. |
| 22 | Accepte de recevoir nos actualités (newsletter) |  | case à cocher |  |
| 23 | Accepte d'être contacté sur WhatsApp |  | case à cocher |  |

## Commercial › Newsletter (`/erp/newsletter`)

### Segments — Création

Bouton **Nouveau segment** · fenêtre « Nouveau segment » · validation : **Créer** · `POST /newsletter/segments` · composant `SegmentsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (150 car. max) |  |
| 2 | Description |  | texte long |  |
| 3 | Règles |  | saisie dédiée (RulesEditor) |  |

### Segments — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /newsletter/segments/{item_id}` · composant `SegmentsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (150 car. max) |  |
| 2 | Description |  | texte long |  |
| 3 | Règles |  | saisie dédiée (RulesEditor) |  |

### Automatisations — Création

Bouton **Nouveau scénario** · fenêtre « Nouveau scénario » · validation : **Créer** · `POST /newsletter/automations` · composant `AutomationsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (150 car. max) |  |
| 2 | Type | **Oui** | liste : Bienvenue · Relance · En maturation (à relancer) · Rappel · Réactivation |  |
| 3 | Déclencheur | **Oui** | liste : Abonnement confirmé · Nouveau prospect · Prospect inactif · Étiquette ajoutée · Jours d'inactivité |  |
| 4 | Réglage du déclencheur |  | réglage du déclencheur |  |
| 5 | Étapes (e-mails envoyés) |  | étapes (bouton « Étape ») |  |
| 6 | Actif |  | case à cocher |  |

### Automatisations — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /newsletter/automations/{item_id}` · composant `AutomationsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (150 car. max) |  |
| 2 | Type |  | liste : Bienvenue · Relance · En maturation (à relancer) · Rappel · Réactivation |  |
| 3 | Déclencheur |  | liste : Abonnement confirmé · Nouveau prospect · Prospect inactif · Étiquette ajoutée · Jours d'inactivité |  |
| 4 | Réglage du déclencheur |  | réglage du déclencheur |  |
| 5 | Étapes (e-mails envoyés) |  | étapes (bouton « Étape ») |  |
| 6 | Actif |  | case à cocher |  |

### Désinscrire l'abonné

validation : **Enregistrer · Désinscrire** · `/newsletter/subscribers/${sub.id}` · composant `SubscriberPanel`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Tags |  | mots-clés (taper puis Entrée) |  |
| 2 | Centres d'intérêt (univers, thèmes) |  | mots-clés (taper puis Entrée) |  |

### formulaire

validation : **Annuler · Enregistrer une nouvelle version / Créer le modèle** · composant `TemplateEditor`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom du modèle | **Oui** | texte |  |
| 2 | Usage |  | liste : Campagne · Automatisation · Transactionnel |  |
| 3 | Objet | **Oui** | texte |  |
| 4 | Pré-en-tête |  | texte |  |

### formulaire

validation : **Annuler · Créer la campagne** · `/newsletter/campaigns` · composant `CampaignCreate`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom interne | **Oui** | texte |  |
| 2 | Objet de l'e-mail | **Oui** | texte |  |
| 3 | Modèle | **Oui** | liste : Choisir… |  |
| 4 | Version |  | liste : Version courante | Par défaut, la version courante au moment de l'envoi. |
| 5 | Segments |  | sélection multiple dans une liste | Aucun segment = tous les abonnés confirmés. |
| 6 | Campagne UTM |  | texte |  |

### Envoyer la campagne / Programmer l'envoi / Annuler la campagne

validation : **Envoyer maintenant · Programmer · Annuler la campagne** · `/newsletter/campaigns/${campaign.id}/send` · composant `CampaignPanel`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Date et heure d'envoi |  | date et heure |  |

## Commercial › SAV (`/erp/sav`)

### Tickets SAV — Création

Bouton **Ticket (appel client)** · fenêtre « Ticket (appel client) » · validation : **Créer** · `POST /support/tickets` · composant `TicketsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Catégorie |  | liste : Étanchéité · Plomberie · Électricité · Fissure · Menuiserie · Peinture · Équipement · Autre |  |
| 3 | Priorité |  | liste : Faible · Normale · Élevée · Urgente |  |
| 4 | Objet | **Oui** | texte (250 car. max, 3 car. min) |  |
| 5 | Description |  | texte long (8000 car. max) |  |
| 6 | Localisation |  | texte (250 car. max) |  |
| 7 | Zone |  | liste des zones de la maquette |  |
| 8 | Reçu par |  | liste : Téléphone · E-mail · WhatsApp · Site web |  |
| 9 | Client (organisation) |  | liste des organisations clientes | Laisser vide : client du projet choisi. Le ticket apparaît dans son espace client. |
| 10 | Nom du demandeur |  | texte (200 car. max) | Personne qui signale le problème (laisser vide pour un ticket interne). |
| 11 | E-mail du demandeur |  | adresse e-mail |  |
| 12 | Téléphone du demandeur |  | texte (40 car. max) |  |

## Communication › Messagerie (`/erp/messagerie`)

### Nouvelle conversation

validation : **Annuler · Ouvrir le canal · Créer le groupe / Démarrer** · `/conversations/project-channel` · composant `NewConversation`

Aussi dans : `/espace-client/messagerie`, `/extranet/messagerie`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet | **Oui** | liste des projets |  |
| 2 | Canal | **Oui** | liste : Équipe du projet · Corps de métier · Échanges avec le client |  |
| 3 | Corps de métier | **Oui** | liste des métiers |  |
| 4 | Nom du groupe | **Oui** | texte |  |

## Finance › Facturation (`/erp/facturation/fournisseurs/[id]`)

### Arbitrage de l'anomalie

validation : **Enregistrer** · `POST /supplier-invoices/{invoice_id}/resolve` · composant `SupplierInvoiceDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Décision | **Oui** | liste : Accepter (dérogation tracée) · Rejeter la facture |  |
| 2 | Justification | **Oui** | texte long (4000 car. max, 5 car. min) |  |

### Avoir fournisseur

validation : **Enregistrer** · `POST /supplier-invoices/{invoice_id}/credit-notes` · composant `SupplierInvoiceDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Montant | **Oui** | nombre (≥ 0) |  |
| 2 | Motif (retour, écart de prix ou de quantité…) | **Oui** | texte long (2000 car. max, 5 car. min) |  |
| 3 | N° d'avoir du fournisseur |  | texte (80 car. max) |  |

### formulaire

validation : **Annuler · Créer l'ordre de paiement** · `/payments/outgoing` · composant `OutgoingPaymentForm`

Aussi dans : Finance › Finances (`/erp/finances`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Pièce à régler | **Oui** | liste de choix |  |
| 2 | TARGETS[targetType].label | **Oui** | liste | Seules les factures validées (bon à payer) sont proposées. |
| 3 | Montant |  | nombre |  |
| 4 | Mode de règlement | **Oui** | liste : Virement bancaire · Mobile Money · Chèque · Espèces |  |
| 5 | Notes |  | texte long |  |

### formulaire

validation : **Annuler · Ouvrir le litige** · `/disputes` · composant `DisputeCreate`

Aussi dans : Sous-traitance › Litiges (`/erp/litiges`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Partie concernée | **Oui** | liste de choix |  |
| 2 | PARTY_SOURCES[v.party_type].label | **Oui** | liste |  |
| 3 | Pièce contestée |  | liste : Aucune |  |
| 4 | RELATED_SOURCES[v.related_type].label | **Oui** | liste |  |
| 5 | Projet |  | liste des projets |  |
| 6 | Responsable du dossier |  | liste des utilisateurs |  |
| 7 | Objet | **Oui** | texte |  |
| 8 | Exposé des faits |  | texte long |  |
| 9 | Montant contesté |  | nombre |  |
| 10 | Geler les paiements sur la pièce contestée |  | case à cocher |  |

## Finance › Facturation (`/erp/facturation`)

### Factures clients — Création

Bouton **Nouvelle facture** · fenêtre « Nouvelle facture » · validation : **Créer** · `POST /client-invoices` · composant `ClientInvoicesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Client (organisation) |  | liste des organisations clientes |  |
| 3 | Contrat |  | liste |  |
| 4 | Type |  | liste : Facture · Acompte · Situation / avancement · Décompte final · Études et conception |  |
| 5 | Titre | **Oui** | texte (250 car. max, 2 car. min) |  |
| 6 | Date d'émission | **Oui** | date |  |
| 7 | Date d'échéance |  | date |  |
| 8 | Taux de TVA |  | nombre |  |
| 9 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 10 | Notes |  | texte long |  |
| 11 | Lignes | **Oui** | tableau de lignes : Désignation ★, Unité, Quantité ★, Prix unitaire ★ |  |

### Factures clients — Action

Bouton **Modifier le brouillon (dans la fiche)** · fenêtre « Modifier le brouillon » · validation : **Modifier le brouillon** · `PATCH /client-invoices/{invoice_id}` · composant `ClientInvoicesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre |  | texte (250 car. max, 2 car. min) |  |
| 2 | Date d'émission |  | date |  |
| 3 | Date d'échéance |  | date |  |
| 4 | Taux de TVA |  | nombre (≥ 0, ≤ 100) |  |
| 5 | Notes |  | texte long (4000 car. max) |  |
| 6 | Lignes |  | tableau de lignes : Désignation ★, Unité, Quantité ★, Prix unitaire ★ |  |

### Factures clients — Action avec confirmation

Bouton **Valider (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/client-invoices/${r.id}/validate`` · composant `ClientInvoicesList`

_Aucun champ à saisir (confirmation simple)._

### Factures clients — Action avec confirmation

Bouton **Envoyer au client (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/client-invoices/${r.id}/send`` · composant `ClientInvoicesList`

_Aucun champ à saisir (confirmation simple)._

### Factures clients — Action avec confirmation

Bouton **PDF (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · composant `ClientInvoicesList`

_Aucun champ à saisir (confirmation simple)._

### Factures clients — Action avec confirmation

Bouton **Relancer le client (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/client-invoices/${r.id}/remind`` · composant `ClientInvoicesList`

_Aucun champ à saisir (confirmation simple)._

### Factures clients — Action avec confirmation

Bouton **Copier un lien de paiement (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · composant `ClientInvoicesList`

_Aucun champ à saisir (confirmation simple)._

### Factures clients — Action

Bouton **Enregistrer un encaissement (dans la fiche)** · fenêtre « Enregistrer un encaissement » · validation : **Enregistrer un encaissement** · `POST /client-invoices/{invoice_id}/payments` · composant `ClientInvoicesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Montant encaissé |  | nombre (≥ 0) | Paiement partiel possible, au plus le reste dû. |
| 2 | Mode de règlement | **Oui** | liste : Virement bancaire · Chèque · Espèces · Mobile Money (dépôt direct, hors plateforme) |  |
| 3 | Date de valeur | **Oui** | date | Crédit du compte, remise du chèque ou des espèces. |
| 4 | Référence |  | texte (200 car. max) | N° de virement, de chèque ou de transaction Mobile Money (facultatif pour les espèces) ; sert au rapprochement bancaire. |
| 5 | Preuve de l'encaissement | **Oui** | fichier à déposer | Avis de crédit, bordereau de remise, copie du chèque ou reçu Mobile Money (PDF ou image). |
| 6 | Notes |  | texte long (2000 car. max) |  |

### Factures clients — Action

Bouton **Émettre un avoir (dans la fiche)** · fenêtre « Émettre un avoir » · validation : **Émettre un avoir** · `POST /client-invoices/{invoice_id}/credit-notes` · composant `ClientInvoicesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Montant | **Oui** | nombre (≥ 0) |  |
| 2 | Motif | **Oui** | texte long (2000 car. max, 5 car. min) |  |

### Factures clients — Action

Bouton **Annuler la facture (dans la fiche)** · fenêtre « Annuler la facture » · validation : **Annuler la facture** · `POST /client-invoices/{invoice_id}/cancel` · composant `ClientInvoicesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Motif de l'annulation | **Oui** | texte long (2000 car. max, 5 car. min) |  |

### Appels de fonds — Création

Bouton **Nouvel appel de fonds** · fenêtre « Nouvel appel de fonds » · validation : **Créer** · `POST /funds-calls` · composant `FundsCallsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet | **Oui** | liste des projets |  |
| 2 | Jalon |  | liste des jalons du projet |  |
| 3 | Libellé | **Oui** | texte (250 car. max, 2 car. min) |  |
| 4 | Montant | **Oui** | nombre (≥ 0) |  |
| 5 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 6 | Date d'échéance |  | date |  |

### Appels de fonds — Action avec confirmation

Bouton **Émettre (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/funds-calls/${r.id}/issue`` · composant `FundsCallsList`

_Aucun champ à saisir (confirmation simple)._

### Appels de fonds — Action

Bouton **Enregistrer un encaissement (dans la fiche)** · fenêtre « Enregistrer un encaissement » · validation : **Enregistrer un encaissement** · `POST /funds-calls/{call_id}/payments` · composant `FundsCallsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Montant encaissé |  | nombre (≥ 0) | Paiement partiel possible, au plus le reste dû. |
| 2 | Mode de règlement | **Oui** | liste : Virement bancaire · Chèque · Espèces · Mobile Money (dépôt direct, hors plateforme) |  |
| 3 | Date de valeur | **Oui** | date | Crédit du compte, remise du chèque ou des espèces. |
| 4 | Référence |  | texte (200 car. max) | N° de virement, de chèque ou de transaction Mobile Money (facultatif pour les espèces) ; sert au rapprochement bancaire. |
| 5 | Preuve de l'encaissement | **Oui** | fichier à déposer | Avis de crédit, bordereau de remise, copie du chèque ou reçu Mobile Money (PDF ou image). |
| 6 | Notes |  | texte long (2000 car. max) |  |

### Factures des sous-traitants — Action avec confirmation

Bouton **Valider (bon à payer) (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/subcontractor-invoices/${r.id}/validate`` · composant `SubcontractorInvoices`

Aussi dans : Sous-traitance › Sous-traitants (`/erp/sous-traitants`)

_Aucun champ à saisir (confirmation simple)._

### Factures des sous-traitants — Action avec confirmation

Bouton **Rejeter (dans la fiche)** · fenêtre « confirmation — Motif du rejet » · validation : **Confirmer** · `(r) => `/subcontractor-invoices/${r.id}/reject`` · composant `SubcontractorInvoices`

Aussi dans : Sous-traitance › Sous-traitants (`/erp/sous-traitants`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Motif du rejet | **Oui** | texte long |  |

### formulaire

validation : **Ligne · Annuler · Enregistrer la facture** · `/supplier-invoices/upload` · composant `SupplierInvoiceForm`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Fournisseur | **Oui** | liste des fournisseurs |  |
| 2 | Bon de commande |  | liste des bons de commande | Le rapprochement 3 pièces (BC / réception / facture) s'appuie sur ce lien. |
| 3 | N° de facture du fournisseur | **Oui** | texte |  |
| 4 | Date de facture | **Oui** | date |  |
| 5 | Échéance |  | date |  |
| 6 | Montant de TVA |  | nombre |  |
| 7 | Facture (PDF ou image) |  | fichier(s) à déposer |  |
| 8 | Lancer le rapprochement 3 pièces dès l'enregistrement |  | case à cocher |  |

## Finance › Financement clients (`/erp/finances/financements`)

### fenêtre

validation : **Enregistrer** · `schéma PartnerIn` · composant `FinancingAdminPage`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (200 car. max, 2 car. min) |  |
| 2 | Type |  | liste : Banque · Microfinance · Offre diaspora |  |
| 3 | Description |  | texte long (2000 car. max) |  |
| 4 | Taux minimum | **Oui** | nombre (≥ 0, ≤ 100) |  |
| 5 | Taux maximum | **Oui** | nombre (≥ 0, ≤ 100) |  |
| 6 | Durée maximum (années) |  | nombre entier (≥ 1, ≤ 30) |  |
| 7 | Apport minimum (%) |  | nombre (≥ 0, ≤ 100) |  |
| 8 | Taux d'endettement maximum (%) |  | nombre (≥ 1, ≤ 100) |  |
| 9 | Frais (%) |  | nombre (≥ 0, ≤ 20) |  |
| 10 | Exigences |  | mots-clés (taper puis Entrée) | Pièces exigées par l'établissement |
| 11 | Nom du contact |  | texte (150 car. max) |  |
| 12 | E-mail de contact |  | texte (254 car. max) |  |
| 13 | Actif |  | case à cocher |  |
| 14 | Ordre |  | nombre entier |  |

## Finance › Finances (`/erp/finances/paiements/[id]`)

### Paiement bloqué par le contrôle interne / Exécuter le paiement

validation : **Approuver · Retirer la saisie / Refuser · Exécuter · Actualiser le statut · Retirer / Refuser · Approuver par dérogation · Confirmer l'exécution** · `/payments/${id}/refresh` · composant `PaymentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Motif | **Oui** | texte long | 5 caractères minimum — ex. « Virement absent du relevé BICEC du 14/10 » |
| 2 | Justification de la dérogation | **Oui** | texte long | 15 caractères minimum — ex. « Numéro confirmé par contre-appel au gérant » |
| 3 | Canal d'exécution |  | liste : Virement / Mobile Money effectué hors plateforme (preuve jointe) |  |
| 4 | Référence bancaire / Mobile Money |  | texte |  |
| 5 | Preuve d'exécution | **Oui** | fichier(s) à déposer | Ordre de virement signé, reçu Mobile Money… |

## Finance › Finances (`/erp/finances`)

### Prévisions de trésorerie — Création

Bouton **Nouvelle prévision** · fenêtre « Nouvelle prévision » · validation : **Créer** · `POST /cash-forecast-entries` · composant `CashForecastList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Libellé | **Oui** | texte (250 car. max) |  |
| 3 | Sens | **Oui** | liste : Entrée · Sortie |  |
| 4 | Montant |  | nombre |  |
| 5 | Date prévue | **Oui** | date |  |
| 6 | Probabilité |  | nombre entier |  |

### Prévisions de trésorerie — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /cash-forecast-entries/{item_id}` · composant `CashForecastList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Libellé |  | texte (250 car. max) |  |
| 3 | Sens |  | liste : Entrée · Sortie |  |
| 4 | Montant |  | nombre |  |
| 5 | Date prévue |  | date |  |
| 6 | Probabilité |  | nombre entier |  |

### Comptes bancaires et Mobile Money — Création

Bouton **Nouveau compte** · fenêtre « Nouveau compte » · validation : **Créer** · `POST /bank-accounts` · composant `BankAccountsView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (150 car. max) |  |
| 2 | Banque |  | texte (150 car. max) |  |
| 3 | Numéro de compte |  | texte | Chiffré au repos ; jamais réaffiché en clair. |
| 4 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 5 | Type |  | liste : Banque · Mobile Money · Prestataire de paiement |  |
| 6 | Actif |  | case à cocher |  |

### Comptes bancaires et Mobile Money — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /bank-accounts/{item_id}` · composant `BankAccountsView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (150 car. max) |  |
| 2 | Banque |  | texte (150 car. max) |  |
| 3 | Numéro de compte |  | texte |  |
| 4 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 5 | Type |  | liste : Banque · Mobile Money · Prestataire de paiement |  |
| 6 | Actif |  | case à cocher |  |

### Petites caisses de chantier — Création

Bouton **Nouvelle caisse** · fenêtre « Nouvelle caisse » · validation : **Créer** · `POST /petty-cash-funds` · composant `PettyCashView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (150 car. max) |  |
| 2 | Projet |  | liste des projets |  |
| 3 | Chantier |  | liste des sites du projet |  |
| 4 | Gestionnaire |  | liste des utilisateurs |  |
| 5 | Plafond |  | nombre |  |
| 6 | Actif |  | case à cocher |  |

### Petites caisses de chantier — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /petty-cash-funds/{item_id}` · composant `PettyCashView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (150 car. max) |  |
| 2 | Projet |  | liste des projets |  |
| 3 | Chantier |  | liste des sites du projet |  |
| 4 | Gestionnaire |  | liste des utilisateurs |  |
| 5 | Plafond |  | nombre |  |
| 6 | Actif |  | case à cocher |  |

## Finance › Ma petite caisse (`/erp/caisse`)

### Mouvement de caisse

validation : **Enregistrer** · `POST /petty-cash-funds/{fund_id}/transactions` · composant `PettyCashFund`

Aussi dans : Finance › Finances (`/erp/finances`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type | **Oui** | liste : Sortie (dépense) · Entrée (réapprovisionnement) |  |
| 2 | Montant | **Oui** | nombre |  |
| 3 | Objet | **Oui** | texte |  |
| 4 | Catégorie |  | liste : Matériaux · Main-d'œuvre · Transport · Restauration · Carburant · Petit outillage · Autre |  |
| 5 | Lot |  | liste des lots du projet |  |
| 6 | Date de l'opération | **Oui** | date |  |
| 7 | Reçu | **Oui** | fichier à déposer | Justificatif (photo du ticket, facture) : obligatoire pour une sortie. |

## Projets › Agenda (`/erp/agenda`)

### formulaire

validation : **Annuler · Créer l'événement** · `/agenda/events` · composant `EventForm`

Aussi dans : `/espace-client/agenda`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre | **Oui** | texte |  |
| 2 | Type |  | liste : Réunion · Rendez-vous · Visite de chantier · Réunion BIM · Appel · Jalon · Rappel |  |
| 3 | Projet |  | liste des projets |  |
| 4 | Début | **Oui** | date et heure |  |
| 5 | Fin | **Oui** | date et heure |  |
| 6 | Lieu |  | texte |  |
| 7 | Récurrence |  | liste : Aucune · Tous les jours · Toutes les semaines · Tous les mois |  |
| 8 | Participants |  | sélection multiple dans une liste |  |
| 9 | Invités externes (e-mails) |  | mots-clés (taper puis Entrée) |  |
| 10 | Rappels (minutes avant) |  | mots-clés (taper puis Entrée) |  |
| 11 | Description |  | texte long |  |
| 12 | Journée entière |  | case à cocher |  |
| 13 | Créer la visioconférence |  | case à cocher |  |
| 14 | Visible par le client |  | case à cocher |  |

## Projets › Chantiers (`/erp/chantiers/[id]`)

### Convention de séquestre

validation : **Enregistrer** · `PUT /projects/{project_id}/escrow` · composant `ProjectEscrowTab`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Partenaire | **Oui** | texte (200 car. max, 2 car. min) | Banque ou notaire tiers de confiance |
| 2 | Référence du partenaire |  | texte (120 car. max) | N° du compte ou de la convention (requis pour l'activation) |
| 3 | Délai de revue (jours) |  | nombre entier (≥ 3, ≤ 60) |  |
| 4 | Conditions |  | texte long (4000 car. max) |  |

### Modifier le projet

validation : **Enregistrer** · `schéma ProjectIn` · composant `Synthese`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (250 car. max, 2 car. min) |  |
| 2 | Description |  | texte long |  |
| 3 | Client (organisation) |  | liste des organisations clientes |  |
| 4 | Univers |  | liste : Globus Home · Globus Business · Globus Premium · Globus Diaspora · Engineering Services |  |
| 5 | Offre |  | liste des offres du site |  |
| 6 | Type de projet |  | liste : Construction neuve · Rénovation · Extension · Réhabilitation · Aménagement · Études |  |
| 7 | Statut |  | liste : Prospect · Étude · Conception · Permis · Préparation · Exécution · Réception · Garantie · Clos · Suspendu · Annulé |  |
| 8 | Adresse |  | texte long |  |
| 9 | Ville |  | texte |  |
| 10 | Pays |  | texte |  |
| 11 | Latitude |  | nombre |  |
| 12 | Longitude |  | nombre |  |
| 13 | Surface (m²) |  | nombre |  |
| 14 | Niveaux |  | nombre entier |  |
| 15 | Début prévu |  | date |  |
| 16 | Fin prévue |  | date |  |
| 17 | Début réel |  | date |  |
| 18 | Fin réelle |  | date |  |
| 19 | Date de réception |  | date |  |
| 20 | Montant du contrat |  | nombre |  |
| 21 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 22 | Responsable |  | liste des utilisateurs |  |
| 23 | Directeur de projet |  | liste des utilisateurs |  |
| 24 | Commercial |  | liste des utilisateurs |  |
| 25 | Visible par le client |  | case à cocher |  |
| 26 | Diaspora |  | case à cocher |  |
| 27 | Étiquettes |  | mots-clés (taper puis Entrée) |  |

### Ajouter un membre

validation : **Enregistrer** · `POST /projects/{project_id}/members` · composant `Members`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Utilisateur | **Oui** | liste des utilisateurs |  |
| 2 | Rôle sur le projet |  | liste : Chef de projet · Conducteur de travaux · Chef de chantier · Ingénieur · Architecte · BIM manager · Acheteur · QHSE · Comptable · Client · Partenaire · Membre |  |
| 3 | Lots |  | sélection multiple : liste |  |
| 4 | Disciplines |  | cases à cocher : disciplines | Aucune case cochée : accès à toutes les disciplines (maquettes BIM et documents). |
| 5 | Chantiers |  | sélection multiple : liste |  |
| 6 | Accès aux finances |  | case à cocher |  |

### Ajouter une photo ou une vidéo

validation : **Enregistrer** · `POST /projects/{project_id}/media` · composant `SiteMedia`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Fichier | **Oui** | fichier à déposer |  |
| 2 | Légende |  | texte |  |
| 3 | Étape |  | liste : Avant travaux · Pendant les travaux · Après travaux · Inspection · Livraison · Incident |  |
| 4 | Chantier |  | liste des sites du projet |  |
| 5 | Tâche |  | liste |  |
| 6 | Date de prise de vue |  | date et heure |  |
| 7 | Latitude |  | nombre |  |
| 8 | Longitude |  | nombre |  |
| 9 | Publier |  | case à cocher |  |
| 10 | Client mutation |  | texte (80 car. max) |  |

### Sites — Création

Bouton **Nouveau site** · fenêtre « Nouveau site » · validation : **Créer** · `POST /sites` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code | **Oui** | texte (40 car. max) |  |
| 2 | Nom | **Oui** | texte (200 car. max) |  |
| 3 | Adresse |  | texte long |  |
| 4 | Ville |  | texte (120 car. max) |  |
| 5 | Latitude |  | nombre |  |
| 6 | Longitude |  | nombre |  |
| 7 | Rayon de géorepérage (m) |  | nombre entier |  |
| 8 | Chef de chantier |  | liste des utilisateurs |  |
| 9 | Statut |  | liste : Préparation · Actif · Suspendu · Clos |  |
| 10 | Date de début |  | date |  |
| 11 | Date de fin |  | date |  |
| 12 | Instructions d'accès |  | texte long |  |
| 13 | Notes sécurité |  | texte long |  |
| 14 | URL du direct |  | texte (500 car. max) |  |

### Sites — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /sites/{item_id}` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code |  | texte (40 car. max) |  |
| 2 | Nom |  | texte (200 car. max) |  |
| 3 | Adresse |  | texte long |  |
| 4 | Ville |  | texte (120 car. max) |  |
| 5 | Latitude |  | nombre |  |
| 6 | Longitude |  | nombre |  |
| 7 | Rayon de géorepérage (m) |  | nombre entier |  |
| 8 | Chef de chantier |  | liste des utilisateurs |  |
| 9 | Statut |  | liste : Préparation · Actif · Suspendu · Clos |  |
| 10 | Date de début |  | date |  |
| 11 | Date de fin |  | date |  |
| 12 | Instructions d'accès |  | texte long |  |
| 13 | Notes sécurité |  | texte long |  |
| 14 | URL du direct |  | texte (500 car. max) |  |

### Phases — Création

Bouton **Nouvelle phase** · fenêtre « Nouvelle phase » · validation : **Créer** · `POST /phases` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (200 car. max) |  |
| 2 | Ordre |  | nombre entier |  |
| 3 | Début prévu |  | date |  |
| 4 | Fin prévue |  | date |  |
| 5 | Début réel |  | date |  |
| 6 | Fin réelle |  | date |  |
| 7 | Avancement (%) |  | nombre |  |
| 8 | Statut |  | liste : Planifié · En cours · Terminé |  |
| 9 | Couleur |  | sélecteur de couleur |  |
| 10 | Visible par le client |  | case à cocher |  |

### Phases — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /phases/{item_id}` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (200 car. max) |  |
| 2 | Ordre |  | nombre entier |  |
| 3 | Début prévu |  | date |  |
| 4 | Fin prévue |  | date |  |
| 5 | Début réel |  | date |  |
| 6 | Fin réelle |  | date |  |
| 7 | Avancement (%) |  | nombre |  |
| 8 | Statut |  | liste : Planifié · En cours · Terminé |  |
| 9 | Couleur |  | sélecteur de couleur |  |
| 10 | Visible par le client |  | case à cocher |  |

### Lots — Création

Bouton **Nouveau lot** · fenêtre « Nouveau lot » · validation : **Créer** · `POST /lots` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code | **Oui** | texte (30 car. max) |  |
| 2 | Nom | **Oui** | texte (200 car. max) |  |
| 3 | Discipline |  | liste des disciplines (Hub BIM) |  |
| 4 | Description |  | texte long |  |
| 5 | Budget |  | nombre |  |
| 6 | Ordre |  | nombre entier |  |
| 7 | Sous-traitant |  | liste des sous-traitants |  |
| 8 | Statut |  | liste : Planifié · En cours · Terminé |  |
| 9 | Avancement (%) |  | nombre |  |

### Lots — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /lots/{item_id}` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code |  | texte (30 car. max) |  |
| 2 | Nom |  | texte (200 car. max) |  |
| 3 | Discipline |  | liste des disciplines (Hub BIM) |  |
| 4 | Description |  | texte long |  |
| 5 | Budget |  | nombre |  |
| 6 | Ordre |  | nombre entier |  |
| 7 | Sous-traitant |  | liste des sous-traitants |  |
| 8 | Statut |  | liste : Planifié · En cours · Terminé |  |
| 9 | Avancement (%) |  | nombre |  |

### Jalons — Création

Bouton **Nouveau jalon** · fenêtre « Nouveau jalon » · validation : **Créer** · `POST /milestones` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (200 car. max) |  |
| 2 | Description |  | texte long |  |
| 3 | Date d'échéance | **Oui** | date |  |
| 4 | Atteint le |  | date et heure |  |
| 5 | Statut |  | liste : Planifié · Atteint · En retard · Annulé |  |
| 6 | Visible par le client |  | case à cocher |  |
| 7 | Part de paiement (%) |  | nombre |  |
| 8 | Ordre |  | nombre entier |  |

### Jalons — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /milestones/{item_id}` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (200 car. max) |  |
| 2 | Description |  | texte long |  |
| 3 | Date d'échéance |  | date |  |
| 4 | Atteint le |  | date et heure |  |
| 5 | Statut |  | liste : Planifié · Atteint · En retard · Annulé |  |
| 6 | Visible par le client |  | case à cocher |  |
| 7 | Part de paiement (%) |  | nombre |  |
| 8 | Ordre |  | nombre entier |  |

### Journal de chantier — Création

Bouton **Nouveau rapport** · fenêtre « Nouveau rapport » · validation : **Créer** · `POST /daily-logs` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Chantier |  | liste des sites du projet |  |
| 2 | Date du journal | **Oui** | date |  |
| 3 | Météo |  | texte (120 car. max) |  |
| 4 | Température (°C) |  | nombre |  |
| 5 | Effectif GLOBUS |  | nombre entier (≥ 0) |  |
| 6 | Effectif sous-traitants |  | nombre entier (≥ 0) |  |
| 7 | Travaux réalisés |  | texte long |  |
| 8 | Problèmes rencontrés |  | texte long |  |
| 9 | Livraisons du jour |  | texte long |  |
| 10 | Visiteurs |  | texte long |  |
| 11 | Notes sécurité |  | texte long |  |
| 12 | Heures de retard |  | nombre |  |
| 13 | Besoins |  | texte long |  |
| 14 | Critique |  | case à cocher |  |
| 15 | Visible par le client |  | case à cocher |  |

### Journal de chantier — Action avec confirmation

Bouton **Soumettre (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/daily-logs/${r.id}/submit`` · composant `ProjectWorkspace`

_Aucun champ à saisir (confirmation simple)._

### Journal de chantier — Action avec confirmation

Bouton **Valider (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/daily-logs/${r.id}/validate`` · composant `ProjectWorkspace`

_Aucun champ à saisir (confirmation simple)._

### Décisions client — Création

Bouton **Demander une décision** · fenêtre « Demander une décision » · validation : **Créer** · `POST /decisions` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type |  | liste : Matériau · Option · Plan · Budget · Planning · Autre |  |
| 2 | Titre | **Oui** | texte (250 car. max, 3 car. min) |  |
| 3 | Description |  | texte long |  |
| 4 | Options proposées au client |  | options proposées (bouton « Option ») |  |
| 5 | Impact prix |  | nombre |  |
| 6 | Impact délai (jours) |  | nombre entier |  |
| 7 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 8 | Type de référence |  | liste : Version de document · Version BIM · Scénario |  |
| 9 | Pièce concernée |  | pièce concernée (liste selon le type) |  |
| 10 | Version |  | texte (60 car. max) |  |
| 11 | Date d'échéance |  | date |  |

### Avenants — Création

Bouton **Nouvel avenant** · fenêtre « Nouvel avenant » · validation : **Créer** · `POST /change-orders` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Lot |  | liste des lots du projet |  |
| 2 | Titre | **Oui** | texte (250 car. max, 3 car. min) |  |
| 3 | Description |  | texte long |  |
| 4 | Motif |  | liste : Demande client · Technique · Imprévu · Réglementaire |  |
| 5 | Impact coût |  | nombre |  |
| 6 | Impact délai (jours) |  | nombre entier |  |
| 7 | Lignes chiffrées |  | saisie dédiée (ChangeOrderLinesEditor) |  |

### Avenants — Action avec confirmation

Bouton **Soumettre au client (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/change-orders/${r.id}/transition`` · composant `ProjectWorkspace`

_Aucun champ à saisir (confirmation simple)._

### Avenants — Action avec confirmation

Bouton **Repasser en brouillon (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/change-orders/${r.id}/transition`` · composant `ProjectWorkspace`

_Aucun champ à saisir (confirmation simple)._

### Avenants — Action avec confirmation

Bouton **Approuver (finance) (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/change-orders/${r.id}/transition`` · composant `ProjectWorkspace`

_Aucun champ à saisir (confirmation simple)._

### Avenants — Action avec confirmation

Bouton **Rejeter (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/change-orders/${r.id}/transition`` · composant `ProjectWorkspace`

_Aucun champ à saisir (confirmation simple)._

### Avenants — Action avec confirmation

Bouton **Annuler (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/change-orders/${r.id}/transition`` · composant `ProjectWorkspace`

_Aucun champ à saisir (confirmation simple)._

### Risques — Création

Bouton **Nouveau risque** · fenêtre « Nouveau risque » · validation : **Créer** · `POST /risks` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre | **Oui** | texte (250 car. max) |  |
| 2 | Description |  | texte long |  |
| 3 | Catégorie |  | liste : Technique · Financier · Planning · Sécurité · Qualité · Juridique · Environnement · Approvisionnement |  |
| 4 | Probabilité |  | nombre entier | De 1 (rare) à 5 (quasi certain). |
| 5 | Impact |  | nombre entier | De 1 (faible) à 5 (critique). |
| 6 | Responsable |  | liste des utilisateurs |  |
| 7 | Mesures de maîtrise |  | texte long |  |
| 8 | Plan de secours |  | texte long |  |
| 9 | Statut |  | liste : Identifié · Sous surveillance · Survenu · Clôturé |  |
| 10 | Date d'échéance |  | date |  |
| 11 | Exposition financière |  | nombre | Coût estimé si le risque survient (FCFA). |

### Risques — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /risks/{item_id}` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre |  | texte (250 car. max) |  |
| 2 | Description |  | texte long |  |
| 3 | Catégorie |  | liste : Technique · Financier · Planning · Sécurité · Qualité · Juridique · Environnement · Approvisionnement |  |
| 4 | Probabilité |  | nombre entier | De 1 (rare) à 5 (quasi certain). |
| 5 | Impact |  | nombre entier | De 1 (faible) à 5 (critique). |
| 6 | Responsable |  | liste des utilisateurs |  |
| 7 | Mesures de maîtrise |  | texte long |  |
| 8 | Plan de secours |  | texte long |  |
| 9 | Statut |  | liste : Identifié · Sous surveillance · Survenu · Clôturé |  |
| 10 | Date d'échéance |  | date |  |
| 11 | Exposition financière |  | nombre | Coût estimé si le risque survient (FCFA). |

### Dossier Tranquillité — Création

Bouton **Nouvelle pièce** · fenêtre « Nouvelle pièce » · validation : **Créer** · `POST /tranquillite-items` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Catégorie | **Oui** | liste : Foncier · Titre foncier / propriété · Permis · Acte notarié · Vérification · Administratif · Assurance · Autre |  |
| 2 | Titre | **Oui** | texte (250 car. max) |  |
| 3 | Numéro de référence |  | texte |  |
| 4 | Autorité |  | texte (200 car. max) |  |
| 5 | Statut |  | liste : À fournir · En cours · En vérification · Vérifié · Anomalie · Expiré |  |
| 6 | Date de délivrance |  | date |  |
| 7 | Date d'expiration |  | date |  |
| 8 | Date d'échéance |  | date |  |
| 9 | Responsable |  | liste des utilisateurs |  |
| 10 | Notes |  | texte long |  |
| 11 | Documents de preuve (GED) |  | sélection multiple dans une liste |  |
| 12 | Notes de vérification |  | texte long |  |
| 13 | Visible par le client |  | case à cocher |  |

### Dossier Tranquillité — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /tranquillite-items/{item_id}` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Catégorie |  | liste : Foncier · Titre foncier / propriété · Permis · Acte notarié · Vérification · Administratif · Assurance · Autre |  |
| 2 | Titre |  | texte (250 car. max) |  |
| 3 | Numéro de référence |  | texte |  |
| 4 | Autorité |  | texte (200 car. max) |  |
| 5 | Statut |  | liste : À fournir · En cours · En vérification · Vérifié · Anomalie · Expiré |  |
| 6 | Date de délivrance |  | date |  |
| 7 | Date d'expiration |  | date |  |
| 8 | Date d'échéance |  | date |  |
| 9 | Responsable |  | liste des utilisateurs |  |
| 10 | Notes |  | texte long |  |
| 11 | Documents de preuve (GED) |  | sélection multiple dans une liste |  |
| 12 | Notes de vérification |  | texte long |  |
| 13 | Visible par le client |  | case à cocher |  |

### Dossier Tranquillité — Action

Bouton **Vérifier (dans la fiche)** · fenêtre « Vérifier » · validation : **Vérifier** · `POST /tranquillite-items/{item_id}/verify` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Statut | **Oui** | liste : En vérification · Vérifié · Anomalie · Expiré · En cours |  |
| 2 | Notes |  | texte long (4000 car. max) |  |
| 3 | Certifier les pièces (empreinte horodatée) |  | case à cocher |  |

### Garanties — Création

Bouton **Nouvelle garantie** · fenêtre « Nouvelle garantie » · validation : **Créer** · `POST /warranties` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type | **Oui** | liste : Parfait achèvement (1 an) · Biennale (2 ans) · Décennale (10 ans) · Équipement |  |
| 2 | Date de début | **Oui** | date |  |
| 3 | Date de fin | **Oui** | date |  |
| 4 | Couverture |  | texte long |  |
| 5 | Assureur |  | texte (200 car. max) |  |
| 6 | N° de police |  | texte (100 car. max) |  |

### Garanties — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /warranties/{item_id}` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type |  | liste : Parfait achèvement (1 an) · Biennale (2 ans) · Décennale (10 ans) · Équipement |  |
| 2 | Date de début |  | date |  |
| 3 | Date de fin |  | date |  |
| 4 | Couverture |  | texte long |  |
| 5 | Assureur |  | texte (200 car. max) |  |
| 6 | N° de police |  | texte (100 car. max) |  |

### Contenus immersifs — Création

Bouton **Nouveau contenu** · fenêtre « Nouveau contenu » · validation : **Créer** · `POST /immersive-contents` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Chantier |  | liste des sites du projet |  |
| 2 | Type | **Oui** | liste : Direct (caméra) · Photo 360° · Vidéo 360° · Drone · Time-lapse · Visite virtuelle |  |
| 3 | Titre | **Oui** | texte (200 car. max) |  |
| 4 | Description |  | texte long |  |
| 5 | Fichier |  | fichier : photo/vidéo du chantier, document GED ou nouveau fichier | Choisissez une photo ou vidéo du chantier, un document du projet, ou déposez un nouveau fichier. Pour un direct ou une visite hébergée ailleurs, laissez vide et renseignez l'URL externe. |
| 6 | URL externe |  | texte (500 car. max) |  |
| 7 | Capturé le |  | date et heure |  |
| 8 | Groupe de comparaison |  | texte (80 car. max) |  |
| 9 | Zone |  | liste des zones de la maquette |  |
| 10 | Publié au client |  | case à cocher |  |

### Contenus immersifs — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /immersive-contents/{item_id}` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Chantier |  | liste des sites du projet |  |
| 2 | Type |  | liste : Direct (caméra) · Photo 360° · Vidéo 360° · Drone · Time-lapse · Visite virtuelle |  |
| 3 | Titre |  | texte (200 car. max) |  |
| 4 | Description |  | texte long |  |
| 5 | Fichier |  | fichier : photo/vidéo du chantier, document GED ou nouveau fichier | Choisissez une photo ou vidéo du chantier, un document du projet, ou déposez un nouveau fichier. Pour un direct ou une visite hébergée ailleurs, laissez vide et renseignez l'URL externe. |
| 6 | URL externe |  | texte (500 car. max) |  |
| 7 | Capturé le |  | date et heure |  |
| 8 | Groupe de comparaison |  | texte (80 car. max) |  |
| 9 | Zone |  | liste des zones de la maquette |  |
| 10 | Publié au client |  | case à cocher |  |

### Résumés client (digests) — Création

Bouton **Nouveau résumé** · fenêtre « Nouveau résumé » · validation : **Créer** · `POST /client-digests` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Début de période | **Oui** | date |  |
| 2 | Fin de période | **Oui** | date |  |
| 3 | Résumé |  | texte long |  |
| 4 | Généré le |  | date et heure |  |
| 5 | Envoyé le |  | date et heure |  |
| 6 | Destinataires (adresses e-mail) |  | mots-clés (taper puis Entrée) |  |

### Résumés client (digests) — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /client-digests/{item_id}` · composant `ProjectWorkspace`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Début de période |  | date |  |
| 2 | Fin de période |  | date |  |
| 3 | Résumé |  | texte long |  |
| 4 | Généré le |  | date et heure |  |
| 5 | Envoyé le |  | date et heure |  |
| 6 | Destinataires (adresses e-mail) |  | mots-clés (taper puis Entrée) |  |

### Dépenses — Création

Bouton **Nouvelle dépense** · fenêtre « Nouvelle dépense » · validation : **Créer** · `POST /expenses` · composant `ProjectBudget`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Lot |  | liste des lots du projet |  |
| 2 | Catégorie |  | liste : Matériaux · Main-d'œuvre · Sous-traitance · Matériel · Études · Frais généraux · Autre |  |
| 3 | Libellé | **Oui** | texte (250 car. max) |  |
| 4 | Montant |  | nombre |  |
| 5 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 6 | Date de la dépense | **Oui** | date |  |
| 7 | Justificatif (facture, ticket, reçu) |  | dépôt d'un fichier (photo ou PDF) |  |
| 8 | Visible par le client |  | case à cocher |  |

### Dépenses — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /expenses/{item_id}` · composant `ProjectBudget`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Lot |  | liste des lots du projet |  |
| 2 | Catégorie |  | liste : Matériaux · Main-d'œuvre · Sous-traitance · Matériel · Études · Frais généraux · Autre |  |
| 3 | Libellé |  | texte (250 car. max) |  |
| 4 | Montant |  | nombre |  |
| 5 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 6 | Date de la dépense |  | date |  |
| 7 | Justificatif (facture, ticket, reçu) |  | dépôt d'un fichier (photo ou PDF) |  |
| 8 | Visible par le client |  | case à cocher |  |

### Nouvelle version de budget

validation : **Enregistrer** · `POST /budgets` · composant `ProjectBudget`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Libellé | **Oui** | texte (150 car. max, 2 car. min) |  |
| 2 | Notes |  | texte long |  |
| 3 | Chiffre d'affaires visé |  | nombre |  |
| 4 | Lignes | **Oui** | tableau de lignes : Lot, Catégorie, Libellé ★, Montant ★ |  |

### Convention de séquestre / Activer le séquestre / Demande de libération / Valider la libération / Médiation de la contestation

validation : **Configurer le séquestre · Convention · Activer · Placer sous séquestre · Demander la libération · Valider la libération ( /2) · Médiation · Envoyer au client · Valider** · `/projects/${projectId}/escrow/activate` · composant `ProjectEscrowTab`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Appel de fonds (non réglé) |  | liste de choix |  |
| 2 | Jalon déclencheur |  | liste de choix |  |
| 3 | Procès-verbal publié (type PV) | **Oui** | liste de choix |  |
| 4 | Référence de l'ordre de libération |  | texte |  |
| 5 | Décision |  | liste : Reprendre le circuit de libération · Restituer les fonds au client |  |

### formulaire

validation : **Panneau A3 (PDF) · QR code · Dépublier / Publier · Enregistrer · Publier la sélection ( ) · Marquer traité** · `/projects/${projectId}/panel` · composant `ProjectPanelTab`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | label | **Oui** | texte |  |
| 2 | Nature des travaux |  | texte long |  |
| 3 | Profils recherchés |  | texte |  |

### Planning ajusté / Écarter le risque

validation : **Analyser maintenant · Replanifier · Écarter · Ne pas prévenir · Prévenir le client** · `/projects/${projectId}/schedule-risks/scan` · composant `ScheduleRisksPanel`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Message au client (à relire) |  | texte long |  |
| 2 | Motif | **Oui** | texte long | Ex. « bâches installées », « équipier remplacé », « livraison avancée » |

### formulaire

validation : **Rattacher les livrables sans facture** · `/projects/${projectId}/deliverables/link-invoice` · composant `ProjectStudiesTab`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Facture d'études |  | liste : Choisir une facture du projet |  |

## Projets › Chantiers (`/erp/chantiers`)

### Chantiers — Création

Bouton **Nouveau projet** · fenêtre « Nouveau projet » · validation : **Créer** · `POST /projects` · composant `page:/erp/chantiers`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (250 car. max, 2 car. min) |  |
| 2 | Description |  | texte long |  |
| 3 | Client (organisation) |  | liste des organisations clientes |  |
| 4 | Univers |  | liste : Globus Home · Globus Business · Globus Premium · Globus Diaspora · Engineering Services |  |
| 5 | Offre |  | liste des offres du site |  |
| 6 | Type de projet |  | liste : Construction neuve · Rénovation · Extension · Réhabilitation · Aménagement · Études |  |
| 7 | Statut |  | liste : Prospect · Étude · Conception · Permis · Préparation · Exécution · Réception · Garantie · Clos · Suspendu · Annulé |  |
| 8 | Adresse |  | texte long |  |
| 9 | Ville |  | texte |  |
| 10 | Pays |  | texte |  |
| 11 | Latitude |  | nombre |  |
| 12 | Longitude |  | nombre |  |
| 13 | Surface (m²) |  | nombre |  |
| 14 | Niveaux |  | nombre entier |  |
| 15 | Début prévu |  | date |  |
| 16 | Fin prévue |  | date |  |
| 17 | Début réel |  | date |  |
| 18 | Fin réelle |  | date |  |
| 19 | Date de réception |  | date |  |
| 20 | Montant du contrat |  | nombre |  |
| 21 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 22 | Responsable |  | liste des utilisateurs |  |
| 23 | Directeur de projet |  | liste des utilisateurs |  |
| 24 | Commercial |  | liste des utilisateurs |  |
| 25 | Visible par le client |  | case à cocher |  |
| 26 | Diaspora |  | case à cocher |  |
| 27 | Étiquettes |  | mots-clés (taper puis Entrée) |  |

## Projets › Configurateur 3D (`/erp/configurateur`)

### Matériaux — Création

Bouton **Nouveau matériau** · fenêtre « Nouveau matériau » · validation : **Créer** · `POST /configurator/materials` · composant `MaterialsCatalogue`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Catégorie | **Oui** | liste de choix |  |
| 2 | Nom | **Oui** | texte (200 car. max) |  |
| 3 | Description |  | texte long |  |
| 4 | Fournisseur |  | liste des fournisseurs |  |
| 5 | Produit fournisseur |  | liste des produits fournisseurs |  |
| 6 | Référence fournisseur |  | texte (80 car. max) |  |
| 7 | Unité |  | texte (20 car. max) |  |
| 8 | Prix unitaire |  | nombre |  |
| 9 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 10 | Disponibilité |  | liste : En stock · Sur commande · Indisponible |  |
| 11 | Délai de livraison (jours) |  | nombre entier |  |
| 12 | Couleur (hex) |  | texte (9 car. max) |  |
| 13 | Rugosité |  | nombre |  |
| 14 | Métallicité |  | nombre |  |
| 15 | Répétition de texture |  | nombre |  |
| 16 | Objets 3D ciblés |  | réglage structuré | Étiquettes de maillages compatibles (sol, mur, façade…). |
| 17 | Valable à partir du |  | date |  |
| 18 | Valable jusqu'au |  | date |  |
| 19 | Gamme |  | liste : Standard · Confort · Premium |  |
| 20 | Actif |  | case à cocher |  |

### Matériaux — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /configurator/materials/{item_id}` · composant `MaterialsCatalogue`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Catégorie |  | liste de choix |  |
| 2 | Nom |  | texte (200 car. max) |  |
| 3 | Description |  | texte long |  |
| 4 | Fournisseur |  | liste des fournisseurs |  |
| 5 | Produit fournisseur |  | liste des produits fournisseurs |  |
| 6 | Référence fournisseur |  | texte (80 car. max) |  |
| 7 | Unité |  | texte (20 car. max) |  |
| 8 | Prix unitaire |  | nombre |  |
| 9 | Devise |  | liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD) |  |
| 10 | Disponibilité |  | liste : En stock · Sur commande · Indisponible |  |
| 11 | Délai de livraison (jours) |  | nombre entier |  |
| 12 | Couleur (hex) |  | texte (9 car. max) |  |
| 13 | Rugosité |  | nombre |  |
| 14 | Métallicité |  | nombre |  |
| 15 | Répétition de texture |  | nombre |  |
| 16 | Objets 3D ciblés |  | réglage structuré | Étiquettes de maillages compatibles (sol, mur, façade…). |
| 17 | Valable à partir du |  | date |  |
| 18 | Valable jusqu'au |  | date |  |
| 19 | Gamme |  | liste : Standard · Confort · Premium |  |
| 20 | Actif |  | case à cocher |  |

### Catégories — Création

Bouton **Nouvelle catégorie** · fenêtre « Nouvelle catégorie » · validation : **Créer** · `POST /configurator/material-categories` · composant `MaterialsCatalogue`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Clé | **Oui** | texte (40 car. max) |  |
| 2 | Nom | **Oui** | texte (120 car. max) |  |
| 3 | Ordre |  | nombre entier |  |

### Catégories — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /configurator/material-categories/{item_id}` · composant `MaterialsCatalogue`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Clé |  | texte (40 car. max) |  |
| 2 | Nom |  | texte (120 car. max) |  |
| 3 | Ordre |  | nombre entier |  |

### formulaire

validation : **Retirer la zone · Zone · Annuler · Créer la maquette configurable** · `/configurator/models` · composant `ModelCreate`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte |  |
| 2 | Source 3D |  | liste : Fichier GLB / glTF (déposé ensuite) · Version de maquette BIM · Sans maquette 3D (choix sur catalogue) |  |
| 3 | Version BIM | **Oui** | liste : Choisir… |  |
| 4 | Date limite des choix client |  | date |  |
| 5 | Clé |  | texte |  |
| 6 | Libellé | **Oui** | texte |  |
| 7 | Pièce |  | texte |  |
| 8 | Catégorie | **Oui** | liste : Choisir… |  |
| 9 | Quantité | **Oui** | nombre |  |
| 10 | Unité |  | texte |  |
| 11 | Matériau de base (inclus au contrat) | **Oui** | liste : Choisir… |  |
| 12 | Options proposées au client |  | saisie dédiée (Checkbox) |  |
| 13 | Maillages 3D ciblés |  | mots-clés (taper puis Entrée) | Noms des objets du GLB (sinon zone sans rendu). |
| 14 | Tâche de planning liée |  | liste des tâches du projet | Le délai matériau est comparé à cette tâche. |

### Aperçu — …

validation : **Aperçu · Envoyer · Retirer de l'espace client / Publier dans l'espace client** · `/configurator/models/${model.id}/publish` · composant `ModelCard`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Date limite des choix |  | date |  |

## Projets › GED (`/erp/ged/documents/[id]`)

### Propriétés du document

validation : **Enregistrer** · `PATCH /documents/{document_id}` · composant `DocumentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre |  | texte (300 car. max) |  |
| 2 | Description |  | texte long |  |
| 3 | Type de document |  | liste : Plan · Contrat · Avenant · Facture · Demande de devis · Procès-verbal · Rapport · Note de calcul · CCTP · Photo · Documents fonciers · Administratif · Technique · QHSE · Ressources humaines · Autre |  |
| 4 | Discipline |  | liste : Architecture · Structure · Électricité · Plomberie · CVC / climatisation · Voirie et réseaux divers (VRD) · Topographie · Géotechnique · Sécurité · Autre |  |
| 5 | Dossier |  | liste des dossiers GED |  |
| 6 | Confidentialité |  | liste : Public · Interne · Confidentiel · Très sensible |  |
| 7 | Visible par le client |  | case à cocher | Publie la version en vigueur dans l'espace client (notification envoyée). |
| 8 | Visible par les partenaires |  | case à cocher |  |
| 9 | Étiquettes |  | mots-clés (taper puis Entrée) |  |
| 10 | Conservation jusqu'au |  | date | Date jusqu'à laquelle le document doit être conservé (archivage légal). |
| 11 | Livrable d'études payant |  | case à cocher | Le client le consulte en aperçu filigrané et le valide ; l'original lui est remis après règlement de la facture d'études. |
| 12 | Facture d'études qui débloque le livrable |  | liste des factures clients (affiché seulement si : condition) |  |

### Droit spécifique

validation : **Enregistrer** · `POST /documents/{document_id}/permissions` · composant `DocumentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type de bénéficiaire | **Oui** | liste : Utilisateur · Rôle · Organisation |  |
| 2 | Bénéficiaire | **Oui** | texte (120 car. max) | Identifiant de l'utilisateur ou de l'organisation, ou code du rôle (ex. CHEF_CHANTIER). |
| 3 | Permission | **Oui** | liste : Lecture · Écriture · Approbation · Signature · Refus |  |

### Rattacher le document

validation : **Enregistrer** · `POST /documents/{document_id}/links` · composant `DocumentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type d'entité | **Oui** | liste : project · Tâche · lot · Bon de commande · Contrat de sous-traitance · Situation · Incident · Issue BIM · Avenant · Jalon |  |
| 2 | Version |  | liste de choix | Facultatif : référence une version précise. |

### Propriétés du document / Nouvelle version / Version … : faire évoluer / Supprimer le document / Droit spécifique / Rattacher le document / Comparer deux versions

validation : **Propriétés · Nouvelle version · Comparer · Faire évoluer · Signer · Rattacher · Ajouter · Retirer · Déposer · Confirmer · Ajouter une étape** · `/documents/${id}/versions` · composant `DocumentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Motif de la révision | **Oui** | texte long |  |
| 2 | Révision majeure (indice suivant) |  | case à cocher |  |
| 3 | Qualité du signataire |  | texte |  |
| 4 | J'accepte de signer électroniquement ce document ; ma signature a la même valeur qu'une signature manuscrite. |  | case à cocher |  |

## Projets › GED (`/erp/ged`)

### formulaire

validation : **Annuler · Déposer** · `/documents` · composant `DocumentUpload`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre | **Oui** | texte |  |
| 2 | Type | **Oui** | liste : Plan · Contrat · Avenant · Facture · Demande de devis · Procès-verbal · Rapport · Note de calcul · CCTP · Photo · Documents fonciers · Administratif · Technique · QHSE · Ressources humaines · Autre |  |
| 3 | Discipline |  | liste : — |  |
| 4 | Confidentialité | **Oui** | liste : Public · Interne · Confidentiel · Très sensible |  |
| 5 | Code (sinon attribué automatiquement) |  | texte |  |
| 6 | Projet |  | liste des projets |  |
| 7 | Dossier |  | liste des dossiers GED |  |
| 8 | Site |  | liste des sites du projet |  |
| 9 | Lot |  | liste des lots du projet |  |
| 10 | Description |  | texte long |  |
| 11 | Mots-clés |  | mots-clés (taper puis Entrée) |  |

### Déposer un document / Nouveau dossier

validation : **Déposer un document · Sous-dossier de « … » / Nouveau dossier · Créer** · `/document-folders` · composant `GedExplorer`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom du dossier |  | texte |  |
| 2 | Confidentialité par défaut |  | liste : Public · Interne · Confidentiel · Très sensible | Niveau proposé pour les documents déposés dans ce dossier (modifiable à chaque dépôt). |

## Projets › Hub BIM (`/erp/hub/issues/[id]`)

### Modifier l'issue

validation : **Enregistrer** · `PATCH /bim/issues/{issue_id}` · composant `IssueDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre |  | texte (250 car. max, 3 car. min) |  |
| 2 | Description |  | texte long (8000 car. max) |  |
| 3 | Priorité |  | liste : Faible · Moyenne · Élevée · Critique |  |
| 4 | Responsable |  | liste des utilisateurs |  |
| 5 | Date d'échéance |  | date |  |
| 6 | Discipline |  | liste des disciplines (Hub BIM) |  |

### Modifier l'issue / Faire évoluer l'issue / Réunion de coordination

validation : **Modifier · Faire évoluer · Réunion · Envoyer · Confirmer · Lancer l'appel** · `/bim/files` · composant `IssueDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Corrigée dans la version |  | liste : — |  |
| 2 | Participant supplémentaire |  | liste des utilisateurs |  |

## Projets › Hub BIM (`/erp/hub`)

### Maquettes — Création

Bouton **Nouvelle maquette** · fenêtre « Nouvelle maquette » · validation : **Créer** · `POST /projects/{project_id}/bim/models` · composant `ModelsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (250 car. max, 2 car. min) |  |
| 2 | Discipline | **Oui** | liste de choix |  |
| 3 | Description |  | texte long (4000 car. max) |  |

### Conflits — Action avec confirmation

Bouton **Action (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · composant `ClashesView`

_Aucun champ à saisir (confirmation simple)._

### Conflits — Action

Bouton **Créer une issue (dans la fiche)** · fenêtre « Créer une issue » · validation : **Créer une issue** · `POST /bim/clashes/{clash_id}/issue` · composant `ClashesView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Responsable |  | liste des utilisateurs |  |
| 2 | Date d'échéance |  | date |  |

### Règles de détection — Création

Bouton **Nouvelle règle** · fenêtre « Nouvelle règle » · validation : **Créer** · `POST /bim/clash-rules` · composant `ClashesView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (200 car. max) |  |
| 2 | Discipline A | **Oui** | liste des disciplines (Hub BIM) |  |
| 3 | Discipline B | **Oui** | liste des disciplines (Hub BIM) |  |
| 4 | Type de conflit |  | liste : Conflit dur · Conflit souple · Dégagement · Doublon |  |
| 5 | Tolérance (mm) |  | nombre |  |
| 6 | Gravité |  | liste : Faible · Moyenne · Élevée · Critique |  |
| 7 | Coût par conflit |  | nombre |  |
| 8 | Actif |  | case à cocher |  |

### Règles de détection — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /bim/clash-rules/{item_id}` · composant `ClashesView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Nom |  | texte (200 car. max) |  |
| 3 | Discipline A |  | liste des disciplines (Hub BIM) |  |
| 4 | Discipline B |  | liste des disciplines (Hub BIM) |  |
| 5 | Type de conflit |  | liste : Conflit dur · Conflit souple · Dégagement · Doublon |  |
| 6 | Tolérance (mm) |  | nombre |  |
| 7 | Gravité |  | liste : Faible · Moyenne · Élevée · Critique |  |
| 8 | Coût par conflit |  | nombre |  |
| 9 | Actif |  | case à cocher |  |

### Zones spatiales — Création

Bouton **Nouvelle zone** · fenêtre « Nouvelle zone » · validation : **Créer** · `POST /projects/{project_id}/bim/zones` · composant `ZonesView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Chantier |  | liste des sites du projet |  |
| 2 | Code | **Oui** | texte (40 car. max) |  |
| 3 | Nom | **Oui** | texte (200 car. max, 2 car. min) |  |
| 4 | Niveau |  | texte (40 car. max) |  |
| 5 | Type de zone |  | liste : Pièce · Zone · Niveau · Extérieur |  |
| 6 | Discipline |  | liste des disciplines (Hub BIM) |  |
| 7 | Contrôles de réception |  | liste de libellés |  |
| 8 | Surface (m²) |  | nombre (≥ 0) |  |
| 9 | Libellé client |  | texte (120 car. max) |  |

### Zones spatiales — Action avec confirmation

Bouton **QR de la zone (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · composant `ZonesView`

_Aucun champ à saisir (confirmation simple)._

### formulaire

validation : **Annuler · Créer l'issue** · `/projects/${projectId}/bim/issues` · composant `IssueCreate`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre | **Oui** | texte |  |
| 2 | Nature |  | liste : Conflit · Conception · Question · Observation · Défaut |  |
| 3 | Priorité |  | liste : Faible · Moyenne · Élevée · Critique |  |
| 4 | Discipline |  | liste : — |  |
| 5 | Assignée à |  | liste des utilisateurs |  |
| 6 | Échéance |  | date |  |
| 7 | Zone |  | liste des zones de la maquette |  |
| 8 | Description |  | texte long |  |
| 9 | Joindre une capture de la vue actuelle |  | case à cocher |  |

### Nouvelle issue BIM

`/bim/versions/${versionId}/viewpoints` · composant `CoordinationView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Vue présentée au client (espace client) |  | case à cocher |  |

### formulaire

validation : **Lancer la détection** · `/projects/${projectId}/bim/clash-detection` · composant `ClashDetection`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Règle |  | liste : Choisir… |  |
| 2 | Maquette A |  | liste : Choisir… |  |
| 3 | Maquette B |  | liste : Choisir… |  |

### formulaire

validation : **Modifier · Nouvelle discipline · Enregistrer** · `/projects/${projectId}/bim/disciplines` · composant `DisciplinesView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte |  |
| 2 | Couleur |  | texte |  |
| 3 | Ordre |  | nombre |  |
| 4 | Visible par défaut |  | case à cocher |  |

## Projets › Planning (`/erp/planning`)

### Calendriers de travail — Création

Bouton **Nouveau calendrier** · fenêtre « Nouveau calendrier » · validation : **Créer** · `POST /work-calendars` · composant `PlanningInner`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Nom |  | texte (120 car. max) |  |
| 3 | Jours travaillés |  | jours de la semaine |  |
| 4 | Jours fériés et fermetures |  | liste de dates |  |
| 5 | Heures par jour |  | nombre |  |

### Calendriers de travail — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /work-calendars/{item_id}` · composant `PlanningInner`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Nom |  | texte (120 car. max) |  |
| 3 | Jours travaillés |  | jours de la semaine |  |
| 4 | Jours fériés et fermetures |  | liste de dates |  |
| 5 | Heures par jour |  | nombre |  |

### Tâches — Création

Bouton **Nouvelle tâche** · fenêtre « Nouvelle tâche » · validation : **Créer** · `POST /projects/{project_id}/tasks` · composant `ProjectPlanning`

Aussi dans : Projets › Chantiers (`/erp/chantiers/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre | **Oui** | texte (250 car. max, 2 car. min) |  |
| 2 | Description |  | texte long |  |
| 3 | Phase |  | liste des phases du projet |  |
| 4 | Lot |  | liste des lots du projet |  |
| 5 | Chantier |  | liste des sites du projet |  |
| 6 | Zone |  | liste des zones de la maquette |  |
| 7 | Parent |  | liste des tâches du projet |  |
| 8 | Code WBS |  | texte |  |
| 9 | Statut |  | liste : À faire · En cours · Bloqué · Terminé · Annulé |  |
| 10 | Priorité |  | liste : Faible · Normale · Élevée · Critique |  |
| 11 | Début prévu |  | date |  |
| 12 | Fin prévue |  | date |  |
| 13 | Durée (jours) |  | nombre entier (≥ 1, ≤ 2000) |  |
| 14 | Jalon |  | case à cocher |  |
| 15 | Jalon |  | liste des jalons du projet |  |
| 16 | Heures estimées |  | nombre |  |
| 17 | Coût prévu |  | nombre |  |
| 18 | Points à vérifier |  | liste de libellés |  |
| 19 | Type de contrainte |  | liste : Dès que possible · Pas avant le · Au plus tard le |  |
| 20 | Date de contrainte |  | date |  |
| 21 | Ordre |  | nombre entier |  |
| 22 | Visible par le client |  | case à cocher |  |
| 23 | Commerciaux affectés |  | sélection multiple : liste des utilisateurs |  |

### Tâches — Action

Bouton **Avancement (dans la fiche)** · fenêtre « Avancement » · validation : **Avancement** · `POST /tasks/{task_id}/progress` · composant `ProjectPlanning`

Aussi dans : Projets › Chantiers (`/erp/chantiers/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Avancement (%) | **Oui** | nombre (≥ 0, ≤ 100) |  |
| 2 | Note |  | texte long (4000 car. max) |  |

### Ajouter une dépendance

validation : **Enregistrer** · `POST /projects/{project_id}/dependencies` · composant `ProjectPlanning`

Aussi dans : Projets › Chantiers (`/erp/chantiers/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Tâche prédécesseur | **Oui** | liste |  |
| 2 | Tâche successeur | **Oui** | liste |  |
| 3 | Type |  | liste : Fin → Début · Début → Début · Fin → Fin · Début → Fin |  |
| 4 | Décalage (jours) |  | nombre entier (≥ -365, ≤ 365) |  |

### Figer une référence de planning

validation : **Enregistrer** · `POST /projects/{project_id}/baselines` · composant `ProjectPlanning`

Aussi dans : Projets › Chantiers (`/erp/chantiers/[id]`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (150 car. max, 2 car. min) |  |
| 2 | Motif |  | texte long (2000 car. max) |  |

## RH et QHSE › QHSE (`/erp/qhse/actions/[id]`)

### Déclarer l'action réalisée / Vérification de l'efficacité / Annuler l'action

validation : **Démarrer · Déclarer réalisée · Vérifier · Annuler · Enregistrer · Valider la vérification** · `/qhse/actions/${id}/start` · composant `ActionDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Compte rendu | **Oui** | texte long |  |
| 2 | Preuves (photos, PV) | **Oui** | fichier(s) à déposer |  |

## RH et QHSE › QHSE (`/erp/qhse/incidents/[id]`)

### Analyse des causes

validation : **Enregistrer** · `POST /qhse/incidents/{incident_id}/investigation` · composant `IncidentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Cause racine | **Oui** | texte long (8000 car. max, 5 car. min) | Méthode des 5 pourquoi, arbre des causes… |
| 2 | Mesures immédiates |  | texte long (4000 car. max) |  |
| 3 | Jours d'arrêt |  | nombre entier (≥ 0, ≤ 3650) |  |

### Nouvelle action corrective

validation : **Enregistrer** · `POST /qhse/actions` · composant `IncidentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre | **Oui** | texte (250 car. max, 3 car. min) |  |
| 2 | Description |  | texte long (8000 car. max) |  |
| 3 | Responsable | **Oui** | liste des utilisateurs |  |
| 4 | Date d'échéance | **Oui** | date |  |

### Informer le client

validation : **Enregistrer** · `POST /qhse/incidents/{incident_id}/publish-client` · composant `IncidentDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Résumé pour le client | **Oui** | texte long (2000 car. max, 10 car. min) | Message factuel visible dans l'espace client (sans données personnelles). |

## RH et QHSE › QHSE (`/erp/qhse`)

### Inspections — Création

Bouton **Nouvelle inspection** · fenêtre « Nouvelle inspection » · validation : **Créer** · `POST /qhse/inspections` · composant `InspectionsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Grille |  | liste des grilles d'inspection |  |
| 2 | Projet | **Oui** | liste des projets |  |
| 3 | Chantier |  | liste des sites du projet |  |
| 4 | Zone |  | liste des zones de la maquette |  |
| 5 | Catégorie |  | liste : Sécurité · Qualité · Environnement |  |
| 6 | Date d'inspection |  | date |  |

### Grilles d'inspection — Création

Bouton **Nouvelle grille** · fenêtre « Nouvelle grille » · validation : **Créer** · `POST /qhse/inspection-templates` · composant `InspectionTemplatesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (200 car. max) |  |
| 2 | Catégorie |  | liste : Sécurité · Qualité · Environnement |  |
| 3 | Liste de contrôle |  | saisie dédiée (ChecklistEditor) |  |
| 4 | Actif |  | case à cocher |  |

### Grilles d'inspection — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /qhse/inspection-templates/{item_id}` · composant `InspectionTemplatesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (200 car. max) |  |
| 2 | Catégorie |  | liste : Sécurité · Qualité · Environnement |  |
| 3 | Liste de contrôle |  | saisie dédiée (ChecklistEditor) |  |
| 4 | Actif |  | case à cocher |  |

### Actions correctives — Création

Bouton **Nouvelle action** · fenêtre « Nouvelle action » · validation : **Créer** · `POST /qhse/actions` · composant `ActionsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Type de source |  | liste : Incident · Inspection · Audit · Autre |  |
| 3 | Titre | **Oui** | texte (250 car. max, 3 car. min) |  |
| 4 | Description |  | texte long (8000 car. max) |  |
| 5 | Responsable | **Oui** | liste des utilisateurs |  |
| 6 | Date d'échéance | **Oui** | date |  |

### Distributions d'EPI — Création

Bouton **Remettre un EPI** · fenêtre « Remettre un EPI » · validation : **Créer** · `POST /qhse/ppe-distributions` · composant `PpeView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | EPI | **Oui** | liste des EPI |  |
| 2 | Employé |  | liste des employés |  |
| 3 | Nom du travailleur |  | texte (200 car. max) |  |
| 4 | Projet |  | liste des projets |  |
| 5 | Quantité |  | nombre entier (≥ 1, ≤ 1000) |  |
| 6 | Remis le |  | date |  |
| 7 | Dépôt |  | liste des entrepôts |  |

### Distributions d'EPI — Action avec confirmation

Bouton **Retour (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/qhse/ppe-distributions/${r.id}/return`` · composant `PpeView`

_Aucun champ à saisir (confirmation simple)._

### Catalogue EPI — Création

Bouton **Nouvel EPI** · fenêtre « Nouvel EPI » · validation : **Créer** · `POST /qhse/ppe-items` · composant `PpeView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (150 car. max) |  |
| 2 | Type | **Oui** | liste : Casque · Chaussures de sécurité · Gilet haute visibilité · Gants · Harnais antichute · Lunettes de protection · Masque · Bouchons d'oreilles |  |
| 3 | Taille |  | texte (20 car. max) |  |
| 4 | Article de stock |  | liste des articles de stock |  |
| 5 | Durée de vie (jours) |  | nombre entier |  |
| 6 | Norme |  | texte (80 car. max) |  |
| 7 | Actif |  | case à cocher |  |

### Catalogue EPI — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /qhse/ppe-items/{item_id}` · composant `PpeView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (150 car. max) |  |
| 2 | Type |  | liste : Casque · Chaussures de sécurité · Gilet haute visibilité · Gants · Harnais antichute · Lunettes de protection · Masque · Bouchons d'oreilles |  |
| 3 | Taille |  | texte (20 car. max) |  |
| 4 | Article de stock |  | liste des articles de stock |  |
| 5 | Durée de vie (jours) |  | nombre entier |  |
| 6 | Norme |  | texte (80 car. max) |  |
| 7 | Actif |  | case à cocher |  |

### formulaire

validation : **Annuler · Déclarer l'incident** · `/qhse/incidents` · composant `IncidentDeclare`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet | **Oui** | liste des projets |  |
| 2 | Site |  | liste des sites du projet |  |
| 3 | Zone de la maquette |  | liste des zones de la maquette | Pièce ou zone de la maquette BIM concernée (facultatif). |
| 4 | Nature | **Oui** | liste : Accident · Presque-accident · Sécurité · Qualité · Environnement · Matériel |  |
| 5 | Gravité | **Oui** | liste : Faible · Moyenne · Élevée · Critique |  |
| 6 | Survenu le | **Oui** | date et heure |  |
| 7 | Lieu précis |  | texte |  |
| 8 | Titre | **Oui** | texte |  |
| 9 | Description des faits |  | texte long |  |
| 10 | Blessures |  | texte long |  |
| 11 | Jours d'arrêt |  | nombre |  |
| 12 | Mesures immédiates |  | texte long |  |
| 13 | Photos |  | fichier(s) à déposer |  |

### formulaire

validation : **Terminer l'inspection** · `/qhse/inspections/${inspection.id}/complete` · composant `InspectionRunner`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Constats généraux |  | texte long |  |

### formulaire

validation : **Annuler · Enregistrer** · `/qhse/safety-talks` · composant `SafetyTalkForm`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet | **Oui** | liste des projets |  |
| 2 | Site |  | liste des sites du projet |  |
| 3 | Date |  | date |  |
| 4 | Durée (min) |  | nombre |  |
| 5 | Thème | **Oui** | texte |  |
| 6 | Contenu |  | texte long |  |
| 7 | Participants (salariés) |  | sélection multiple dans une liste |  |
| 8 | Autres participants (un par ligne : intérimaires, sous-traitants) |  | texte long |  |
| 9 | Photos (feuille d'émargement, séance) |  | fichier(s) à déposer |  |

## RH et QHSE › Ressources humaines (`/erp/rh/employes/[id]`)

### Modifier le dossier

validation : **Enregistrer** · `PATCH /hr/employees/{employee_id}` · composant `EmployeeDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Prénom |  | texte (120 car. max) |  |
| 2 | Nom |  | texte (120 car. max) |  |
| 3 | Téléphone |  | texte (40 car. max) |  |
| 4 | E-mail |  | adresse e-mail |  |
| 5 | Adresse |  | texte long (1000 car. max) |  |
| 6 | Fonction |  | texte (150 car. max, 2 car. min) |  |
| 7 | Métier |  | liste des métiers |  |
| 8 | Service |  | texte (80 car. max) |  |
| 9 | Équipe |  | liste des équipes |  |
| 10 | Type de contrat |  | liste : CDI · CDD · Journalier · Stage · Intérim |  |
| 11 | Date de fin |  | date |  |
| 12 | Salaire de base |  | nombre (≥ 0) |  |
| 13 | Taux horaire |  | nombre (≥ 0) |  |
| 14 | Taux journalier |  | nombre (≥ 0) |  |
| 15 | Fréquence de paie |  | liste : Mensuelle · Hebdomadaire · Journalière |  |
| 16 | N° CNI |  | texte (60 car. max) | Laisser vide pour ne pas modifier. |
| 17 | N° CNPS |  | texte (60 car. max) | Laisser vide pour ne pas modifier. |
| 18 | Compte bancaire (IBAN/RIB) |  | texte (80 car. max) | Laisser vide pour ne pas modifier. |
| 19 | Numéro Mobile Money |  | texte (40 car. max) |  |
| 20 | Contact d'urgence |  | texte (250 car. max) |  |
| 21 | Projet actuel |  | liste des projets |  |
| 22 | Statut |  | liste : Actif · Suspendu |  |
| 23 | Utilisateur |  | liste des utilisateurs |  |
| 24 | Motif |  | texte long (2000 car. max) | Obligatoire pour toute modification de rémunération (tracée). |

### Fin de contrat

validation : **Enregistrer** · `POST /hr/employees/{employee_id}/terminate` · composant `EmployeeDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Date de fin | **Oui** | date |  |
| 2 | Motif | **Oui** | texte long (2000 car. max, 5 car. min) |  |

### Ajouter un document

validation : **Enregistrer** · `POST /hr/employees/{employee_id}/documents` · composant `EmployeeDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type | **Oui** | liste : Contrat · Carte nationale d'identité · Diplôme · Certificat médical · Avertissement · Attestation · Bulletin de paie |  |
| 2 | Titre | **Oui** | texte (250 car. max, 2 car. min) |  |
| 3 | Date d'expiration |  | date |  |
| 4 | Confidentialité |  | liste : Interne · Confidentiel · Très sensible |  |
| 5 | Fichier | **Oui** | fichier à déposer |  |

## RH et QHSE › Ressources humaines (`/erp/rh/paie/[id]`)

### Ajustement — …

validation : **Enregistrer** · `PATCH /hr/payroll-runs/{run_id}/items/{item_id}` · composant `PayrollRunDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Primes |  | nombre (≥ 0) |  |
| 2 | Indemnités |  | nombre (≥ 0) |  |
| 3 | Avances sur salaire |  | nombre (≥ 0) |  |
| 4 | Motif | **Oui** | texte long (1000 car. max, 5 car. min) | Motif obligatoire (tracé). |

### Ajustement — … / Valider la paie / Paiement des salaires

validation : **Export CSV · Recalculer · Valider (finance) · Marquer payée · Ajuster · Confirmer** · `/hr/payroll-runs/${id}/compute` · composant `PayrollRunDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Mode de paiement |  | liste : Virement bancaire · Mobile Money · Espèces · Chèque |  |
| 2 | Référence |  | texte |  |
| 3 | Preuve (ordre de virement, état signé) | **Oui** | fichier(s) à déposer |  |

## RH et QHSE › Ressources humaines (`/erp/rh`)

### Personnel — Création

Bouton **Nouvel employé** · fenêtre « Nouvel employé » · validation : **Créer** · `POST /hr/employees` · composant `EmployeesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Matricule |  | texte (30 car. max) |  |
| 2 | Compte utilisateur (auto-pointage, espace salarié) |  | liste des utilisateurs |  |
| 3 | Prénom | **Oui** | texte (120 car. max) |  |
| 4 | Nom | **Oui** | texte (120 car. max) |  |
| 5 | Genre |  | liste : Homme · Femme · Non précisé |  |
| 6 | Date de naissance |  | date |  |
| 7 | Téléphone |  | texte (40 car. max) |  |
| 8 | E-mail |  | adresse e-mail |  |
| 9 | Adresse |  | texte long (1000 car. max) |  |
| 10 | Fonction | **Oui** | texte (150 car. max, 2 car. min) |  |
| 11 | Métier |  | liste des métiers |  |
| 12 | Service |  | texte (80 car. max) |  |
| 13 | Équipe |  | liste des équipes |  |
| 14 | Type de contrat |  | liste : CDI · CDD · Journalier · Stage · Intérim |  |
| 15 | Date d'embauche | **Oui** | date |  |
| 16 | Date de fin |  | date |  |
| 17 | Salaire de base |  | nombre (≥ 0) |  |
| 18 | Taux horaire |  | nombre (≥ 0) |  |
| 19 | Taux journalier |  | nombre (≥ 0) |  |
| 20 | Fréquence de paie |  | liste : Mensuelle · Hebdomadaire · Journalière |  |
| 21 | N° CNI |  | texte (60 car. max) | Chiffré au repos, masqué à l'affichage. |
| 22 | N° CNPS |  | texte (60 car. max) | Chiffré au repos, masqué à l'affichage. |
| 23 | Compte bancaire (IBAN/RIB) |  | texte (80 car. max) | Chiffré au repos, masqué à l'affichage. |
| 24 | Numéro Mobile Money |  | texte (40 car. max) |  |
| 25 | Contact d'urgence |  | texte (250 car. max) |  |
| 26 | Projet actuel |  | liste des projets |  |

### Personnel — Action avec confirmation

Bouton **Ouvrir le dossier (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · composant `EmployeesList`

_Aucun champ à saisir (confirmation simple)._

### Pointages — Action avec confirmation

Bouton **Valider (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/hr/attendance/${r.id}/validate`` · composant `AttendanceView`

_Aucun champ à saisir (confirmation simple)._

### Congés et absences — Création

Bouton **Nouvelle absence** · fenêtre « Nouvelle absence » · validation : **Créer** · `POST /hr/leaves` · composant `LeavesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Employé |  | liste des employés |  |
| 2 | Type |  | liste : Congés payés · Maladie · Sans solde · Autre |  |
| 3 | Date de début | **Oui** | date |  |
| 4 | Date de fin | **Oui** | date |  |
| 5 | Motif |  | texte long (2000 car. max) |  |

### Congés et absences — Action avec confirmation

Bouton **Accorder (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/hr/leaves/${r.id}/decision`` · composant `LeavesList`

_Aucun champ à saisir (confirmation simple)._

### Congés et absences — Action avec confirmation

Bouton **Refuser (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · `(r) => `/hr/leaves/${r.id}/decision`` · composant `LeavesList`

_Aucun champ à saisir (confirmation simple)._

### Paie — Création

Bouton **Nouvelle paie** · fenêtre « Nouvelle paie » · validation : **Créer** · `POST /hr/payroll-runs` · composant `PayrollRunsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Période | **Oui** | texte | Format AAAA-MM |

### Paie — Action avec confirmation

Bouton **Ouvrir (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · composant `PayrollRunsList`

_Aucun champ à saisir (confirmation simple)._

### Horaires de travail — Création

Bouton **Nouvel horaire** · fenêtre « Nouvel horaire » · validation : **Créer** · `POST /hr/work-schedules` · composant `WorkSchedulesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom | **Oui** | texte (120 car. max) |  |
| 2 | Heure de début | **Oui** | heure |  |
| 3 | Heure de fin | **Oui** | heure |  |
| 4 | Pause (minutes) |  | nombre entier |  |
| 5 | Jours travaillés |  | jours de la semaine |  |
| 6 | Seuil d'heures supplémentaires |  | nombre |  |
| 7 | Par défaut |  | case à cocher |  |

### Horaires de travail — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /hr/work-schedules/{item_id}` · composant `WorkSchedulesList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom |  | texte (120 car. max) |  |
| 2 | Heure de début |  | heure |  |
| 3 | Heure de fin |  | heure |  |
| 4 | Pause (minutes) |  | nombre entier |  |
| 5 | Jours travaillés |  | jours de la semaine |  |
| 6 | Seuil d'heures supplémentaires |  | nombre |  |
| 7 | Par défaut |  | case à cocher |  |

### formulaire

`/hr/attendance/scan` · composant `ScanStation`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet |  | liste des projets |  |
| 2 | Site |  | liste des sites du projet |  |
| 3 | Badge |  | texte |  |

### formulaire

validation : **Enregistrer · Annuler les modifications** · `/hr/payroll-parameters` · composant `PayrollParameters`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Paramètres revus et validés par un expert-comptable |  | case à cocher |  |
| 2 | Note du réviseur |  | texte |  |

## Site web › Contenus (CMS) (`/erp/cms/pages/[id]`)

### Aperçu — … / Supprimer la page

validation : **Aperçu · Enregistrer · Ajouter une section · Supprimer la page · Confirmer** · `/cms/pages/${pageId}/transition` · composant `PageEditor`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre | **Oui** | texte |  |
| 2 | Modèle |  | liste : Standard · Page d'atterrissage · Mentions / juridique · Liste |  |
| 3 | Clé de route | **Oui** | texte |  |
| 4 | Chemin public | **Oui** | texte |  |
| 5 | Résumé |  | texte long |  |
| 6 | Publication programmée |  | date et heure |  |
| 7 | Dépublication programmée |  | date et heure |  |
| 8 | Ordre |  | nombre |  |
| 9 | Corps libre (modèle « juridique » : mentions légales, confidentialité…) |  | saisie |  |
| 10 | Mise en ligne le (facultatif) |  | date et heure |  |
| 11 | Retrait le (facultatif) |  | date et heure |  |

## Site web › Contenus (CMS) (`/erp/cms`)

### Formulaires — Action avec confirmation

Bouton **Modifier (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · composant `FormsAdmin`

_Aucun champ à saisir (confirmation simple)._

### Formulaires — Action avec confirmation

Bouton **Envois reçus (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · composant `FormsAdmin`

_Aucun champ à saisir (confirmation simple)._

### Réponses automatiques — Action avec confirmation

Bouton **Modifier (dans la fiche)** · fenêtre « confirmation » · validation : **Confirmer** · composant `FormsAdmin`

_Aucun champ à saisir (confirmation simple)._

### formulaire

validation : **Annuler · Enregistrer / Créer le formulaire** · `/cms/forms/${initial!.id}` · composant `FormDefinitionEditor`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Emplacement sur le site |  | texte | Les blocs « Formulaire » des pages appellent ce formulaire par son emplacement. |
| 2 | Titre affiché | **Oui** | texte |  |
| 3 | Phrase d'introduction (facultatif) |  | texte long |  |
| 4 | Message affiché après l'envoi |  | texte | Laissez vide pour le message standard « Merci, votre demande est bien reçue ». |
| 5 | Accusé de réception envoyé au visiteur |  | liste : Message standard GLOBUS | Modèles gérés plus bas dans « Réponses automatiques ». |

### formulaire

validation : **Annuler · Enregistrer** · `/cms/auto-replies/${initial!.id}` · composant `AutoReplyEditor`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Nom de la réponse | **Oui** | texte | Ex. contact-standard, devis-diaspora |
| 2 | Envoyée par |  | saisie |  |
| 3 | Objet de l'e-mail |  | texte |  |
| 4 | Modèle WhatsApp approuvé par Meta | **Oui** | texte | Nom exact du modèle validé dans votre compte WhatsApp Business (WhatsApp impose des modèles pré-approuvés pour écrire en premier). |
| 5 | email ? "Texte de l'e-mail" : "Texte de référence (aperçu interne)" | **Oui** | saisie |  |

### Médiathèque

validation : **Utiliser · Envoyer · Afficher plus ( )** · `/cms/media` · composant `MediaLibraryModal`

Aussi dans : Site web › Contenus (CMS) (`/erp/cms/pages/[id]`), Site web › Médiathèque (`/erp/media`), Site web › SEO (`/erp/seo`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Dossier |  | texte |  |

### formulaire

validation : **Enregistrer** · `/cms/site-settings` · composant `SiteSettingsEditor`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Raison sociale |  | texte |  |
| 2 | Slogan |  | texte |  |
| 3 | Promesse |  | texte long |  |
| 4 | Logo |  | choix dans la médiathèque |  |
| 5 | Logo (fond sombre) |  | choix dans la médiathèque |  |
| 6 | Image de partage par défaut |  | choix dans la médiathèque |  |
| 7 | Icône de la plateforme |  | choix dans la médiathèque | Icône unique, appliquée partout dès l'enregistrement : onglet du navigateur, application installée, raccourci iPhone, assistant du site, notifications et futures applications mobile et bureau. Image carrée PNG ou WebP, idéalement 512 px ou plus, fond transparent de préférence. Le logo reste réservé aux en-têtes, pieds de page et documents. |
| 8 | E-mail |  | adresse e-mail |  |
| 9 | Téléphone |  | texte |  |
| 10 | WhatsApp |  | texte |  |
| 11 | Adresse |  | texte long |  |
| 12 | Ville |  | texte |  |
| 13 | Pays |  | texte |  |
| 14 | Latitude |  | nombre |  |
| 15 | Longitude |  | nombre |  |
| 16 | Horaires d'ouverture |  | saisie |  |
| 17 | Fiche Google Business (URL) |  | texte |  |
| 18 | label |  | texte |  |
| 19 | Modèle de titre |  | texte | %s est remplacé par le titre de la page. |
| 20 | Vérification Search Console |  | texte |  |
| 21 | Méta-description par défaut |  | texte long |  |
| 22 | label |  | texte | Chargé uniquement après consentement. |
| 23 | Pages à exclure des moteurs de recherche |  | mots-clés (taper puis Entrée) | Adresse de chaque page à ne pas référencer, ex. /offres/ancienne-offre (les espaces privés sont déjà exclus). |
| 24 | Version de la politique de consentement |  | texte | Changer la version redemande le consentement aux visiteurs. |
| 25 | t.label |  | texte long |  |
| 26 | Message de maintenance (vide = site ouvert) |  | texte long |  |

### formulaire

validation : **Publier le menu** · `/cms/navigation/${key}` · composant `NavigationEditor`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre du menu |  | texte |  |

## Site web › Médiathèque (`/erp/media`)

### Archiver le média

validation : **Enregistrer · Annuler · Remplacer · Archiver · Restaurer** · `/cms/media/${id}` · composant `MediaDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre |  | texte |  |
| 2 | Dossier |  | texte |  |
| 3 | Texte alternatif |  | texte |  |
| 4 | Légende |  | texte long |  |
| 5 | Crédits |  | texte |  |
| 6 | Mots-clés |  | mots-clés (taper puis Entrée) |  |
| 7 | Image d'aperçu de la vidéo |  | choix dans la médiathèque | Affichée avant la lecture (et pendant le chargement) sur le site. |

### Média / Envoyer des fichiers / Vidéo YouTube / Vimeo

validation : **Vidéo YouTube / Vimeo · Envoyer des fichiers · Recalculer les usages · Afficher plus ( ) · Envoyer · Ajouter** · `/cms/media-scan` · composant `MediaLibraryPage`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Dossier |  | texte |  |
| 2 | Adresse de la vidéo |  | texte | Lecture en mode « confidentialité renforcée » (youtube-nocookie). |
| 3 | Titre |  | texte |  |
| 4 | Dossier |  | texte |  |

## Site web › SEO (`/erp/seo`)

### Redirections — Création

Bouton **Nouvelle redirection** · fenêtre « Nouvelle redirection » · validation : **Créer** · `POST /cms/redirects` · composant `RedirectsView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Chemin source | **Oui** | texte (500 car. max) |  |
| 2 | Chemin cible |  | texte (500 car. max) |  |
| 3 | Code HTTP |  | liste : 301 — définitive · 302 — temporaire · 410 — supprimé |  |
| 4 | Actif |  | case à cocher |  |
| 5 | Note |  | texte (300 car. max) |  |

### Redirections — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /cms/redirects/{item_id}` · composant `RedirectsView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Chemin source |  | texte (500 car. max) |  |
| 2 | Chemin cible |  | texte (500 car. max) |  |
| 3 | Code HTTP |  | nombre entier |  |
| 4 | Actif |  | case à cocher |  |
| 5 | Note |  | texte (300 car. max) |  |

### Données structurées (schema.org) — Création

Bouton **Ajouter** · fenêtre « Ajouter » · validation : **Créer** · `POST /cms/schema-markups` · composant `StructuredDataView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Page du site | **Oui** | saisie dédiée (PageTargetSelect) |  |
| 2 | Type | **Oui** | liste :  |  |
| 3 | Propriétés |  | saisie dédiée (SchemaPropsEditor) | Informations ajoutées au code de la page pour les moteurs de recherche (schema.org). |
| 4 | Activé |  | case à cocher |  |

### Données structurées (schema.org) — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /cms/schema-markups/{item_id}` · composant `StructuredDataView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Page du site |  | saisie dédiée (PageTargetSelect) |  |
| 2 | Type |  | liste :  |  |
| 3 | Propriétés |  | saisie dédiée (SchemaPropsEditor) | Informations ajoutées au code de la page pour les moteurs de recherche (schema.org). |
| 4 | Activé |  | case à cocher |  |

### Réseaux sociaux — Création

Bouton **Ajouter** · fenêtre « Ajouter » · validation : **Créer** · `POST /cms/social-links` · composant `SocialLinksView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Réseau | **Oui** | liste : Facebook · instagram · LinkedIn · tiktok · youtube · x · WhatsApp |  |
| 2 | URL | **Oui** | texte (500 car. max) |  |
| 3 | Libellé |  | texte (120 car. max) |  |
| 4 | Ordre |  | nombre entier |  |
| 5 | Actif |  | case à cocher |  |

### Réseaux sociaux — Modification

Bouton **Modifier (dans la fiche ouverte depuis la liste)** · fenêtre « fiche de l'élément » · validation : **Enregistrer** · `PATCH /cms/social-links/{item_id}` · composant `SocialLinksView`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Réseau |  | liste : Facebook · instagram · LinkedIn · tiktok · youtube · x · WhatsApp |  |
| 2 | URL |  | texte (500 car. max) |  |
| 3 | Libellé |  | texte (120 car. max) |  |
| 4 | Ordre |  | nombre entier |  |
| 5 | Actif |  | case à cocher |  |

## Sous-traitance › Litiges (`/erp/litiges/[id]`)

### Ajouter à la chronologie

validation : **Enregistrer** · `POST /disputes/{dispute_id}/events` · composant `DisputeDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Type | **Oui** | liste : Commentaire · Preuve · Proposition · Contre-proposition · Accord |  |
| 2 | Contenu |  | texte long (8000 car. max) |  |
| 3 | Montant |  | nombre (≥ 0) |  |

### Décision

validation : **Enregistrer** · `POST /disputes/{dispute_id}/decision` · composant `DisputeDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Montant accepté | **Oui** | nombre (≥ 0) |  |
| 2 | Montant refusé | **Oui** | nombre (≥ 0) | Accepté + refusé = montant contesté (…). |
| 3 | Résumé | **Oui** | texte long (8000 car. max, 5 car. min) | Motivation détaillée de la décision : 20 caractères minimum. |

## Sous-traitance › Litiges (`/erp/litiges`)

### Réclamations — Création

Bouton **Nouvelle réclamation** · fenêtre « Nouvelle réclamation » · validation : **Créer** · `POST /claims` · composant `ClaimsList`

Aussi dans : Sous-traitance › Sous-traitants (`/erp/sous-traitants`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Contrat de sous-traitance |  | liste des marchés |  |
| 2 | Sous-traitant |  | liste des sous-traitants |  |
| 3 | Fournisseur |  | liste des fournisseurs |  |
| 4 | Titre | **Oui** | texte (250 car. max, 3 car. min) |  |
| 5 | Description |  | texte long (8000 car. max) |  |
| 6 | Montant |  | nombre (≥ 0) |  |

### Réclamations — Action

Bouton **Répondre (dans la fiche)** · fenêtre « Répondre » · validation : **Répondre** · `POST /claims/{claim_id}/answer` · composant `ClaimsList`

Aussi dans : Sous-traitance › Sous-traitants (`/erp/sous-traitants`)

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Décision | **Oui** | liste : Accepter · Rejeter · Escalader |  |
| 2 | Réponse | **Oui** | texte long (8000 car. max, 5 car. min) |  |

## Sous-traitance › Situations (`/erp/situations/[id]`)

### Valider la situation

validation : **Enregistrer** · `POST /situations/{situation_id}/validate` · composant `SituationDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Pénalités retenues (si différentes du calcul) |  | nombre (≥ 0) |  |
| 2 | Motif de l'ajustement des pénalités |  | texte long (2000 car. max) |  |

### Facture du sous-traitant

validation : **Enregistrer** · `POST /situations/{situation_id}/invoice` · composant `SituationDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Référence | **Oui** | texte (80 car. max) |  |
| 2 | Date de facture | **Oui** | date |  |
| 3 | Montant | **Oui** | nombre | Montant attendu : … (net à payer de la situation, plus la TVA du marché le cas échéant). |
| 4 | Fichier | **Oui** | fichier à déposer |  |

### Constat terrain / Dérogation au montant du marché / Valider la situation / Rejeter la situation / Facture du sous-traitant

validation : **Soumettre · Constat terrain · Accorder une dérogation · Valider · Rejeter · Enregistrer la facture · Envoyer les photos · Enregistrer le constat** · `/situations/${id}/submit` · composant `SituationDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Observations |  | texte long |  |

## Sous-traitance › Sous-traitants (`/erp/sous-traitants/[id]`)

### Modifier le sous-traitant

validation : **Enregistrer** · `PATCH /subcontractors/{subcontractor_id}` · composant `SubcontractorDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Raison sociale |  | texte (250 car. max, 2 car. min) |  |
| 2 | Nom commercial |  | texte (250 car. max) |  |
| 3 | Corps de métier |  | cases à cocher : corps de métier (par famille) | Cochez les corps de métier exercés ; une qualification approuvée ajoute aussi son corps de métier. |
| 4 | Zones |  | mots-clés (taper puis Entrée) |  |
| 5 | NIU |  | texte (60 car. max) |  |
| 6 | RCCM |  | texte (80 car. max) |  |
| 7 | E-mail |  | adresse e-mail |  |
| 8 | Téléphone |  | texte (40 car. max) |  |
| 9 | WhatsApp |  | texte (40 car. max) |  |
| 10 | Adresse |  | texte long (1000 car. max) |  |
| 11 | Ville |  | texte (120 car. max) |  |
| 12 | Effectif |  | nombre entier (≥ 0, ≤ 100000) |  |
| 13 | Assurance RC jusqu'au |  | date |  |
| 14 | Assurance décennale jusqu'au |  | date |  |
| 15 | Compte bancaire (IBAN/RIB) |  | texte (80 car. max) |  |
| 16 | Numéro Mobile Money |  | texte (40 car. max) |  |
| 17 | Organisation (accès extranet) |  | liste des organisations de type sous-traitant | Organisation de type « sous-traitant » créée dans Administration › Utilisateurs et rôles › Organisations : ses comptes ouvriront l'extranet sous-traitant de cette fiche. |
| 18 | Notes |  | texte long (4000 car. max) |  |

### Statut du sous-traitant

validation : **Enregistrer** · `POST /subcontractors/{subcontractor_id}/status` · composant `SubcontractorDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Statut | **Oui** | liste : Prospect · Qualifié · Approuvé · Suspendu · Liste noire |  |
| 2 | Motif | **Oui** | texte long (2000 car. max, 5 car. min) |  |

### Qualification

validation : **Enregistrer** · `POST /subcontractors/{subcontractor_id}/qualifications` · composant `SubcontractorDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Corps de métier | **Oui** | saisie dédiée (TradeSelect) |  |
| 2 | Critères notés (0 à 5) | **Oui** | saisie dédiée (QualificationCriteriaEditor) |  |
| 3 | Références chantier |  | saisie dédiée (ReferencesEditor) |  |
| 4 | Pièces justificatives |  | saisie dédiée (QualificationDocumentsField) | Assurances, attestations, références… Chaque fichier est envoyé dès son dépôt. |
| 5 | Décision | **Oui** | liste : En attente · Approuvé · Refusé |  |
| 6 | Commentaire |  | texte long (4000 car. max) |  |

### Noter le sous-traitant

validation : **Enregistrer** · `POST /subcontractors/{subcontractor_id}/ratings` · composant `SubcontractorDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Contrat de sous-traitance |  | liste |  |
| 2 | Qualité | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 3 | Délais | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 4 | Sécurité | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 5 | Propreté | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 6 | Conformité | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 7 | Coopération | **Oui** | nombre entier (≥ 1, ≤ 5) |  |
| 8 | Commentaire |  | texte long (2000 car. max) |  |

## Sous-traitance › Sous-traitants (`/erp/sous-traitants/consultations/[id]`)

### Évaluation technique — …

validation : **Enregistrer** · `POST /bids/{bid_id}/evaluation` · composant `TenderDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Note technique | **Oui** | nombre (≥ 0, ≤ 100) |  |
| 2 | Détail par critère (facultatif) |  | notes par critère |  |

### Négociation — …

validation : **Enregistrer** · `POST /bids/{bid_id}/negotiations` · composant `TenderDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Montant | **Oui** | nombre (≥ 0) |  |
| 2 | Durée (jours) |  | nombre entier (≥ 1, ≤ 3650) |  |
| 3 | Commentaire |  | texte long (4000 car. max) |  |

### Attribuer à …

validation : **Enregistrer** · `POST /tenders/{tender_id}/award` · composant `TenderDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre |  | texte (250 car. max) |  |
| 2 | Retenue de garantie (%) |  | nombre (≥ 0, ≤ 20) |  |
| 3 | Avance forfaitaire |  | nombre (≥ 0) |  |
| 4 | Récupération d'avance (%) |  | nombre (≥ 0, ≤ 100) |  |
| 5 | Pénalité par jour |  | nombre (≥ 0) |  |
| 6 | Plafond des pénalités (%) |  | nombre (≥ 0, ≤ 100) |  |
| 7 | Taux de TVA |  | nombre (≥ 0, ≤ 100) |  |
| 8 | Date de début |  | date |  |
| 9 | Date de fin |  | date |  |
| 10 | Conditions |  | texte long (50000 car. max) |  |

### Pièces du DCE et critères

validation : **Enregistrer** · `/tenders/${t.id}` · composant `TenderDceDialog`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Pièces du dossier de consultation (DCE) |  | cases à cocher : documents GED du projet |  |
| 2 | Critères de notation (pondération en %) |  | nombre |  |

### Inviter des entreprises / Évaluation technique — … / Négociation — … / Attribuer à … / Clôturer la consultation / Annuler la consultation

validation : **Publier · Inviter · Clôturer · Annuler · Évaluer · Négocier · Accepter · Attribuer** · `/bids/${bidId}/negotiations/accept` · composant `TenderDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Corps de métier |  | liste de choix | Restreint les entreprises proposées ; celles déjà ajoutées restent sélectionnées. |

## Sous-traitance › Sous-traitants (`/erp/sous-traitants/marches/[id]`)

### Modifier le marché

validation : **Enregistrer** · `PATCH /subcontracts/{contract_id}` · composant `ContractDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Titre |  | texte (250 car. max, 3 car. min) |  |
| 2 | Retenue de garantie (%) |  | nombre (≥ 0, ≤ 20) |  |
| 3 | Avance forfaitaire |  | nombre (≥ 0) |  |
| 4 | Récupération d'avance (%) |  | nombre (≥ 0, ≤ 100) |  |
| 5 | Pénalité par jour |  | nombre (≥ 0) |  |
| 6 | Plafond des pénalités (%) |  | nombre (≥ 0, ≤ 100) |  |
| 7 | Taux de TVA |  | nombre (≥ 0, ≤ 100) |  |
| 8 | Date de début |  | date |  |
| 9 | Date de fin |  | date |  |
| 10 | Conditions |  | texte long (50000 car. max) |  |
| 11 | Éléments |  | tableau de lignes : Code, Désignation ★, Unité, Quantité ★, Prix unitaire ★ |  |

### Mobilisation du sous-traitant

validation : **Enregistrer** · `POST /subcontracts/{contract_id}/mobilizations` · composant `ContractDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Date de mobilisation | **Oui** | date |  |
| 2 | Effectif | **Oui** | nombre entier (≥ 0, ≤ 10000) |  |
| 3 | Encadrant |  | texte (200 car. max) |  |
| 4 | Matériel |  | texte long (4000 car. max) |  |
| 5 | Accès chantier accordé |  | case à cocher |  |
| 6 | Accueil sécurité effectué |  | case à cocher |  |
| 7 | Notes |  | texte long (4000 car. max) |  |

### Libération de la retenue de garantie

validation : **Enregistrer** · `POST /subcontracts/{contract_id}/retention/release` · composant `ContractDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Montant |  | nombre (≥ 0) |  |
| 2 | Motif | **Oui** | texte long (2000 car. max, 5 car. min) |  |

### formulaire

validation : **Annuler · Créer la situation** · `/subcontracts/${contract.id}/situations` · composant `SituationCreate`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Début de période | **Oui** | date |  |
| 2 | Fin de période | **Oui** | date |  |

## Sous-traitance › Sous-traitants (`/erp/sous-traitants`)

### Sous-traitants — Création

Bouton **Nouveau sous-traitant** · fenêtre « Nouveau sous-traitant » · validation : **Créer** · `POST /subcontractors` · composant `SubcontractorsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Code |  | texte (30 car. max) |  |
| 2 | Raison sociale | **Oui** | texte (250 car. max, 2 car. min) |  |
| 3 | Nom commercial |  | texte (250 car. max) |  |
| 4 | Corps de métier |  | cases à cocher : corps de métier (par famille) | Cochez les corps de métier exercés ; une qualification approuvée ajoute aussi son corps de métier. |
| 5 | Zones |  | mots-clés (taper puis Entrée) |  |
| 6 | NIU |  | texte (60 car. max) |  |
| 7 | RCCM |  | texte (80 car. max) |  |
| 8 | E-mail |  | adresse e-mail |  |
| 9 | Téléphone |  | texte (40 car. max) |  |
| 10 | WhatsApp |  | texte (40 car. max) |  |
| 11 | Adresse |  | texte long (1000 car. max) |  |
| 12 | Ville |  | texte (120 car. max) |  |
| 13 | Effectif |  | nombre entier (≥ 0, ≤ 100000) |  |
| 14 | Assurance RC jusqu'au |  | date |  |
| 15 | Assurance décennale jusqu'au |  | date |  |
| 16 | Compte bancaire (IBAN/RIB) |  | texte (80 car. max) |  |
| 17 | Numéro Mobile Money |  | texte (40 car. max) |  |
| 18 | Organisation (accès extranet) |  | liste des organisations de type sous-traitant | Organisation de type « sous-traitant » créée dans Administration › Utilisateurs et rôles › Organisations : ses comptes ouvriront l'extranet sous-traitant de cette fiche. |
| 19 | Notes |  | texte long (4000 car. max) |  |

### Marchés de sous-traitance — Création

Bouton **Marché de gré à gré** · fenêtre « Marché de gré à gré » · validation : **Créer** · `POST /subcontracts` · composant `ContractsList`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet | **Oui** | liste des projets |  |
| 2 | Lot |  | liste des lots du projet |  |
| 3 | Sous-traitant | **Oui** | liste des sous-traitants |  |
| 4 | Titre | **Oui** | texte (250 car. max, 3 car. min) |  |
| 5 | Justification | **Oui** | texte long (4000 car. max, 10 car. min) | Attribution sans consultation : justification obligatoire (tracée). |
| 6 | Retenue de garantie (%) |  | nombre (≥ 0, ≤ 20) |  |
| 7 | Avance forfaitaire |  | nombre (≥ 0) |  |
| 8 | Récupération d'avance (%) |  | nombre (≥ 0, ≤ 100) |  |
| 9 | Pénalité par jour |  | nombre (≥ 0) |  |
| 10 | Plafond des pénalités (%) |  | nombre (≥ 0, ≤ 100) |  |
| 11 | Taux de TVA |  | nombre (≥ 0, ≤ 100) |  |
| 12 | Date de début |  | date |  |
| 13 | Date de fin |  | date |  |
| 14 | Conditions |  | texte long (50000 car. max) |  |
| 15 | Éléments | **Oui** | tableau de lignes : Code, Désignation ★, Unité, Quantité ★, Prix unitaire ★ |  |

### formulaire

validation : **Retirer le lot · Poste · Ajouter un lot · Annuler · Créer la consultation** · `/tenders` · composant `TenderForm`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Projet | **Oui** | liste des projets |  |
| 2 | Date limite de remise des offres | **Oui** | date et heure |  |
| 3 | Intitulé | **Oui** | texte |  |
| 4 | Démarrage souhaité |  | date |  |
| 5 | Durée cible (jours) |  | nombre |  |
| 6 | Description |  | texte long |  |
| 7 | Cahier des charges technique |  | texte long |  |
| 8 | Exclusions |  | texte long |  |
| 9 | Variantes autorisées |  | case à cocher |  |
| 10 | Pièces du dossier de consultation (DCE) |  | cases à cocher : documents GED du projet | Plans, CCTP, notes techniques : version en vigueur, téléchargeable par les sous-traitants consultés. |
| 11 | Critères de notation des offres (pondération en %) |  | nombre | Le comparatif des offres applique ces poids ; le total doit faire 100 %. |
| 12 | Code | **Oui** | texte |  |
| 13 | Intitulé du lot | **Oui** | texte |  |
| 14 | Estimation |  | nombre |  |
| 15 | Lot du projet |  | liste des lots du projet |  |

## Tableau de bord (`/erp/bim/[model_id]`)

### Nouvelle version de la maquette / Publier la version v…

validation : **Nouvelle version · Valider · Publier · Relancer · Déposer** · `/bim/models/${modelId}/versions` · composant `ModelDetail`

| # | Champ | Obligatoire | Saisie | Aide affichée |
| --- | --- | --- | --- | --- |
| 1 | Motif de la révision |  | texte long |  |
| 2 | Rendre visible dans l'espace client (immersion 3D) |  | case à cocher |  |

