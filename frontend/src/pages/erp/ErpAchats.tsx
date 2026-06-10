import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardListIcon, ShoppingCartIcon, BoxesIcon, PlusIcon, AlertTriangleIcon, CheckCircle2Icon, XCircleIcon, ClockIcon, PackageCheckIcon, XIcon, Loader2Icon, DownloadIcon, EyeIcon } from 'lucide-react';
import { formatDate, formatDateParts } from '../../utils/datetime';
import { ExportButton } from '../../components/ui/ExportButton';
import { exportPurchaseRequestsXlsx, exportStockXlsx } from '../../services/api/downloads';
import {
  usePurchaseRequests, useCreatePR, useValidatePR, useRejectPR, useStock,
  useCreateStockItem, useDeleteStockItem, useStockMovements, useCreateStockMovement,
  usePurchaseOrders, useReceivePurchaseOrder, useProjects,
} from '../../hooks/useErp';
const tabs = [
{
  id: 'da',
  label: "Demandes d'Achat",
  icon: ClipboardListIcon
},
{
  id: 'bc',
  label: 'Bons de Commande',
  icon: ShoppingCartIcon
},
{
  id: 'stock',
  label: 'Stock & Inventaire',
  icon: BoxesIcon
}];

interface DA {
  id: string;
  items: string;
  requestedBy: string;
  date: string;
  total: number;
  project: string;
  status: 'en-attente' | 'validee' | 'refusee';
}


interface StockItem {
  name: string;
  current: number;
  threshold: number;
  unit: string;
  status: 'ok' | 'attention' | 'alerte';
  id: string;
}


const fmt = (v: number) =>
new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0
}).format(v);
const statusBcColor = (s: string) => {
  if (s === 'Livré') return 'bg-green-100 text-green-700';
  if (s === 'Émis') return 'bg-blue-100 text-blue-700';
  return 'bg-yellow-100 text-yellow-700';
};
function prStatusToUi(status: string): DA['status'] {
  if (status === 'VALIDEE') return 'validee';
  if (status === 'REFUSEE') return 'refusee';
  return 'en-attente';
}

