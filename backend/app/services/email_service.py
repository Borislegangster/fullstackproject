"""Email service — SMTP-based email sending for Globus BTP."""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

logger = logging.getLogger(__name__)

# Read SMTP config from environment (loaded by dotenv in main.py)
import os

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def _send_email(to: str, subject: str, html_body: str):
    """Low-level SMTP send. Runs synchronously — call from background task in prod."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning(f"SMTP not configured. Would send to {to}: {subject}")
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = SMTP_FROM or SMTP_USER
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        logger.info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")


# ── Invitation Email ─────────────────────────────────────────

def send_invitation_email(
    email: str,
    invitation_token: str,
    temp_password: str,
    first_name: str = "",
):
    """Send onboarding invitation with magic link + temporary credentials."""
    reset_url = f"{FRONTEND_URL}/reset-mot-de-passe?token={invitation_token}&forced=true"
    subject = "Bienvenue sur Globus BTP — Activez votre compte"
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Globus Engineering SARL</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Plateforme de Suivi de Projets</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a365d; margin-top: 0;">Bonjour {first_name or 'cher client'} 👋</h2>
            <p style="color: #4a5568; line-height: 1.6;">
                Votre espace client Globus BTP a été créé avec succès. Vous pouvez désormais
                suivre l'avancement de vos projets en temps réel, consulter vos documents
                et communiquer avec nos équipes.
            </p>

            <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 8px; font-weight: 600; color: #1a365d;">Vos identifiants temporaires :</p>
                <p style="margin: 4px 0; color: #4a5568;">📧 Email : <strong>{email}</strong></p>
                <p style="margin: 4px 0; color: #4a5568;">🔑 Mot de passe : <strong>{temp_password}</strong></p>
            </div>

            <p style="color: #e53e3e; font-size: 14px; font-weight: 600;">
                ⚠️ Vous devrez changer ce mot de passe lors de votre première connexion.
            </p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}"
                   style="background: #ed8936; color: white; padding: 14px 32px; text-decoration: none;
                          border-radius: 8px; font-weight: 700; display: inline-block; font-size: 16px;">
                    Activer mon compte →
                </a>
            </div>

            <p style="color: #a0aec0; font-size: 12px; text-align: center;">
                Ce lien est valable 48 heures. Passé ce délai, contactez-nous pour en recevoir un nouveau.
            </p>
        </div>
    </div>
    """
    _send_email(email, subject, html)


def send_resend_invitation(email: str, invitation_token: str, first_name: str = ""):
    """Resend an expired invitation with a fresh token."""
    reset_url = f"{FRONTEND_URL}/reset-mot-de-passe?token={invitation_token}&forced=true"
    subject = "Globus BTP — Nouveau lien d'activation"
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a365d; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">Globus Engineering SARL</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a365d;">Bonjour {first_name or 'cher client'}</h2>
            <p style="color: #4a5568;">Voici votre nouveau lien d'activation (valable 48h) :</p>
            <div style="text-align: center; margin: 25px 0;">
                <a href="{reset_url}"
                   style="background: #ed8936; color: white; padding: 14px 32px; text-decoration: none;
                          border-radius: 8px; font-weight: 700; display: inline-block;">
                    Activer mon compte →
                </a>
            </div>
        </div>
    </div>
    """
    _send_email(email, subject, html)


def send_invoice_notification(email: str, invoice_code: str, total: float, first_name: str = ""):
    """Notify client that a new invoice is available."""
    subject = f"Globus BTP — Nouvelle facture {invoice_code}"
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a365d; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">Globus Engineering SARL</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a365d;">Bonjour {first_name}</h2>
            <p style="color: #4a5568;">Une nouvelle facture est disponible dans votre espace client :</p>
            <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 4px 0;"><strong>Référence :</strong> {invoice_code}</p>
                <p style="margin: 4px 0;"><strong>Montant :</strong> {total:,.0f} FCFA</p>
            </div>
            <div style="text-align: center; margin: 20px 0;">
                <a href="{FRONTEND_URL}/espace-client/finances"
                   style="background: #ed8936; color: white; padding: 12px 24px; text-decoration: none;
                          border-radius: 8px; font-weight: 700; display: inline-block;">
                    Voir la facture →
                </a>
            </div>
        </div>
    </div>
    """
    _send_email(email, subject, html)


