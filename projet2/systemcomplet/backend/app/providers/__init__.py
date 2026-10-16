"""Adaptateurs d'intégration externes (règle d'abstraction §25.1).

Chaque intégration est encapsulée derrière un provider interne (PaymentProvider, WhatsAppProvider,
EmailProvider, SmsProvider, PushProvider, StorageProvider, AIProvider, SpeechToTextProvider,
MapsProvider, AnalyticsProvider, BimProvider, AnchoringProvider) : changer de prestataire ne
nécessite pas de réécrire le métier.
"""