export function ErpAchats() {
  // API hooks
  const { data: apiPRs } = usePurchaseRequests();
  const { data: apiPOs } = usePurchaseOrders();
  const { data: apiStock } = useStock();
  const { data: apiMovements } = useStockMovements();
  const createPRMutation = useCreatePR();
  const { data: apiProjects } = useProjects();
  const projectOptions: any[] = Array.isArray(apiProjects) ? apiProjects : [];
  const validatePRMutation = useValidatePR();
  const rejectPRMutation = useRejectPR();
  const createStockItemMutation = useCreateStockItem();
  const deleteStockItemMutation = useDeleteStockItem();
  const createStockMovementMutation = useCreateStockMovement();
  const receivePOMutation = useReceivePurchaseOrder();

  // Live data mapped from API (with static fallback for empty server)
  const demandes: DA[] = useMemo(() => {
    if (!Array.isArray(apiPRs)) return [];
    return apiPRs.map((p: any) => ({
      id: p.code || p.id,
      items: Array.isArray(p.items)
        ? p.items.map((it: any) => it.designation || it.name).join(', ')
        : p.description || '',
      requestedBy: p.requested_by || '',
      date: formatDate(p.created_at),
      total: p.estimated_total || 0,
      project: p.project_id || '',
      status: prStatusToUi(p.status),
    } as DA));
  }, [apiPRs]);

  const bonsCommande = useMemo(() => {
    if (!Array.isArray(apiPOs)) return [];
    return apiPOs.map((p: any) => ({
      id: p.code || p.id,
      fournisseur: p.supplier || '',
      montant: p.total || 0,
      date: formatDate(p.created_at),
      status: p.status === 'LIVRE' ? 'Livré' : p.status === 'ANNULE' ? 'Annulé' : 'Émis',
      raw_id: p.id,
    }));
  }, [apiPOs]);

  const stockItems = useMemo<StockItem[]>(() => {
    if (!Array.isArray(apiStock)) return [];
    return apiStock.map((s: any) => ({
      name: s.name || '',
      current: s.quantity || 0,
      threshold: s.alert_threshold || 0,
      unit: s.unit || 'pcs',
      status: (s.low_stock ? 'alerte' : (s.quantity <= (s.alert_threshold || 0) * 1.5 ? 'attention' : 'ok')) as StockItem['status'],
      id: s.id,
    }));
  }, [apiStock]);

  const mouvements = useMemo(() => {
    if (!Array.isArray(apiMovements)) return [] as any[];
    return apiMovements.map((m: any) => ({
      date: formatDateParts(m.created_at, { day: '2-digit', month: '2-digit' }),
      type: m.movement_type === 'IN' ? 'Entrée' : 'Sortie',
      item: m.stock_item_id || '',
      qty: `${m.quantity || 0}`,
      site: m.project_id || '',
      by: m.recorded_by || '',
    }));
  }, [apiMovements]);

  const [activeTab, setActiveTab] = useState('da');
  // UI States
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState({
    active: false,
    progress: 0,
    done: false,
    filename: ''
  });
  // Modals
  const [daModal, setDaModal] = useState(false);
  const [refuseModal, setRefuseModal] = useState<{
    isOpen: boolean;
    daId: string | null;
  }>({
    isOpen: false,
    daId: null
  });
  const [bcModal, setBcModal] = useState<{
    isOpen: boolean;
    da: DA | null;
  }>({
    isOpen: false,
    da: null
  });
  const [bcDetailModal, setBcDetailModal] = useState<{
    isOpen: boolean;
    bc: (typeof bonsCommande)[0] | null;
  }>({
    isOpen: false,
    bc: null
  });
  const [consoModal, setConsoModal] = useState(false);
  const [showNewStock, setShowNewStock] = useState(false);
  const daByStatus = (status: DA['status']) =>
  demandes.filter((d) => d.status === status);
  // Handlers
  const handleValidateDA = async (id: string) => {
    setProcessingId(id);
    try {
      await validatePRMutation.mutateAsync(id);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleRefuseDA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refuseModal.daId) return;
    setProcessingId('refuse');
    const reason = (e.target as any).reason?.value || '';
    try {
      await rejectPRMutation.mutateAsync({ id: refuseModal.daId, reason });
      setRefuseModal({ isOpen: false, daId: null });
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleNewDA = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('new-da');
    try {
      const items = (e.target as any).items.value;
      const total = parseFloat((e.target as any).montant.value) || 0;
      await createPRMutation.mutateAsync({
        project_id: (e.target as any).projet.value || undefined,
        description: items,
        items: [{ designation: items, qty: 1, est_price: total }],
        estimated_total: total,
      });
      setDaModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleCreateBC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcModal.da) return;
    setProcessingId('create-bc');
    // Validate the linked PR if not yet validated — auto-creates a PO server-side.
    try {
      // bcModal.da.id is the DA code; we'd need the UUID. Server already auto-creates BC at validation.
      setBcModal({ isOpen: false, da: null });
    } finally {
      setProcessingId(null);
    }
  };
  const handleConso = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('conso');
    try {
      const stockItemId = (e.target as any).article.value;
      const qty = parseFloat((e.target as any).qty.value) || 0;
      const site = (e.target as any).chantier.value;
      const notes = (e.target as any).by.value;
      await createStockMovementMutation.mutateAsync({
        stock_item_id: stockItemId,
        movement_type: 'OUT',
        quantity: qty,
        project_id: site || undefined,
        notes: notes || '',
        reference: 'Consommation chantier',
      });
      setConsoModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleCreateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('new-stock');
    try {
      const f = e.target as any;
      await createStockItemMutation.mutateAsync({
        name: f.name.value,
        category: f.category?.value || '',
        unit: f.unit.value || 'pcs',
        quantity: parseFloat(f.quantity.value) || 0,
        alert_threshold: parseFloat(f.threshold.value) || 10,
      });
      setShowNewStock(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleDeleteStock = async (id: string) => {
    setProcessingId(`del-stock-${id}`);
    try {
      await deleteStockItemMutation.mutateAsync(id);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleReceivePO = async (id: string) => {
    setProcessingId(`receive-${id}`);
    try {
      await receivePOMutation.mutateAsync(id);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const triggerDownload = (filename: string) => {
    if (downloadState.active) return;
    setDownloadState({
      active: true,
      progress: 0,
      done: false,
      filename
    });
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setDownloadState((prev) => ({
        ...prev,
        progress: p
      }));
      if (p >= 100) {
        clearInterval(interval);
        setDownloadState((prev) => ({
          ...prev,
          done: true
        }));
        setTimeout(
          () =>
          setDownloadState({
            active: false,
            progress: 0,
            done: false,
            filename: ''
          }),
          3000
        );
      }
    }, 150);
  };
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-montserrat font-bold text-xs transition-all ${activeTab === tab.id ? 'bg-globus-blue-dark text-white shadow-md' : 'text-globus-gray hover:bg-gray-50'}`}>
              
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>);

        })}
      </div>

      <AnimatePresence mode="wait">
        {/* DEMANDES D'ACHAT */}
        {activeTab === 'da' &&
        <motion.div
          key="da"
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
            y: -10
          }}
          className="space-y-4">
          
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                Workflow des Demandes d'Achat
              </h2>
              <div className="flex gap-2 flex-wrap">
                <ExportButton onAction={exportPurchaseRequestsXlsx} />
                <button
                  onClick={() => setDaModal(true)}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
                  <PlusIcon className="w-4 h-4" /> Nouvelle DA
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* EN ATTENTE */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <h3 className="font-montserrat font-bold text-sm text-gray-700">
                    EN ATTENTE
                  </h3>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">
                    {daByStatus('en-attente').length}
                  </span>
                </div>
                <div className="space-y-3">
                  <AnimatePresence>
                    {daByStatus('en-attente').map((da) =>
                  <motion.div
                    key={da.id}
                    layout
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
                      scale: 0.9
                    }}
                    className="bg-white rounded-xl border-2 border-yellow-200 p-4 shadow-sm relative overflow-hidden">
                    
                        {processingId === da.id &&
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
                            <Loader2Icon className="w-6 h-6 text-globus-orange animate-spin" />
                          </div>
                    }
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-xs font-bold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">
                            {da.id}
                          </span>
                          <ClockIcon className="w-4 h-4 text-yellow-500" />
                        </div>
                        <p className="font-opensans text-sm text-gray-800 font-semibold mb-1">
                          {da.items}
                        </p>
                        <p className="text-xs text-globus-gray mb-2">
                          Par {da.requestedBy} • {da.date}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {da.project}
                          </span>
                          <span className="font-montserrat font-bold text-sm text-globus-blue-dark">
                            {fmt(da.total)}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                        onClick={() => handleValidateDA(da.id)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1">
                        
                            <CheckCircle2Icon className="w-3.5 h-3.5" /> Valider
                          </button>
                          <button
                        onClick={() =>
                        setRefuseModal({
                          isOpen: true,
                          daId: da.id
                        })
                        }
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1">
                        
                            <XCircleIcon className="w-3.5 h-3.5" /> Refuser
                          </button>
                        </div>
                      </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              </div>

              {/* VALIDÉE */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <h3 className="font-montserrat font-bold text-sm text-gray-700">
                    VALIDÉE
                  </h3>
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
                    {daByStatus('validee').length}
                  </span>
                </div>
                <div className="space-y-3">
                  <AnimatePresence>
                    {daByStatus('validee').map((da) =>
                  <motion.div
                    key={da.id}
                    layout
                    initial={{
                      opacity: 0,
                      scale: 0.95
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1
                    }}
                    className="bg-white rounded-xl border-2 border-green-200 p-4 shadow-sm">
                    
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                            {da.id}
                          </span>
                          <CheckCircle2Icon className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="font-opensans text-sm text-gray-800 font-semibold mb-1">
                          {da.items}
                        </p>
                        <p className="text-xs text-globus-gray mb-2">
                          Par {da.requestedBy} • {da.date}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {da.project}
                          </span>
                          <span className="font-montserrat font-bold text-sm text-globus-blue-dark">
                            {fmt(da.total)}
                          </span>
                        </div>
                        <button
                      onClick={() =>
                      setBcModal({
                        isOpen: true,
                        da
                      })
                      }
                      className="w-full mt-3 bg-globus-blue hover:bg-globus-blue/90 text-white text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1">
                      
                          <ShoppingCartIcon className="w-3.5 h-3.5" /> Créer BC
                        </button>
                      </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              </div>

              {/* REFUSÉE */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <h3 className="font-montserrat font-bold text-sm text-gray-700">
                    REFUSÉE
                  </h3>
                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                    {daByStatus('refusee').length}
                  </span>
                </div>
                <div className="space-y-3">
                  <AnimatePresence>
                    {daByStatus('refusee').map((da) =>
                  <motion.div
                    key={da.id}
                    layout
                    initial={{
                      opacity: 0,
                      scale: 0.95
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1
                    }}
                    className="bg-white rounded-xl border-2 border-red-200 p-4 shadow-sm opacity-75">
                    
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                            {da.id}
                          </span>
                          <XCircleIcon className="w-4 h-4 text-red-500" />
                        </div>
                        <p className="font-opensans text-sm text-gray-800 font-semibold mb-1 line-through">
                          {da.items}
                        </p>
                        <p className="text-xs text-globus-gray mb-2">
                          Par {da.requestedBy} • {da.date}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {da.project}
                          </span>
                          <span className="font-montserrat font-bold text-sm text-gray-400">
                            {fmt(da.total)}
                          </span>
                        </div>
                      </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        }

        {/* BONS DE COMMANDE */}
        {activeTab === 'bc' &&
        <motion.div
          key="bc"
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
            y: -10
          }}
          className="space-y-4">
          
            <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
              Bons de Commande
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        N° BC
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Fournisseur
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Montant
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden sm:table-cell">
                        Date
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Statut
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-opensans text-sm">
                    {bonsCommande.map((bc, i) =>
                  <tr
                    key={i}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    
                        <td className="p-3 font-mono text-xs font-bold text-globus-blue">
                          {bc.id}
                        </td>
                        <td className="p-3 font-semibold text-gray-800">
                          {bc.fournisseur}
                        </td>
                        <td className="p-3 font-mono text-xs font-semibold text-gray-800">
                          {fmt(bc.montant)} FCFA
                        </td>
                        <td className="p-3 text-globus-gray hidden sm:table-cell">
                          {bc.date}
                        </td>
                        <td className="p-3">
                          <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusBcColor(bc.status)}`}>
                        
                            {bc.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {bc.status === 'Émis' &&
                          <button
                            onClick={() => handleReceivePO(bc.raw_id)}
                            disabled={processingId === `receive-${bc.raw_id}`}
                            title="Marquer le bon de commande comme réceptionné"
                            className="text-xs font-bold text-green-700 hover:bg-green-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50">
                              {processingId === `receive-${bc.raw_id}` ?
                            <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :
                            <PackageCheckIcon className="w-3.5 h-3.5" />} Réceptionner
                            </button>
                          }
                            <button
                        onClick={() =>
                        setBcDetailModal({
                          isOpen: true,
                          bc
                        })
                        }
                        className="text-xs font-semibold text-globus-blue hover:underline flex items-center gap-1">

                              <EyeIcon className="w-3.5 h-3.5" /> Voir
                            </button>
                          </div>
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        }

        {/* STOCK */}
        {activeTab === 'stock' &&
        <motion.div
          key="stock"
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
            y: -10
          }}
          className="space-y-6">
          
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                État des Stocks
              </h2>
              <div className="flex gap-2 flex-wrap">
                <ExportButton onAction={exportStockXlsx} />
                <button
                  onClick={() => setShowNewStock(true)}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
                  <PlusIcon className="w-4 h-4" /> Nouvel article
                </button>
                <button
                  onClick={() => setConsoModal(true)}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
                  <PlusIcon className="w-4 h-4" /> Déclarer Consommation
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {stockItems.map((item, i) => {
              const pct = Math.min(
                100,
                Math.round(
                  item.current /
                  Math.max(item.threshold * 2, item.current * 1.2) *
                  100
                )
              );
              const isAlert = item.status === 'alerte';
              const barColor = isAlert ?
              'bg-red-500' :
              item.status === 'attention' ?
              'bg-orange-500' :
              'bg-green-500';
              const borderColor = isAlert ?
              'border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]' :
              item.status === 'attention' ?
              'border-orange-300' :
              'border-gray-200';
              return (
                <motion.div
                  key={i}
                  initial={{
                    opacity: 0,
                    y: 15
                  }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  transition={{
                    delay: i * 0.05
                  }}
                  className={`bg-white rounded-xl shadow-sm border-2 ${borderColor} p-4 relative overflow-hidden`}>
                  
                    {isAlert &&
                  <motion.div
                    animate={{
                      opacity: [0, 0.5, 0]
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2
                    }}
                    className="absolute inset-0 bg-red-50 pointer-events-none" />

                  }
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark">
                          {item.name}
                        </h4>
                        {isAlert &&
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                            <AlertTriangleIcon className="w-3 h-3" /> Stock Bas!
                          </span>
                      }
                        {item.status === 'attention' &&
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                            Attention
                          </span>
                      }
                        {item.status === 'ok' &&
                      <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                            OK
                          </span>
                      }
                      </div>
                      <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                        {item.current}{' '}
                        <span className="text-sm font-normal text-globus-gray">
                          {item.unit}
                        </span>
                      </p>
                      <p className="text-xs text-globus-gray mb-2">
                        Seuil min: {item.threshold} {item.unit}
                      </p>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                        <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{
                          width: `${pct}%`
                        }}>
                      </div>
                      </div>
                      {isAlert &&
                    <button
                      onClick={() => setDaModal(true)}
                      className="w-full bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1">

                          <ShoppingCartIcon className="w-3.5 h-3.5" /> Commander
                        </button>
                    }
                      <button
                      onClick={() => handleDeleteStock(item.id)}
                      disabled={processingId === `del-stock-${item.id}`}
                      className="mt-2 w-full text-gray-400 hover:text-red-500 hover:bg-red-50 text-[11px] font-bold py-1 rounded transition-colors flex items-center justify-center gap-1 disabled:opacity-50">
                        {processingId === `del-stock-${item.id}` ?
                      <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :
                      <XCircleIcon className="w-3.5 h-3.5" />} Retirer l'article
                      </button>
                    </div>
                  </motion.div>);

            })}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark">
                  Mouvements Récents
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Date
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Type
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Article
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Quantité
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden sm:table-cell">
                        Destination
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden md:table-cell">
                        Par
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-opensans text-sm">
                    {mouvements.map((m, i) =>
                  <tr
                    key={i}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    
                        <td className="p-3 font-mono text-xs text-gray-600">
                          {m.date}
                        </td>
                        <td className="p-3">
                          <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.type === 'Entrée' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        
                            {m.type}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-gray-800">
                          {m.item}
                        </td>
                        <td className="p-3 text-gray-600">{m.qty}</td>
                        <td className="p-3 text-globus-gray hidden sm:table-cell">
                          {m.site}
                        </td>
                        <td className="p-3 text-globus-gray hidden md:table-cell">
                          {m.by}
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* ===== MODALS ===== */}

      {/* Refuse DA Modal */}
      <AnimatePresence>
        {refuseModal.isOpen &&
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
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50">
                <h3 className="font-montserrat font-bold text-lg text-red-700 flex items-center gap-2">
                  <XCircleIcon className="w-5 h-5" /> Refuser la Demande
                </h3>
                <button
                onClick={() =>
                setRefuseModal({
                  isOpen: false,
                  daId: null
                })
                }
                className="text-red-400 hover:text-red-600">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleRefuseDA} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Motif du refus
                  </label>
                  <textarea
                  required
                  rows={4}
                  placeholder="Veuillez expliquer pourquoi cette demande est refusée..."
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none resize-none" />
                
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                  type="button"
                  onClick={() =>
                  setRefuseModal({
                    isOpen: false,
                    daId: null
                  })
                  }
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'refuse'}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'refuse' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <XCircleIcon className="w-4 h-4" />
                  }{' '}
                    Confirmer le refus
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* New DA Modal */}
      <AnimatePresence>
        {daModal &&
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
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
                  <ClipboardListIcon className="w-5 h-5 text-globus-orange" />{' '}
                  Nouvelle Demande d'Achat
                </h3>
                <button
                onClick={() => setDaModal(false)}
                className="text-gray-400 hover:text-gray-600">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleNewDA} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Articles demandés
                  </label>
                  <textarea
                  name="items"
                  required
                  rows={3}
                  placeholder="Ex: Ciment CPA 50T, Fer HA 12mm..."
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none resize-none" />
                
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Demandeur
                    </label>
                    <input
                    name="demandeur"
                    type="text"
                    required
                    placeholder="Nom du demandeur"
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Montant estimé (FCFA)
                    </label>
                    <input
                    name="montant"
                    type="number"
                    required
                    placeholder="Ex: 1500000"
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Projet / Chantier
                  </label>
                  <select
                  name="projet"
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">

                    <option value="">— Sélectionner un chantier —</option>
                    {projectOptions.map((p) =>
                    <option key={p.id} value={p.id}>{p.name || p.code}</option>
                    )}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                  type="button"
                  onClick={() => setDaModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'new-da'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'new-da' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }{' '}
                    Soumettre DA
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Create BC Modal */}
      <AnimatePresence>
        {bcModal.isOpen && bcModal.da &&
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
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
                  <ShoppingCartIcon className="w-5 h-5 text-globus-orange" />{' '}
                  Créer Bon de Commande
                </h3>
                <button
                onClick={() =>
                setBcModal({
                  isOpen: false,
                  da: null
                })
                }
                className="text-gray-400 hover:text-gray-600">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateBC} className="p-6 space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
                  <p className="text-xs text-gray-500 mb-1">
                    Basé sur la demande:{' '}
                    <span className="font-bold text-globus-blue">
                      {bcModal.da.id}
                    </span>
                  </p>
                  <p className="font-semibold text-sm text-gray-800">
                    {bcModal.da.items}
                  </p>
                  <p className="font-bold text-globus-blue-dark mt-2">
                    {fmt(bcModal.da.total)} FCFA
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Fournisseur
                  </label>
                  <input
                  type="text"
                  name="fournisseur"
                  required
                  placeholder="Nom du fournisseur"
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                  type="button"
                  onClick={() =>
                  setBcModal({
                    isOpen: false,
                    da: null
                  })
                  }
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'create-bc'}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'create-bc' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <ShoppingCartIcon className="w-4 h-4" />
                  }{' '}
                    Générer BC
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* BC Detail Modal */}
      <AnimatePresence>
        {bcDetailModal.isOpen && bcDetailModal.bc &&
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
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-1">
                    Bon de Commande
                  </h3>
                  <span className="font-mono text-sm font-bold text-globus-blue bg-blue-50 px-2 py-0.5 rounded">
                    {bcDetailModal.bc.id}
                  </span>
                </div>
                <button
                onClick={() =>
                setBcDetailModal({
                  isOpen: false,
                  bc: null
                })
                }
                className="text-gray-400 hover:text-gray-600">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fournisseur</p>
                    <p className="font-bold text-sm text-gray-800">
                      {bcDetailModal.bc.fournisseur}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      Date d'émission
                    </p>
                    <p className="font-bold text-sm text-gray-800">
                      {bcDetailModal.bc.date}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Montant Total</p>
                    <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
                      {fmt(bcDetailModal.bc.montant)} FCFA
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Statut</p>
                    <span
                    className={`px-2 py-1 rounded-full text-xs font-bold inline-block ${statusBcColor(bcDetailModal.bc.status)}`}>
                    
                      {bcDetailModal.bc.status}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Suivi de livraison
                  </p>
                  <div className="relative pl-4 border-l-2 border-gray-200 space-y-4">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>
                      <p className="text-sm font-bold text-gray-800">BC Émis</p>
                      <p className="text-xs text-gray-500">
                        {bcDetailModal.bc.date}
                      </p>
                    </div>
                    <div className="relative">
                      <div
                      className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${bcDetailModal.bc.status === 'Livré' || bcDetailModal.bc.status === 'Partiellement livré' ? 'bg-green-500' : 'bg-gray-300'}`}>
                    </div>
                      <p
                      className={`text-sm font-bold ${bcDetailModal.bc.status === 'Livré' || bcDetailModal.bc.status === 'Partiellement livré' ? 'text-gray-800' : 'text-gray-400'}`}>
                      
                        En cours de livraison
                      </p>
                    </div>
                    <div className="relative">
                      <div
                      className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${bcDetailModal.bc.status === 'Livré' ? 'bg-green-500' : 'bg-gray-300'}`}>
                    </div>
                      <p
                      className={`text-sm font-bold ${bcDetailModal.bc.status === 'Livré' ? 'text-gray-800' : 'text-gray-400'}`}>
                      
                        Livraison terminée
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                onClick={() =>
                triggerDownload(`BC_${bcDetailModal.bc?.id}.pdf`)
                }
                className="bg-globus-orange hover:bg-globus-orange-hover text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm">
                
                  <DownloadIcon className="w-4 h-4" /> Télécharger PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* New Stock Item Modal */}
      <AnimatePresence>
        {showNewStock &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewStock(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
                <PlusIcon className="w-5 h-5 text-globus-orange" /> Nouvel Article de Stock
              </h3>
              <button onClick={() => setShowNewStock(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateStock} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Nom de l'article</label>
                <input name="name" required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Catégorie</label>
                <input name="category"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Quantité</label>
                  <input name="quantity" type="number" defaultValue="0"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Unité</label>
                  <input name="unit" defaultValue="pcs"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Seuil min</label>
                  <input name="threshold" type="number" defaultValue="10"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewStock(false)}
                  className="px-4 py-2 rounded-lg font-bold text-globus-gray hover:bg-gray-100 text-sm">Annuler</button>
                <button type="submit" disabled={processingId === 'new-stock'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-bold py-2 px-5 rounded-lg text-sm flex items-center gap-2 disabled:opacity-70">
                  {processingId === 'new-stock' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :
                  <PlusIcon className="w-4 h-4" />}
                  Créer
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>}
      </AnimatePresence>

      {/* Stock Consumption Modal */}
      <AnimatePresence>
        {consoModal &&
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
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
                  <PackageCheckIcon className="w-5 h-5 text-globus-orange" />{' '}
                  Déclarer Consommation
                </h3>
                <button
                onClick={() => setConsoModal(false)}
                className="text-gray-400 hover:text-gray-600">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleConso} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Article
                  </label>
                  <select
                  name="article"
                  required
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">
                  
                    <option value="">Sélectionner un article...</option>
                    {stockItems.map((item) =>
                  <option key={item.name} value={item.name}>
                        {item.name} (Dispo: {item.current} {item.unit})
                      </option>
                  )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Quantité sortie
                  </label>
                  <input
                  name="qty"
                  type="number"
                  min="1"
                  required
                  placeholder="Ex: 5"
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Chantier de destination
                  </label>
                  <select
                  name="chantier"
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">

                    <option value="">— Sélectionner un chantier —</option>
                    {projectOptions.map((p) =>
                    <option key={p.id} value={p.id}>{p.name || p.code}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Déclaré par
                  </label>
                  <input
                  name="by"
                  type="text"
                  required
                  placeholder="Nom du déclarant"
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                  type="button"
                  onClick={() => setConsoModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'conso'}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'conso' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }{' '}
                    Valider Sortie
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Download Toast */}
      <AnimatePresence>
        {downloadState.active &&
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
            x: 20
          }}
          animate={{
            opacity: 1,
            y: 0,
            x: 0
          }}
          exit={{
            opacity: 0,
            y: 20,
            x: 20
          }}
          className="fixed bottom-4 right-4 z-50 bg-white shadow-xl rounded-xl border border-gray-200 p-4 w-80">
          
            <div className="flex items-center gap-3 mb-3">
              {downloadState.done ?
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2Icon className="w-4 h-4 text-green-600" />
                </div> :

            <div className="w-8 h-8 rounded-full bg-globus-orange/10 flex items-center justify-center shrink-0">
                  <Loader2Icon className="w-4 h-4 text-globus-orange animate-spin" />
                </div>
            }
              <div>
                <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                  {downloadState.done ?
                'Téléchargement terminé' :
                'Préparation du document...'}
                </p>
                <p className="font-opensans text-xs text-globus-gray">
                  {downloadState.filename}
                </p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
              className={`h-full rounded-full ${downloadState.done ? 'bg-green-500' : 'bg-globus-orange'}`}
              initial={{
                width: '0%'
              }}
              animate={{
                width: `${downloadState.progress}%`
              }}
              transition={{
                duration: 0.1
              }} />
            
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}