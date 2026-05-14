import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import { FloatingWidgets } from './layout/FloatingWidgets';
import { CookieBanner } from './components/ui/CookieBanner';
import { GlobusLoader } from './components/ui/GlobusLoader';
import { TrackingScripts } from './components/seo/TrackingScripts';
import { SchemaOrg } from './components/seo/SchemaOrg';
import { QueryProvider } from './providers/QueryProvider';
import { GlobusToaster } from './components/ui/Toast';
import { useAnalyticsTracker } from './hooks/useAnalyticsTracker';
// Lazy-loaded pages — Public
const HomePage = lazy(() =>
import('./pages/public/HomePage').then((m) => ({
  default: m.HomePage
}))
);
const AboutPage = lazy(() =>
import('./pages/public/AboutPage').then((m) => ({
  default: m.AboutPage
}))
);
const ServicesPage = lazy(() =>
import('./pages/public/ServicesPage').then((m) => ({
  default: m.ServicesPage
}))
);
const ServiceDetailPage = lazy(() =>
import('./pages/public/ServiceDetailPage').then((m) => ({
  default: m.ServiceDetailPage
}))
);
const ProjectsPage = lazy(() =>
import('./pages/public/ProjectsPage').then((m) => ({
  default: m.ProjectsPage
}))
);
const ProjectDetailPage = lazy(() =>
import('./pages/public/ProjectDetailPage').then((m) => ({
  default: m.ProjectDetailPage
}))
);
const BlogPage = lazy(() =>
import('./pages/public/BlogPage').then((m) => ({
  default: m.BlogPage
}))
);
const BlogDetailPage = lazy(() =>
import('./pages/public/BlogDetailPage').then((m) => ({
  default: m.BlogDetailPage
}))
);
const ContactPage = lazy(() =>
import('./pages/public/ContactPage').then((m) => ({
  default: m.ContactPage
}))
);
const FAQPage = lazy(() =>
import('./pages/public/FAQPage').then((m) => ({
  default: m.FAQPage
}))
);
const HelpCenterPage = lazy(() =>
import('./pages/public/HelpCenterPage').then((m) => ({
  default: m.HelpCenterPage
}))
);
const LegalNoticePage = lazy(() =>
import('./pages/public/LegalNoticePage').then((m) => ({
  default: m.LegalNoticePage
}))
);
const PrivacyPolicyPage = lazy(() =>
import('./pages/public/PrivacyPolicyPage').then((m) => ({
  default: m.PrivacyPolicyPage
}))
);
const TermsPage = lazy(() =>
import('./pages/public/TermsPage').then((m) => ({
  default: m.TermsPage
}))
);
const CookiePolicyPage = lazy(() =>
import('./pages/public/CookiePolicyPage').then((m) => ({
  default: m.CookiePolicyPage
}))
);
const LoginPage = lazy(() =>
import('./pages/auth/LoginPage').then((m) => ({
  default: m.LoginPage
}))
);
const RegisterPage = lazy(() =>
import('./pages/auth/RegisterPage').then((m) => ({
  default: m.RegisterPage
}))
);
const ForgotPasswordPage = lazy(() =>
import('./pages/auth/ForgotPasswordPage').then((m) => ({
  default: m.ForgotPasswordPage
}))
);
const ResetPasswordPage = lazy(() =>
import('./pages/auth/ResetPasswordPage').then((m) => ({
  default: m.ResetPasswordPage
}))
);
const ErpLoginPage = lazy(() =>
import('./pages/auth/ErpLoginPage').then((m) => ({
  default: m.ErpLoginPage
}))
);
// Lazy-loaded layouts
const ClientLayout = lazy(() =>
import('./layout/ClientLayout').then((m) => ({
  default: m.ClientLayout
}))
);
const ErpLayout = lazy(() =>
import('./layout/ErpLayout').then((m) => ({
  default: m.ErpLayout
}))
);
// Lazy-loaded pages — Client Portal
const ClientDashboard = lazy(() =>
import('./pages/client/ClientDashboard').then((m) => ({
  default: m.ClientDashboard
}))
);
const ClientChantier = lazy(() =>
import('./pages/client/ClientChantier').then((m) => ({
  default: m.ClientChantier
}))
);
const ClientPlanning = lazy(() =>
import('./pages/client/ClientPlanning').then((m) => ({
  default: m.ClientPlanning
}))
);
const ClientFinances = lazy(() =>
import('./pages/client/ClientFinances').then((m) => ({
  default: m.ClientFinances
}))
);
const ClientDocuments = lazy(() =>
import('./pages/client/ClientDocuments').then((m) => ({
  default: m.ClientDocuments
}))
);
const ClientMessages = lazy(() =>
import('./pages/client/ClientMessages').then((m) => ({
  default: m.ClientMessages
}))
);
const ClientAccount = lazy(() =>
import('./pages/client/ClientAccount').then((m) => ({
  default: m.ClientAccount
}))
);
const ClientSAV = lazy(() =>
import('./pages/client/ClientSAV').then((m) => ({
  default: m.ClientSAV
}))
);
const ClientNotifications = lazy(() =>
import('./pages/client/ClientNotifications').then((m) => ({
  default: m.ClientNotifications
}))
);
// Lazy-loaded pages — ERP
const ErpDashboard = lazy(() =>
import('./pages/erp/ErpDashboard').then((m) => ({
  default: m.ErpDashboard
}))
);
const ErpChantiers = lazy(() =>
import('./pages/erp/ErpChantiers').then((m) => ({
  default: m.ErpChantiers
}))
);
const ErpRH = lazy(() =>
import('./pages/erp/ErpRH').then((m) => ({
  default: m.ErpRH
}))
);
const ErpFinances = lazy(() =>
import('./pages/erp/ErpFinances').then((m) => ({
  default: m.ErpFinances
}))
);
const ErpFacturation = lazy(() =>
import('./pages/erp/ErpFacturation').then((m) => ({
  default: m.ErpFacturation
}))
);
const ErpAchats = lazy(() =>
import('./pages/erp/ErpAchats').then((m) => ({
  default: m.ErpAchats
}))
);
const ErpPlanification = lazy(() =>
import('./pages/erp/ErpPlanification').then((m) => ({
  default: m.ErpPlanification
}))
);
const ErpQHSE = lazy(() =>
import('./pages/erp/ErpQHSE').then((m) => ({
  default: m.ErpQHSE
}))
);
const ErpMateriel = lazy(() =>
import('./pages/erp/ErpMateriel').then((m) => ({
  default: m.ErpMateriel
}))
);
const ErpCRM = lazy(() =>
import('./pages/erp/ErpCRM').then((m) => ({
  default: m.ErpCRM
}))
);
const ErpDocuments = lazy(() =>
import('./pages/erp/ErpDocuments').then((m) => ({
  default: m.ErpDocuments
}))
);
const ErpGED = lazy(() =>
import('./pages/erp/ErpGED').then((m) => ({
  default: m.ErpGED
}))
);
const ErpSousTraitants = lazy(() =>
import('./pages/erp/ErpSousTraitants').then((m) => ({
  default: m.ErpSousTraitants
}))
);
const ErpRapports = lazy(() =>
import('./pages/erp/ErpRapports').then((m) => ({
  default: m.ErpRapports
}))
);
const ErpAgenda = lazy(() =>
import('./pages/erp/ErpAgenda').then((m) => ({
  default: m.ErpAgenda
}))
);
const ErpCMS = lazy(() =>
import('./pages/erp/ErpCMS').then((m) => ({
  default: m.ErpCMS
}))
);
const ErpSAV = lazy(() =>
import('./pages/erp/ErpSAV').then((m) => ({
  default: m.ErpSAV
}))
);
const ErpNotifications = lazy(() =>
import('./pages/erp/ErpNotifications').then((m) => ({
  default: m.ErpNotifications
}))
);
const ErpParametres = lazy(() =>
import('./pages/erp/ErpParametres').then((m) => ({
  default: m.ErpParametres
}))
);
const ErpJournalActivite = lazy(() =>
import('./pages/erp/ErpJournalActivite').then((m) => ({
  default: m.ErpJournalActivite
}))
);
function AppContent() {
  const location = useLocation();
  const isClientPortal = location.pathname.startsWith('/espace-client');
  const isErp = location.pathname.startsWith('/erp');
  const isAuth = ['/connexion', '/inscription', '/mot-de-passe-oublie', '/reset-mot-de-passe', '/erp-login'].includes(location.pathname);
  const isPortal = isClientPortal || isErp || isAuth;
  
  // Track page views
  useAnalyticsTracker();
  return (
    <div
      className={`font-opensans text-globus-gray bg-white w-full min-h-screen flex flex-col ${isPortal ? 'h-screen overflow-hidden' : ''}`}>
      
      {!isPortal &&
      <>
          <Header />
          <TrackingScripts
          gaId="G-DEMO123456"
          gtmId="GTM-DEMO123"
          fbPixelId="123456789"
          tiktokPixelId="DEMO123" />
        
          <SchemaOrg />
        </>
      }
      <main className={isPortal ? 'flex-1 h-full' : 'flex-grow'}>
        <Suspense fallback={<GlobusLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/a-propos" element={<AboutPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/services/:slug" element={<ServiceDetailPage />} />
            <Route path="/projets" element={<ProjectsPage />} />
            <Route path="/projets/:slug" element={<ProjectDetailPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/aide" element={<HelpCenterPage />} />
            <Route path="/mentions-legales" element={<LegalNoticePage />} />
            <Route
              path="/politique-de-confidentialite"
              element={<PrivacyPolicyPage />} />
            
            <Route path="/termes-et-conditions" element={<TermsPage />} />
            <Route path="/cookies" element={<CookiePolicyPage />} />
            <Route path="/connexion" element={<LoginPage />} />
            <Route path="/inscription" element={<RegisterPage />} />
            <Route
              path="/mot-de-passe-oublie"
              element={<ForgotPasswordPage />} />
            
            <Route path="/reset-mot-de-passe" element={<ResetPasswordPage />} />
            <Route path="/erp-login" element={<ErpLoginPage />} />

            <Route path="/espace-client" element={<ClientLayout />}>
              <Route index element={<ClientDashboard />} />
              <Route path="chantier" element={<ClientChantier />} />
              <Route path="planning" element={<ClientPlanning />} />
              <Route path="finances" element={<ClientFinances />} />
              <Route path="documents" element={<ClientDocuments />} />
              <Route path="messagerie" element={<ClientMessages />} />
              <Route path="compte" element={<ClientAccount />} />
              <Route path="sav" element={<ClientSAV />} />
              <Route path="notifications" element={<ClientNotifications />} />
            </Route>

            <Route path="/erp" element={<ErpLayout />}>
              <Route index element={<ErpDashboard />} />
              <Route path="chantiers" element={<ErpChantiers />} />
              <Route path="rh" element={<ErpRH />} />
              <Route path="finances" element={<ErpFinances />} />
              <Route path="facturation" element={<ErpFacturation />} />
              <Route path="achats" element={<ErpAchats />} />
              <Route path="planification" element={<ErpPlanification />} />
              <Route path="qhse" element={<ErpQHSE />} />
              <Route path="materiel" element={<ErpMateriel />} />
              <Route path="crm" element={<ErpCRM />} />
              <Route path="documents" element={<ErpDocuments />} />
              <Route path="ged" element={<ErpGED />} />
              <Route path="sous-traitants" element={<ErpSousTraitants />} />
              <Route path="rapports" element={<ErpRapports />} />
              <Route path="agenda" element={<ErpAgenda />} />
              <Route path="cms" element={<ErpCMS />} />
              <Route path="sav" element={<ErpSAV />} />
              <Route path="notifications" element={<ErpNotifications />} />
              <Route path="parametres" element={<ErpParametres />} />
              <Route path="journal-activite" element={<ErpJournalActivite />} />
            </Route>
          </Routes>
        </Suspense>
      </main>
      {!isPortal &&
      <>
          <Footer />
          <FloatingWidgets />
          <CookieBanner />
        </>
      }
    </div>);

}
export function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <GlobusToaster />
        <AppContent />
      </BrowserRouter>
    </QueryProvider>);

}