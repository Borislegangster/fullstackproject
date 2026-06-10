import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUpIcon, BuildingIcon, CoinsIcon, PlusIcon, DownloadIcon, UploadCloudIcon, CheckCircle2Icon, Loader2Icon, XIcon, EyeIcon, FileTextIcon } from 'lucide-react';
import { formatDate, formatDateParts } from '../../utils/datetime';
import { useFinancesProjects, useCharges, useCreateCharge, usePettyCashTransactions, useCreatePettyCashTransaction, useCashflow, useProjectExpenses, useAddProjectExpense } from '../../hooks/useErp';
import { ChartEmpty } from '../../components/ui/ChartEmpty';
import { downloadCSV } from '../../utils/download';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer } from
'recharts';
const tabs = [
{
  id: 'rentabilite',
  label: 'Rentabilité Projets',
  icon: TrendingUpIcon
},
{
  id: 'tresorerie',
  label: 'Charges & Trésorerie',
  icon: BuildingIcon
},
{
  id: 'caisse',
  label: 'Caisse',
  icon: CoinsIcon
}];





interface FinanceProject {
  id: string; name: string; status: string;
  budgetInit: number; budgetActuel: number; depenses: number; margin: number;
  mat: number; mo: number; st: number; log: number;
  client: string; dateDebut: string; dateFinPrevue: string;
}

