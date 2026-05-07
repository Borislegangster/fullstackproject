import React, { useState, useRef } from 'react';
import { useAdminCMS } from '../../hooks/useAdminCMS';
import {
  ArticleModal, ArticlePreviewModal, ProjectModal, ServiceModal, TeamModal,
  TestimonialModal, PartnerModal, FaqItemModal, FaqCategoryModal,
  HeroSlideModal, DeleteConfirmModal, ContactMessageModal,
  EngagementModal, MethodologyStepModal, GuaranteeModal, StatModal
} from './ErpCMSModals';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileTextIcon,
  ImageIcon,
  BriefcaseIcon,
  UsersIcon,
  HelpCircleIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  Trash2Icon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  CheckCircle2Icon,
  MessageSquareIcon,
  MailIcon,
  ClockIcon,
  Loader2Icon,
  XIcon,
  UploadCloudIcon,
  SaveIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  GlobeIcon,
  ScaleIcon,
  ChevronDownIcon,
  PlayCircleIcon,
  LinkIcon,
  TypeIcon,
  HashIcon,
  ShieldCheckIcon,
  VideoIcon,
  HandshakeIcon,
  StarIcon,
  PhoneIcon,
  MapPinIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  FolderOpenIcon,
  FileIcon,
  MusicIcon,
  CopyIcon,
  FilmIcon,
  BarChart3Icon,
  TagIcon,
  CodeIcon,
  MapIcon,
  RefreshCwIcon
} from
  'lucide-react';
const tabs = [
  {
    id: 'blog',
    label: 'Articles Blog',
    icon: FileTextIcon
  },
  {
    id: 'portfolio',
    label: 'Projets & Portfolio',
    icon: ImageIcon
  },
  {
    id: 'services',
    label: 'Services',
    icon: BriefcaseIcon
  },
  {
    id: 'team',
    label: 'Équipe & Témoignages',
    icon: UsersIcon
  },
  {
    id: 'faq',
    label: 'FAQ & Contact',
    icon: HelpCircleIcon
  },
  {
    id: 'homepage',
    label: 'Accueil & Sections',
    icon: LayoutDashboardIcon
  },
  {
    id: 'settings',
    label: 'Paramètres Site',
    icon: SettingsIcon
  },
  {
    id: 'pages',
    label: 'Pages Publiques',
    icon: GlobeIcon
  },
  {
    id: 'legal',
    label: 'Pages Légales',
    icon: ScaleIcon
  },
  {
    id: 'media',
    label: 'Médiathèque',
    icon: FolderOpenIcon
  },
  {
    id: 'seo',
    label: 'SEO & Tracking',
    icon: SearchIcon
  }];

