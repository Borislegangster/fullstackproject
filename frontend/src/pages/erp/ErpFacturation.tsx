import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReceiptIcon, PlusIcon, SendIcon, DownloadIcon, CheckCircle2Icon, ClockIcon, AlertTriangleIcon, SearchIcon, MailIcon, XIcon, FileTextIcon, WalletIcon, CalendarIcon, PhoneIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { formatDate } from '../../utils/datetime';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell } from
'recharts';
import {
  useInvoices, useCreateInvoice, useMarkInvoicePaid, useSendInvoice,
  useRemindInvoice, useDeleteInvoice, useInvoicingStats, useInvoiceAging, useQuotes,
  useProjects, useCreateQuote, useUsers,
} from '../../hooks/useErp';
import { downloadInvoicePdf, downloadQuotePdf, exportInvoicesXlsx } from '../../services/api/downloads';
import { ChartEmpty } from '../../components/ui/ChartEmpty';
interface Invoice {
  id: string;
  numero: string;
  client: string;
  projet: string;
  projectId: string;
  montant: number;
  description: string;
  dateEmission: string;
  dateEcheance: string;
  status: 'payee' | 'en-attente' | 'en-retard' | 'brouillon';
  appelFonds?: number;
}

interface Devis {
  id: string;
  rawId: string;
  numero: string;
  client: string;
  projet: string;
  montant: number;
  date: string;
  validite: string;
  status: 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire';
}

// Aging buckets → chart bars (label + colour by bucket key).
const AGING_META: Record<string, {range: string; color: string}> = {
  '0_30': { range: '0-30j', color: '#10B981' },
  '31_60': { range: '30-60j', color: '#F97316' },
  '61_90': { range: '60-90j', color: '#EF4444' },
  '90_plus': { range: '90j+', color: '#991B1B' },
};

const formatCurrency = (value: number) =>
new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';
const tabs = [
{
  id: 'factures',
  label: 'Factures Clients',
  icon: ReceiptIcon
},
{
  id: 'devis',
  label: 'Devis & Proformas',
  icon: FileTextIcon
},
{
  id: 'relances',
  label: 'Relances & Encaissements',
  icon: AlertTriangleIcon
},
{
  id: 'appels_fonds',
  label: 'Appels de Fonds',
  icon: WalletIcon
}];

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08
    }
  }
};
const fadeUp = {
  hidden: {
    opacity: 0,
    y: 20
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4
    }
  }
};
function invoiceToUi(i: any): Invoice {
  const statusMap: Record<string, Invoice['status']> = {
    PAYEE: 'payee',
    ENVOYEE: 'en-attente',
    EN_RETARD: 'en-retard',
    BROUILLON: 'brouillon',
  };
  return {
    id: i.id,
    numero: i.code || '',
    client: i.client_name || i.client_id || '',
    projet: i.project_name || i.project_id || '',
    projectId: i.project_id || '',
    montant: i.total || 0,
    description: i.notes || '',
    dateEmission: formatDate(i.issue_date),
    dateEcheance: formatDate(i.due_date),
    status: statusMap[i.status] || 'brouillon',
    appelFonds: i.invoice_type === 'APPEL_FONDS' ? 1 : undefined,
  };
}