def send_ticket_reply_notification(email: str, ticket_code: str, first_name: str = ""):
    """Notify client that their SAV ticket received a reply."""
    subject = f"Globus BTP — Réponse à votre ticket {ticket_code}"
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a365d; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">Globus Engineering SARL</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a365d;">Bonjour {first_name}</h2>
            <p style="color: #4a5568;">Une réponse a été apportée à votre ticket <strong>{ticket_code}</strong>.</p>
            <div style="text-align: center; margin: 20px 0;">
                <a href="{FRONTEND_URL}/espace-client/sav"
                   style="background: #ed8936; color: white; padding: 12px 24px; text-decoration: none;
                          border-radius: 8px; font-weight: 700; display: inline-block;">
                    Voir le ticket →
                </a>
            </div>
        </div>
    </div>
    """
    _send_email(email, subject, html)


def send_appointment_notification(email: str, title: str, date_str: str, first_name: str = ""):
    """Notify client that their appointment has been confirmed."""
    subject = "Globus BTP — Rendez-vous confirmé"
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a365d; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">Globus Engineering SARL</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a365d;">Bonjour {first_name}</h2>
            <p style="color: #4a5568;">Votre rendez-vous a été confirmé :</p>
            <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 4px 0;"><strong>Objet :</strong> {title}</p>
                <p style="margin: 4px 0;"><strong>Date :</strong> {date_str}</p>
            </div>
            <div style="text-align: center; margin: 20px 0;">
                <a href="{FRONTEND_URL}/espace-client/planning"
                   style="background: #ed8936; color: white; padding: 12px 24px; text-decoration: none;
                          border-radius: 8px; font-weight: 700; display: inline-block;">
                    Voir mon planning →
                </a>
            </div>
        </div>
    </div>
    """
    _send_email(email, subject, html)


def send_password_reset_email(email: str, reset_token: str, first_name: str = ""):
    """Send the forgot-password magic link."""
    reset_url = f"{FRONTEND_URL}/reset-mot-de-passe?token={reset_token}"
    subject = "Globus BTP — Réinitialisation de votre mot de passe"
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Globus Engineering SARL</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a365d; margin-top: 0;">Bonjour {first_name or 'cher client'}</h2>
            <p style="color: #4a5568; line-height: 1.6;">
                Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous
                pour en créer un nouveau (lien valable 1 heure) :
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}"
                   style="background: #ed8936; color: white; padding: 14px 32px; text-decoration: none;
                          border-radius: 8px; font-weight: 700; display: inline-block;">
                    Réinitialiser mon mot de passe →
                </a>
            </div>
            <p style="color: #a0aec0; font-size: 12px;">
                Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.
                Votre mot de passe restera inchangé.
            </p>
        </div>
    </div>
    """
    _send_email(email, subject, html)


def send_password_changed_notification(email: str, first_name: str = ""):
    """Notify the user that their password was successfully changed."""
    subject = "Globus BTP — Mot de passe modifié"
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #16a34a; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">✅ Mot de passe modifié</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a365d;">Bonjour {first_name or 'cher client'}</h2>
            <p style="color: #4a5568;">
                Votre mot de passe Globus BTP vient d'être modifié avec succès.
            </p>
            <p style="color: #4a5568;">
                Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement notre support.
            </p>
        </div>
    </div>
    """
    _send_email(email, subject, html)