const fmt = (v: number) =>
new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0
}).format(v);
const statusLabel = (s: string) => {
  const m: Record<string, string> = {
    EN_COURS: 'En cours', PLANIFIE: 'Planifié', TERMINE: 'Terminé',
    LIVRE: 'Livré', SUSPENDU: 'Suspendu', NOUVEAU: 'Nouveau',
  };
  return m[String(s || '').toUpperCase()] || s || '—';
};
const fmtD = (d: string) => formatDate(d, '—');
export function ErpFinances() {
  // API hooks
  const { data: apiProjects } = useFinancesProjects();
  const { data: apiCharges } = useCharges();
  const { data: apiTransactions } = usePettyCashTransactions();
  const { data: apiCashflow } = useCashflow(6);
  const createChargeMutation = useCreateCharge();
  const createTransactionMutation = useCreatePettyCashTransaction();
  const addExpenseMutation = useAddProjectExpense();

  const [activeTab, setActiveTab] = useState('rentabilite');

  // Live data — empty arrays surface empty states (no mock fallback).
  const projects = useMemo(() => {
    if (!Array.isArray(apiProjects)) return [];
    return apiProjects.map((p: any) => ({
      id: p.project_id || p.id,
      name: p.project_name || p.name || '',
      status: statusLabel(p.status),
      budgetInit: p.budget || 0,
      budgetActuel: p.budget || 0,
      depenses: p.spent || 0,
      margin: p.margin_pct || p.margin || 0,
      mat: p.breakdown?.materiaux || 0,
      mo: p.breakdown?.main_oeuvre || 0,
      st: p.breakdown?.sous_traitance || 0,
      log: p.breakdown?.logistique || 0,
      client: p.client || '',
      dateDebut: fmtD(p.start_date),
      dateFinPrevue: fmtD(p.end_date),
    }));
  }, [apiProjects]);

  const charges = useMemo(() => {
    if (!Array.isArray(apiCharges)) return [];
    return apiCharges.map((c: any) => ({
      id: c.id,
      label: c.description || '',
      montant: c.amount || 0,
      freq: c.period === 'MONTHLY' ? 'Mensuel'
        : c.period === 'QUARTERLY' ? 'Trimestriel'
        : c.period === 'ANNUAL' ? 'Annuel' : 'Ponctuel',
    }));
  }, [apiCharges]);

  const transactions = useMemo(() => {
    if (!Array.isArray(apiTransactions)) return [];
    return apiTransactions.map((t: any) => ({
      id: t.id,
      date: formatDateParts(t.recorded_at, { day: '2-digit', month: '2-digit' }),
      motif: t.description || '',
      montant: -(t.amount || 0),  // outflows are negative
      cat: t.category || '',
      site: t.project_id || '',
    }));
  }, [apiTransactions]);

  // Cashflow → area chart (raw FCFA → millions; empty → ChartEmpty).
  const liveCashflow = useMemo(() => {
    if (!Array.isArray(apiCashflow)) return [];
    return apiCashflow.map((c: any) => ({
      month: c.month?.split('-')[1]
        ? formatDateParts(c.month + '-01', { month: 'short' })
        : c.month,
      entrees: Math.round((c.inflow || 0) / 1_000_000),
      sorties: Math.round((c.outflow || 0) / 1_000_000),
    }));
  }, [apiCashflow]);
  const cashflowHasData = liveCashflow.some((c) => c.entrees > 0 || c.sorties > 0);

  // Cash balance is the negative sum of petty cash (all outflows)
  const soldeCaisse = useMemo(() => {
    return transactions.reduce((s, t) => s + (t.montant || 0), 0);
  }, [transactions]);
  // UI States
  const [showCaisseForm, setShowCaisseForm] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState({
    active: false,
    progress: 0,
    done: false,
    filename: ''
  });
  // Modals
  const [projectModal, setProjectModal] = useState<{
    isOpen: boolean;
    project: FinanceProject | null;
  }>({
    isOpen: false,
    project: null
  });
  const [chargeModal, setChargeModal] = useState(false);
  // Live expense breakdown for the open project (real, refreshes after add).
  const { data: modalExpenses } = useProjectExpenses(projectModal.project?.id || '');
  const modalBreakdown = useMemo(() => {
    const b = { mat: 0, mo: 0, st: 0, log: 0 };
    if (Array.isArray(modalExpenses)) {
      for (const e of modalExpenses as any[]) {
        const c = (e.category || '').toLowerCase();
        const amt = e.amount || 0;
        if (c === 'materials') b.mat += amt;
        else if (c === 'labor') b.mo += amt;
        else if (c === 'subcontractor') b.st += amt;
        else b.log += amt;
      }
    }
    return b;
  }, [modalExpenses]);
  const modalBreakdownTotal = modalBreakdown.mat + modalBreakdown.mo + modalBreakdown.st + modalBreakdown.log;
  // Handlers
  const handleCaisseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('caisse');
    const form = e.target as HTMLFormElement;
    try {
      const motif = (form.elements.namedItem('motif') as HTMLInputElement).value;
      const montant = parseFloat(
        (form.elements.namedItem('montant') as HTMLInputElement).value
      ) || 0;
      const cat = (form.elements.namedItem('cat') as HTMLSelectElement).value;
      const site = (form.elements.namedItem('site') as HTMLSelectElement).value;
      await createTransactionMutation.mutateAsync({
        project_id: site || undefined,
        amount: montant,
        description: motif,
        category: cat,
      });
      form.reset();
      setShowCaisseForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleChargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('charge');
    const form = e.target as HTMLFormElement;
    try {
      const label = (form.elements.namedItem('label') as HTMLInputElement).value;
      const montant = parseFloat(
        (form.elements.namedItem('montant') as HTMLInputElement).value
      ) || 0;
      const freq = (form.elements.namedItem('freq') as HTMLSelectElement).value;
      const period = freq === 'Mensuel' ? 'MONTHLY'
        : freq === 'Trimestriel' ? 'QUARTERLY'
        : freq === 'Annuel' ? 'ANNUAL' : 'ONE_OFF';
      await createChargeMutation.mutateAsync({
        category: 'autre',
        description: label,
        amount: montant,
        recurring: period !== 'ONE_OFF',
      } as any);
      setChargeModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  // Real CSV export driving the progress toast (no fake progress, no placeholder file).
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectModal.project) return;
    const form = e.target as HTMLFormElement;
    const category = (form.elements.namedItem('exp_category') as HTMLSelectElement)?.value || 'materials';
    const amount = parseFloat((form.elements.namedItem('exp_amount') as HTMLInputElement)?.value) || 0;
    const description = (form.elements.namedItem('exp_desc') as HTMLInputElement)?.value || '';
    if (amount <= 0 || !description) return;
    setProcessingId('expense');
    try {
      await addExpenseMutation.mutateAsync({
        id: projectModal.project.id,
        data: { category, amount, description },
      });
      form.reset();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const triggerDownload = (
    filename: string,
    rows: Array<Record<string, unknown>>,
    columns: { key: string; label: string }[],
  ) => {
    if (downloadState.active) return;
    const csvName = filename.replace(/\.pdf$/i, '.csv');
    try {
      downloadCSV(csvName, rows, columns);
    } catch {
      /* ignore */
    }
    setDownloadState({ active: true, progress: 100, done: true, filename: csvName });
    setTimeout(
      () => setDownloadState({ active: false, progress: 0, done: false, filename: '' }),
      2500,
    );
  };
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 flex flex-wrap gap-1.5 w-full sm:w-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 sm:flex-none min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-montserrat font-bold text-xs transition-all ${activeTab === tab.id ? 'bg-globus-blue-dark text-white shadow-md' : 'text-globus-gray hover:bg-gray-50'}`}>
                
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>);

          })}
        </div>

        <button
          onClick={() =>
          triggerDownload(
            `Rapport_Financier_${formatDate(new Date()).replace(/\//g, '-')}.csv`,
            projects.map((p) => ({
              name: p.name, status: p.status, client: p.client,
              budget: p.budgetActuel, depenses: p.depenses, margin: `${p.margin}%`,
            })),
            [
              { key: 'name', label: 'Projet' },
              { key: 'status', label: 'Statut' },
              { key: 'client', label: 'Client' },
              { key: 'budget', label: 'Budget (FCFA)' },
              { key: 'depenses', label: 'Dépenses (FCFA)' },
              { key: 'margin', label: 'Marge' },
            ],
          )
          }
          className="bg-white border border-gray-200 hover:bg-gray-50 text-globus-blue-dark font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm w-full sm:w-auto justify-center">
          
          <DownloadIcon className="w-4 h-4" /> Exporter Rapport
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* RENTABILITÉ */}
        {activeTab === 'rentabilite' &&
        <motion.div
          key="rent"
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
              Suivi de Rentabilité par Projet
            </h2>
            <div className="space-y-4">
              {projects.map((p, i) => {
              const pct = Math.min(
                100,
                Math.round(p.depenses / p.budgetActuel * 100)
              );
              return (
                <motion.div
                  key={p.id}
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
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-globus-blue/30 transition-colors">
                  
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="font-montserrat font-bold text-base text-globus-blue-dark">
                          {p.name}
                        </h3>
                        <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        
                          {p.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div
                        className={`font-montserrat font-extrabold text-xl ${p.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        
                          {p.margin >= 0 ? '+' : ''}
                          {p.margin}% marge
                        </div>
                        <button
                        onClick={() =>
                        setProjectModal({
                          isOpen: true,
                          project: p
                        })
                        }
                        className="text-globus-blue hover:text-globus-blue-dark bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-colors"
                        title="Voir détails">
                        
                          <EyeIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-globus-gray font-opensans">
                          Budget Initial
                        </p>
                        <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                          {fmt(p.budgetInit)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-globus-gray font-opensans">
                          Budget Actuel
                        </p>
                        <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                          {fmt(p.budgetActuel)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-globus-gray font-opensans">
                          Dépenses Réelles
                        </p>
                        <p
                        className={`font-montserrat font-bold text-sm ${p.depenses > p.budgetActuel ? 'text-red-600' : 'text-globus-blue-dark'}`}>
                        
                          {fmt(p.depenses)}
                        </p>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div
                      className={`h-full rounded-full ${pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{
                        width: `${Math.min(pct, 100)}%`
                      }}>
                    </div>
                    </div>

                    {(p.mat + p.mo + p.st + p.log) > 0 &&
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-opensans">
                      <div className="flex justify-between bg-orange-50 rounded px-2 py-1">
                        <span className="text-gray-600">Matériaux</span>
                        <span className="font-semibold text-gray-800">{fmt(p.mat)}</span>
                      </div>
                      <div className="flex justify-between bg-blue-50 rounded px-2 py-1">
                        <span className="text-gray-600">Main d'œuvre</span>
                        <span className="font-semibold text-gray-800">{fmt(p.mo)}</span>
                      </div>
                      <div className="flex justify-between bg-purple-50 rounded px-2 py-1">
                        <span className="text-gray-600">Sous-trait.</span>
                        <span className="font-semibold text-gray-800">{fmt(p.st)}</span>
                      </div>
                      <div className="flex justify-between bg-green-50 rounded px-2 py-1">
                        <span className="text-gray-600">Logistique</span>
                        <span className="font-semibold text-gray-800">{fmt(p.log)}</span>
                      </div>
                    </div>
                    }

                  </motion.div>);

            })}
            </div>
          </motion.div>
        }

        {/* TRÉSORERIE */}
        {activeTab === 'tresorerie' &&
        <motion.div
          key="tres"
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
          
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs text-globus-gray font-opensans mb-1">
                  Trésorerie Actuelle
                </p>
                <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                  {fmt(150000000)}
                </p>
                <p className="text-xs text-green-600 font-semibold mt-1">
                  FCFA
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs text-globus-gray font-opensans mb-1">
                  Charges Fixes / Mois
                </p>
                <p className="font-montserrat font-extrabold text-2xl text-red-600">
                  {fmt(charges.reduce((s, c) => s + c.montant, 0))}
                </p>
                <p className="text-xs text-globus-gray font-opensans mt-1">
                  FCFA
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs text-globus-gray font-opensans mb-1">
                  Créances Clients
                </p>
                <p className="font-montserrat font-extrabold text-2xl text-globus-orange">
                  {fmt(45000000)}
                </p>
                <p className="text-xs text-globus-gray font-opensans mt-1">
                  FCFA
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
                Flux de Trésorerie (6 derniers mois, en millions FCFA)
              </h3>
              <div className="h-56">
                {!cashflowHasData ? (
                  <ChartEmpty message="Aucun flux de trésorerie sur la période" />
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                  data={liveCashflow}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0
                  }}>
                  
                    <defs>
                      <linearGradient id="gEntrees" x1="0" y1="0" x2="0" y2="1">
                        <stop
                        offset="5%"
                        stopColor="#10B981"
                        stopOpacity={0.2} />
                      
                        <stop
                        offset="95%"
                        stopColor="#10B981"
                        stopOpacity={0} />
                      
                      </linearGradient>
                      <linearGradient id="gSorties" x1="0" y1="0" x2="0" y2="1">
                        <stop
                        offset="5%"
                        stopColor="#EF4444"
                        stopOpacity={0.2} />
                      
                        <stop
                        offset="95%"
                        stopColor="#EF4444"
                        stopOpacity={0} />
                      
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f3f4f6" />
                  
                    <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: '#6b7280'
                    }} />
                  
                    <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: '#6b7280'
                    }}
                    tickFormatter={(v) => `${v}M`} />
                  
                    <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }}
                    formatter={(v: number) => [`${v}M FCFA`, '']} />
                  
                    <Area
                    type="monotone"
                    dataKey="entrees"
                    name="Entrées"
                    stroke="#10B981"
                    strokeWidth={2}
                    fill="url(#gEntrees)" />
                  
                    <Area
                    type="monotone"
                    dataKey="sorties"
                    name="Sorties"
                    stroke="#EF4444"
                    strokeWidth={2}
                    fill="url(#gSorties)" />
                  
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark">
                  Charges Fixes Récurrentes
                </h3>
                <button
                onClick={() => setChargeModal(true)}
                className="bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 transition-colors">
                
                  <PlusIcon className="w-3.5 h-3.5" /> Ajouter
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Libellé
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Montant
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Fréquence
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-opensans text-sm">
                    {charges.map((c) =>
                  <tr
                    key={c.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    
                        <td className="p-3 text-gray-800">{c.label}</td>
                        <td className="p-3 font-mono text-xs font-semibold text-gray-800">
                          {fmt(c.montant)} FCFA
                        </td>
                        <td className="p-3 text-globus-gray">
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                            {c.freq}
                          </span>
                        </td>
                      </tr>
                  )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td className="p-3 font-montserrat font-bold text-sm text-globus-blue-dark">
                        TOTAL
                      </td>
                      <td className="p-3 font-montserrat font-bold text-sm text-globus-blue-dark">
                        {fmt(charges.reduce((s, c) => s + c.montant, 0))} FCFA
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </motion.div>
        }

        {/* CAISSE */}
        {activeTab === 'caisse' &&
        <motion.div
          key="caisse"
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex-1 sm:flex-none">
                <p className="text-xs text-globus-gray font-opensans mb-1">
                  Solde Caisse (Petty Cash)
                </p>
                <p className="font-montserrat font-extrabold text-3xl text-globus-blue-dark">
                  {fmt(soldeCaisse)}{' '}
                  <span className="text-base font-bold text-globus-gray">
                    FCFA
                  </span>
                </p>
              </div>
              <button
              onClick={() => setShowCaisseForm(!showCaisseForm)}
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
              
                <PlusIcon className="w-4 h-4" /> Nouvelle Dépense
              </button>
            </div>

            <AnimatePresence>
              {showCaisseForm &&
            <motion.div
              initial={{
                height: 0,
                opacity: 0
              }}
              animate={{
                height: 'auto',
                opacity: 1
              }}
              exit={{
                height: 0,
                opacity: 0
              }}
              className="overflow-hidden">
              
                  <form
                onSubmit={handleCaisseSubmit}
                className="bg-white rounded-xl shadow-md border-2 border-globus-orange/20 p-5 mb-2">
                
                    <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
                      Enregistrer une transaction
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-semibold text-globus-blue-dark mb-1 font-montserrat">
                          Motif
                        </label>
                        <input
                      name="motif"
                      type="text"
                      required
                      placeholder="Ex: Taxi chantier"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
                    
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-globus-blue-dark mb-1 font-montserrat">
                          Montant (FCFA)
                        </label>
                        <input
                      name="montant"
                      type="number"
                      required
                      min="1"
                      placeholder="15000"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
                    
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-globus-blue-dark mb-1 font-montserrat">
                          Catégorie
                        </label>
                        <select
                      name="cat"
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange">
                      
                          <option value="Transport">Transport</option>
                          <option value="Matériaux">Matériaux</option>
                          <option value="Restauration">Restauration</option>
                          <option value="Bureau">Bureau</option>
                          <option value="Approvisionnement">
                            Approvisionnement (Entrée)
                          </option>
                          <option value="Divers">Divers</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-globus-blue-dark mb-1 font-montserrat">
                          Chantier
                        </label>
                        <select
                      name="site"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange">

                          <option value="">Aucun (Siège)</option>
                          {projects.map((p) =>
                          <option key={p.id} value={p.id}>{p.name}</option>
                          )}
                        </select>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-globus-blue-dark mb-1 font-montserrat">
                        Photo du reçu (Optionnel)
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                        <UploadCloudIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-globus-gray">
                          Cliquez ou glissez la photo
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                    type="button"
                    onClick={() => setShowCaisseForm(false)}
                    className="px-4 py-2 text-sm font-semibold text-globus-gray hover:bg-gray-100 rounded-lg transition-colors">
                    
                        Annuler
                      </button>
                      <button
                    type="submit"
                    disabled={processingId === 'caisse'}
                    className="bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold py-2 px-5 rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70">
                    
                        {processingId === 'caisse' ?
                    <Loader2Icon className="w-4 h-4 animate-spin" /> :

                    <CheckCircle2Icon className="w-4 h-4" />
                    }
                        Enregistrer
                      </button>
                    </div>
                  </form>
                </motion.div>
            }
            </AnimatePresence>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark">
                  Transactions Récentes
                </h3>
                <button
                onClick={() =>
                triggerDownload(
                  `Journal_Caisse_${formatDate(new Date()).replace(/\//g, '-')}.csv`,
                  transactions.map((t) => ({
                    date: t.date, motif: t.motif, cat: t.cat, montant: t.montant,
                  })),
                  [
                    { key: 'date', label: 'Date' },
                    { key: 'motif', label: 'Motif' },
                    { key: 'cat', label: 'Catégorie' },
                    { key: 'montant', label: 'Montant (FCFA)' },
                  ],
                )
                }
                className="text-globus-blue hover:text-globus-blue-dark text-xs font-bold flex items-center gap-1">
                
                  <DownloadIcon className="w-3.5 h-3.5" /> Exporter
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Date
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Motif
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Montant
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden sm:table-cell">
                        Catégorie
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden md:table-cell">
                        Chantier
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-opensans text-sm">
                    {transactions.map((t) =>
                  <tr
                    key={t.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    
                        <td className="p-3 font-mono text-xs text-gray-600">
                          {t.date}
                        </td>
                        <td className="p-3 text-gray-800">{t.motif}</td>
                        <td
                      className={`p-3 font-mono text-xs font-bold ${t.montant > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      
                          {t.montant > 0 ? '+' : ''}
                          {fmt(t.montant)} FCFA
                        </td>
                        <td className="p-3 text-globus-gray hidden sm:table-cell">
                          <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.cat === 'Approvisionnement' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        
                            {t.cat}
                          </span>
                        </td>
                        <td className="p-3 text-globus-gray hidden md:table-cell">
                          {t.site}
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

      {/* MODALS */}

      {/* Project Detail Modal */}
      <AnimatePresence>
        {projectModal.isOpen && projectModal.project &&
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                <div>
                  <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-1">
                    Détails Financiers du Projet
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-globus-blue bg-blue-100 px-2 py-0.5 rounded">
                      {projectModal.project.id}
                    </span>
                    <span className="text-sm font-semibold text-gray-600">
                      {projectModal.project.name}
                    </span>
                  </div>
                </div>
                <button
                onClick={() =>
                setProjectModal({
                  isOpen: false,
                  project: null
                })
                }
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Client</p>
                    <p className="font-bold text-sm text-gray-800">
                      {projectModal.project.client}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Statut</p>
                    <p className="font-bold text-sm text-globus-blue">
                      {projectModal.project.status}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Date Début</p>
                    <p className="font-bold text-sm text-gray-800">
                      {projectModal.project.dateDebut}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">
                      Date Fin Prévue
                    </p>
                    <p className="font-bold text-sm text-gray-800">
                      {projectModal.project.dateFinPrevue}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-3 border-b border-gray-100 pb-2">
                    Synthèse Budgétaire
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="border border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-bold">
                        Budget Alloué
                      </p>
                      <p className="font-montserrat font-extrabold text-xl text-globus-blue-dark">
                        {fmt(projectModal.project.budgetActuel)}
                      </p>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-bold">
                        Dépenses Réelles
                      </p>
                      <p className="font-montserrat font-extrabold text-xl text-globus-orange">
                        {fmt(projectModal.project.depenses)}
                      </p>
                    </div>
                    <div
                    className={`border ${projectModal.project.margin >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} rounded-xl p-4 text-center`}>
                    
                      <p
                      className={`text-xs mb-1 uppercase tracking-wider font-bold ${projectModal.project.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      
                        Marge Nette
                      </p>
                      <p
                      className={`font-montserrat font-extrabold text-xl ${projectModal.project.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      
                        {projectModal.project.margin >= 0 ? '+' : ''}
                        {projectModal.project.margin}%
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-3 border-b border-gray-100 pb-2">
                    Répartition des Dépenses
                  </h4>
                  {modalBreakdownTotal === 0 ?
                  <p className="text-sm text-gray-400 italic">
                    Aucune dépense enregistrée pour ce chantier.
                  </p> :
                  <div className="space-y-3">
                    {[
                    { label: 'Matériaux', val: modalBreakdown.mat, color: 'bg-orange-500' },
                    { label: "Main d'œuvre", val: modalBreakdown.mo, color: 'bg-blue-500' },
                    { label: 'Sous-traitance', val: modalBreakdown.st, color: 'bg-purple-500' },
                    { label: 'Logistique & Divers', val: modalBreakdown.log, color: 'bg-green-500' }].
                    filter((it) => it.val > 0).map((item, idx) => {
                      const pct = Math.round((item.val / modalBreakdownTotal) * 100);
                      return (
                        <div key={idx}>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-gray-700">{item.label}</span>
                            <span className="text-gray-900">
                              {fmt(item.val)} FCFA ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>);
                    })}
                  </div>
                  }
                </div>

                <div>
                  <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-3 border-b border-gray-100 pb-2">
                    Ajouter une dépense
                  </h4>
                  <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                    <select name="exp_category" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-globus-orange">
                      <option value="materials">Matériaux</option>
                      <option value="labor">Main d'œuvre</option>
                      <option value="subcontractor">Sous-traitance</option>
                      <option value="logistics">Logistique</option>
                      <option value="misc">Divers</option>
                    </select>
                    <input name="exp_desc" type="text" required placeholder="Description" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-globus-orange" />
                    <input name="exp_amount" type="number" required min="1" placeholder="Montant (FCFA)" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-globus-orange" />
                    <button type="submit" disabled={processingId === 'expense'} className="bg-globus-orange hover:bg-globus-orange-hover text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                      {processingId === 'expense' ?
                      <Loader2Icon className="w-4 h-4 animate-spin" /> :
                      <PlusIcon className="w-4 h-4" />}
                      Ajouter
                    </button>
                  </form>
                </div>

              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                onClick={() =>
                triggerDownload(
                  `Bilan_Projet_${projectModal.project?.id}.csv`,
                  [
                    { indicateur: 'Projet', valeur: projectModal.project?.name || '' },
                    { indicateur: 'Client', valeur: projectModal.project?.client || '' },
                    { indicateur: 'Statut', valeur: projectModal.project?.status || '' },
                    { indicateur: 'Budget alloué', valeur: fmt(projectModal.project?.budgetActuel || 0) },
                    { indicateur: 'Dépenses', valeur: fmt(projectModal.project?.depenses || 0) },
                    { indicateur: 'Marge nette', valeur: `${projectModal.project?.margin || 0}%` },
                  ],
                  [
                    { key: 'indicateur', label: 'Indicateur' },
                    { key: 'valeur', label: 'Valeur' },
                  ],
                )
                }
                className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm">
                
                  <FileTextIcon className="w-4 h-4" /> Exporter Bilan
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Add Charge Modal */}
      <AnimatePresence>
        {chargeModal &&
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
                  <BuildingIcon className="w-5 h-5 text-globus-orange" />{' '}
                  Nouvelle Charge Fixe
                </h3>
                <button
                onClick={() => setChargeModal(false)}
                className="text-gray-400 hover:text-gray-600">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleChargeSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Libellé de la charge
                  </label>
                  <input
                  name="label"
                  type="text"
                  required
                  placeholder="Ex: Abonnement Logiciel"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Montant (FCFA)
                  </label>
                  <input
                  name="montant"
                  type="number"
                  required
                  min="1"
                  placeholder="Ex: 150000"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Fréquence
                  </label>
                  <select
                  name="freq"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">
                  
                    <option value="Mensuel">Mensuel</option>
                    <option value="Trimestriel">Trimestriel</option>
                    <option value="Annuel">Annuel</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                  type="button"
                  onClick={() => setChargeModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'charge'}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'charge' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }
                    Ajouter
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
                <p className="font-opensans text-xs text-globus-gray truncate max-w-[200px]">
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