export function ErpFacturation() {
  // API hooks
  const { data: apiInvoices } = useInvoices();
  const { data: stats } = useInvoicingStats();
  const { data: agingRaw } = useInvoiceAging();
  const createInvoiceMutation = useCreateInvoice();
  const markPaidMutation = useMarkInvoicePaid();
  const sendInvoiceMutation = useSendInvoice();
  const remindInvoiceMutation = useRemindInvoice();
  const deleteInvoiceMutation = useDeleteInvoice();
  const { data: apiProjects } = useProjects();
  const createQuoteMutation = useCreateQuote();
  const { data: apiUsers } = useUsers();

  // New-invoice form state (real client/project — no mock options).
  const [invForm, setInvForm] = useState({ projectId: '', amount: '', dueDate: '', description: '' });
  // New-devis form state.
  const [devisForm, setDevisForm] = useState({ clientName: '', projectLabel: '', amount: '', validity: '', notes: '' });
  // Appels-de-fonds project selector.
  const [afProjectId, setAfProjectId] = useState('');
  const projectOptions: any[] = Array.isArray(apiProjects) ? apiProjects : [];
  const clientOptions: any[] = Array.isArray(apiUsers)
    ? apiUsers.filter((u: any) => u.role === 'CLIENT')
    : [];

  // Live invoices from API — empty array → empty table (no mock fallback).
  const liveInvoices: Invoice[] = useMemo(() => {
    if (!Array.isArray(apiInvoices)) return [];
    return apiInvoices.map(invoiceToUi);
  }, [apiInvoices]);

  // Devis — live from /quotes (Phase 14).
  const { data: apiQuotes } = useQuotes();
  const devisData: Devis[] = useMemo(() => {
    if (!Array.isArray(apiQuotes)) return [];
    const statusMap: Record<string, Devis['status']> = {
      EN_REDACTION: 'brouillon', ENVOYE: 'envoye', ACCEPTE: 'accepte', REFUSE: 'refuse',
    };
    return apiQuotes.map((q: any) => ({
      id: q.code || q.id,
      rawId: q.id,
      numero: q.code || '',
      client: q.client_name || '',
      projet: q.project_label || '',
      montant: q.amount || 0,
      date: formatDate(q.created_at),
      validite: formatDate(q.valid_until, '—'),
      status: statusMap[q.status] || 'brouillon',
    }));
  }, [apiQuotes]);

  // Aged receivables → chart bars (4 overdue buckets, zero-filled).
  const liveAging = useMemo(() => {
    const buckets: any[] = (agingRaw as any)?.buckets || [];
    return ['0_30', '31_60', '61_90', '90_plus'].map((k) => {
      const b = buckets.find((x) => x.bucket === k);
      return { range: AGING_META[k].range, montant: b?.amount || 0, color: AGING_META[k].color };
    });
  }, [agingRaw]);
  const agingTotal = (agingRaw as any)?.total_outstanding || 0;

  // Overdue invoices → relance list (derived from raw API invoices).
  const liveRelances = useMemo(() => {
    if (!Array.isArray(apiInvoices)) return [];
    const now = Date.now();
    return apiInvoices
      .filter((i: any) =>
        ['ENVOYEE', 'EN_RETARD'].includes(i.status) &&
        i.due_date && new Date(i.due_date).getTime() < now &&
        ((i.total || 0) - (i.amount_paid || 0)) > 0)
      .map((i: any) => ({
        id: i.id,
        numero: i.code || '',
        client: i.client_name || i.client_id || '',
        projet: i.project_name || i.project_id || '',
        montant: (i.total || 0) - (i.amount_paid || 0),
        echeance: formatDate(i.due_date),
        joursRetard: i.due_date ? Math.floor((now - new Date(i.due_date).getTime()) / 86_400_000) : 0,
        nbRelances: 0,
        derniereRelance: '—',
      }));
  }, [apiInvoices]);

  const [activeTab, setActiveTab] = useState('factures');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  // New states for interactive features
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showNewDevis, setShowNewDevis] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const showToast = (
  message: string,
  type: 'success' | 'error' | 'info' = 'success') =>
  {
    setToast({
      message,
      type
    });
    setTimeout(() => setToast(null), 3000);
  };
  const handleDownload = async (id: string, type: 'facture' | 'devis') => {
    setIsProcessing(`download-${id}`);
    showToast('Téléchargement en cours...', 'info');
    try {
      // Only "facture" has a real backend PDF; devis still uses the mock flow.
      if (type === 'facture') {
        const inv = (apiInvoices || []).find((i: any) => i.id === id);
        await downloadInvoicePdf(id, inv?.code || `facture-${id}`);
        showToast('PDF téléchargé ✓', 'success');
      } else {
        const devis = devisData.find((d) => d.id === id);
        const realId = devis?.rawId || id;
        await downloadQuotePdf(realId, devis?.numero || `devis-${id}`);
        showToast('PDF du devis téléchargé ✓', 'success');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Échec du téléchargement', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleExportXlsx = async () => {
    try {
      setIsProcessing('export-xlsx');
      await exportInvoicesXlsx();
      showToast('Export Excel téléchargé ✓', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "Échec de l'export", 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleRelance = async (id: string, client: string) => {
    setIsProcessing(`relance-${id}`);
    try {
      await remindInvoiceMutation.mutateAsync(id);
      showToast(`Relance envoyée à ${client}`, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur lors de la relance', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleCreateInvoice = async () => {
    const project = projectOptions.find((p) => p.id === invForm.projectId);
    if (!project) {
      showToast('Veuillez sélectionner un projet', 'error');
      return;
    }
    if (!project.client_id) {
      showToast("Ce projet n'a pas de client associé", 'error');
      return;
    }
    const amount = parseFloat(invForm.amount) || 0;
    setIsProcessing('create-invoice');
    try {
      await createInvoiceMutation.mutateAsync({
        project_id: project.id,
        client_id: project.client_id,
        invoice_type: 'FACTURE',
        subtotal: amount,
        total: amount,
        notes: invForm.description || '',
        due_date: invForm.dueDate || undefined,
      });
      showToast('Facture créée avec succès', 'success');
      setShowNewInvoice(false);
      setInvForm({ projectId: '', amount: '', dueDate: '', description: '' });
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur lors de la création', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleSendInvoice = async (id: string) => {
    setIsProcessing(`send-${id}`);
    try {
      await sendInvoiceMutation.mutateAsync(id);
      showToast('Facture envoyée au client', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "Erreur lors de l'envoi", 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleDeleteInvoice = (id: string) => {
    setConfirmAction({
      title: 'Supprimer la facture',
      message: 'Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible.',
      onConfirm: async () => {
        setIsProcessing(`delete-${id}`);
        setConfirmAction(null);
        try {
          await deleteInvoiceMutation.mutateAsync(id);
          showToast('Facture supprimée', 'info');
          if (selectedInvoice?.id === id) setSelectedInvoice(null);
        } catch (err: any) {
          showToast(err?.response?.data?.detail || 'Erreur', 'error');
        } finally {
          setIsProcessing(null);
        }
      },
    });
  };
  const handleCreateDevis = async () => {
    if (!devisForm.clientName || !devisForm.projectLabel) {
      showToast('Client et projet sont requis', 'error');
      return;
    }
    setIsProcessing('create-devis');
    try {
      await createQuoteMutation.mutateAsync({
        client_name: devisForm.clientName,
        project_label: devisForm.projectLabel,
        amount: parseFloat(devisForm.amount) || 0,
        valid_until: devisForm.validity || undefined,
        notes: devisForm.notes || '',
      });
      showToast('Devis créé avec succès', 'success');
      setShowNewDevis(false);
      setDevisForm({ clientName: '', projectLabel: '', amount: '', validity: '', notes: '' });
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur lors de la création', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleFacturerDevis = (id: string) => {
    // A devis carries free-text client/project, so converting it means creating a
    // real invoice: prefill the New-Invoice modal with the devis amount and let
    // the user attach the real project (which resolves the client).
    const devis = devisData.find((d) => d.id === id);
    setInvForm({
      projectId: '',
      amount: devis ? String(devis.montant) : '',
      dueDate: '',
      description: devis ? `Facturation du devis ${devis.numero}` : '',
    });
    setShowNewInvoice(true);
  };
  const handleMarkAsPaid = (id: string) => {
    setConfirmAction({
      title: 'Marquer comme payée',
      message: 'Êtes-vous sûr de vouloir marquer cette facture comme payée ?',
      onConfirm: async () => {
        setIsProcessing(`pay-${id}`);
        setConfirmAction(null);
        try {
          await markPaidMutation.mutateAsync(id);
          showToast('Facture marquée comme payée', 'success');
          if (selectedInvoice) {
            setSelectedInvoice({ ...selectedInvoice, status: 'payee' });
          }
        } catch (err: any) {
          showToast(err?.response?.data?.detail || 'Erreur', 'error');
        } finally {
          setIsProcessing(null);
        }
      },
    });
  };
  const totalFacture = stats?.total_paid !== undefined
    ? (stats.total_paid + stats.total_pending)
    : liveInvoices.reduce((s, i) => s + i.montant, 0);
  const totalEncaisse = stats?.total_paid
    ?? liveInvoices.filter((i) => i.status === 'payee').reduce((s, i) => s + i.montant, 0);
  const totalAttente = stats?.total_pending
    ?? liveInvoices.filter((i) => i.status === 'en-attente').reduce((s, i) => s + i.montant, 0);
  const totalRetard = stats?.total_overdue
    ?? liveInvoices.filter((i) => i.status === 'en-retard').reduce((s, i) => s + i.montant, 0);
  const filteredInvoices = liveInvoices.filter(
    (i) =>
    i.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.projet.toLowerCase().includes(searchQuery.toLowerCase())
  );
  // Appels de fonds (capital calls) = invoices of type APPEL_FONDS, scoped to the
  // selected project. Budget / paid / remaining come from the real project + its
  // paid appel invoices — no hardcoded client or amounts.
  const afInvoices = useMemo(
    () => liveInvoices.filter((i) => i.appelFonds && (!afProjectId || i.projectId === afProjectId)),
    [liveInvoices, afProjectId],
  );
  const afProject = projectOptions.find((p) => p.id === afProjectId);
  const afBudget = Number(afProject?.budget_initial || 0);
  const afPaid = afInvoices
    .filter((i) => i.status === 'payee')
    .reduce((s, i) => s + i.montant, 0);
  const afRemaining = Math.max(0, afBudget - afPaid);
  const afPct = afBudget > 0 ? Math.min(100, Math.round((afPaid / afBudget) * 100)) : 0;

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'payee':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
            <CheckCircle2Icon className="w-3 h-3" /> Payée
          </span>);

      case 'en-attente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
            <ClockIcon className="w-3 h-3" /> En attente
          </span>);

      case 'en-retard':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
            <AlertTriangleIcon className="w-3 h-3" /> En retard
          </span>);

      case 'brouillon':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
            <FileTextIcon className="w-3 h-3" /> Brouillon
          </span>);

    }
  };
  const getDevisStatusBadge = (status: Devis['status']) => {
    switch (status) {
      case 'brouillon':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
            Brouillon
          </span>);

      case 'envoye':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
            Envoyé
          </span>);

      case 'accepte':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
            Accepté
          </span>);

      case 'refuse':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
            Refusé
          </span>);

      case 'expire':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
            Expiré
          </span>);

    }
  };
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="space-y-6 max-w-[1400px] mx-auto">
      
      {/* Tabs */}
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 flex flex-wrap gap-1">
        
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-montserrat font-bold text-sm transition-all ${isActive ? 'bg-globus-orange text-white shadow-md' : 'text-globus-gray hover:bg-gray-50'}`}>
              
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>);

        })}
      </motion.div>

      {/* TAB: Factures Clients */}
      {activeTab === 'factures' &&
      <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
          {
            label: 'Total Facturé',
            value: totalFacture,
            icon: ReceiptIcon,
            bg: 'bg-blue-100',
            color: 'text-blue-600'
          },
          {
            label: 'Encaissé',
            value: totalEncaisse,
            icon: CheckCircle2Icon,
            bg: 'bg-green-100',
            color: 'text-green-600'
          },
          {
            label: 'En Attente',
            value: totalAttente,
            icon: ClockIcon,
            bg: 'bg-orange-100',
            color: 'text-orange-600'
          },
          {
            label: 'En Retard',
            value: totalRetard,
            icon: AlertTriangleIcon,
            bg: 'bg-red-100',
            color: 'text-red-600'
          }].
          map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <motion.div
                key={idx}
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                
                  <div className="flex items-center justify-between mb-3">
                    <div
                    className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    
                      <Icon className={`w-5 h-5 ${kpi.color}`} />
                    </div>
                  </div>
                  <p className="font-montserrat font-extrabold text-lg text-globus-blue-dark">
                    {formatCurrency(kpi.value)}
                  </p>
                  <p className="text-xs text-globus-gray font-opensans">
                    {kpi.label}
                  </p>
                </motion.div>);

          })}
          </div>

          {/* Search + Actions */}
          <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
              type="text"
              placeholder="Rechercher une facture..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange/30" />
            
            </div>
            <button
              type="button"
              onClick={handleExportXlsx}
              disabled={isProcessing === 'export-xlsx'}
              className="bg-white hover:bg-gray-50 border border-gray-200 text-globus-blue-dark font-montserrat font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm disabled:opacity-60"
              title="Exporter au format Excel">
              {isProcessing === 'export-xlsx' ? (
                <Loader2Icon className="w-4 h-4 animate-spin" />
              ) : (
                <DownloadIcon className="w-4 h-4" />
              )}
              Export Excel
            </button>
            <button
            onClick={() => setShowNewInvoice(true)}
            className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">

              <PlusIcon className="w-4 h-4" /> Nouvelle Facture
            </button>
          </motion.div>

          {/* Invoices Table */}
          <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark">
                      N° Facture
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark">
                      Client
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark hidden lg:table-cell">
                      Projet
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark">
                      Montant
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark hidden md:table-cell">
                      Émission
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark hidden md:table-cell">
                      Échéance
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark">
                      Statut
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="font-opensans text-sm">
                  {filteredInvoices.map((inv) =>
                <tr
                  key={inv.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  
                      <td className="p-4 font-mono font-semibold text-globus-blue-dark">
                        {inv.numero}
                      </td>
                      <td className="p-4 text-globus-blue-dark font-semibold">
                        {inv.client}
                      </td>
                      <td className="p-4 text-globus-gray hidden lg:table-cell">
                        {inv.projet}
                      </td>
                      <td className="p-4 font-bold text-globus-blue-dark">
                        {formatCurrency(inv.montant)}
                      </td>
                      <td className="p-4 text-globus-gray hidden md:table-cell">
                        {inv.dateEmission}
                      </td>
                      <td className="p-4 text-globus-gray hidden md:table-cell">
                        {inv.dateEcheance}
                      </td>
                      <td className="p-4">{getStatusBadge(inv.status)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(inv.id, 'facture');
                        }}
                        className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded-lg transition-colors"
                        title="Télécharger PDF">
                        
                            {isProcessing === `download-${inv.id}` ?
                        <Loader2Icon className="w-4 h-4 animate-spin" /> :

                        <DownloadIcon className="w-4 h-4" />
                        }
                          </button>
                          {inv.status === 'en-attente' &&
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRelance(inv.id, inv.client);
                        }}
                        className="p-1.5 text-gray-400 hover:text-globus-orange hover:bg-orange-50 rounded-lg transition-colors"
                        title="Envoyer relance">
                        
                              {isProcessing === `relance-${inv.id}` ?
                        <Loader2Icon className="w-4 h-4 animate-spin" /> :

                        <MailIcon className="w-4 h-4" />
                        }
                            </button>
                      }
                          {inv.status === 'en-retard' &&
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRelance(inv.id, inv.client);
                        }}
                        className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors text-xs font-bold px-2 flex items-center justify-center"
                        title="Relancer"
                        disabled={isProcessing === `relance-${inv.id}`}>
                        
                              {isProcessing === `relance-${inv.id}` ?
                        <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

                        <SendIcon className="w-3.5 h-3.5" />
                        }
                            </button>
                      }
                          {inv.status === 'brouillon' &&
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendInvoice(inv.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-globus-orange hover:bg-orange-50 rounded-lg transition-colors"
                        title="Envoyer au client"
                        disabled={isProcessing === `send-${inv.id}`}>

                              {isProcessing === `send-${inv.id}` ?
                        <Loader2Icon className="w-4 h-4 animate-spin" /> :
                        <SendIcon className="w-4 h-4" />
                        }
                            </button>
                      }
                          <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded-lg transition-colors ml-1"
                        title="Voir détails">

                            <FileTextIcon className="w-4 h-4" />
                          </button>
                          <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteInvoice(inv.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                        disabled={isProcessing === `delete-${inv.id}`}>

                            {isProcessing === `delete-${inv.id}` ?
                        <Loader2Icon className="w-4 h-4 animate-spin" /> :
                        <Trash2Icon className="w-4 h-4" />
                        }
                          </button>
                        </div>
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      }

      {/* TAB: Devis & Proformas */}
      {activeTab === 'devis' &&
      <>
          {/* Conversion Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            
              <p className="text-xs text-globus-gray font-opensans mb-1">
                Total Devis
              </p>
              <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                {devisData.length}
              </p>
            </motion.div>
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            
              <p className="text-xs text-globus-gray font-opensans mb-1">
                Taux de Conversion
              </p>
              <p className="font-montserrat font-extrabold text-2xl text-green-600">
                {devisData.length === 0 ? 0 : Math.round(
                devisData.filter((d) => d.status === 'accepte').length /
                devisData.length *
                100
              )}
                %
              </p>
            </motion.div>
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            
              <p className="text-xs text-globus-gray font-opensans mb-1">
                Montant Accepté
              </p>
              <p className="font-montserrat font-extrabold text-lg text-globus-blue-dark">
                {formatCurrency(
                devisData.
                filter((d) => d.status === 'accepte').
                reduce((s, d) => s + d.montant, 0)
              )}
              </p>
            </motion.div>
          </div>

          {/* Devis List */}
          <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-montserrat font-bold text-base text-globus-blue-dark">
                Liste des Devis
              </h3>
              <button
              onClick={() => setShowNewDevis(true)}
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
              
                <PlusIcon className="w-4 h-4" /> Nouveau Devis
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {devisData.length === 0 &&
                <p className="p-8 text-center text-globus-gray font-opensans text-sm">
                  Aucun devis enregistré
                </p>
              }
              {devisData.map((devis) =>
            <div
              key={devis.id}
              className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <FileTextIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs text-gray-400">
                          {devis.numero}
                        </span>
                        {getDevisStatusBadge(devis.status)}
                      </div>
                      <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                        {devis.client} — {devis.projet}
                      </p>
                      <p className="font-opensans text-xs text-globus-gray">
                        Émis le {devis.date} • Valide jusqu'au {devis.validite}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-montserrat font-bold text-globus-blue-dark">
                      {formatCurrency(devis.montant)}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                    onClick={() => handleDownload(devis.id, 'devis')}
                    className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded-lg transition-colors"
                    title="Télécharger">
                    
                        {isProcessing === `download-${devis.id}` ?
                    <Loader2Icon className="w-4 h-4 animate-spin" /> :

                    <DownloadIcon className="w-4 h-4" />
                    }
                      </button>
                      {devis.status === 'accepte' &&
                  <button
                    onClick={() => handleFacturerDevis(devis.id)}
                    disabled={isProcessing === `facturer-${devis.id}`}
                    className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-70">
                    
                          {isProcessing === `facturer-${devis.id}` ?
                    <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

                    <ReceiptIcon className="w-3.5 h-3.5" />
                    }{' '}
                          Facturer
                        </button>
                  }
                    </div>
                  </div>
                </div>
            )}
            </div>
          </motion.div>
        </>
      }

      {/* TAB: Relances & Encaissements */}
      {activeTab === 'relances' &&
      <>
          {/* Aging Chart */}
          <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          
            <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
              Analyse des Créances par Ancienneté
            </h3>
            <div className="h-56">
              {agingTotal === 0 ? (
                <ChartEmpty message="Aucune créance en attente" />
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                data={liveAging}
                margin={{
                  top: 10,
                  right: 20,
                  left: 0,
                  bottom: 0
                }}>
                
                  <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f3f4f6" />
                
                  <XAxis
                  dataKey="range"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 12,
                    fill: '#6b7280'
                  }} />
                
                  <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 11,
                    fill: '#6b7280'
                  }}
                  tickFormatter={(v) => `${v / 1000000}M`} />
                
                  <Tooltip
                  formatter={(value: number) => [
                  formatCurrency(value),
                  'Montant']
                  }
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }} />
                
                  <Bar dataKey="montant" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {liveAging.map((entry, index) =>
                  <Cell key={index} fill={entry.color} />
                  )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Overdue Invoices */}
          <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-montserrat font-bold text-base text-globus-blue-dark flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-red-500" /> Factures
                en Retard
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {liveRelances.length === 0 &&
                <p className="p-8 text-center text-globus-gray font-opensans text-sm">
                  Aucune facture en retard 🎉
                </p>
              }
              {liveRelances.map((rel) =>
            <div
              key={rel.id}
              className="p-5 hover:bg-gray-50 transition-colors">
              
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-gray-400">
                          {rel.numero}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          {rel.joursRetard} jours de retard
                        </span>
                      </div>
                      <p className="font-montserrat font-bold text-globus-blue-dark">
                        {rel.client} — {rel.projet}
                      </p>
                      <p className="font-opensans text-xs text-globus-gray mt-1">
                        Échéance : {rel.echeance} • {rel.nbRelances} relance(s)
                        envoyée(s) • Dernière : {rel.derniereRelance}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-montserrat font-bold text-lg text-red-600">
                        {formatCurrency(rel.montant)}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                      onClick={() => handleRelance(rel.id, rel.client)}
                      disabled={isProcessing === `relance-${rel.id}`}
                      className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 text-xs disabled:opacity-70">
                      
                          {isProcessing === `relance-${rel.id}` ?
                      <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

                      <SendIcon className="w-3.5 h-3.5" />
                      }{' '}
                          Relancer
                        </button>
                        <button
                      className="p-2 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded-lg transition-colors"
                      title="Appeler">
                      
                          <PhoneIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
            )}
            </div>
          </motion.div>

          {/* Summary */}
          <motion.div
          variants={fadeUp}
          className="bg-red-50 border border-red-200 rounded-xl p-5">
          
            <div className="flex items-center gap-3">
              <WalletIcon className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-montserrat font-bold text-red-800">
                  Total Créances en Retard
                </p>
                <p className="font-montserrat font-extrabold text-2xl text-red-700">
                  {formatCurrency(totalRetard)}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      }

      {/* TAB: Appels de Fonds */}
      {activeTab === 'appels_fonds' &&
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="space-y-6">
        
          {/* Project selector + real budget progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
              Projet
            </label>
            <select
              value={afProjectId}
              onChange={(e) => setAfProjectId(e.target.value)}
              className="w-full md:w-96 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
              <option value="">— Tous les projets —</option>
              {projectOptions.map((p) =>
              <option key={p.id} value={p.id}>{p.name || p.code}</option>
              )}
            </select>
            {projectOptions.length === 0 &&
            <p className="text-xs text-globus-gray mt-2">Aucun projet disponible.</p>
            }

            {afProject &&
            <div className="mt-6">
              <div className="flex flex-col md:flex-row justify-between gap-6 mb-4">
                <div>
                  <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                    {afProject.name}
                  </h3>
                  {(() => {
                    const c = clientOptions.find((cl) => cl.id === afProject.client_id);
                    const nm = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : '';
                    return nm ? <p className="text-sm text-globus-gray">{nm}</p> : null;
                  })()}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">Budget Total</p>
                  <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                    {formatCurrency(afBudget)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-green-600">Payé : {formatCurrency(afPaid)}</span>
                  <span className="text-globus-gray">Reste : {formatCurrency(afRemaining)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${afPct}%` }} />
                </div>
                <p className="text-right text-xs text-gray-500 font-bold">{afPct}%</p>
              </div>
            </div>
            }
          </div>

          {/* Appels de Fonds List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
                <WalletIcon className="w-5 h-5 text-globus-orange" />
                Échéancier des Appels de Fonds
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {afInvoices.length === 0 ?
            <div className="p-10 text-center text-globus-gray font-opensans text-sm">
                Aucun appel de fonds {afProjectId ? 'pour ce projet' : 'enregistré'}.
              </div> :

            afInvoices.map((af) =>
            <div
              key={af.id}
              className="p-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">

                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <FileTextIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-gray-400 font-bold">
                          {af.numero}
                        </span>
                        {getStatusBadge(af.status)}
                      </div>
                      <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                        {af.description || af.projet}
                      </p>
                      {af.status === 'payee' && af.dateEmission &&
                  <p className="text-xs text-gray-500 mt-1">
                          Émis le {af.dateEmission}
                        </p>
                  }
                      {(af.status === 'en-attente' || af.status === 'en-retard') && af.dateEcheance &&
                  <p className="text-xs text-orange-600 mt-1">
                          Échéance : {af.dateEcheance}
                        </p>
                  }
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-montserrat font-bold text-globus-blue-dark">
                      {formatCurrency(af.montant)}
                    </p>
                    {(af.status === 'en-attente' || af.status === 'en-retard') &&
                <button
                  onClick={() => handleRelance(af.id, af.client)}
                  disabled={isProcessing === `relance-${af.id}`}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 text-xs disabled:opacity-70">

                        {isProcessing === `relance-${af.id}` ?
                  <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

                  <SendIcon className="w-3.5 h-3.5" />
                  }{' '}
                        Relancer
                      </button>
                }
                    {af.status === 'payee' &&
                <button
                  onClick={() => handleDownload(af.id, 'facture')}
                  disabled={isProcessing === `download-${af.id}`}
                  className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded-lg transition-colors"
                  title="Télécharger le reçu">

                        {isProcessing === `download-${af.id}` ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <DownloadIcon className="w-4 h-4" />
                  }
                      </button>
                }
                  </div>
                </div>
            )}
            </div>
          </div>
        </motion.div>
      }

      {/* New Invoice Modal */}
      <AnimatePresence>
        {showNewInvoice &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewInvoice(false)}>
          
            <motion.div
            initial={{
              scale: 0.95,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.95,
              opacity: 0
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            
              <div className="bg-globus-blue-dark p-6 text-white flex items-center justify-between">
                <h3 className="font-montserrat font-bold text-xl">
                  Nouvelle Facture
                </h3>
                <button
                onClick={() => setShowNewInvoice(false)}
                className="text-white/70 hover:text-white">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Projet
                  </label>
                  <select
                  value={invForm.projectId}
                  onChange={(e) => setInvForm({ ...invForm, projectId: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                    <option value="">— Sélectionner un projet —</option>
                    {projectOptions.map((p) =>
                  <option key={p.id} value={p.id}>{p.name || p.code}</option>
                  )}
                  </select>
                  {projectOptions.length === 0 &&
                <p className="text-xs text-globus-gray mt-1.5">Aucun projet disponible. Créez d'abord un chantier.</p>
                }
                  <p className="text-xs text-globus-gray mt-1.5">Le client est rattaché automatiquement au projet sélectionné.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Montant (FCFA)
                    </label>
                    <input
                    type="number"
                    placeholder="0"
                    value={invForm.amount}
                    onChange={(e) => setInvForm({ ...invForm, amount: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />

                  </div>
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Échéance
                    </label>
                    <input
                    type="date"
                    value={invForm.dueDate}
                    onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />

                  </div>
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Description
                  </label>
                  <textarea
                  rows={3}
                  placeholder="Détails de la facture..."
                  value={invForm.description}
                  onChange={(e) => setInvForm({ ...invForm, description: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange resize-none" />

                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                  onClick={() => setShowNewInvoice(false)}
                  className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                  
                    Annuler
                  </button>
                  <button
                  onClick={handleCreateInvoice}
                  disabled={isProcessing === 'create-invoice'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {isProcessing === 'create-invoice' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <ReceiptIcon className="w-4 h-4" />
                  }{' '}
                    Créer la Facture
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* New Devis Modal */}
      <AnimatePresence>
        {showNewDevis &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewDevis(false)}>
          
            <motion.div
            initial={{
              scale: 0.95,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.95,
              opacity: 0
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            
              <div className="bg-globus-blue-dark p-6 text-white flex items-center justify-between">
                <h3 className="font-montserrat font-bold text-xl">
                  Nouveau Devis
                </h3>
                <button
                onClick={() => setShowNewDevis(false)}
                className="text-white/70 hover:text-white">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Client
                  </label>
                  <input
                  type="text"
                  list="devis-client-list"
                  value={devisForm.clientName}
                  onChange={(e) => setDevisForm({ ...devisForm, clientName: e.target.value })}
                  placeholder="Nom du client"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                  <datalist id="devis-client-list">
                    {clientOptions.map((c) =>
                  <option key={c.id} value={`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email} />
                  )}
                  </datalist>
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Projet
                  </label>
                  <input
                  type="text"
                  list="devis-project-list"
                  value={devisForm.projectLabel}
                  onChange={(e) => setDevisForm({ ...devisForm, projectLabel: e.target.value })}
                  placeholder="Nom du projet"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                  <datalist id="devis-project-list">
                    {projectOptions.map((p) =>
                  <option key={p.id} value={p.name || p.code} />
                  )}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Montant Estimé (FCFA)
                    </label>
                    <input
                    type="number"
                    placeholder="0"
                    value={devisForm.amount}
                    onChange={(e) => setDevisForm({ ...devisForm, amount: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />

                  </div>
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Validité
                    </label>
                    <input
                    type="date"
                    value={devisForm.validity}
                    onChange={(e) => setDevisForm({ ...devisForm, validity: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />

                  </div>
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Notes internes
                  </label>
                  <textarea
                  rows={3}
                  placeholder="Détails du devis..."
                  value={devisForm.notes}
                  onChange={(e) => setDevisForm({ ...devisForm, notes: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange resize-none" />

                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                  onClick={() => setShowNewDevis(false)}
                  className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                  
                    Annuler
                  </button>
                  <button
                  onClick={handleCreateDevis}
                  disabled={isProcessing === 'create-devis'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {isProcessing === 'create-devis' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <FileTextIcon className="w-4 h-4" />
                  }{' '}
                    Créer le Devis
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {selectedInvoice &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedInvoice(null)}>
          
            <motion.div
            initial={{
              scale: 0.95,
              opacity: 0,
              y: 20
            }}
            animate={{
              scale: 1,
              opacity: 1,
              y: 0
            }}
            exit={{
              scale: 0.95,
              opacity: 0,
              y: 20
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            
              <div className="bg-globus-blue-dark p-6 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-montserrat font-bold text-xl flex items-center gap-2">
                    Facture {selectedInvoice.numero}
                  </h3>
                  <p className="text-sm text-blue-200 mt-1">
                    {selectedInvoice.client} - {selectedInvoice.projet}
                  </p>
                </div>
                <button
                onClick={() => setSelectedInvoice(null)}
                className="text-white/70 hover:text-white bg-white/10 p-2 rounded-full transition-colors">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Montant Total</p>
                    <p className="font-montserrat font-extrabold text-3xl text-globus-blue-dark">
                      {formatCurrency(selectedInvoice.montant)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">Statut</p>
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <CalendarIcon className="w-4 h-4" />{' '}
                      <span className="text-sm">Date d'émission</span>
                    </div>
                    <p className="font-semibold text-gray-800">
                      {selectedInvoice.dateEmission}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <ClockIcon className="w-4 h-4" />{' '}
                      <span className="text-sm">Date d'échéance</span>
                    </div>
                    <p className="font-semibold text-gray-800">
                      {selectedInvoice.dateEcheance}
                    </p>
                  </div>
                </div>

                <h4 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4">
                  Détails des prestations
                </h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden mb-8">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="p-3 font-semibold text-gray-600">
                          Description
                        </th>
                        <th className="p-3 font-semibold text-gray-600 text-center">
                          Qté
                        </th>
                        <th className="p-3 font-semibold text-gray-600 text-right">
                          Prix Unitaire
                        </th>
                        <th className="p-3 font-semibold text-gray-600 text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="p-3 text-gray-800">
                          Appel de fonds n°{selectedInvoice.appelFonds || 1} -
                          Avancement travaux
                        </td>
                        <td className="p-3 text-gray-600 text-center">1</td>
                        <td className="p-3 text-gray-600 text-right">
                          {formatCurrency(selectedInvoice.montant)}
                        </td>
                        <td className="p-3 font-semibold text-gray-800 text-right">
                          {formatCurrency(selectedInvoice.montant)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                <button
                onClick={() => handleDownload(selectedInvoice.id, 'facture')}
                disabled={isProcessing === `download-${selectedInvoice.id}`}
                className="text-globus-blue hover:text-globus-blue-dark font-montserrat font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70">
                
                  {isProcessing === `download-${selectedInvoice.id}` ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :

                <DownloadIcon className="w-4 h-4" />
                }{' '}
                  Télécharger PDF
                </button>

                <div className="flex gap-2">
                  {(selectedInvoice.status === 'en-attente' ||
                selectedInvoice.status === 'en-retard') &&
                <button
                  onClick={() => handleMarkAsPaid(selectedInvoice.id)}
                  disabled={isProcessing === `pay-${selectedInvoice.id}`}
                  className="bg-green-600 hover:bg-green-700 text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70">
                  
                      {isProcessing === `pay-${selectedInvoice.id}` ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }{' '}
                      Marquer Payée
                    </button>
                }
                  {selectedInvoice.status === 'en-retard' &&
                <button
                  onClick={() =>
                  handleRelance(
                    selectedInvoice.id,
                    selectedInvoice.client
                  )
                  }
                  disabled={
                  isProcessing === `relance-${selectedInvoice.id}`
                  }
                  className="bg-red-500 hover:bg-red-600 text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70">
                  
                      {isProcessing === `relance-${selectedInvoice.id}` ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <SendIcon className="w-4 h-4" />
                  }{' '}
                      Relancer
                    </button>
                }
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmAction &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          
            <motion.div
            initial={{
              scale: 0.95,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.95,
              opacity: 0
            }}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangleIcon className="w-8 h-8" />
              </div>
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                {confirmAction.title}
              </h3>
              <p className="text-gray-600 mb-6">{confirmAction.message}</p>
              <div className="flex gap-3 justify-center">
                <button
                onClick={() => setConfirmAction(null)}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                
                  Annuler
                </button>
                <button
                onClick={confirmAction.onConfirm}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-white bg-globus-blue hover:bg-globus-blue-dark transition-colors shadow-md">
                
                  Confirmer
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast &&
        <motion.div
          initial={{
            opacity: 0,
            y: 50,
            scale: 0.9
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1
          }}
          exit={{
            opacity: 0,
            y: 20,
            scale: 0.9
          }}
          className="fixed bottom-6 right-6 z-[70]">
          
            <div
            className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 font-montserrat font-bold text-sm text-white ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-globus-blue-dark'}`}>
            
              {toast.type === 'success' ?
            <CheckCircle2Icon className="w-5 h-5" /> :
            toast.type === 'error' ?
            <AlertTriangleIcon className="w-5 h-5" /> :

            <ClockIcon className="w-5 h-5" />
            }
              {toast.message}
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}