def send_signing_otp(email: str, code: str, document_name: str, first_name: str = ""):
    """Email a 6-digit OTP for the electronic-signature flow.

    The code is shown big and bold; we also remind the user to never share it.
    """
    subject = f"Globus BTP — Code de signature ({code})"
    html = f"""
    <div style=\"font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;\">
        <div style=\"background: #1a365d; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;\">
            <h1 style=\"color: white; margin: 0;\">Code de signature</h1>
            <p style=\"color: rgba(255,255,255,0.85); margin: 6px 0 0;\">Globus BTP</p>
        </div>
        <div style=\"background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;\">
            <h2 style=\"color: #1a365d; margin-top: 0;\">Bonjour {first_name or ''} 👋</h2>
            <p style=\"color: #4a5568; line-height: 1.6;\">
                Vous êtes sur le point de signer électroniquement le document
                <strong>{document_name}</strong>. Saisissez le code ci-dessous
                pour finaliser votre signature.
            </p>
            <div style=\"text-align: center; margin: 30px 0;\">
                <div style=\"display: inline-block; padding: 16px 32px; background: #f7fafc;
                            border: 2px dashed #1a365d; border-radius: 12px;
                            font-size: 28pt; letter-spacing: 8px; font-weight: 700; color: #1a365d;\">
                    {code}
                </div>
            </div>
            <p style=\"color: #c53030; font-size: 14px; font-weight: 600;\">
                ⚠️ Ne communiquez jamais ce code. Il expire dans 10 minutes.
            </p>
            <p style=\"color: #718096; font-size: 12px; margin-top: 24px;\">
                Si vous n'êtes pas à l'origine de cette demande, ignorez ce message
                ou contactez notre support.
            </p>
        </div>
    </div>
    """
    _send_email(email, subject, html)


def send_overdue_invoice_reminder(email: str, invoice_code: str, total: float, first_name: str = ""):
    """Remind client about an overdue invoice."""
    subject = f"Globus BTP — Rappel de paiement {invoice_code}"
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #c53030; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">⚠️ Rappel de Paiement</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a365d;">Bonjour {first_name}</h2>
            <p style="color: #4a5568;">
                Nous vous rappelons que la facture <strong>{invoice_code}</strong>
                d'un montant de <strong>{total:,.0f} FCFA</strong> est en attente de règlement.
            </p>
            <div style="text-align: center; margin: 25px 0;">
                <a href="{FRONTEND_URL}/espace-client/finances"
                   style="background: #c53030; color: white; padding: 12px 24px; text-decoration: none;
                          border-radius: 8px; font-weight: 700; display: inline-block;">
                    Régler maintenant →
                </a>
            </div>
        </div>
    </div>
    """
    _send_email(email, subject, html)


def send_payment_confirmation_client(email: str, invoice_code: str, amount: float,
                                     first_name: str = "", method: str = ""):
    """Confirm to the client that their online payment was received."""
    subject = f"Globus BTP — Paiement reçu (facture {invoice_code})"
    via = f" via {method}" if method else ""
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #2f855a; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">✅ Paiement confirmé</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a365d;">Bonjour {first_name}</h2>
            <p style="color: #4a5568;">Nous avons bien reçu votre paiement{via}. Merci !</p>
            <div style="background: #f0fff4; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 4px 0;"><strong>Facture :</strong> {invoice_code}</p>
                <p style="margin: 4px 0;"><strong>Montant réglé :</strong> {amount:,.0f} FCFA</p>
            </div>
            <div style="text-align: center; margin: 20px 0;">
                <a href="{FRONTEND_URL}/espace-client/finances"
                   style="background: #ed8936; color: white; padding: 12px 24px; text-decoration: none;
                          border-radius: 8px; font-weight: 700; display: inline-block;">
                    Voir mes reçus →
                </a>
            </div>
        </div>
    </div>
    """
    _send_email(email, subject, html)


def send_payment_received_staff(email: str, invoice_code: str, amount: float,
                                client_name: str = "", method: str = "", first_name: str = ""):
    """Alert finance staff / the project chef that an online payment was received."""
    subject = f"Globus BTP — Paiement reçu en ligne (facture {invoice_code})"
    via = f" via {method}" if method else ""
    who = f" de {client_name}" if client_name else ""
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a365d; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">💳 Paiement reçu en ligne</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a365d;">Bonjour {first_name}</h2>
            <p style="color: #4a5568;">Un paiement en ligne{who} a été reçu et vérifié{via}.</p>
            <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 4px 0;"><strong>Facture :</strong> {invoice_code}</p>
                <p style="margin: 4px 0;"><strong>Montant :</strong> {amount:,.0f} FCFA</p>
            </div>
            <div style="text-align: center; margin: 20px 0;">
                <a href="{FRONTEND_URL}/erp/facturation"
                   style="background: #ed8936; color: white; padding: 12px 24px; text-decoration: none;
                          border-radius: 8px; font-weight: 700; display: inline-block;">
                    Ouvrir la facturation →
                </a>
            </div>
        </div>
    </div>
    """
    _send_email(email, subject, html)
