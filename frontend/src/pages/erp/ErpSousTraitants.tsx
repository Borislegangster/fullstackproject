import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { UsersRoundIcon, ClipboardListIcon, ReceiptIcon, PlusIcon, StarIcon, CheckCircle2Icon, PhoneIcon, XIcon, Loader2Icon, AlertTriangleIcon, FileTextIcon, MailIcon, MessageSquareIcon, Trash2Icon } from 'lucide-react';
import { formatDate } from '../../utils/datetime';
import {
  useSubcontractors, useCreateSubcontractor, useSubcontractorInvoices,
  useUpdateSubcontractorInvoiceStatus, useEvaluateSubcontractor, useDeleteSubcontractor,
  useSubcontractorSituations, useCreateSituation, useValidateSituation, useRefuseSituation,
  useProjects,
} from '../../hooks/useErp';
import { AnimatePresence } from 'framer-motion';
export function ErpSousTraitants() {
  // API hooks
  const { data: apiSubs } = useSubcontractors();
  const { data: apiInvoices } = useSubcontractorInvoices();
  const createSubMutation = useCreateSubcontractor();
  const updateInvoiceMutation = useUpdateSubcontractorInvoiceStatus();
  const evaluateMutation = useEvaluateSubcontractor();
  const deleteSubMutation = useDeleteSubcontractor();
  const { data: apiSituations } = useSubcontractorSituations();
  const { data: apiProjects } = useProjects();
  const createSituationMutation = useCreateSituation();
  const validateSituationMutation = useValidateSituation();
  const refuseSituationMutation = useRefuseSituation();
  const projectOptions: any[] = Array.isArray(apiProjects) ? apiProjects : [];
  const liveSituations = useMemo<any[]>(() => {
    if (!Array.isArray(apiSituations)) return [];
    return apiSituations.map((s: any) => ({
      id: s.id, sub: s.subcontractor_name || '', project: s.project_name || '',
      description: s.description || '', progress: s.progress_pct || 0,
      amount: s.amount || 0, status: s.status,
    }));
  }, [apiSituations]);
  const [showNewSituation, setShowNewSituation] = useState(false);
  const handleNewSituation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing('new-situation');
    const f = e.target as any;
    try {
      await createSituationMutation.mutateAsync({
        subcontractor_id: f.subcontractor.value || undefined,
        project_id: f.project.value || undefined,
        description: f.description.value,
        progress_pct: parseInt(f.progress.value) || 0,
        amount: parseFloat(f.amount.value) || 0,
      });
      setShowNewSituation(false);
      showToast('Situation déclarée', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  // Map API → UI shapes
  const liveSubs = useMemo<any[]>(() => {
    if (!Array.isArray(apiSubs)) return [];
    return apiSubs.map((s: any) => ({
      name: s.company_name || '',
      specialty: s.speciality || '',
      contact: s.contact_name || '',
      phone: s.phone || '',
      projects: 0, // will be enriched below
      rating: s.rating || 0,
      raw_id: s.id,
      email: s.email || '',
    }));
  }, [apiSubs]);

  // Enrich project counts from situations data
  const liveSubsEnriched = useMemo(() => {
    if (!Array.isArray(apiSituations)) return liveSubs;
    const countMap: Record<string, Set<string>> = {};
    for (const s of apiSituations) {
      if (s.subcontractor_id && s.project_id) {
        if (!countMap[s.subcontractor_id]) countMap[s.subcontractor_id] = new Set();
        countMap[s.subcontractor_id].add(s.project_id);
      }
    }
    return liveSubs.map((sub: any) => ({
      ...sub,
      projects: countMap[sub.raw_id]?.size || 0,
    }));
  }, [liveSubs, apiSituations]);

  const liveInvoicesFromApi = useMemo(() => {
    if (!Array.isArray(apiInvoices)) return [];
    return apiInvoices.map((inv: any) => ({
      id: inv.code,
      partner: inv.subcontractor_name || '',
      supplier: inv.subcontractor_name || '',
      ref: inv.code || '',
      amount: inv.amount || 0,
      date: formatDate(inv.issue_date),
      status: inv.status === 'PAYEE' ? 'Payée'
        : inv.status === 'VALIDEE' ? 'Validée'
        : inv.status === 'REFUSEE' ? 'Refusée' : 'En attente',
      raw_id: inv.id,
    }));
  }, [apiInvoices]);

  const [activeTab, setActiveTab] = useState('subs');
  // New states for interactive features
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [partnerToRate, setPartnerToRate] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
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
  const handleAddPartner = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsProcessing('add-partner');
    const form = e?.target as HTMLFormElement | undefined;
    try {
      await createSubMutation.mutateAsync({
        company_name: form
          ? (form.elements.namedItem('company_name') as HTMLInputElement)?.value || 'Sous-traitant'
          : 'Sous-traitant',
        contact_name: form
          ? (form.elements.namedItem('contact_name') as HTMLInputElement)?.value || ''
          : '',
        email: form
          ? (form.elements.namedItem('email') as HTMLInputElement)?.value || ''
          : '',
        phone: form
          ? (form.elements.namedItem('phone') as HTMLInputElement)?.value || ''
          : '',
        speciality: form
          ? (form.elements.namedItem('speciality') as HTMLInputElement)?.value || ''
          : '',
      });
      setShowAddPartner(false);
      showToast('Nouveau sous-traitant ajouté', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleInvoiceAction = async (id: string, action: string) => {
    setIsProcessing(`${action}-${id}`);
    // Map UI action → backend status
    const status = action === 'val' ? 'VALIDEE'
      : action === 'pay' ? 'PAYEE'
      : action === 'ref' ? 'REFUSEE' : 'A_VALIDER';
    // Find the raw_id from current list
    const inv = liveInvoicesFromApi.find((i: any) => i.id === id || i.raw_id === id);
    const realId = (inv as any)?.raw_id || id;
    try {
      await updateInvoiceMutation.mutateAsync({ id: realId, status });
      const msg = action === 'val' ? 'Facture validée'
        : action === 'pay' ? 'Facture payée' : 'Statut mis à jour';
      showToast(msg, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleRateSubmit = async () => {
    setIsProcessing('rate');
    const sub = liveSubs.find((s) => s.name === partnerToRate);
    try {
      if (sub?.raw_id) {
        await evaluateMutation.mutateAsync({
          subId: sub.raw_id,
          data: {
            project_id: '',
            quality: ratingValue,
            timeliness: ratingValue,
            communication: ratingValue,
            comments: '',
          },
        });
      }
      setShowRatingModal(false);
      setRatingValue(0);
      showToast('Évaluation enregistrée', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleDeleteSub = async () => {
    if (!selectedPartner?.raw_id) {
      setSelectedPartner(null);
      return;
    }
    setIsProcessing('delete-sub');
    try {
      await deleteSubMutation.mutateAsync(selectedPartner.raw_id);
      showToast('Sous-traitant supprimé', 'info');
      setSelectedPartner(null);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const fmt = (v: number) =>
  new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  }).format(v) + ' FCFA';
  const tabs = [
  {
    id: 'subs',
    label: 'Sous-Traitants',
    icon: UsersRoundIcon
  },
  {
    id: 'situations',
    label: 'Situations de Travaux',
    icon: ClipboardListIcon
  },
  {
    id: 'invoices',
    label: 'Factures Fournisseurs',
    icon: ReceiptIcon
  }];

  const getInvoiceStatus = (s: string) => {
    switch (s) {
      case 'Soumise':
        return 'bg-blue-100 text-blue-700';
      case 'Validée':
        return 'bg-green-100 text-green-700';
      case 'Payée':
        return 'bg-gray-100 text-gray-600';
      case 'En litige':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) =>
        <StarIcon
          key={s}
          className={`w-3.5 h-3.5 ${s <= Math.floor(rating) ? 'text-globus-orange fill-globus-orange' : s - 0.5 <= rating ? 'text-globus-orange fill-globus-orange/50' : 'text-gray-300'}`} />

        )}
        <span className="text-xs text-globus-gray ml-1 font-semibold">
          {rating}
        </span>
      </div>);

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
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-montserrat font-bold text-sm transition-all ${activeTab === tab.id ? 'bg-globus-orange text-white shadow-md' : 'text-globus-gray hover:bg-globus-light'}`}>
              
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>);

        })}
      </div>

      {activeTab === 'subs' &&
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
              Gestion des Sous-Traitants
            </h2>
            <button
            onClick={() => setShowAddPartner(true)}
            className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
            
              <PlusIcon className="w-4 h-4" /> Ajouter Partenaire
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveSubsEnriched.map((sub, idx) =>
          <motion.div
            key={sub.name}
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              delay: idx * 0.05
            }}
            onClick={() => setSelectedPartner(sub)}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer group">
            
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-lg shrink-0 group-hover:bg-globus-blue transition-colors">
                    {sub.name.charAt(0)}
                  </div>
                  <span className="bg-globus-light text-globus-gray text-xs font-bold px-2 py-1 rounded border border-gray-200">
                    {sub.specialty}
                  </span>
                </div>
                <h3 className="font-montserrat font-bold text-globus-blue-dark mb-1">
                  {sub.name}
                </h3>
                <p className="text-xs text-globus-gray font-opensans flex items-center gap-1 mb-1">
                  <PhoneIcon className="w-3 h-3" />
                  {sub.contact} — {sub.phone}
                </p>
                <p className="text-xs text-globus-gray font-opensans mb-3">
                  {sub.projects} projet(s) actif(s)
                </p>
                {renderStars(sub.rating)}
              </motion.div>
          )}
          </div>
        </motion.div>
      }

      {activeTab === 'situations' &&
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
              <ClipboardListIcon className="w-5 h-5 text-globus-orange" /> Situations de travaux
            </h3>
            <button
              onClick={() => setShowNewSituation(true)}
              className="bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
              <PlusIcon className="w-4 h-4" /> Nouvelle situation
            </button>
          </div>
          {liveSituations.length === 0 ?
          <p className="p-8 text-center text-sm text-gray-400 italic">Aucune situation de travaux enregistrée.</p> :
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-globus-light border-b border-gray-200 text-xs text-globus-blue-dark">
                  <th className="p-3 font-semibold">Sous-traitant</th>
                  <th className="p-3 font-semibold">Projet</th>
                  <th className="p-3 font-semibold">Description</th>
                  <th className="p-3 font-semibold">Avanc.</th>
                  <th className="p-3 font-semibold">Montant</th>
                  <th className="p-3 font-semibold">Statut</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-opensans">
                {liveSituations.map((s) =>
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-semibold text-globus-blue-dark">{s.sub || '—'}</td>
                      <td className="p-3 text-globus-gray">{s.project || '—'}</td>
                      <td className="p-3 text-globus-gray">{s.description}</td>
                      <td className="p-3">{s.progress}%</td>
                      <td className="p-3 font-bold text-globus-blue-dark">{fmt(s.amount)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${s.status === 'VALIDEE' ? 'bg-green-100 text-green-700' : s.status === 'REFUSEE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {s.status === 'VALIDEE' ? 'Validée' : s.status === 'REFUSEE' ? 'Refusée' : 'Soumise'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {s.status === 'SOUMISE' &&
                    <div className="flex justify-end gap-2">
                          <button onClick={() => validateSituationMutation.mutate(s.id)} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-bold transition-colors">Valider</button>
                          <button onClick={() => refuseSituationMutation.mutate(s.id)} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2.5 py-1 rounded-lg font-bold transition-colors">Refuser</button>
                        </div>
                    }
                      </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
          }
        </div>
      </motion.div>
      }

      {/* New Situation Modal */}
      <AnimatePresence>
        {showNewSituation &&
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewSituation(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-globus-blue-dark p-6 text-white flex items-center justify-between">
              <h3 className="font-montserrat font-bold text-xl">Nouvelle situation de travaux</h3>
              <button onClick={() => setShowNewSituation(false)} className="text-white/70 hover:text-white"><XIcon className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleNewSituation} className="p-6 space-y-4">
              <div>
                <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">Sous-traitant</label>
                <select name="subcontractor" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-globus-orange">
                  <option value="">— Sélectionner —</option>
                  {liveSubs.map((s) => <option key={s.raw_id} value={s.raw_id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">Projet</label>
                <select name="project" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-globus-orange">
                  <option value="">— Sélectionner —</option>
                  {projectOptions.map((pr) => <option key={pr.id} value={pr.id}>{pr.name || pr.code}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">Description des travaux</label>
                <input name="description" type="text" placeholder="Ex: Pose fenêtres RDC" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-globus-orange" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">% Avancement</label>
                  <input name="progress" type="number" min="0" max="100" defaultValue="0" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-globus-orange" />
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">Montant (FCFA)</label>
                  <input name="amount" type="number" placeholder="0" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-globus-orange" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowNewSituation(false)} className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">Annuler</button>
                <button type="submit" disabled={isProcessing === 'new-situation'} className="bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2 disabled:opacity-70">
                  {isProcessing === 'new-situation' ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <CheckCircle2Icon className="w-4 h-4" />} Soumettre
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
        }
      </AnimatePresence>

      {activeTab === 'invoices' &&
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}>
        
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
              Factures Reçues
            </h2>
            <div className="flex gap-3 text-xs font-montserrat font-bold">
              <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg">
                {liveInvoicesFromApi.filter((i) => i.status === 'En attente' || i.status === 'Soumise').length} en attente
              </span>
              <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg">
                {liveInvoicesFromApi.filter((i) => i.status === 'Validée').length} validées
              </span>
              <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">
                {liveInvoicesFromApi.filter((i) => i.status === 'Payée').length} payées
              </span>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-globus-light border-b border-gray-200">
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                      N° Facture
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                      Fournisseur
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                      Montant
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                      Date
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                      Statut
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="font-opensans text-sm">
                  {liveInvoicesFromApi.length === 0 &&
                <tr><td colSpan={6} className="p-8 text-center text-globus-gray">
                    Aucune facture sous-traitant enregistrée.
                  </td></tr>
                }
                  {liveInvoicesFromApi.map((inv) =>
                <tr
                  key={inv.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  
                      <td className="p-4 font-mono text-xs text-gray-500">
                        {inv.id}
                      </td>
                      <td className="p-4 font-semibold text-globus-blue-dark">
                        {inv.supplier}
                      </td>
                      <td className="p-4 font-bold text-globus-blue-dark">
                        {fmt(inv.amount)}
                      </td>
                      <td className="p-4 text-globus-gray">{inv.date}</td>
                      <td className="p-4">
                        <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold font-montserrat ${getInvoiceStatus(inv.status)}`}>
                      
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {inv.status === 'Soumise' &&
                    <button
                      onClick={() => handleInvoiceAction(inv.id, 'val')}
                      disabled={isProcessing === `val-${inv.id}`}
                      className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 ml-auto disabled:opacity-50">
                      
                            {isProcessing === `val-${inv.id}` ?
                      <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :
                      null}{' '}
                            Valider
                          </button>
                    }
                        {inv.status === 'Validée' &&
                    <button
                      onClick={() => handleInvoiceAction(inv.id, 'pay')}
                      disabled={isProcessing === `pay-${inv.id}`}
                      className="text-xs bg-globus-blue hover:bg-globus-blue/90 text-white px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 ml-auto disabled:opacity-50">
                      
                            {isProcessing === `pay-${inv.id}` ?
                      <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :
                      null}{' '}
                            Payer
                          </button>
                    }
                        {inv.status === 'En litige' &&
                    <button
                      onClick={() => handleInvoiceAction(inv.id, 'res')}
                      disabled={isProcessing === `res-${inv.id}`}
                      className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 ml-auto disabled:opacity-50">
                      
                            {isProcessing === `res-${inv.id}` ?
                      <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :
                      null}{' '}
                            Résoudre
                          </button>
                    }
                        {inv.status === 'Payée' &&
                    <span className="text-xs text-gray-400">—</span>
                    }
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      }

      {/* Add Partner Modal */}
      <AnimatePresence>
        {showAddPartner &&
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
          onClick={() => setShowAddPartner(false)}>
          
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
                  Nouveau Sous-Traitant
                </h3>
                <button
                onClick={() => setShowAddPartner(false)}
                className="text-white/70 hover:text-white">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                    Raison Sociale
                  </label>
                  <input
                  type="text"
                  placeholder="Nom de l'entreprise"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                    Spécialité
                  </label>
                  <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                    <option>Menuiserie</option>
                    <option>Électricité</option>
                    <option>Plomberie</option>
                    <option>Peinture</option>
                    <option>Maçonnerie</option>
                    <option>Logistique</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                      Contact Principal
                    </label>
                    <input
                    type="text"
                    placeholder="Nom du contact"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                  
                  </div>
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                      Téléphone
                    </label>
                    <input
                    type="tel"
                    placeholder="+237..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                  
                  </div>
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                    Email
                  </label>
                  <input
                  type="email"
                  placeholder="contact@entreprise.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                    N° Contribuable / RCCM
                  </label>
                  <input
                  type="text"
                  placeholder="Identifiant légal"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                  onClick={() => setShowAddPartner(false)}
                  className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                  
                    Annuler
                  </button>
                  <button
                  onClick={handleAddPartner}
                  disabled={isProcessing === 'add-partner'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {isProcessing === 'add-partner' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <PlusIcon className="w-4 h-4" />
                  }{' '}
                    Enregistrer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Partner Detail Modal */}
      <AnimatePresence>
        {selectedPartner &&
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
          onClick={() => setSelectedPartner(null)}>
          
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
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            
              <div className="bg-globus-blue-dark p-6 text-white flex items-start justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center font-montserrat font-bold text-3xl">
                    {selectedPartner.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-montserrat font-bold text-2xl mb-1">
                      {selectedPartner.name}
                    </h3>
                    <span className="bg-globus-orange px-2 py-0.5 rounded text-xs font-bold">
                      {selectedPartner.specialty}
                    </span>
                  </div>
                </div>
                <button
                onClick={() => setSelectedPartner(null)}
                className="text-white/70 hover:text-white bg-white/10 p-2 rounded-full transition-colors">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-4">
                    <h4 className="font-montserrat font-bold text-globus-blue-dark border-b border-gray-100 pb-2">
                      Coordonnées
                    </h4>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <UsersRoundIcon className="w-4 h-4 text-globus-orange" />{' '}
                      {selectedPartner.contact}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <PhoneIcon className="w-4 h-4 text-globus-orange" />{' '}
                      {selectedPartner.phone}
                    </div>
                    {selectedPartner.email &&
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <MailIcon className="w-4 h-4 text-globus-orange" />{' '}
                      {selectedPartner.email}
                    </div>
                    }
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-montserrat font-bold text-globus-blue-dark border-b border-gray-100 pb-2">
                      Performance
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500">
                          Note globale
                        </span>
                        <div className="flex items-center gap-1">
                          <StarIcon className="w-4 h-4 text-globus-orange fill-globus-orange" />
                          <span className="font-bold text-globus-blue-dark">
                            {selectedPartner.rating}/5
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Projets réalisés
                        </span>
                        <span className="font-bold text-globus-blue-dark">
                          {selectedPartner.projects}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="font-montserrat font-bold text-globus-blue-dark border-b border-gray-100 pb-2 mb-4">
                  Historique des interventions
                </h4>
                <p className="text-sm text-gray-400 italic">Aucune intervention enregistrée pour ce sous-traitant.</p>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                <button
                onClick={handleDeleteSub}
                disabled={isProcessing === 'delete-sub'}
                className="bg-white border border-red-200 text-red-600 hover:bg-red-50 font-montserrat font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm mr-auto disabled:opacity-70">
                  {isProcessing === 'delete-sub' ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :
                <Trash2Icon className="w-4 h-4" />}
                  Supprimer
                </button>
                <button
                onClick={() => { setPartnerToRate(selectedPartner.name); setShowRatingModal(true); }}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-montserrat font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm">
                  <StarIcon className="w-4 h-4" /> Noter
                </button>
                <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-montserrat font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm">
                  <MessageSquareIcon className="w-4 h-4" /> Contacter
                </button>
                <button className="bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
                  <FileTextIcon className="w-4 h-4" /> Voir Contrats
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>


      {/* Rating Modal */}
      <AnimatePresence>
        {showRatingModal && partnerToRate &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setShowRatingModal(false)}>
          
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
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-1">
                Évaluer la prestation
              </h3>
              <p className="text-sm text-gray-500 mb-6">{partnerToRate}</p>

              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) =>
              <button
                key={star}
                onClick={() => setRatingValue(star)}
                className="focus:outline-none transition-transform hover:scale-110">
                
                    <StarIcon
                  className={`w-10 h-10 ${star <= ratingValue ? 'text-globus-orange fill-globus-orange' : 'text-gray-200'}`} />
                
                  </button>
              )}
              </div>

              <textarea
              rows={3}
              placeholder="Commentaire optionnel..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange resize-none mb-6" />
            

              <div className="flex gap-3 justify-center">
                <button
                onClick={() => setShowRatingModal(false)}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors w-full">
                
                  Plus tard
                </button>
                <button
                onClick={handleRateSubmit}
                disabled={ratingValue === 0 || isProcessing === 'rate'}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-white bg-globus-orange hover:bg-globus-orange-hover transition-colors shadow-md w-full flex justify-center items-center gap-2 disabled:opacity-50">
                
                  {isProcessing === 'rate' ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :
                null}{' '}
                  Valider
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

            <CheckCircle2Icon className="w-5 h-5" />
            }
              {toast.message}
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}