// ── All data now fetched from backend via useAdminCMS hook ──
// ── All data now fetched from backend via useAdminCMS hook ──

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05
    }
  }
};
const fadeUp = {
  hidden: {
    opacity: 0,
    y: 15
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3
    }
  }
};
export function ErpCMS() {
  // ── Backend data via hook ─────────────────────────────────
  const cms = useAdminCMS();
  const {
    blog, projects, services, team, testimonials, partners,
    faqCategories, faqItems, heroSlides, engagements,
    methodology, stats, guarantees, contacts, mediaItems,
    siteSettings, aboutContent, legalPages,
    blogStats, mediaStats, contactStats,
    createBlog, updateBlog, deleteBlog,
    projectsCrud, servicesCrud, teamCrud, testimonialsCrud,
    partnersCrud, faqCategoriesCrud, faqItemsCrud, heroSlidesCrud,
    engagementsCrud, methodologyCrud, statsCrud, guaranteesCrud,
    updateSettings, updateAbout, updateLegal,
    markContactRead, replyContact, uploadMedia, importYouTube, deleteMedia,
    loading, isSaving,
  } = cms;

  // ── Aliases for template compatibility ────────────────────
  const blogData = blog;
  const projectsData = projects;
  const servicesData = services;
  const teamData = team;
  const testimonialsData = testimonials;
  const faqData = faqItems;
  const contactData = contacts.map(c => ({
    ...c, date: new Date(c.created_at).toLocaleDateString('fr-FR'),
    status: c.replied ? 'Répondu' : c.is_read ? 'Lu' : 'Nouveau',
  }));
  const heroSlidesData = heroSlides;
  const engagementsData = engagements;
  const methodologyData = methodology;
  const statsBarData = stats;
  const guaranteesData = guarantees;
  const partnersData = partners;
  const mediaData = mediaItems.map(m => ({
    ...m, uploadDate: m.uploaded_at ? new Date(m.uploaded_at).toLocaleDateString('fr-FR') : '',
    usageCount: m.usage_count || 0,
  }));
  // Settings aliases (fallback to empty object)
  const s = siteSettings || {} as any;
  const heroVideoData = { url: s.hero_video_src || '', poster: s.hero_video_poster || '', duration: 6 };
  const aboutSectionData = {
    paragraph1: aboutContent?.paragraphs?.[0] || '',
    paragraph2: aboutContent?.paragraphs?.[1] || '',
    bulletPoints: aboutContent?.highlights || [],
    badgeText: aboutContent?.badge_value || '',
    images: aboutContent?.images || [],
  };
  const videoSectionData = { youtubeUrl: s.video_section_youtube_url || '', title: s.video_section_title || '', subtitle: s.video_section_subtitle || '' };
  const ctaBannerData = { title: s.cta_title || '', subtitle: s.cta_subtitle || '', buttonText: s.cta_text || '', buttonLink: s.cta_href || '' };
  const headerSettingsData = { logoUrl: s.logo || '/globusLogo.jpg', phone: s.phone || '', email: s.email || '', hours: s.top_bar_text || '' };
  const footerSettingsData = { description: s.footer_description || '', address: s.address || '', phone: s.phone || '', email: s.email || '', facebook: s.social_links?.facebook || '', twitter: s.social_links?.twitter || '', linkedin: s.social_links?.linkedin || '', instagram: s.social_links?.instagram || '', newsletterEnabled: true };
  const seoSettingsData = { metaTitle: '', metaDescription: '', ogImage: '' };
  const aboutPageData = { heroImage: aboutContent?.hero_image || '', historyTitle: aboutContent?.hero_title || '', historyP1: aboutContent?.paragraphs?.[0] || '', historyP2: aboutContent?.paragraphs?.[1] || '', values: aboutContent?.values || [], certifications: aboutContent?.certifications || [] };
  const contactPageData = { address: s.contact_address || '', phoneStandard: s.contact_phone || '', phoneWhatsApp: s.contact_whatsapp || '', emailContact: s.contact_email || '', emailDevis: s.email || '', hoursWeekday: s.contact_hours || '', hoursSaturday: '', mapUrl: s.contact_map_embed_url || '', formSubjects: ['Demande de devis', 'Renseignement général', 'Candidature / Emploi', 'Autre demande'] };
  const faqPageData = faqCategories.map(cat => ({
    id: cat.id, category: cat.name,
    items: faqItems.filter(item => item.category_id === cat.id).map(item => ({ q: item.question, a: item.answer })),
  }));
  const helpCenterData = { supportEmail: s.contact_email || '', whatsappNumber: s.contact_whatsapp || '', faqDesc: 'Trouvez des réponses immédiates.', whatsappDesc: 'Discutez en direct.', emailDesc: 'Réponse sous 24h.' };
  const legalPagesData = {
    legalNotice: legalPages['legalNotice'] || { lastUpdated: '-', companyName: '', legalForm: '', rccm: '', address: '', director: '', contact: '', hostName: '', hostAddress: '' } as any,
    privacyPolicy: legalPages['privacy'] || { lastUpdated: '-', sections: 5 } as any,
    terms: legalPages['terms'] || { lastUpdated: '-', sections: 5 } as any,
    cookiePolicy: legalPages['cookies'] || { lastUpdated: '-', sections: 4 } as any,
  };

  // ── Local UI state ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('blog');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);
  // Blog search & filter
  const [blogSearchTerm, setBlogSearchTerm] = useState('');
  const [blogCategoryFilter, setBlogCategoryFilter] = useState('');
  // Blog article preview
  const [showArticlePreview, setShowArticlePreview] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteEntityType, setDeleteEntityType] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('hero');
  const [activeSettingsTab, setActiveSettingsTab] = useState('header');
  const [activePagesTab, setActivePagesTab] = useState('about');
  const [activeLegalTab, setActiveLegalTab] = useState('legalNotice');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editEntityType, setEditEntityType] = useState<string>('');
  // Media Tab State
  const [mediaFilter, setMediaFilter] = useState('all');
  const [mediaSearch, setMediaSearch] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerCallback, setMediaPickerCallback] = useState<
    ((url: string) => void) | null>(
      null);
  // SEO Tab State
  const [activeSeoTab, setActiveSeoTab] = useState('pages');
  // Form modal state
  const [formData, setFormData] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Entity modals state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showTestimonialModal, setShowTestimonialModal] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showFaqItemModal, setShowFaqItemModal] = useState(false);
  const [showFaqCategoryModal, setShowFaqCategoryModal] = useState(false);
  const [showHeroSlideModal, setShowHeroSlideModal] = useState(false);
  const [showEngagementModal, setShowEngagementModal] = useState(false);
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);
  const [showGuaranteeModal, setShowGuaranteeModal] = useState(false);
  const [showStatModal, setShowStatModal] = useState(false);

  // Contact message modal
  const [showContactViewModal, setShowContactViewModal] = useState(false);
  const [contactViewItem, setContactViewItem] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Settings form state — initialized from siteSettings, synced on save
  const [settingsForm, setSettingsForm] = useState<any>({});
  const [aboutForm, setAboutForm] = useState<any>({});
  const sfInit = useRef(false);
  const afInit = useRef(false);
  // Sync settings form when data loads
  if (siteSettings && !sfInit.current) {
    sfInit.current = true;
    setSettingsForm({ ...siteSettings });
  }
  if (aboutContent && !afInit.current) {
    afInit.current = true;
    setAboutForm({ ...aboutContent });
  }
  const sf = (k: string) => settingsForm[k] ?? '';
  const setSf = (k: string, v: any) => setSettingsForm((p: any) => ({ ...p, [k]: v }));

  const toggleSection = (id: string) =>
    setExpandedSection(expandedSection === id ? null : id);

  // ── Toast helper ──────────────────────────────────────────
  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'success') => {
    setToast({
      message,
      type
    });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Real API handlers ─────────────────────────────────────

  const handleSaveGeneric = async () => {
    setIsProcessing('save-generic');
    try {
      await updateSettings(settingsForm);
      showToast('Modifications enregistrées avec succès');
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
    setIsProcessing(null);
    setShowEditModal(false);
    setEditItem(null);
  };

  const handleSaveAbout = async () => {
    setIsProcessing('save-about');
    try {
      await updateAbout(aboutForm);
      showToast('Modifications "À Propos" enregistrées avec succès');
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
    setIsProcessing(null);
  };

  const handlePublishToggle = async (id: string, currentStatus: string) => {
    setIsProcessing(`publish-${id}`);
    try {
      const newStatus = currentStatus === 'published' || currentStatus === 'Publié' ? 'draft' : 'published';
      await updateBlog(id, { status: newStatus });
      showToast(newStatus === 'draft' ? 'Article dépublié avec succès' : 'Article publié avec succès');
    } catch {
      showToast('Erreur lors de la mise à jour', 'error');
    }
    setIsProcessing(null);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsProcessing('delete');
    try {
      const type = deleteEntityType;
      const id = itemToDelete.id;
      if (type === 'blog') await deleteBlog(id);
      else if (type === 'project') await projectsCrud.delete(id);
      else if (type === 'service') await servicesCrud.delete(id);
      else if (type === 'team') await teamCrud.delete(id);
      else if (type === 'testimonial') await testimonialsCrud.delete(id);
      else if (type === 'partner') await partnersCrud.delete(id);
      else if (type === 'faqItem') await faqItemsCrud.delete(id);
      else if (type === 'faqCategory') await faqCategoriesCrud.delete(id);
      else if (type === 'heroSlide') await heroSlidesCrud.delete(id);
      else if (type === 'engagement') await engagementsCrud.delete(id);
      else if (type === 'methodology') await methodologyCrud.delete(id);
      else if (type === 'stat') await statsCrud.delete(id);
      else if (type === 'guarantee') await guaranteesCrud.delete(id);
      else if (type === 'media') await deleteMedia(id);
      showToast('Élément supprimé avec succès');
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    }
    setIsProcessing(null);
    setShowDeleteModal(false);
    setItemToDelete(null);
    setDeleteEntityType('');
  };

  const confirmDelete = (item: any, entityType: string) => {
    setItemToDelete(item);
    setDeleteEntityType(entityType);
    setShowDeleteModal(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing('save-article');
    try {
      const now = new Date();
      const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
      const dateStr = `${String(now.getDate()).padStart(2,'0')} ${months[now.getMonth()]} ${now.getFullYear()}`;
      const payload = { ...formData };
      if (!editItem?.id) {
        // Auto-set date and read_time on creation
        payload.date = dateStr;
        if (!payload.read_time) payload.read_time = '3 min';
      }
      if (editItem?.id) {
        await updateBlog(editItem.id, payload);
        showToast('Article modifié avec succès');
      } else {
        await createBlog(payload);
        showToast('Article créé avec succès');
      }
      setShowArticleModal(false);
      setEditItem(null);
      setFormData({});
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
    setIsProcessing(null);
  };

  const openArticleModal = (item?: any) => {
    if (item) {
      setEditItem(item);
      setFormData({ title: item.title, category: item.category, author: item.author, excerpt: item.excerpt || '', status: item.status, image: item.image || '', html_content: item.html_content || '' });
    } else {
      setEditItem(null);
      setFormData({ title: '', category: '', author: '', excerpt: '', status: 'draft', image: '', html_content: '' });
    }
    setShowArticleModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadMedia(file);
      showToast('Fichier uploadé avec succès');
    } catch {
      showToast('Erreur lors de l\'upload', 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Generic entity modal helpers ────────────────────────────
  const openEntityModal = (type: string, item?: any) => {
    setEditItem(item || null);
    setFormData(item ? { ...item } : {});
    setEditEntityType(type);
    if (type === 'project') setShowProjectModal(true);
    else if (type === 'service') setShowServiceModal(true);
    else if (type === 'team') setShowTeamModal(true);
    else if (type === 'testimonial') setShowTestimonialModal(true);
    else if (type === 'partner') setShowPartnerModal(true);
    else if (type === 'faqItem') setShowFaqItemModal(true);
    else if (type === 'faqCategory') setShowFaqCategoryModal(true);
    else if (type === 'engagement') setShowEngagementModal(true);
    else if (type === 'methodology') setShowMethodologyModal(true);
    else if (type === 'guarantee') setShowGuaranteeModal(true);
    else if (type === 'stat') setShowStatModal(true);
  };

  const closeEntityModal = () => {
    setShowProjectModal(false); setShowServiceModal(false);
    setShowTeamModal(false); setShowTestimonialModal(false);
    setShowPartnerModal(false); setShowFaqItemModal(false);
    setShowFaqCategoryModal(false); setShowHeroSlideModal(false);
    setShowEngagementModal(false); setShowMethodologyModal(false);
    setShowGuaranteeModal(false); setShowStatModal(false);
    setEditItem(null); setFormData({}); setEditEntityType('');
  };

  const handleSaveEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing('save-entity');
    try {
      const type = editEntityType;
      const crud = type === 'project' ? projectsCrud : type === 'service' ? servicesCrud :
        type === 'team' ? teamCrud : type === 'testimonial' ? testimonialsCrud :
          type === 'partner' ? partnersCrud : type === 'faqItem' ? faqItemsCrud :
            type === 'faqCategory' ? faqCategoriesCrud : type === 'heroSlide' ? heroSlidesCrud :
              type === 'engagement' ? engagementsCrud : type === 'methodology' ? methodologyCrud :
                type === 'guarantee' ? guaranteesCrud : type === 'stat' ? statsCrud : null;
      if (!crud) {
        showToast(`Erreur: Type d'entité inconnu (${type})`, 'error');
        return;
      }
      if (editItem?.id) {
        await crud.update(editItem.id, formData);
        showToast('Élément modifié avec succès');
      } else {
        await crud.create(formData);
        showToast('Élément créé avec succès');
      }
      closeEntityModal();
    } catch (error) {
      console.error(error);
      showToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  // ── Loading state ─────────────────────────────────────────
  if (loading.global) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2Icon className="w-8 h-8 animate-spin text-globus-orange" />
        <span className="ml-3 font-montserrat font-semibold text-gray-500">Chargement du CMS...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast &&
          <motion.div
            initial={{
              opacity: 0,
              y: 50
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            exit={{
              opacity: 0,
              y: 50
            }}
            className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 text-white font-opensans text-sm ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>

            {toast.type === 'success' &&
              <CheckCircle2Icon className="w-5 h-5" />
            }
            {toast.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Header & Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark flex items-center gap-2">
              <FileTextIcon className="w-7 h-7 text-globus-orange" />
              Gestion de Contenu (CMS)
            </h2>
            <p className="font-opensans text-sm text-globus-gray mt-1">
              Gérez le contenu du site public (Blog, Projets, Services, etc.)
            </p>
          </div>
        </div>
        <div className="flex overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-montserrat font-semibold text-sm transition-colors relative whitespace-nowrap ${isActive ? 'text-globus-orange' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>

                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive &&
                  <motion.div
                    layoutId="cms-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-globus-orange" />

                }
              </button>);

          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* TAB 1: BLOG */}
        {activeTab === 'blog' &&
          <motion.div
            key="blog"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="space-y-6">

            <motion.div
              variants={fadeUp}
              className="grid grid-cols-1 sm:grid-cols-4 gap-4">

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Publiés
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-green-600">
                    {blogStats.published}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle2Icon className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Brouillons
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-gray-600">
                    {blogStats.draft}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                  <EditIcon className="w-5 h-5 text-gray-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Planifiés
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-blue-600">
                    {blogStats.scheduled}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <ClockIcon className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Vues ce mois
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-globus-blue-dark">
                    —
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <EyeIcon className="w-5 h-5 text-globus-blue" />
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un article..."
                      value={blogSearchTerm}
                      onChange={e => setBlogSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <select
                    value={blogCategoryFilter}
                    onChange={e => setBlogCategoryFilter(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue">
                    <option value="">Toutes catégories</option>
                    {[...new Set(blogData.map(p => p.category).filter(Boolean))].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => openArticleModal()}
                  className="w-full sm:w-auto bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 text-sm">

                  <PlusIcon className="w-4 h-4" /> Nouvel Article
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-montserrat font-bold text-gray-500 uppercase">
                      <th className="py-3 px-5">Titre</th>
                      <th className="py-3 px-5">Catégorie</th>
                      <th className="py-3 px-5">Auteur</th>
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5">Statut</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm font-opensans">
                    {blogData
                      .filter(p => !blogSearchTerm || p.title.toLowerCase().includes(blogSearchTerm.toLowerCase()) || p.author?.toLowerCase().includes(blogSearchTerm.toLowerCase()))
                      .filter(p => !blogCategoryFilter || p.category === blogCategoryFilter)
                      .map((post) =>
                      <tr
                        key={post.id}
                        className="hover:bg-gray-50 transition-colors">

                        <td className="py-3 px-5 font-semibold text-gray-800">
                          {post.title}
                        </td>
                        <td className="py-3 px-5 text-gray-600">
                          {post.category}
                        </td>
                        <td className="py-3 px-5 text-gray-600">
                          {post.author}
                        </td>
                        <td className="py-3 px-5 text-gray-500">{post.date}</td>
                        <td className="py-3 px-5">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase ${post.status === 'published' ? 'bg-green-100 text-green-700' : post.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>

                            {post.status === 'published' ? 'PUBLIÉ' : post.status === 'scheduled' ? 'PLANIFIÉ' : 'BROUILLON'}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setPreviewArticle(post);
                                setShowArticlePreview(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors"
                              title="Aperçu">

                              <SearchIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openArticleModal(post)}
                              className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors"
                              title="Modifier">

                              <EditIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handlePublishToggle(post.id, post.status)
                              }
                              disabled={isProcessing === `publish-${post.id}`}
                              className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors disabled:opacity-50"
                              title={
                                post.status === 'published' ?
                                  'Dépublier' :
                                  'Publier'
                              }>

                              {isProcessing === `publish-${post.id}` ?
                                <Loader2Icon className="w-4 h-4 animate-spin" /> :
                                post.status === 'published' ?
                                  <EyeOffIcon className="w-4 h-4" /> :

                                  <EyeIcon className="w-4 h-4" />
                              }
                            </button>
                            <button
                              onClick={() => confirmDelete(post, 'blog')}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Supprimer">

                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 2: PORTFOLIO */}
        {activeTab === 'portfolio' &&
          <motion.div
            key="portfolio"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="space-y-6">

            <motion.div
              variants={fadeUp}
              className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">

              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                Projets du Portfolio
              </h3>
              <button
                onClick={() => openEntityModal('project')}
                className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">

                <PlusIcon className="w-4 h-4" /> Ajouter un Projet
              </button>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projectsData.map((project) =>
                <motion.div
                  key={project.id}
                  variants={fadeUp}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group">

                  <div className="h-40 relative overflow-hidden">
                    <img
                      src={project.images?.[0] || ''}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />

                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase shadow-sm ${project.status === 'Publié' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>

                        {project.status}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-montserrat font-bold text-globus-blue-dark">
                        {project.title}
                      </h4>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      {project.category} • {project.location}
                    </p>

                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">
                          Avancement affiché
                        </span>
                        <span className="font-bold text-globus-blue">
                          {project.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-globus-blue h-1.5 rounded-full"
                          style={{
                            width: `${project.progress}%`
                          }}>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <button
                        onClick={() => openEntityModal('project', project)}
                        className="text-sm font-semibold text-gray-500 hover:text-globus-blue flex items-center gap-1">
                        <EditIcon className="w-4 h-4" /> Modifier
                      </button>
                      <button
                        onClick={() => confirmDelete(project, 'project')}
                        className="text-sm font-semibold text-gray-400 hover:text-red-500 flex items-center gap-1">

                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        }

        {/* TAB 3: SERVICES */}
        {activeTab === 'services' &&
          <motion.div
            key="services"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="space-y-6">

            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

              <div className="flex justify-between items-center mb-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Services Proposés
                </h3>
                <button
                  onClick={() => openEntityModal('service')}

                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">

                  <PlusIcon className="w-4 h-4" /> Ajouter un Service
                </button>
              </div>

              <div className="space-y-3">
                {servicesData.map((service) =>
                  <div
                    key={service.id}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-white hover:border-globus-blue/50 transition-colors group">

                    <div className="cursor-grab text-gray-300 hover:text-gray-500">
                      <GripVerticalIcon className="w-5 h-5" />
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-globus-blue-dark flex items-center justify-center shrink-0">
                      <BriefcaseIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-montserrat font-bold text-gray-800">
                        {service.title}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {service.subtitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">
                        {'Actif'}
                      </span>
                      <button
                        onClick={() => openEntityModal('service', service)}
                        className="p-2 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors">
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => confirmDelete(service, 'service')}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">

                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 4: TEAM & TESTIMONIALS */}
        {activeTab === 'team' &&
          <motion.div
            key="team"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

              <div className="flex justify-between items-center mb-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Équipe Dirigeante
                </h3>
                <button
                  onClick={() => openEntityModal('team')}
                  className="text-sm font-semibold text-globus-blue hover:underline flex items-center gap-1">
                  <PlusIcon className="w-4 h-4" /> Ajouter
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {teamData.map((member) =>
                  <div
                    key={member.id}
                    className="border border-gray-100 rounded-lg p-4 text-center relative group hover:border-globus-blue/30 transition-colors">

                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={() => openEntityModal('team', member)}
                        className="p-1 text-gray-400 hover:text-globus-blue">
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => confirmDelete(member, 'team')}
                        className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="w-16 h-16 mx-auto rounded-full mb-3 flex items-center justify-center overflow-hidden bg-gray-200">
                      {member.photo ? (
                        <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <UsersIcon className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <h4 className="font-montserrat font-bold text-sm text-gray-800">
                      {member.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">{member.role}</p>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

              <div className="flex justify-between items-center mb-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Témoignages Clients
                </h3>
                <button
                  onClick={() => openEntityModal('testimonial')}
                  className="text-sm font-semibold text-globus-blue hover:underline flex items-center gap-1">
                  <PlusIcon className="w-4 h-4" /> Ajouter
                </button>
              </div>
              <div className="space-y-4">
                {testimonialsData.map((testi) =>
                  <div
                    key={testi.id}
                    className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">

                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        {testi.photo && (
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                            <img src={testi.photo} alt={testi.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-montserrat font-bold text-sm text-gray-800">
                            {testi.name}
                          </h4>
                          <p className="text-xs text-gray-500">{testi.project}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-400 text-sm">{'★'.repeat(testi.rating || 5)}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${testi.is_published !== false ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                          {testi.is_published !== false ? 'Publié' : 'Brouillon'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 italic">
                      "{testi.text}"
                    </p>
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => openEntityModal('testimonial', testi)}
                        className="text-xs font-semibold text-gray-500 hover:text-globus-blue">
                        Modifier
                      </button>
                      <button
                        onClick={() => confirmDelete(testi, 'testimonial')}
                        className="text-xs font-semibold text-gray-400 hover:text-red-500">
                        Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 5: FAQ & CONTACT */}
        {activeTab === 'faq' &&
          <motion.div
            key="faq"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

              <div className="flex justify-between items-center mb-4">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Foire Aux Questions
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEntityModal('faqCategory')}
                    className="text-xs font-semibold text-gray-500 hover:text-globus-blue border border-gray-200 px-2 py-1 rounded-lg flex items-center gap-1">
                    <PlusIcon className="w-3 h-3" /> Catégorie
                  </button>
                  <button
                    onClick={() => openEntityModal('faqItem')}
                    className="text-sm font-semibold text-globus-blue hover:underline flex items-center gap-1">
                    <PlusIcon className="w-4 h-4" /> Question
                  </button>
                </div>
              </div>

              {/* FAQ grouped by category */}
              <div className="space-y-4">
                {faqCategories.map((cat) => {
                  const catItems = faqItems.filter((f: any) => f.category_id === cat.id);
                  return (
                    <div key={cat.id} className="border border-gray-100 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="font-montserrat font-bold text-sm text-globus-blue-dark">{cat.name}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEntityModal('faqCategory', cat)}
                            className="p-1 text-gray-400 hover:text-globus-blue" title="Modifier">
                            <EditIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => confirmDelete(cat, 'faqCategory')}
                            className="p-1 text-gray-400 hover:text-red-500" title="Supprimer">
                            <Trash2Icon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {catItems.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-400 italic">Aucune question dans cette catégorie</p>
                      ) : (
                        catItems.map((faq: any) => (
                          <div key={faq.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors group">
                            <GripVerticalIcon className="w-4 h-4 text-gray-300 mt-0.5 cursor-grab shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-800 truncate">{faq.question}</p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">{faq.answer}</p>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                              <button
                                onClick={() => openEntityModal('faqItem', faq)}
                                className="p-1 text-gray-400 hover:text-globus-blue">
                                <EditIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => confirmDelete(faq, 'faqItem')}
                                className="p-1 text-gray-400 hover:text-red-500">
                                <Trash2Icon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
                {faqCategories.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Aucune catégorie FAQ. Commencez par en créer une.</p>
                )}
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-6 flex items-center gap-2">
                <MailIcon className="w-5 h-5 text-gray-400" />
                Soumissions Formulaire Contact
              </h3>
              <div className="space-y-3">
                {contactData.map((msg) =>
                  <div
                    key={msg.id}
                    className={`p-4 rounded-lg border ${msg.status === 'Nouveau' ? 'border-blue-200 bg-blue-50/30' : msg.status === 'Répondu' ? 'border-green-200 bg-green-50/30' : 'border-gray-100 bg-white'}`}>

                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        {msg.status === 'Nouveau' &&
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                        }
                        <h4 className="font-montserrat font-bold text-sm text-gray-800">
                          {msg.name}
                        </h4>
                      </div>
                      <span className="text-xs text-gray-500">{msg.date}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{msg.email}</p>
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      {msg.subject}
                    </p>
                    <div className="flex justify-between items-center">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${msg.status === 'Nouveau' ? 'bg-blue-100 text-blue-700' : msg.status === 'Répondu' ? 'bg-green-100 text-green-700' : msg.status === 'Lu' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                        {msg.status}
                      </span>
                      <button
                        onClick={() => {
                          setContactViewItem(msg);
                          setShowContactViewModal(true);
                        }}
                        className="text-xs font-semibold text-globus-blue hover:underline">
                        Voir le message
                      </button>
                    </div>
                  </div>
                )}
                {contactData.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Aucun message reçu.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 6: ACCUEIL & SECTIONS */}
        {activeTab === 'homepage' &&
          <motion.div
            key="homepage"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="space-y-4">

            {/* Hero Carousel */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <button
                onClick={() => toggleSection('hero')}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-globus-blue-dark flex items-center justify-center">
                    <PlayCircleIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Hero Carousel
                    </h3>
                    <p className="text-xs text-gray-500">
                      {heroSlidesData.length} slides • Vidéo d'intro:{' '}
                      {heroVideoData.duration}s
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'hero' ? 'rotate-180' : ''}`} />

              </button>
              {expandedSection === 'hero' &&
                <div className="p-5 border-t border-gray-100 space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-montserrat font-bold text-sm text-gray-700 mb-3">
                      Vidéo d'introduction
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          URL Vidéo
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={sf("hero_video_src")} onChange={e => setSf("hero_video_src", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                          <button
                            onClick={() => {
                              setMediaFilter('video');
                              setShowMediaPicker(true);
                              setMediaPickerCallback(
                                () => (url: string) => setSf("hero_video_src", url)
                              );
                            }}
                            className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0"
                            title="Choisir depuis la médiathèque">

                            <FolderOpenIcon className="w-4 h-4" />
                          </button>
                        </div>
                        {sf("hero_video_src") && (
                          <div className="mt-2 relative group rounded overflow-hidden">
                            <video src={sf("hero_video_src")} className="w-full h-24 object-cover border border-gray-200 bg-black" controls muted />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Image Poster
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={sf("hero_video_poster")} onChange={e => setSf("hero_video_poster", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                          <button
                            onClick={() => {
                              setMediaFilter('image');
                              setShowMediaPicker(true);
                              setMediaPickerCallback(
                                () => (url: string) => setSf("hero_video_poster", url)
                              );
                            }}
                            className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0"
                            title="Choisir depuis la médiathèque">

                            <FolderOpenIcon className="w-4 h-4" />
                          </button>
                        </div>
                        {sf("hero_video_poster") && (
                          <div className="mt-2">
                            <img src={sf("hero_video_poster")} alt="Poster" className="w-full h-24 object-cover rounded border border-gray-200" />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Durée (sec)
                        </label>
                        <input
                          type="number"
                          value={sf("hero_video_duration") || 6} onChange={e => setSf("hero_video_duration", e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <h4 className="font-montserrat font-bold text-sm text-gray-700">
                      Slides du Carousel
                    </h4>
                    <button
                      onClick={() => openEntityModal('heroSlide')}
                      className="text-sm font-semibold text-globus-orange hover:underline flex items-center gap-1">

                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                  </div>
                  <div className="space-y-3">
                    {heroSlidesData.map((slide) =>
                      <div
                        key={slide.id}
                        className="border border-gray-200 rounded-lg p-4 bg-white hover:border-globus-blue/30 transition-colors">

                        <div className="flex items-start gap-4">
                          <GripVerticalIcon className="w-5 h-5 text-gray-300 mt-1 cursor-grab shrink-0" />
                          <img
                            src={slide.image}
                            alt=""
                            className="w-20 h-14 object-cover rounded-lg shrink-0" />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-globus-orange/10 text-globus-orange rounded text-[10px] font-bold">
                                {slide.tag}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); heroSlidesCrud.update(slide.id, { ...slide, is_active: !slide.is_active }); }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${slide.is_active !== false ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                                title={slide.is_active !== false ? 'Désactiver' : 'Activer'}>
                                {slide.is_active !== false ? 'Actif' : 'Inactif'}
                              </button>
                            </div>
                            <h5 className="font-montserrat font-bold text-sm text-gray-800 truncate">
                              {slide.title}
                            </h5>
                            <p className="text-xs text-gray-500 truncate">
                              {slide.subtitle}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] text-gray-400">
                                CTA1: {slide.cta1_text}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                CTA2: {slide.cta2_text}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => openEntityModal('heroSlide', slide)}
                              className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded">

                              <EditIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => confirmDelete(slide, 'heroSlide')}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">

                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveGeneric}
                      disabled={isProcessing === 'save-generic'}
                      className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2 disabled:opacity-70">

                      {isProcessing === 'save-generic' ?
                        <>
                          <Loader2Icon className="w-4 h-4 animate-spin" />{' '}
                          Enregistrement...
                        </> :

                        <>
                          <SaveIcon className="w-4 h-4" /> Enregistrer
                        </>
                      }
                    </button>
                  </div>
                </div>
              }
            </motion.div>

            {/* Engagements Bar */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <button
                onClick={() => toggleSection('engagements')}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-globus-orange flex items-center justify-center">
                    <ShieldCheckIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Barre d'Engagements
                    </h3>
                    <p className="text-xs text-gray-500">
                      {engagementsData.length} engagements
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'engagements' ? 'rotate-180' : ''}`} />

              </button>
              {expandedSection === 'engagements' &&
                <div className="p-5 border-t border-gray-100 space-y-3">
                  {engagementsData.map((eng) =>
                    <div
                      key={eng.id}
                      className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-globus-blue/30 transition-colors">

                      <GripVerticalIcon className="w-5 h-5 text-gray-300 cursor-grab" />
                      <div className="flex-1">
                        <h4 className="font-montserrat font-bold text-sm text-gray-800">
                          {eng.title}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {eng.desc}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${eng.bg_color === 'bg-globus-blue' ? 'bg-blue-100 text-blue-700' : eng.bg_color === 'bg-globus-orange' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>

                        {eng.bg_color}
                      </span>
                      <button
                        onClick={() => openEntityModal('engagement', eng)}
                        className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded">

                        <EditIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() => openEntityModal('engagement')}
                      className="text-sm font-semibold text-globus-orange hover:underline flex items-center gap-1">
                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                    <button
                      onClick={handleSaveGeneric}
                      className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
              }
            </motion.div>

            {/* About Section */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <button
                onClick={() => toggleSection('about')}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-globus-blue flex items-center justify-center">
                    <FileTextIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Section À Propos
                    </h3>
                    <p className="text-xs text-gray-500">
                      Texte, points clés, badge, images
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'about' ? 'rotate-180' : ''}`} />

              </button>
              {expandedSection === 'about' &&
                <div className="p-5 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Paragraphe 1
                    </label>
                    <textarea
                      value={aboutForm?.paragraphs?.[0] || ""} onChange={e => setAboutForm((p:any) => ({...p, paragraphs: [e.target.value, p?.paragraphs?.[1]||""]}))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Paragraphe 2
                    </label>
                    <textarea
                      value={aboutForm?.paragraphs?.[1] || ""} onChange={e => setAboutForm((p:any) => ({...p, paragraphs: [p?.paragraphs?.[0]||"", e.target.value]}))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Badge
                    </label>
                    <input
                      type="text"
                      value={aboutForm?.badge_value || ""} onChange={e => setAboutForm((p:any) => ({...p, badge_value: e.target.value}))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Vidéo Source (URL)
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={aboutForm?.video_src || ""} onChange={e => setAboutForm((p:any) => ({...p, video_src: e.target.value}))}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                      <button
                        onClick={() => {
                          setMediaFilter('video');
                          setShowMediaPicker(true);
                          setMediaPickerCallback(() => (url: string) => setAboutForm((p:any) => ({...p, video_src: url})));
                        }}
                        className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors"
                        title="Choisir depuis la médiathèque">
                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Vidéo Poster (Image URL)
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={aboutForm?.video_poster || ""} onChange={e => setAboutForm((p:any) => ({...p, video_poster: e.target.value}))}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                      <button
                        onClick={() => {
                          setMediaFilter('image');
                          setShowMediaPicker(true);
                          setMediaPickerCallback(() => (url: string) => setAboutForm((p:any) => ({...p, video_poster: url})));
                        }}
                        className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors"
                        title="Choisir depuis la médiathèque">
                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Points Clés
                    </label>
                    {(aboutForm?.highlights || []).map((bp: string, i: number) =>
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-400 w-4">
                          {i + 1}.
                        </span>
                        <input
                          type="text"
                          value={bp}
                          onChange={e => {
                            const arr = [...(aboutForm?.highlights || [])];
                            arr[i] = e.target.value;
                            setAboutForm((p:any) => ({...p, highlights: arr}));
                          }}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue" />

                        <button 
                          onClick={() => {
                            const arr = [...(aboutForm?.highlights || [])];
                            arr.splice(i, 1);
                            setAboutForm((p:any) => ({...p, highlights: arr}));
                          }}
                          className="p-1 text-gray-400 hover:text-red-500">
                          <Trash2Icon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={() => setAboutForm((p:any) => ({...p, highlights: [...(p.highlights||[]), "Nouveau point"]}))}
                      className="text-xs text-globus-orange font-semibold hover:underline flex items-center gap-1 mt-1">
                      <PlusIcon className="w-3.5 h-3.5" /> Ajouter
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Images Carousel
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {(aboutForm?.images || []).map((img: string, i: number) =>
                        <div key={i} className="relative group">
                          <img
                            src={img}
                            alt=""
                            className="w-20 h-14 object-cover rounded-lg border border-gray-200" />

                          <button 
                            onClick={() => {
                              const arr = [...(aboutForm?.images || [])];
                              arr.splice(i, 1);
                              setAboutForm((p:any) => ({...p, images: arr}));
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <XIcon className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setMediaFilter('image');
                          setShowMediaPicker(true);
                          setMediaPickerCallback(
                            () => (url: string) => {
                              setAboutForm((p:any) => ({...p, images: [...(p?.images||[]), url]}));
                            }
                          );
                        }}
                        className="w-20 h-14 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-globus-orange hover:text-globus-orange transition-colors"
                        title="Choisir depuis la médiathèque">

                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveAbout}
                      className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
              }
            </motion.div>

            {/* Methodology */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <button
                onClick={() => toggleSection('methodology')}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                    <HashIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Méthodologie
                    </h3>
                    <p className="text-xs text-gray-500">
                      {methodologyData.length} étapes
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'methodology' ? 'rotate-180' : ''}`} />

              </button>
              {expandedSection === 'methodology' &&
                <div className="p-5 border-t border-gray-100 space-y-3">
                  {methodologyData.map((step) =>
                    <div
                      key={step.id}
                      className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-globus-blue/30 transition-colors">

                      <GripVerticalIcon className="w-5 h-5 text-gray-300 cursor-grab" />
                      <div className="w-8 h-8 rounded-full bg-globus-blue-dark flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-sm">
                          {step.id}
                        </span>
                      </div>
                      <img
                        src={step.image}
                        alt=""
                        className="w-16 h-12 object-cover rounded-lg shrink-0" />

                      <div className="flex-1 min-w-0">
                        <h4 className="font-montserrat font-bold text-sm text-gray-800">
                          {step.title}
                        </h4>
                        <p className="text-xs text-gray-500 truncate">
                          {step.desc}
                        </p>
                      </div>
                      <button
                        onClick={() => openEntityModal('methodology', step)}
                        className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded">

                        <EditIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() => openEntityModal('methodology')}
                      className="text-sm font-semibold text-globus-orange hover:underline flex items-center gap-1">
                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                    <button
                      onClick={handleSaveGeneric}
                      className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
              }
            </motion.div>

            {/* Stats Bar */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <button
                onClick={() => toggleSection('stats')}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                    <StarIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Barre de Statistiques
                    </h3>
                    <p className="text-xs text-gray-500">
                      {statsBarData.length} chiffres clés
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'stats' ? 'rotate-180' : ''}`} />

              </button>
              {expandedSection === 'stats' &&
                <div className="p-5 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {statsBarData.map((stat) =>
                      <div
                        key={stat.id}
                        className="border border-gray-200 rounded-lg p-4 text-center group relative">
                        <div className="text-2xl font-montserrat font-bold text-globus-blue-dark border-b border-gray-200 pb-2 mb-2">{stat.value}</div>
                        <div className="text-sm text-gray-500">{stat.label}</div>
                        
                        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEntityModal('stat', stat)}
                            className="p-1.5 bg-white text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded shadow-sm border border-gray-100">
                            <EditIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => confirmDelete(stat, 'stat')}
                            className="p-1.5 bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 rounded shadow-sm border border-gray-100">
                            <Trash2Icon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() => openEntityModal('stat')}
                      className="text-sm font-semibold text-globus-orange hover:underline flex items-center gap-1">
                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                    <button
                      onClick={handleSaveGeneric}
                      className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                      <SaveIcon className="w-4 h-4" /> Enregistrer ordre
                    </button>
                  </div>
                </div>
              }
            </motion.div>

            {/* Guarantees */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <button
                onClick={() => toggleSection('guarantees')}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                    <ShieldCheckIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Garanties
                    </h3>
                    <p className="text-xs text-gray-500">
                      {guaranteesData.length} garanties
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'guarantees' ? 'rotate-180' : ''}`} />

              </button>
              {expandedSection === 'guarantees' &&
                <div className="p-5 border-t border-gray-100 space-y-3">
                  {guaranteesData.map((g) =>
                    <div
                      key={g.id}
                      className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-globus-blue/30 transition-colors">

                      <GripVerticalIcon className="w-5 h-5 text-gray-300 cursor-grab" />
                      <div className="flex-1">
                        <h4 className="font-montserrat font-bold text-sm text-gray-800">
                          {g.title}
                        </h4>
                        <p className="text-xs text-gray-500">{g.desc}</p>
                      </div>
                      <button
                        onClick={() => openEntityModal('guarantee', g)}
                        className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded">

                        <EditIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() => openEntityModal('guarantee')}
                      className="text-sm font-semibold text-globus-orange hover:underline flex items-center gap-1">
                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                    <button
                      onClick={handleSaveGeneric}
                      className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
              }
            </motion.div>

            {/* Video Section */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <button
                onClick={() => toggleSection('video')}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center">
                    <VideoIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Section Vidéo
                    </h3>
                    <p className="text-xs text-gray-500">
                      YouTube + texte d'accroche
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'video' ? 'rotate-180' : ''}`} />

              </button>
              {expandedSection === 'video' &&
                <div className="p-5 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      URL YouTube (embed)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={sf("video_section_youtube_url")} onChange={e => setSf("video_section_youtube_url", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                      <button
                        onClick={() => {
                          setMediaFilter('video');
                          setShowMediaPicker(true);
                          setMediaPickerCallback(() => (url: string) => setSf("video_section_youtube_url", url));
                        }}
                        className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0"
                        title="Choisir depuis la médiathèque">

                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                    {sf("video_section_youtube_url") && (
                      <div className="mt-2 relative w-full aspect-video rounded overflow-hidden border border-gray-200">
                        <iframe 
                          src={sf("video_section_youtube_url")} 
                          className="w-full h-full" 
                          allowFullScreen />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Vidéo d'arrière-plan (URL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={sf("video_section_bg_video_src")} onChange={e => setSf("video_section_bg_video_src", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                      <button
                        onClick={() => {
                          setMediaFilter('video');
                          setShowMediaPicker(true);
                          setMediaPickerCallback(() => (url: string) => setSf("video_section_bg_video_src", url));
                        }}
                        className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0"
                        title="Choisir depuis la médiathèque">

                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                    {sf("video_section_bg_video_src") && (
                      <div className="mt-2 relative rounded overflow-hidden">
                        <video src={sf("video_section_bg_video_src")} className="w-full h-24 object-cover border border-gray-200 bg-black" controls muted />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Vidéo d'arrière-plan Poster (Image URL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={sf("video_section_bg_video_poster")} onChange={e => setSf("video_section_bg_video_poster", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                      <button
                        onClick={() => {
                          setMediaFilter('image');
                          setShowMediaPicker(true);
                          setMediaPickerCallback(() => (url: string) => setSf("video_section_bg_video_poster", url));
                        }}
                        className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0"
                        title="Choisir depuis la médiathèque">

                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                    {sf("video_section_bg_video_poster") && (
                      <div className="mt-2">
                        <img src={sf("video_section_bg_video_poster")} alt="Poster" className="h-20 rounded border border-gray-200 object-cover" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Titre
                      </label>
                      <input
                        type="text"
                        value={sf("video_section_title")} onChange={e => setSf("video_section_title", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Sous-titre
                      </label>
                      <input
                        type="text"
                        value={sf("video_section_subtitle")} onChange={e => setSf("video_section_subtitle", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveGeneric}
                      className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
              }
            </motion.div>

            {/* Partners */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <button
                onClick={() => toggleSection('partners')}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <HandshakeIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Partenaires
                    </h3>
                    <p className="text-xs text-gray-500">
                      {partnersData.length} partenaires
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'partners' ? 'rotate-180' : ''}`} />

              </button>
              {expandedSection === 'partners' &&
                <div className="p-5 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {partnersData.map((p) =>
                      <div
                        key={p.id}
                        className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full group cursor-pointer"
                        onClick={() => openEntityModal('partner', p)}>

                        <span className="text-sm font-semibold text-gray-700">
                          {p.name}
                        </span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); confirmDelete(p, 'partner'); }}
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => openEntityModal('partner')}
                      className="flex items-center gap-1 bg-globus-orange/10 text-globus-orange px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-globus-orange/20">

                      <PlusIcon className="w-3.5 h-3.5" /> Ajouter
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveGeneric}
                      className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                      <SaveIcon className="w-4 h-4" /> Enregistrer ordre
                    </button>
                  </div>
                </div>
              }
            </motion.div>

            {/* CTA Banner */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <button
                onClick={() => toggleSection('cta')}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-globus-orange flex items-center justify-center">
                    <TypeIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Bannière CTA
                    </h3>
                    <p className="text-xs text-gray-500">Appel à l'action</p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'cta' ? 'rotate-180' : ''}`} />

              </button>
              {expandedSection === 'cta' &&
                <div className="p-5 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Titre
                    </label>
                    <input
                      type="text"
                      value={sf("cta_title")} onChange={e => setSf("cta_title", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Sous-titre
                    </label>
                    <input
                      type="text"
                      value={sf("cta_subtitle")} onChange={e => setSf("cta_subtitle", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Texte du bouton
                      </label>
                      <input
                        type="text"
                        value={sf("cta_text")} onChange={e => setSf("cta_text", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Lien du bouton
                      </label>
                      <input
                        type="text"
                        value={sf("cta_href")} onChange={e => setSf("cta_href", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveGeneric}
                      className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
              }
            </motion.div>
          </motion.div>
        }

        {/* TAB 7: PARAMÈTRES SITE */}
        {activeTab === 'settings' &&
          <motion.div
            key="settings"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="space-y-6">

            <motion.div
              variants={fadeUp}
              className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">

              {[
                {
                  id: 'header',
                  label: 'En-tête',
                  icon: LayoutDashboardIcon
                },
                {
                  id: 'footer',
                  label: 'Pied de page',
                  icon: FileTextIcon
                },
                {
                  id: 'seo',
                  label: 'SEO & Méta',
                  icon: SearchIcon
                },
                {
                  id: 'social',
                  label: 'Réseaux Sociaux',
                  icon: LinkIcon
                }].
                map((t) =>
                  <button
                    key={t.id}
                    onClick={() => setActiveSettingsTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-montserrat font-semibold transition-colors whitespace-nowrap ${activeSettingsTab === t.id ? 'bg-globus-blue-dark text-white' : 'text-gray-500 hover:bg-gray-100'}`}>

                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                )}
            </motion.div>

            {activeSettingsTab === 'header' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Paramètres de l'En-tête
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    URL du Logo
                  </label>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={sf("logo")} onChange={e => setSf("logo", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                      <button
                        onClick={() => {
                          setMediaFilter('image');
                          setShowMediaPicker(true);
                          setMediaPickerCallback(
                            () => (url: string) =>
                              console.log('Selected:', url)
                          );
                        }}
                        className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors"
                        title="Choisir depuis la médiathèque">

                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <img
                      src={headerSettingsData.logoUrl}
                      alt="Logo"
                      className="h-10 bg-white border rounded p-1" />

                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      value={sf("phone")} onChange={e => setSf("phone", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email
                    </label>
                    <input
                      type="text"
                      value={sf("email")} onChange={e => setSf("email", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Horaires
                    </label>
                    <input
                      type="text"
                      value={sf("top_bar_text")} onChange={e => setSf("top_bar_text", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }

            {activeSettingsTab === 'footer' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Paramètres du Pied de Page
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Description entreprise
                  </label>
                  <textarea
                    value={sf("footer_description")} onChange={e => setSf("footer_description", e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Adresse
                    </label>
                    <input
                      type="text"
                      value={sf("address")} onChange={e => setSf("address", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      value={sf("phone")} onChange={e => setSf("phone", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email
                    </label>
                    <input
                      type="text"
                      value={sf("email")} onChange={e => setSf("email", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={true} onChange={() => {}}
                    className="w-4 h-4 accent-globus-orange" />

                  <span className="text-sm font-semibold text-gray-700">
                    Activer le formulaire Newsletter
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }

            {activeSettingsTab === 'seo' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  SEO & Métadonnées
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={sf("meta_title") || ""} onChange={e => setSf("meta_title", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Meta Description
                  </label>
                  <textarea
                    value={sf("meta_description") || ""} onChange={e => setSf("meta_description", e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Image OG
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sf("og_image") || ""} onChange={e => setSf("og_image", e.target.value)}
                      placeholder="https://..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    <button
                      onClick={() => {
                        setMediaFilter('image');
                        setShowMediaPicker(true);
                        setMediaPickerCallback(
                          () => (url: string) => console.log('Selected:', url)
                        );
                      }}
                      className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0"
                      title="Choisir depuis la médiathèque">

                      <FolderOpenIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }

            {activeSettingsTab === 'social' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Réseaux Sociaux
                </h3>
                {[
                  {
                    icon: FacebookIcon,
                    label: 'Facebook',
                    value: footerSettingsData.facebook,
                    color: 'text-[#4267B2]'
                  },
                  {
                    icon: TwitterIcon,
                    label: 'Twitter / X',
                    value: footerSettingsData.twitter,
                    color: 'text-[#1DA1F2]'
                  },
                  {
                    icon: LinkedinIcon,
                    label: 'LinkedIn',
                    value: footerSettingsData.linkedin,
                    color: 'text-[#0077b5]'
                  },
                  {
                    icon: InstagramIcon,
                    label: 'Instagram',
                    value: footerSettingsData.instagram,
                    color: 'text-[#E4405F]'
                  }].
                  map((s, i) =>
                    <div key={i} className="flex items-center gap-3">
                      <s.icon className={`w-6 h-6 ${s.color} shrink-0`} />
                      <label className="w-24 text-sm font-semibold text-gray-700 shrink-0">
                        {s.label}
                      </label>
                      <input
                        type="text"
                        defaultValue={s.value}
                        placeholder="https://..."
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                  )}
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }
          </motion.div>
        }

        {/* TAB 8: PAGES PUBLIQUES */}
        {activeTab === 'pages' &&
          <motion.div
            key="pages"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="space-y-6">

            <motion.div
              variants={fadeUp}
              className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">

              {[
                {
                  id: 'about',
                  label: 'Page À Propos'
                },
                {
                  id: 'contact',
                  label: 'Page Contact'
                },
                {
                  id: 'faqpage',
                  label: 'FAQ Complète'
                },
                {
                  id: 'helpcenter',
                  label: "Centre d'Aide"
                }].
                map((t) =>
                  <button
                    key={t.id}
                    onClick={() => setActivePagesTab(t.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-montserrat font-semibold transition-colors whitespace-nowrap ${activePagesTab === t.id ? 'bg-globus-blue-dark text-white' : 'text-gray-500 hover:bg-gray-100'}`}>

                    {t.label}
                  </button>
                )}
            </motion.div>

            {activePagesTab === 'about' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Page À Propos
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Image Hero Banner
                  </label>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={aboutForm?.hero_image || ""} onChange={e => setAboutForm((p:any) => ({...p, hero_image: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                      <button
                        onClick={() => {
                          setMediaFilter('image');
                          setShowMediaPicker(true);
                          setMediaPickerCallback(
                            () => (url: string) =>
                              console.log('Selected:', url)
                          );
                        }}
                        className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors"
                        title="Choisir depuis la médiathèque">

                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <img
                      src={aboutPageData.heroImage}
                      alt=""
                      className="h-12 rounded" />

                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Titre
                  </label>
                  <input
                    type="text"
                    value={aboutForm?.hero_title || ""} onChange={e => setAboutForm((p:any) => ({...p, hero_title: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Paragraphe 1
                  </label>
                  <textarea
                    value={aboutForm?.paragraphs?.[0] || ""} onChange={e => setAboutForm((p:any) => ({...p, paragraphs: [e.target.value, p?.paragraphs?.[1]||""]}))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Paragraphe 2
                  </label>
                  <textarea
                    value={aboutForm?.paragraphs?.[1] || ""} onChange={e => setAboutForm((p:any) => ({...p, paragraphs: [p?.paragraphs?.[0]||"", e.target.value]}))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Vidéo Source (URL)
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={aboutForm?.video_src || ""} onChange={e => setAboutForm((p:any) => ({...p, video_src: e.target.value}))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                    <button
                      onClick={() => {
                        setMediaFilter('video');
                        setShowMediaPicker(true);
                        setMediaPickerCallback(() => (url: string) => setAboutForm((p:any) => ({...p, video_src: url})));
                      }}
                      className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors"
                      title="Choisir depuis la médiathèque">
                      <FolderOpenIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Vidéo Poster (Image URL)
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={aboutForm?.video_poster || ""} onChange={e => setAboutForm((p:any) => ({...p, video_poster: e.target.value}))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                    <button
                      onClick={() => {
                        setMediaFilter('image');
                        setShowMediaPicker(true);
                        setMediaPickerCallback(() => (url: string) => setAboutForm((p:any) => ({...p, video_poster: url})));
                      }}
                      className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors"
                      title="Choisir depuis la médiathèque">
                      <FolderOpenIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">
                    Valeurs ({(aboutForm?.values || []).length})
                  </label>
                  {(aboutForm?.values || []).map((v: any, i: number) =>
                    <div
                      key={i}
                      className="flex gap-3 mb-3 p-3 border border-gray-200 rounded-lg">

                      <div className="flex-1">
                        <input
                          type="text"
                          value={v.title}
                          onChange={e => {
                            const arr = [...(aboutForm?.values || [])];
                            arr[i] = { ...arr[i], title: e.target.value };
                            setAboutForm((p:any) => ({...p, values: arr}));
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mb-1 focus:outline-none focus:border-globus-blue font-semibold" />

                        <input
                          type="text"
                          value={v.desc}
                          onChange={e => {
                            const arr = [...(aboutForm?.values || [])];
                            arr[i] = { ...arr[i], desc: e.target.value };
                            setAboutForm((p:any) => ({...p, values: arr}));
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue" />

                      </div>
                      <button 
                        onClick={() => {
                          const arr = [...(aboutForm?.values || [])];
                          arr.splice(i, 1);
                          setAboutForm((p:any) => ({...p, values: arr}));
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 self-center">
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={() => setAboutForm((p:any) => ({...p, values: [...(p.values||[]), {title: "Nouvelle valeur", desc: "Description...", iconKey: "StarIcon"}]}))}
                    className="text-xs text-globus-orange font-semibold hover:underline flex items-center gap-1 mt-1">
                    <PlusIcon className="w-3.5 h-3.5" /> Ajouter
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">
                    Certifications ({(aboutForm?.certifications || []).length})
                  </label>
                  {(aboutForm?.certifications || []).map((c: string, i: number) =>
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <CheckCircle2Icon className="w-4 h-4 text-globus-orange shrink-0" />
                      <input
                        type="text"
                        value={c}
                        onChange={e => {
                          const arr = [...(aboutForm?.certifications || [])];
                          arr[i] = e.target.value;
                          setAboutForm((p:any) => ({...p, certifications: arr}));
                        }}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue" />

                      <button 
                        onClick={() => {
                          const arr = [...(aboutForm?.certifications || [])];
                          arr.splice(i, 1);
                          setAboutForm((p:any) => ({...p, certifications: arr}));
                        }}
                        className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={() => setAboutForm((p:any) => ({...p, certifications: [...(p.certifications||[]), "Nouvelle certification"]}))}
                    className="text-xs text-globus-orange font-semibold hover:underline flex items-center gap-1 mt-1">
                    <PlusIcon className="w-3.5 h-3.5" /> Ajouter
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveAbout}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }

            {activePagesTab === 'contact' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Page Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Adresse
                    </label>
                    <textarea
                      value={sf("contact_address")} onChange={e => setSf("contact_address", e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Tél. Standard
                      </label>
                      <input
                        type="text"
                        value={sf("contact_phone") || sf("phone")} onChange={e => setSf("contact_phone", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        WhatsApp
                      </label>
                      <input
                        type="text"
                        value={sf("contact_whatsapp")} onChange={e => setSf("contact_whatsapp", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email Contact
                    </label>
                    <input
                      type="text"
                      value={sf("contact_email")} onChange={e => setSf("contact_email", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email Devis
                    </label>
                    <input
                      type="text"
                      value={sf("email")} onChange={e => setSf("email", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Horaires semaine
                    </label>
                    <input
                      type="text"
                      value={sf("contact_hours")} onChange={e => setSf("contact_hours", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Horaires samedi
                    </label>
                    <input
                      type="text"
                      value={""} onChange={() => {}}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    URL Google Maps (embed)
                  </label>
                  <input
                    type="text"
                    value={sf("contact_map_embed_url")} onChange={e => setSf("contact_map_embed_url", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">
                    Options formulaire
                  </label>
                  {contactPageData.formSubjects.map((s, i) =>
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400 w-4">
                        {i + 1}.
                      </span>
                      <input
                        type="text"
                        defaultValue={s}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue" />

                      <button className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <button className="text-xs text-globus-orange font-semibold hover:underline flex items-center gap-1 mt-1">
                    <PlusIcon className="w-3.5 h-3.5" /> Ajouter
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }

            {activePagesTab === 'faqpage' &&
              <motion.div variants={fadeUp} className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    FAQ Complète —{' '}
                    {faqPageData.reduce((acc, c) => acc + c.items.length, 0)}{' '}
                    questions
                  </h3>
                  <button
                    onClick={() => showToast('Catégorie ajoutée', 'info')}
                    className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2">

                    <PlusIcon className="w-4 h-4" /> Catégorie
                  </button>
                </div>
                {faqPageData.map((cat) =>
                  <div
                    key={cat.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">

                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-montserrat font-bold text-globus-blue-dark flex items-center gap-2">
                        <div className="w-2 h-5 bg-globus-orange rounded-full"></div>
                        {cat.category}
                      </h4>
                      <button className="text-xs text-globus-orange font-semibold hover:underline flex items-center gap-1">
                        <PlusIcon className="w-3.5 h-3.5" /> Question
                      </button>
                    </div>
                    <div className="space-y-2">
                      {cat.items.map((item, idx) =>
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group">

                          <GripVerticalIcon className="w-4 h-4 text-gray-300 mt-1 cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-800">
                              {item.q}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {item.a}
                            </p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                            <button className="p-1 text-gray-400 hover:text-globus-blue">
                              <EditIcon className="w-4 h-4" />
                            </button>
                            <button className="p-1 text-gray-400 hover:text-red-500">
                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            }

            {activePagesTab === 'helpcenter' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Centre d'Aide
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email Support
                    </label>
                    <input
                      type="text"
                      value={sf("contact_email")} onChange={e => setSf("contact_email", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Numéro WhatsApp
                    </label>
                    <input
                      type="text"
                      value={sf("contact_whatsapp")} onChange={e => setSf("contact_whatsapp", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Description carte FAQ
                  </label>
                  <textarea
                    value={"Trouvez des r\u00e9ponses imm\u00e9diates."} onChange={() => {}}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Description carte WhatsApp
                  </label>
                  <textarea
                    value={"Discutez en direct."} onChange={() => {}}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Description carte Email
                  </label>
                  <textarea
                    value={"R\u00e9ponse sous 24h."} onChange={() => {}}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }
          </motion.div>
        }

        {/* TAB 9: PAGES LÉGALES */}
        {activeTab === 'legal' &&
          <motion.div
            key="legal"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="space-y-6">

            <motion.div
              variants={fadeUp}
              className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">

              {[
                {
                  id: 'legalNotice',
                  label: 'Mentions Légales'
                },
                {
                  id: 'privacy',
                  label: 'Confidentialité'
                },
                {
                  id: 'terms',
                  label: 'Termes & Conditions'
                },
                {
                  id: 'cookies',
                  label: 'Cookies'
                }].
                map((t) =>
                  <button
                    key={t.id}
                    onClick={() => setActiveLegalTab(t.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-montserrat font-semibold transition-colors whitespace-nowrap ${activeLegalTab === t.id ? 'bg-globus-blue-dark text-white' : 'text-gray-500 hover:bg-gray-100'}`}>

                    {t.label}
                  </button>
                )}
            </motion.div>

            {activeLegalTab === 'legalNotice' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Mentions Légales
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    MAJ: {legalPagesData.legalNotice.last_updated}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Dénomination
                    </label>
                    <input
                      type="text"
                      value={legalPages["legalNotice"]?.company_name || ""} readOnly
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Forme juridique
                    </label>
                    <input
                      type="text"
                      value={legalPages["legalNotice"]?.legal_form || ""} readOnly
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      RCCM
                    </label>
                    <input
                      type="text"
                      value={legalPages["legalNotice"]?.rccm || ""} readOnly
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Directeur
                    </label>
                    <input
                      type="text"
                      value={legalPages["legalNotice"]?.director || ""} readOnly
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Siège social
                  </label>
                  <input
                    type="text"
                    value={legalPages["legalNotice"]?.address || ""} readOnly
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Contact
                  </label>
                  <input
                    type="text"
                    value={legalPages["legalNotice"]?.contact || ""} readOnly
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                </div>
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="font-montserrat font-bold text-sm text-gray-700 mb-3">
                    Hébergeur
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Nom
                      </label>
                      <input
                        type="text"
                        value={legalPages["legalNotice"]?.host_name || ""} readOnly
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Adresse
                      </label>
                      <input
                        type="text"
                        value={legalPages["legalNotice"]?.host_address || ""} readOnly
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Contenu complémentaire
                  </label>
                  <textarea
                    rows={5}
                    defaultValue="L'ensemble de ce site relève de la législation internationale sur le droit d'auteur et la propriété intellectuelle. Tous les droits de reproduction sont réservés."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Date MAJ
                  </label>
                  <input
                    type="text"
                    value={legalPages["legalNotice"]?.last_updated || "-"} readOnly
                    className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }

            {activeLegalTab === 'privacy' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Politique de Confidentialité
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    MAJ: {legalPagesData.privacyPolicy.last_updated}
                  </span>
                </div>
                {[
                  '1. Données collectées',
                  '2. Finalité du traitement',
                  '3. Base légale et durée',
                  '4. Droits des utilisateurs',
                  '5. Sécurité et Contact DPO'].
                  map((title, i) =>
                    <div key={i}>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        {title}
                      </label>
                      <textarea
                        rows={4}
                        defaultValue={`Contenu de la section "${title}" — modifiable depuis le CMS.`}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                    </div>
                  )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Date MAJ
                  </label>
                  <input
                    type="text"
                    value={legalPages["privacy"]?.last_updated || "-"} readOnly
                    className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }

            {activeLegalTab === 'terms' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Termes & Conditions
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    MAJ: {legalPagesData.terms.last_updated}
                  </span>
                </div>
                {[
                  '1. Objet',
                  '2. Acceptation des CGU',
                  '3. Services et Devis',
                  '4. Responsabilités',
                  '5. Droit applicable'].
                  map((title, i) =>
                    <div key={i}>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        {title}
                      </label>
                      <textarea
                        rows={4}
                        defaultValue={`Contenu de la section "${title}" — modifiable depuis le CMS.`}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                    </div>
                  )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Date MAJ
                  </label>
                  <input
                    type="text"
                    value={legalPages["terms"]?.last_updated || "-"} readOnly
                    className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }

            {activeLegalTab === 'cookies' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Politique des Cookies
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    MAJ: {legalPagesData.cookiePolicy.last_updated}
                  </span>
                </div>
                {[
                  "1. Qu'est-ce qu'un cookie ?",
                  '2. Cookies utilisés',
                  '3. Gestion des cookies',
                  '4. Durée de conservation'].
                  map((title, i) =>
                    <div key={i}>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        {title}
                      </label>
                      <textarea
                        rows={4}
                        defaultValue={`Contenu de la section "${title}" — modifiable depuis le CMS.`}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                    </div>
                  )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Date MAJ
                  </label>
                  <input
                    type="text"
                    value={legalPages["cookies"]?.last_updated || "-"} readOnly
                    className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
            }
          </motion.div>
        }

        {/* TAB 10: MÉDIATHÈQUE */}
        {activeTab === 'media' &&
          <motion.div
            key="media"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="space-y-6">

            <motion.div
              variants={fadeUp}
              className="grid grid-cols-1 sm:grid-cols-4 gap-4">

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Total Fichiers
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-globus-blue-dark">
                    {mediaData.length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <FolderOpenIcon className="w-5 h-5 text-globus-blue" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Images
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-blue-600">
                    {mediaData.filter((m) => m.type === 'image').length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Vidéos
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-purple-600">
                    {mediaData.filter((m) => m.type === 'video').length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <VideoIcon className="w-5 h-5 text-purple-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Documents
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-orange-600">
                    {mediaData.filter((m) => m.type === 'document').length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                  <FileIcon className="w-5 h-5 text-orange-500" />
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

              <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row gap-4 justify-between items-center">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                  <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un fichier..."
                      value={mediaSearch}
                      onChange={(e) => setMediaSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-globus-blue" />

                  </div>
                  <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto hide-scrollbar">
                    {[
                      {
                        id: 'all',
                        label: 'Tous'
                      },
                      {
                        id: 'image',
                        label: 'Images'
                      },
                      {
                        id: 'video',
                        label: 'Vidéos'
                      }].
                      map((f) =>
                        <button
                          key={f.id}
                          onClick={() => setMediaFilter(f.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${mediaFilter === f.id ? 'bg-gray-100 text-globus-blue-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>

                          {f.label}
                        </button>
                      )}
                  </div>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*,.pdf,.doc,.docx" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 text-sm whitespace-nowrap">

                  <PlusIcon className="w-4 h-4" /> Ajouter un fichier
                </button>
              </div>

              <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-white hover:bg-gray-50 hover:border-globus-blue/50 transition-colors cursor-pointer">
                  <UploadCloudIcon className="w-10 h-10 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-700 font-semibold mb-1 text-center">
                    Glissez vos fichiers ici ou cliquez pour parcourir
                  </p>
                  <p className="text-xs text-gray-400 text-center">
                    Images, Vidéos, Audio, Documents (Max 50MB)
                  </p>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {mediaData.
                    filter(
                      (m) => mediaFilter === 'all' || m.type === mediaFilter
                    ).
                    filter((m) =>
                      m.name.toLowerCase().includes(mediaSearch.toLowerCase())
                    ).
                    map((media) =>
                      <div
                        key={media.id}
                        className="group border border-gray-200 rounded-xl overflow-hidden bg-white hover:border-globus-blue/30 hover:shadow-md transition-all">

                        <div className="h-32 bg-gray-100 relative flex items-center justify-center overflow-hidden">
                          {media.type === 'image' ?
                            <img
                              src={media.url}
                              alt={media.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> :

                            media.type === 'video' ?
                              <div className="w-full h-full flex items-center justify-center">
                                <VideoIcon className="w-12 h-12 text-gray-400" />
                              </div> :

                              <div className="w-full h-full flex items-center justify-center">
                                <FileIcon className="w-12 h-12 text-gray-400" />
                              </div>
                          }
                          <div className="absolute top-2 right-2">
                            <button
                              onClick={() => {
                                setEditItem(media);
                                setShowEditModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors">

                              <EditIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="p-3">
                          <h4 className="font-montserrat font-bold text-sm text-gray-800 truncate">
                            {media.name}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {media.size}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {media.uploadDate}
                          </p>
                          <div className="flex gap-1 mt-2">
                            <span className="text-xs text-gray-400">
                              {media.usageCount} utilisations
                            </span>
                            <span className="text-xs text-gray-400">
                              {media.type === 'image' ?
                                'Image' :
                                media.type === 'video' ?
                                  'Vidéo' :
                                  'Document'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 11: SEO & TRACKING */}
        {activeTab === 'seo' &&
          <motion.div
            key="seo"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={stagger}
            className="space-y-6">

            <motion.div
              variants={fadeUp}
              className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">

              {[
                {
                  id: 'pages',
                  label: 'SEO par Page',
                  icon: GlobeIcon
                },
                {
                  id: 'schema',
                  label: 'Schema.org',
                  icon: CodeIcon
                },
                {
                  id: 'tracking',
                  label: 'Tracking & Analytics',
                  icon: BarChart3Icon
                },
                {
                  id: 'sitemap',
                  label: 'Sitemap XML',
                  icon: MapIcon
                }].
                map((t) =>
                  <button
                    key={t.id}
                    onClick={() => setActiveSeoTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-montserrat font-semibold transition-colors whitespace-nowrap ${activeSeoTab === t.id ? 'bg-globus-blue-dark text-white' : 'text-gray-500 hover:bg-gray-100'}`}>

                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                )}
            </motion.div>

            {activeSeoTab === 'pages' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    SEO par Page
                  </h3>
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Tout Enregistrer
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-montserrat font-bold text-gray-500 uppercase">
                        <th className="py-3 px-4">Page</th>
                        <th className="py-3 px-4">Chemin</th>
                        <th className="py-3 px-4">Titre SEO</th>
                        <th className="py-3 px-4">Statut</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm font-opensans">
                      {[
                        { id: '1', page: 'Accueil', path: '/', title: 'Globus BTP — Construction Clé en Main', status: 'Configuré' },
                        { id: '2', page: 'À Propos', path: '/a-propos', title: 'Qui Sommes-Nous — Globus BTP', status: 'Configuré' },
                        { id: '3', page: 'Services', path: '/services', title: 'Nos Services — Globus BTP', status: 'Configuré' },
                        { id: '4', page: 'Projets', path: '/projets', title: 'Réalisations — Globus BTP', status: 'Configuré' },
                        { id: '5', page: 'Blog', path: '/blog', title: 'Blog & Actualités — Globus BTP', status: 'Configuré' },
                        { id: '6', page: 'Contact', path: '/contact', title: 'Contactez-Nous — Globus BTP', status: 'Configuré' },
                        { id: '7', page: 'FAQ', path: '/faq', title: 'Questions Fréquentes — Globus BTP', status: 'Configuré' },
                      ].map((page) =>
                        <tr
                          key={page.id}
                          className="hover:bg-gray-50 transition-colors">

                          <td className="py-3 px-4 font-semibold text-gray-800">
                            {page.page}
                          </td>
                          <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                            {page.path}
                          </td>
                          <td className="py-3 px-4 text-gray-600 truncate max-w-[200px]">
                            {page.title}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">
                              {page.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setEditItem(page);
                                setShowEditModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors"
                              title="Modifier">

                              <EditIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            }

            {activeSeoTab === 'schema' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Données Structurées (Schema.org LocalBusiness)
                  </h3>
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Nom de l'entreprise
                      </label>
                      <input
                        type="text"
                        defaultValue="Globus Engineering SARL"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        defaultValue="Votre partenaire de confiance pour la construction BTP clé en main au Cameroun."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />

                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Téléphone
                        </label>
                        <input
                          type="text"
                          defaultValue="+33 1 23 45 67 89"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Email
                        </label>
                        <input
                          type="text"
                          defaultValue="contact@globus-btp.com"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Adresse complète
                      </label>
                      <input
                        type="text"
                        defaultValue="123 Avenue de la Construction"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue mb-2"
                        placeholder="Rue" />

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          defaultValue="Douala"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue"
                          placeholder="Ville" />

                        <input
                          type="text"
                          defaultValue="CM"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue"
                          placeholder="Pays (Code)" />

                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Latitude
                        </label>
                        <input
                          type="text"
                          defaultValue="4.0511"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Longitude
                        </label>
                        <input
                          type="text"
                          defaultValue="9.7679"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Horaires d'ouverture
                      </label>
                      <input
                        type="text"
                        defaultValue="Mo-Fr 08:00-18:00, Sa 09:00-13:00"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                  </div>
                </div>
              </motion.div>
            }

            {activeSeoTab === 'tracking' &&
              <motion.div variants={fadeUp} className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Tracking & Analytics
                  </h3>
                  <button
                    onClick={handleSaveGeneric}
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <SaveIcon className="w-4 h-4" /> Tout Enregistrer
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* GA */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <BarChart3Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">
                            Google Analytics
                          </h4>
                          <p className="text-xs text-gray-500">gtag.js</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          defaultChecked />

                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Measurement ID
                      </label>
                      <input
                        type="text"
                        defaultValue="G-DEMO123456"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                  </div>
                  {/* GTM */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <TagIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">
                            Google Tag Manager
                          </h4>
                          <p className="text-xs text-gray-500">Container ID</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          defaultChecked />

                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Container ID
                      </label>
                      <input
                        type="text"
                        defaultValue="GTM-DEMO123"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                  </div>
                  {/* FB Pixel */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <FacebookIcon className="w-5 h-5 text-[#1877F2]" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">
                            Facebook Pixel
                          </h4>
                          <p className="text-xs text-gray-500">Meta Ads</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          defaultChecked />

                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Pixel ID
                      </label>
                      <input
                        type="text"
                        defaultValue="123456789"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                  </div>
                  {/* TikTok Pixel */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <span className="font-bold text-lg">🎵</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">
                            TikTok Pixel
                          </h4>
                          <p className="text-xs text-gray-500">TikTok Ads</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          defaultChecked />

                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Pixel ID
                      </label>
                      <input
                        type="text"
                        defaultValue="DEMO123"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />

                    </div>
                  </div>
                </div>
              </motion.div>
            }

            {activeSeoTab === 'sitemap' &&
              <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Sitemap XML
                  </h3>
                  <button
                    onClick={() =>
                      showToast('Sitemap régénéré avec succès', 'success')
                    }
                    className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">

                    <RefreshCwIcon className="w-4 h-4" /> Régénérer le Sitemap
                  </button>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-green-400 font-mono text-xs">
                    {`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.globus-btp.com/</loc>
    <lastmod>2026-03-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.globus-btp.com/a-propos</loc>
    <lastmod>2026-03-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- ... autres pages ... -->
</urlset>`}
                  </pre>
                </div>
              </motion.div>
            }
          </motion.div>
        }
      </AnimatePresence>

      {/* Media Picker Modal */}
      <AnimatePresence>
        {showMediaPicker &&
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.95
              }}
              animate={{
                opacity: 1,
                scale: 1
              }}
              exit={{
                opacity: 0,
                scale: 0.95
              }}
              className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}>

              <div className="bg-globus-blue-dark p-4 flex justify-between items-center shrink-0">
                <h3 className="text-white font-montserrat font-bold text-lg flex items-center gap-2">
                  <FolderOpenIcon className="w-5 h-5" /> Sélectionner depuis la
                  Médiathèque
                </h3>
                <button
                  onClick={() => {
                    setShowMediaPicker(false);
                    setMediaPickerCallback(null);
                  }}
                  className="text-white/70 hover:text-white transition-colors">

                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50 shrink-0">
                <div className="relative w-full sm:w-64">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-globus-blue" />

                </div>
                <div className="flex bg-white border border-gray-200 p-1 rounded-lg w-full sm:w-auto overflow-x-auto hide-scrollbar">
                  {[
                    {
                      id: 'all',
                      label: 'Tous'
                    },
                    {
                      id: 'image',
                      label: 'Images'
                    },
                    {
                      id: 'video',
                      label: 'Vidéos'
                    }].
                    map((f) =>
                      <button
                        key={f.id}
                        onClick={() => setMediaFilter(f.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${mediaFilter === f.id ? 'bg-gray-100 text-globus-blue-dark' : 'text-gray-500 hover:text-gray-700'}`}>

                        {f.label}
                      </button>
                    )}
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 bg-gray-50/30">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {mediaData.
                    filter(
                      (m) => mediaFilter === 'all' || m.type === mediaFilter
                    ).
                    filter((m) =>
                      m.name.toLowerCase().includes(mediaSearch.toLowerCase())
                    ).
                    map((media) =>
                      <div
                        key={media.id}
                        onClick={() => {
                          if (mediaPickerCallback) {
                            mediaPickerCallback(media.url);
                          }
                          setShowMediaPicker(false);
                          setMediaPickerCallback(null);
                          showToast('Fichier sélectionné avec succès');
                        }}
                        className="group border border-gray-200 rounded-xl overflow-hidden bg-white hover:border-globus-orange hover:ring-2 hover:ring-globus-orange/50 hover:shadow-md transition-all cursor-pointer">

                        <div className="h-28 bg-gray-100 relative flex items-center justify-center overflow-hidden">
                          {media.type === 'image' ?
                            <img
                              src={media.thumbnail}
                              alt={media.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> :

                            media.type === 'video' ?
                              <>
                                <img
                                  src={media.thumbnail}
                                  alt={media.name}
                                  className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-300" />

                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                                    <PlayCircleIcon className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              </> :
                              media.type === 'document' ?
                                <FileIcon className="w-10 h-10 text-gray-400 group-hover:text-globus-orange transition-colors" /> :

                                <MusicIcon className="w-10 h-10 text-gray-400 group-hover:text-globus-orange transition-colors" />
                          }
                        </div>
                        <div className="p-2">
                          <h4
                            className="text-[11px] font-bold text-gray-800 truncate mb-1"
                            title={media.name}>

                            {media.name}
                          </h4>
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${media.type === 'image' ? 'bg-blue-100 text-blue-700' : media.type === 'video' ? 'bg-purple-100 text-purple-700' : media.type === 'document' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>

                              {media.type}
                            </span>
                            <span className="text-[9px] text-gray-500 font-medium">
                              {media.size}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>

      {/* ── CRUD Modals ───────────────────────────────────────── */}
      <ArticleModal
        show={showArticleModal} onClose={() => { setShowArticleModal(false); setEditItem(null); setFormData({}); }}
        formData={formData} setFormData={setFormData} onSave={handleSaveArticle}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-article'}
        onPickMedia={() => {
          setMediaFilter('image');
          setShowMediaPicker(true);
          setMediaPickerCallback(() => (url: string) => {
            setFormData((prev: any) => ({ ...prev, image: url }));
          });
        }} />

      <ArticlePreviewModal
        show={showArticlePreview}
        onClose={() => { setShowArticlePreview(false); setPreviewArticle(null); }}
        article={previewArticle} />

      <ProjectModal
        show={showProjectModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'}
        onPickMedia={(callback) => {
          setMediaFilter('image');
          setShowMediaPicker(true);
          setMediaPickerCallback(() => callback);
        }} />

      <ServiceModal
        show={showServiceModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'}
        onPickMedia={(callback) => {
          setMediaFilter('image');
          setShowMediaPicker(true);
          setMediaPickerCallback(() => callback);
        }} />

      <TeamModal
        show={showTeamModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'}
        onPickMedia={(callback) => {
          setMediaFilter('image');
          setShowMediaPicker(true);
          setMediaPickerCallback(() => callback);
        }} />

      <TestimonialModal
        show={showTestimonialModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'}
        onPickMedia={(callback) => {
          setMediaFilter('image');
          setShowMediaPicker(true);
          setMediaPickerCallback(() => callback);
        }} />

      <PartnerModal
        show={showPartnerModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'} />

      <FaqItemModal
        show={showFaqItemModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'}
        categories={faqCategories.map(c => ({ id: c.id, name: c.name }))} />

      <FaqCategoryModal
        show={showFaqCategoryModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'} />

      <HeroSlideModal
        show={showHeroSlideModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'}
        onPickMedia={(callback) => {
          setMediaFilter('image');
          setShowMediaPicker(true);
          setMediaPickerCallback(() => callback);
        }} />

      <EngagementModal
        show={showEngagementModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'} />

      <MethodologyStepModal
        show={showMethodologyModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'}
        onPickMedia={(callback) => {
          setMediaFilter('image');
          setShowMediaPicker(true);
          setMediaPickerCallback(() => callback);
        }} />

      <GuaranteeModal
        show={showGuaranteeModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'} />

      <StatModal
        show={showStatModal} onClose={closeEntityModal}
        formData={formData} setFormData={setFormData} onSave={handleSaveEntity}
        isEdit={!!editItem?.id} loading={isProcessing === 'save-entity'} />

      <DeleteConfirmModal
        show={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setItemToDelete(null); setDeleteEntityType(''); }}
        onConfirm={handleDelete}
        loading={isProcessing === 'delete'}
        itemName={itemToDelete?.title || itemToDelete?.name || itemToDelete?.question || ''} />

      <ContactMessageModal
        show={showContactViewModal}
        onClose={() => { setShowContactViewModal(false); setContactViewItem(null); setReplyText(''); }}
        message={contactViewItem}
        replyText={replyText}
        setReplyText={setReplyText}
        onMarkRead={async () => {
          if (contactViewItem) {
            await markContactRead(contactViewItem.id);
            setContactViewItem((prev: any) => prev ? { ...prev, status: 'Lu', is_read: true } : prev);
          }
        }}
        onReply={async () => {
          if (contactViewItem && replyText.trim()) {
            setIsReplying(true);
            try {
              await replyContact(contactViewItem.id, replyText);
              setContactViewItem((prev: any) => prev ? { ...prev, status: 'Répondu', replied: true, is_read: true } : prev);
              setReplyText('');
            } catch (e) { console.error('Reply failed:', e); }
            setIsReplying(false);
          }
        }}
        isReplying={isReplying} />

    </div>);

}