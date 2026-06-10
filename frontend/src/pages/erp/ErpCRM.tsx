import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate } from '../../utils/datetime';
import {
  TargetIcon,
  CalculatorIcon,
  PlusIcon,
  DownloadIcon,
  CopyIcon,
  PencilIcon,
  UserIcon,
  CalendarIcon,
  PercentIcon,
  XIcon,
  CheckCircle2Icon,
  Loader2Icon,
  Trash2Icon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  HistoryIcon,
  GitBranchIcon } from
'lucide-react';
import {
  useLeads, useCreateLead, useConvertLead, useUpdateLead, useDeleteLead,
  useQuotes, useCreateQuote, useUpdateQuote, useReviseQuote, useQuoteVersions,
  useProjectTemplates,
} from '../../hooks/useErp';
import { ExportButton } from '../../components/ui/ExportButton';
import { exportLeadsXlsx, downloadQuotePdf } from '../../services/api/downloads';
import { EmptyState } from '../../components/ui/EmptyState';
// Pipeline column skeleton (metadata only — lead items come from the API).
const PIPELINE_COLUMNS = [
  { id: 'prospect', label: 'PROSPECT', color: 'border-t-gray-400', bg: 'bg-gray-50', items: [] as any[] },
  { id: 'qualification', label: 'QUALIFICATION', color: 'border-t-blue-500', bg: 'bg-blue-50/30', items: [] as any[] },
  { id: 'devis', label: 'DEVIS ENVOYÉ', color: 'border-t-globus-orange', bg: 'bg-orange-50/30', items: [] as any[] },
  { id: 'nego', label: 'NÉGOCIATION', color: 'border-t-purple-500', bg: 'bg-purple-50/30', items: [] as any[] },
  { id: 'won', label: 'GAGNÉ', color: 'border-t-emerald-500', bg: 'bg-emerald-50/30', items: [] as any[] },
];


const fmt = (v: number) =>
new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0
}).format(v) + ' FCFA';
const fmtShort = (v: number) => {
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace('.0', '') + 'M FCFA';
  return fmt(v);
};
// Map backend pipeline status → UI column id
const STATUS_TO_COL: Record<string, string> = {
  NOUVEAU: 'prospect',
  QUALIFICATION: 'qualification',
  DEVIS: 'devis',
  NEGOCIATION: 'nego',
  GAGNE: 'won',
  PERDU: 'lost',
};
const COL_TO_STATUS: Record<string, string> = {
  prospect: 'NOUVEAU',
  qualification: 'QUALIFICATION',
  devis: 'DEVIS',
  nego: 'NEGOCIATION',
  won: 'GAGNE',
  lost: 'PERDU',
};

function leadToCard(lead: any) {
  return {
    id: lead.id,
    name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.company || lead.email,
    project: lead.project_type || '',
    budget: lead.quote_amount || 0,
    source: lead.source || 'website',
    date: formatDate(lead.created_at),
    prob: { NOUVEAU: 20, QUALIFICATION: 40, DEVIS: 60, NEGOCIATION: 80, GAGNE: 100, PERDU: 0 }[lead.status as string] || 30,
    phone: lead.phone || '',
    email: lead.email || '',
    location: lead.location || '',
    notes: lead.pipeline_notes || '',
    raw: lead,
  };
}

export function ErpCRM() {
  // API hooks for CRM data
  const { data: apiLeads } = useLeads();
  const createLeadMutation = useCreateLead();
  const convertLeadMutation = useConvertLead();
  const updateLeadMutation = useUpdateLead();
  const deleteLeadMutation = useDeleteLead();

  const [activeTab, setActiveTab] = useState('pipeline');

  // Pipeline columns rebuilt LIVE from server leads (no more local state)
  const pipelineColumns = useMemo(() => {
    const leadsByCol: Record<string, any[]> = {
      prospect: [], qualification: [], devis: [], nego: [], won: [], lost: [],
    };
    if (Array.isArray(apiLeads)) {
      for (const lead of apiLeads) {
        const colId = STATUS_TO_COL[lead.status] || 'prospect';
        if (leadsByCol[colId]) leadsByCol[colId].push(leadToCard(lead));
      }
    }
    // Apply server data over the static skeleton (preserves colors/styles).
    return PIPELINE_COLUMNS.map((col) => ({
      ...col,
      items: leadsByCol[col.id] || [],
    }));
  }, [apiLeads]);

  // Quotes — live from /quotes (Phase 14).
  const { data: apiQuotes } = useQuotes();
  const createQuoteMutation = useCreateQuote();
  const updateQuoteMutation = useUpdateQuote();
  const QUOTE_STATUS_UI: Record<string, string> = {
    EN_REDACTION: 'En rédaction', ENVOYE: 'Envoyé', ACCEPTE: 'Accepté', REFUSE: 'Refusé',
  };
  const QUOTE_STATUS_API: Record<string, string> = {
    'En rédaction': 'EN_REDACTION', 'Envoyé': 'ENVOYE', 'Accepté': 'ACCEPTE', 'Refusé': 'REFUSE',
  };
  const quotes = useMemo(() => {
    if (!Array.isArray(apiQuotes)) return [];
    return apiQuotes.map((q: any) => ({
      rawId: q.id,
      id: q.code,
      project: q.project_label || '',
      client: q.client_name || '',
      amount: q.amount || 0,
      version: q.version || 1,
      status: QUOTE_STATUS_UI[q.status] || q.status,
      date: formatDate(q.created_at),
    }));
  }, [apiQuotes]);
  const reviseQuoteMutation = useReviseQuote();
  const [reviseModal, setReviseModal] = useState<{ isOpen: boolean; quote: any }>({ isOpen: false, quote: null });
  const [versionHistoryModal, setVersionHistoryModal] = useState<{ isOpen: boolean; quoteId: string | null }>({ isOpen: false, quoteId: null });
  const { data: versionHistory } = useQuoteVersions(versionHistoryModal.quoteId);
  // UI States
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [convertTemplateId, setConvertTemplateId] = useState<string>('');
  const { data: projectTemplates } = useProjectTemplates();
  // Modals
  const [prospectModal, setProspectModal] = useState(false);
  const [devisModal, setDevisModal] = useState(false);
  const [prospectDetailModal, setProspectDetailModal] = useState<{
    isOpen: boolean;
    prospect: any;
    colId: string;
  }>({
    isOpen: false,
    prospect: null,
    colId: ''
  });
  const [editDevisModal, setEditDevisModal] = useState<{
    isOpen: boolean;
    quote: any;
  }>({
    isOpen: false,
    quote: null
  });
  const tabs = [
  {
    id: 'pipeline',
    label: 'Pipeline Commercial',
    icon: TargetIcon
  },
  {
    id: 'devis',
    label: 'Devis & BOQ',
    icon: CalculatorIcon
  },
  {
    id: 'portail',
    label: 'Portail Client',
    icon: MessageSquareIcon
  }];

  const getStatusStyle = (s: string) => {
    switch (s) {
      case 'Envoyé':
        return 'bg-orange-100 text-orange-700';
      case 'Accepté':
        return 'bg-green-100 text-green-700';
      case 'En rédaction':
        return 'bg-blue-100 text-blue-700';
      case 'Refusé':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };
  // Handlers
  const handleNewProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('new-prospect');
    const form = e.target as HTMLFormElement;
    const fullName = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const [first, ...rest] = fullName.split(' ');
    try {
      await createLeadMutation.mutateAsync({
        first_name: first || fullName,
        last_name: rest.join(' '),
        email: (form.elements.namedItem('email') as HTMLInputElement).value,
        phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
        project_type: (form.elements.namedItem('project') as HTMLInputElement).value,
        location: (form.elements.namedItem('location') as HTMLInputElement).value,
        source: (form.elements.namedItem('source') as HTMLSelectElement).value,
        quote_amount: parseFloat(
          (form.elements.namedItem('budget') as HTMLInputElement).value
        ) || undefined,
        message: '',
      });
      setProspectModal(false);
    } catch (err) {
      // Errors will show through console; React Query exposes them.
      console.error('Lead creation failed', err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleMoveProspect = async (
    prospectId: string,
    _fromColId: string,
    toColId: string
  ) => {
    setProcessingId(`move-${prospectId}`);
    const targetStatus = COL_TO_STATUS[toColId];
    if (!targetStatus) {
      setProcessingId(null);
      return;
    }
    try {
      await updateLeadMutation.mutateAsync({
        id: prospectId,
        data: { status: targetStatus },
      });
      setProspectDetailModal({ isOpen: false, prospect: null, colId: '' });
    } catch (err) {
      console.error('Lead status update failed', err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleConvertLead = async (leadId: string) => {
    const prospect = prospectDetailModal.prospect;
    setProcessingId(`convert-${leadId}`);
    try {
      await convertLeadMutation.mutateAsync({
        id: leadId,
        data: {
          project_name: prospect?.project || prospect?.name || 'Nouveau projet',
          template_id: convertTemplateId || undefined,
        },
      });
      setConvertTemplateId('');
      setProspectDetailModal({ isOpen: false, prospect: null, colId: '' });
    } catch (err) {
      console.error('Lead conversion failed', err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleDeleteLead = async (leadId: string) => {
    setProcessingId(`delete-${leadId}`);
    try {
      await deleteLeadMutation.mutateAsync(leadId);
      setProspectDetailModal({ isOpen: false, prospect: null, colId: '' });
    } catch (err) {
      console.error('Lead deletion failed', err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleNewDevis = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('new-devis');
    const form = e.target as HTMLFormElement;
    try {
      await createQuoteMutation.mutateAsync({
        project_label: (form.elements.namedItem('project') as HTMLInputElement).value,
        client_name: (form.elements.namedItem('client') as HTMLInputElement).value,
        amount: parseInt((form.elements.namedItem('amount') as HTMLInputElement).value) || 0,
      });
      setDevisModal(false);
    } catch (err) {
      console.error('Create quote failed', err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleEditDevis = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('edit-devis');
    const form = e.target as HTMLFormElement;
    const uiStatus = (form.elements.namedItem('status') as HTMLSelectElement).value;
    try {
      await updateQuoteMutation.mutateAsync({
        id: editDevisModal.quote.rawId,
        data: { status: QUOTE_STATUS_API[uiStatus] || uiStatus },
      });
      setEditDevisModal({ isOpen: false, quote: null });
    } catch (err) {
      console.error('Update quote failed', err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleDuplicateDevis = async (quote: any) => {
    setProcessingId(`dup-${quote.id}`);
    try {
      await createQuoteMutation.mutateAsync({
        project_label: quote.project,
        client_name: quote.client,
        amount: quote.amount,
      });
    } catch (err) {
      console.error('Duplicate quote failed', err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleDownloadDevis = async (quote: any) => {
    setProcessingId(`dl-${quote.id}`);
    try {
      await downloadQuotePdf(quote.rawId, quote.id);
    } catch (err) {
      console.error('Download quote PDF failed', err);
    } finally {
      setProcessingId(null);
    }
  };
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-montserrat font-bold text-sm transition-all ${activeTab === tab.id ? 'bg-globus-orange text-white shadow-md' : 'text-globus-gray hover:bg-globus-light'}`}>
              
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>);

        })}
      </div>

      {activeTab === 'pipeline' &&
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}>
        
          <div className="flex justify-between items-center mb-6 gap-2 flex-wrap">
            <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
              Tunnel de Vente
            </h2>
            <div className="flex gap-2">
              <ExportButton onAction={exportLeadsXlsx} />
              <button
                onClick={() => setProspectModal(true)}
                className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
                <PlusIcon className="w-4 h-4" /> Nouveau Prospect
              </button>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[600px]">
            {pipelineColumns.map((col, ci) =>
          <motion.div
            key={col.id}
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              delay: ci * 0.05
            }}
            className={`min-w-[280px] w-[280px] shrink-0 rounded-xl border border-gray-200 border-t-4 ${col.color} ${col.bg} overflow-hidden flex flex-col max-h-[700px]`}>
            
                <div className="p-3 border-b border-gray-200/50 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-montserrat font-bold text-xs uppercase tracking-wider text-globus-blue-dark">
                      {col.label}
                    </h3>
                    <span className="bg-white text-globus-gray text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">
                      {col.items.length}
                    </span>
                  </div>
                  <div className="text-[10px] font-semibold text-gray-500">
                    {fmtShort(
                  col.items.reduce((sum, item) => sum + item.budget, 0)
                )}
                  </div>
                </div>
                <div className="p-3 space-y-3 overflow-y-auto flex-1">
                  <AnimatePresence>
                    {col.items.map((item) =>
                <motion.div
                  key={item.id}
                  layout
                  initial={{
                    opacity: 0,
                    scale: 0.9
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.9
                  }}
                  onClick={() =>
                  setProspectDetailModal({
                    isOpen: true,
                    prospect: item,
                    colId: col.id
                  })
                  }
                  className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 hover:shadow-md hover:border-globus-blue/30 transition-all cursor-pointer group relative">
                  
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-full bg-globus-blue-dark text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            {item.name.charAt(0)}
                            {item.name.split(' ').pop()?.charAt(0)}
                          </div>
                          <p className="font-montserrat font-bold text-xs text-globus-blue-dark truncate group-hover:text-globus-blue transition-colors">
                            {item.name}
                          </p>
                        </div>
                        <p className="text-xs text-globus-gray font-opensans mb-2 truncate">
                          {item.project}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="font-montserrat font-bold text-xs text-globus-orange">
                            {fmtShort(item.budget)}
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            <PercentIcon className="w-3 h-3" />
                            {item.prob}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
                          <span className="text-[10px] text-globus-gray bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 truncate max-w-[100px]">
                            {item.source}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-auto">
                            {item.date}
                          </span>
                        </div>
                      </motion.div>
                )}
                  </AnimatePresence>
                </div>
              </motion.div>
          )}
          </div>
        </motion.div>
      }

      {activeTab === 'devis' &&
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}>
        
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
              Générateur de Devis (BOQ)
            </h2>
            <button
            onClick={() => setDevisModal(true)}
            className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
            
              <PlusIcon className="w-4 h-4" /> Nouveau Devis
            </button>
          </div>
          <div className="space-y-4">
            {quotes.length === 0 &&
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-globus-gray font-opensans text-sm">
                Aucun devis pour le moment. Créez-en un avec « Nouveau Devis ».
              </div>
            }
            <AnimatePresence>
              {quotes.map((q, idx) =>
            <motion.div
              key={q.id}
              layout
              initial={{
                opacity: 0,
                y: 10
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              exit={{
                opacity: 0,
                scale: 0.95
              }}
              transition={{
                delay: idx * 0.05
              }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-globus-blue/20 transition-colors relative">
              
                  {processingId === `dup-${q.id}` &&
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                      <Loader2Icon className="w-6 h-6 text-globus-blue animate-spin" />
                    </div>
              }
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-xs font-bold text-globus-blue bg-blue-50 px-2 py-0.5 rounded">
                        {q.id}
                      </span>
                      {q.version > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700 font-montserrat">
                          V{q.version}
                        </span>
                      )}
                      <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-montserrat ${getStatusStyle(q.status)}`}>
                    
                        {q.status}
                      </span>
                    </div>
                    <h3 className="font-montserrat font-bold text-globus-blue-dark text-lg">
                      {q.project}
                    </h3>
                    <p className="text-sm text-globus-gray font-opensans flex items-center gap-2 mt-1">
                      <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-semibold text-gray-700">
                        {q.client}
                      </span>
                      <span className="text-gray-300">•</span>
                      <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                      {q.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <p className="font-montserrat font-bold text-xl text-globus-blue-dark">
                      {fmt(q.amount)}
                    </p>
                    <div className="flex gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                      <button
                    onClick={() => handleDownloadDevis(q)}
                    disabled={processingId === `dl-${q.id}`}
                    className="p-2 text-gray-500 hover:text-globus-blue hover:bg-white rounded-md transition-all shadow-sm disabled:opacity-50"
                    title="Télécharger PDF">
                    
                        {processingId === `dl-${q.id}` ?
                    <Loader2Icon className="w-4 h-4 animate-spin" /> :
                    <DownloadIcon className="w-4 h-4" />
                    }
                      </button>
                      <button
                    onClick={() => handleDuplicateDevis(q)}
                    className="p-2 text-gray-500 hover:text-globus-orange hover:bg-white rounded-md transition-all shadow-sm"
                    title="Dupliquer">
                    
                        <CopyIcon className="w-4 h-4" />
                      </button>
                      <button
                    onClick={() =>
                    setEditDevisModal({
                      isOpen: true,
                      quote: q
                    })
                    }
                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-white rounded-md transition-all shadow-sm"
                    title="Modifier Statut">
                    
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                    onClick={() => setReviseModal({ isOpen: true, quote: q })}
                    className="p-2 text-gray-500 hover:text-purple-600 hover:bg-white rounded-md transition-all shadow-sm"
                    title="Créer une révision">
                        <GitBranchIcon className="w-4 h-4" />
                      </button>
                      <button
                    onClick={() => setVersionHistoryModal({ isOpen: true, quoteId: q.rawId })}
                    className="p-2 text-gray-500 hover:text-amber-600 hover:bg-white rounded-md transition-all shadow-sm"
                    title="Historique des versions">
                        <HistoryIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
            )}
            </AnimatePresence>
          </div>
        </motion.div>
      }

      {activeTab === 'portail' &&
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <EmptyState
            icon={<MessageSquareIcon className="w-7 h-7" />}
            title="Communication client"
            description="Les messages et les rendez-vous des clients sont gérés dans les modules dédiés Messagerie et Agenda de l'ERP."
          />
        </div>
      </motion.div>
      }

      {/* MODALS */}

      {/* New Prospect Modal */}
      <AnimatePresence>
        {prospectModal &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          
            <motion.div
            initial={{
              scale: 0.9,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.9,
              opacity: 0
            }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-globus-orange" /> Nouveau
                  Prospect
                </h3>
                <button
                onClick={() => setProspectModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleNewProspect} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Nom du prospect / Entreprise
                    </label>
                    <input
                    name="name"
                    type="text"
                    required
                    placeholder="Ex: M. Dupont ou Société XYZ"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Projet envisagé
                    </label>
                    <input
                    name="project"
                    type="text"
                    required
                    placeholder="Ex: Construction Villa R+1"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Budget estimé (FCFA)
                    </label>
                    <input
                    name="budget"
                    type="number"
                    required
                    min="1000000"
                    placeholder="Ex: 50000000"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Probabilité (%)
                    </label>
                    <input
                    name="prob"
                    type="number"
                    required
                    min="0"
                    max="100"
                    defaultValue="20"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Source
                    </label>
                    <select
                    name="source"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">
                    
                      <option value="Site web">Site web</option>
                      <option value="Recommandation">Recommandation</option>
                      <option value="Salon BTP">Salon BTP</option>
                      <option value="Réseaux sociaux">Réseaux sociaux</option>
                      <option value="Appel d'offre">Appel d'offre</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Localisation
                    </label>
                    <input
                    name="location"
                    type="text"
                    required
                    placeholder="Ex: Douala, Bonapriso"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Téléphone
                    </label>
                    <input
                    name="phone"
                    type="tel"
                    required
                    placeholder="+237..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Email
                    </label>
                    <input
                    name="email"
                    type="email"
                    required
                    placeholder="contact@email.com"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                  <button
                  type="button"
                  onClick={() => setProspectModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'new-prospect'}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'new-prospect' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }
                    Créer Prospect
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Prospect Detail / Move Modal */}
      <AnimatePresence>
        {prospectDetailModal.isOpen && prospectDetailModal.prospect &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          
            <motion.div
            initial={{
              scale: 0.9,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.9,
              opacity: 0
            }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-globus-blue-dark text-white flex items-center justify-center text-lg font-bold shadow-inner">
                    {prospectDetailModal.prospect.name.charAt(0)}
                    {prospectDetailModal.prospect.name.
                  split(' ').
                  pop()?.
                  charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                      {prospectDetailModal.prospect.name}
                    </h3>
                    <p className="text-sm text-globus-orange font-semibold">
                      {prospectDetailModal.prospect.project}
                    </p>
                  </div>
                </div>
                <button
                onClick={() =>
                setProspectDetailModal({
                  isOpen: false,
                  prospect: null,
                  colId: ''
                })
                }
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <TargetIcon className="w-3 h-3" /> Budget Estimé
                    </p>
                    <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
                      {fmt(prospectDetailModal.prospect.budget)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <PercentIcon className="w-3 h-3" /> Probabilité
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
                        {prospectDetailModal.prospect.prob}%
                      </p>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                        className="h-full bg-globus-orange rounded-full"
                        style={{
                          width: `${prospectDetailModal.prospect.prob}%`
                        }} />
                      
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-montserrat font-bold text-sm text-gray-800 border-b border-gray-100 pb-2">
                    Coordonnées
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <PhoneIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">
                        {prospectDetailModal.prospect.phone}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MailIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700 truncate">
                        {prospectDetailModal.prospect.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPinIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">
                        {prospectDetailModal.prospect.location}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">
                        Ajouté le {prospectDetailModal.prospect.date}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-montserrat font-bold text-sm text-gray-800 border-b border-gray-100 pb-2 mb-3">
                    Déplacer dans le pipeline
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {pipelineColumns.map((col) =>
                  <button
                    key={col.id}
                    onClick={() =>
                    handleMoveProspect(
                      prospectDetailModal.prospect.id,
                      prospectDetailModal.colId,
                      col.id
                    )
                    }
                    disabled={
                    col.id === prospectDetailModal.colId ||
                    processingId ===
                    `move-${prospectDetailModal.prospect.id}`
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${col.id === prospectDetailModal.colId ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-globus-blue-dark border-gray-200 hover:border-globus-blue hover:bg-blue-50 shadow-sm'}`}>
                    
                        {processingId ===
                    `move-${prospectDetailModal.prospect.id}` &&
                    col.id !== prospectDetailModal.colId ?
                    <Loader2Icon className="w-3 h-3 animate-spin inline mr-1" /> :
                    null}
                        {col.label}
                      </button>
                  )}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Modèle de projet (phases pré-remplies)
                  </label>
                  <select
                  value={convertTemplateId}
                  onChange={(e) => setConvertTemplateId(e.target.value)}
                  className="w-full mb-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue">
                    <option value="">— Sans modèle —</option>
                    {(Array.isArray(projectTemplates) ? projectTemplates : []).map((t: any) =>
                    <option key={t.id} value={t.id}>{t.name}</option>
                    )}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                  onClick={() => handleConvertLead(prospectDetailModal.prospect.id)}
                  disabled={processingId === `convert-${prospectDetailModal.prospect.id}`}
                  className="flex-1 bg-globus-blue-dark hover:bg-globus-blue text-white font-montserrat font-bold py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-70">

                    {processingId === `convert-${prospectDetailModal.prospect.id}` ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :
                  <CheckCircle2Icon className="w-4 h-4" />}
                    Convertir en projet
                  </button>
                  <button
                  onClick={() => handleDeleteLead(prospectDetailModal.prospect.id)}
                  disabled={processingId === `delete-${prospectDetailModal.prospect.id}`}
                  className="px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-montserrat font-bold text-sm flex items-center gap-2 disabled:opacity-70">

                    {processingId === `delete-${prospectDetailModal.prospect.id}` ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :
                  <Trash2Icon className="w-4 h-4" />}
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* New Devis Modal */}
      <AnimatePresence>
        {devisModal &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          
            <motion.div
            initial={{
              scale: 0.9,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.9,
              opacity: 0
            }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
                  <CalculatorIcon className="w-5 h-5 text-globus-orange" />{' '}
                  Nouveau Devis
                </h3>
                <button
                onClick={() => setDevisModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleNewDevis} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Projet
                  </label>
                  <input
                  name="project"
                  type="text"
                  required
                  placeholder="Ex: Construction Villa R+1"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Client
                  </label>
                  <input
                  name="client"
                  type="text"
                  required
                  placeholder="Nom du client"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Montant Total (FCFA)
                  </label>
                  <input
                  name="amount"
                  type="number"
                  required
                  min="1000"
                  placeholder="Ex: 15000000"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                  <button
                  type="button"
                  onClick={() => setDevisModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'new-devis'}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'new-devis' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }
                    Créer Devis
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Edit Devis Modal */}
      <AnimatePresence>
        {editDevisModal.isOpen && editDevisModal.quote &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          
            <motion.div
            initial={{
              scale: 0.9,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.9,
              opacity: 0
            }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
                  <PencilIcon className="w-5 h-5 text-globus-orange" /> Modifier
                  Statut
                </h3>
                <button
                onClick={() =>
                setEditDevisModal({
                  isOpen: false,
                  quote: null
                })
                }
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleEditDevis} className="p-6 space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 text-center">
                  <p className="font-mono text-xs font-bold text-globus-blue mb-1">
                    {editDevisModal.quote.id}
                  </p>
                  <p className="font-bold text-sm text-gray-800">
                    {editDevisModal.quote.project}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Nouveau Statut
                  </label>
                  <select
                  name="status"
                  defaultValue={editDevisModal.quote.status}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">
                  
                    <option value="En rédaction">En rédaction</option>
                    <option value="Envoyé">Envoyé</option>
                    <option value="Accepté">Accepté</option>
                    <option value="Refusé">Refusé</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                  <button
                  type="button"
                  onClick={() =>
                  setEditDevisModal({
                    isOpen: false,
                    quote: null
                  })
                  }
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'edit-devis'}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'edit-devis' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Revise Quote Modal */}
      <AnimatePresence>
        {reviseModal.isOpen &&
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setReviseModal({ isOpen: false, quote: null })}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-purple-700 p-6 text-white flex items-center justify-between">
              <div>
                <h3 className="font-montserrat font-bold text-xl">Nouvelle révision</h3>
                <p className="text-purple-200 text-sm mt-1">{reviseModal.quote?.id} — V{(reviseModal.quote?.version || 1)} → V{(reviseModal.quote?.version || 1) + 1}</p>
              </div>
              <button onClick={() => setReviseModal({ isOpen: false, quote: null })} className="p-2 hover:bg-white/10 rounded-lg">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setProcessingId('revise-devis');
              const form = e.target as HTMLFormElement;
              try {
                await reviseQuoteMutation.mutateAsync({
                  id: reviseModal.quote.rawId,
                  data: {
                    amount: parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value) || undefined,
                    notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value || undefined,
                    version_note: (form.elements.namedItem('version_note') as HTMLInputElement).value,
                  },
                });
                setReviseModal({ isOpen: false, quote: null });
              } catch (err) {
                console.error('Revise quote failed', err);
              } finally {
                setProcessingId(null);
              }
            }} className="p-6 space-y-4">
              <div>
                <label className="font-montserrat text-sm font-bold text-globus-blue-dark block mb-1">Motif de la révision *</label>
                <input name="version_note" required placeholder="ex: Ajustement prix terrassement"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
              <div>
                <label className="font-montserrat text-sm font-bold text-globus-blue-dark block mb-1">Nouveau montant (FCFA)</label>
                <input name="amount" type="number" defaultValue={reviseModal.quote?.amount || 0}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
              <div>
                <label className="font-montserrat text-sm font-bold text-globus-blue-dark block mb-1">Notes</label>
                <textarea name="notes" rows={3} defaultValue=""
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setReviseModal({ isOpen: false, quote: null })}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Annuler</button>
                <button type="submit" disabled={processingId === 'revise-devis'}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  {processingId === 'revise-devis' ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <GitBranchIcon className="w-4 h-4" />}
                  Créer V{(reviseModal.quote?.version || 1) + 1}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
        }
      </AnimatePresence>

      {/* Version History Modal */}
      <AnimatePresence>
        {versionHistoryModal.isOpen &&
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setVersionHistoryModal({ isOpen: false, quoteId: null })}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-amber-600 p-6 text-white flex items-center justify-between">
              <div>
                <h3 className="font-montserrat font-bold text-xl">Historique des versions</h3>
                <p className="text-amber-100 text-sm mt-1">
                  {Array.isArray(versionHistory) && versionHistory.length > 0 ? versionHistory[0]?.code?.split('__v')[0] : ''}
                </p>
              </div>
              <button onClick={() => setVersionHistoryModal({ isOpen: false, quoteId: null })} className="p-2 hover:bg-white/10 rounded-lg">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto">
              {Array.isArray(versionHistory) && versionHistory.length > 0 ? (
                <div className="space-y-3">
                  {versionHistory.map((v: any, i: number) => (
                    <div key={v.id} className={`p-4 rounded-xl border ${i === 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold font-montserrat ${i === 0 ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-600'}`}>
                            V{v.version}
                          </span>
                          {i === 0 && <span className="text-xs font-bold text-amber-600">Actuelle</span>}
                        </div>
                        <span className="text-xs text-gray-500 font-opensans">{formatDate(v.created_at)}</span>
                      </div>
                      <p className="font-montserrat font-bold text-globus-blue-dark">
                        {(v.amount || 0).toLocaleString('fr-FR')} FCFA
                      </p>
                      {v.version_note && (
                        <p className="text-sm text-gray-600 font-opensans mt-1 italic">
                          {v.version_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 font-opensans py-8">Aucun historique disponible</p>
              )}
            </div>
          </motion.div>
        </motion.div>
        }
      </AnimatePresence>

    </div>);

}