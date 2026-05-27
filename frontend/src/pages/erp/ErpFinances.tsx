import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUpIcon,
  BuildingIcon,
  CoinsIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DownloadIcon,
  CameraIcon,
  UploadCloudIcon,
  CheckCircle2Icon,
  Loader2Icon,
  XIcon,
  EyeIcon,
  FileTextIcon } from
'lucide-react';
import { useFinancesProjects, useCharges, useCreateCharge, usePettyCashTransactions, useCreatePettyCashTransaction } from '../../hooks/useErp';
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

const initialProjects = [
{
  id: 'PRJ-001',
  name: 'Villa Moderne Bonapriso',
  status: 'En cours',
  budgetInit: 85000000,
  budgetActuel: 95000000,
  depenses: 74100000,
  margin: 22,
  mat: 35000000,
  mo: 22000000,
  st: 10000000,
  log: 7100000,
  client: 'M. Etoundi',
  dateDebut: '15/01/2026',
  dateFinPrevue: '30/08/2026'
},
{
  id: 'PRJ-002',
  name: 'Immeuble R+4 Akwa',
  status: 'En cours',
  budgetInit: 320000000,
  budgetActuel: 320000000,
  depenses: 272000000,
  margin: 15,
  mat: 130000000,
  mo: 80000000,
  st: 40000000,
  log: 22000000,
  client: 'SCI Horizon',
  dateDebut: '10/11/2025',
  dateFinPrevue: '15/12/2026'
},
{
  id: 'PRJ-003',
  name: 'Résidence Bonanjo',
  status: 'En cours',
  budgetInit: 150000000,
  budgetActuel: 155000000,
  depenses: 142600000,
  margin: 8,
  mat: 68000000,
  mo: 42000000,
  st: 20000000,
  log: 12600000,
  client: 'Mme. Kamga',
  dateDebut: '05/02/2026',
  dateFinPrevue: '20/10/2026'
},
{
  id: 'PRJ-004',
  name: 'Entrepôt Bonabéri',
  status: 'En cours',
  budgetInit: 45000000,
  budgetActuel: 45000000,
  depenses: 46350000,
  margin: -3,
  mat: 22000000,
  mo: 14000000,
  st: 6000000,
  log: 4350000,
  client: 'Logistics SA',
  dateDebut: '01/03/2026',
  dateFinPrevue: '30/05/2026'
},
{
  id: 'PRJ-005',
  name: 'Bureau Deïdo',
  status: 'Terminé',
  budgetInit: 60000000,
  budgetActuel: 62000000,
  depenses: 54560000,
  margin: 12,
  mat: 26000000,
  mo: 16000000,
  st: 8000000,
  log: 4560000,
  client: 'Tech Solutions',
  dateDebut: '10/09/2025',
  dateFinPrevue: '15/02/2026'
}];

const cashFlowData = [
{
  month: 'Oct',
  entrees: 85,
  sorties: 62
},
{
  month: 'Nov',
  entrees: 72,
  sorties: 58
},
{
  month: 'Déc',
  entrees: 95,
  sorties: 70
},
{
  month: 'Jan',
  entrees: 110,
  sorties: 78
},
{
  month: 'Fév',
  entrees: 88,
  sorties: 65
},
{
  month: 'Mar',
  entrees: 125,
  sorties: 82
}];

const initialCharges = [
{
  id: 'CH-01',
  label: 'Loyer bureau Douala',
  montant: 2500000,
  freq: 'Mensuel'
},
{
  id: 'CH-02',
  label: 'Salaires fixes (5 employés)',
  montant: 4200000,
  freq: 'Mensuel'
},
{
  id: 'CH-03',
  label: 'Assurances (RC Pro + Véhicules)',
  montant: 1800000,
  freq: 'Mensuel'
},
{
  id: 'CH-04',
  label: 'Carburant & Véhicules',
  montant: 1500000,
  freq: 'Mensuel'
},
{
  id: 'CH-05',
  label: 'Fournitures bureau',
  montant: 350000,
  freq: 'Mensuel'
},
{
  id: 'CH-06',
  label: 'Internet & Télécom',
  montant: 450000,
  freq: 'Mensuel'
},
{
  id: 'CH-07',
  label: 'Maintenance matériel',
  montant: 1200000,
  freq: 'Mensuel'
}];

const initialPettyTransactions = [
{
  id: 'TR-10',
  date: '23/03',
  motif: 'Taxi chantier Akwa',
  montant: -15000,
  cat: 'Transport',
  site: 'Immeuble Akwa'
},
{
  id: 'TR-09',
  date: '23/03',
  motif: 'Petit matériel (clous, vis)',
  montant: -8500,
  cat: 'Matériaux',
  site: 'Villa Bonapriso'
},
{
  id: 'TR-08',
  date: '22/03',
  motif: 'Recharge caisse',
  montant: 500000,
  cat: 'Approvisionnement',
  site: '—'
},
{
  id: 'TR-07',
  date: '22/03',
  motif: 'Repas équipe chantier',
  montant: -45000,
  cat: 'Restauration',
  site: 'Résidence Bonanjo'
},
{
  id: 'TR-06',
  date: '21/03',
  motif: 'Photocopies plans',
  montant: -12000,
  cat: 'Bureau',
  site: 'Bureau Deïdo'
},
{
  id: 'TR-05',
  date: '21/03',
  motif: 'Eau potable chantier',
  montant: -5000,
  cat: 'Divers',
  site: 'Immeuble Akwa'
},
{
  id: 'TR-04',
  date: '20/03',
  motif: 'Taxi livraison urgente',
  montant: -25000,
  cat: 'Transport',
  site: 'Villa Bonapriso'
},
{
  id: 'TR-03',
  date: '20/03',
  motif: 'Ampoules + rallonge',
  montant: -18000,
  cat: 'Matériaux',
  site: 'Entrepôt Bonabéri'
},
{
  id: 'TR-02',
  date: '19/03',
  motif: 'Recharge caisse',
  montant: 300000,
  cat: 'Approvisionnement',
  site: '—'
},
{
  id: 'TR-01',
  date: '19/03',
  motif: 'Frais notaire document',
  montant: -35000,
  cat: 'Administratif',
  site: '—'
}];

const fmt = (v: number) =>
new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0
}).format(v);
export function ErpFinances() {
  // API hooks
  const { data: apiProjects } = useFinancesProjects();
  const { data: apiCharges } = useCharges();
  const { data: apiTransactions } = usePettyCashTransactions();
  const createChargeMutation = useCreateCharge();
  const createTransactionMutation = useCreatePettyCashTransaction();

  const [activeTab, setActiveTab] = useState('rentabilite');
  // Data States
  const [projects] = useState(initialProjects);
  const [charges, setCharges] = useState(initialCharges);
  const [transactions, setTransactions] = useState(initialPettyTransactions);
  const [soldeCaisse, setSoldeCaisse] = useState(850000);
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
    project: (typeof initialProjects)[0] | null;
  }>({
    isOpen: false,
    project: null
  });
  const [chargeModal, setChargeModal] = useState(false);
  // Handlers
  const handleCaisseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('caisse');
    setTimeout(() => {
      const form = e.target as HTMLFormElement;
      const motif = (form.elements.namedItem('motif') as HTMLInputElement).value;
      const montantStr = (
      form.elements.namedItem('montant') as HTMLInputElement).
      value;
      const cat = (form.elements.namedItem('cat') as HTMLSelectElement).value;
      const site = (form.elements.namedItem('site') as HTMLSelectElement).value;
      const isRecharge = cat === 'Approvisionnement';
      const montant = isRecharge ? parseInt(montantStr) : -parseInt(montantStr);
      const newTx = {
        id: `TR-${Math.floor(Math.random() * 1000)}`,
        date: new Date().toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit'
        }),
        motif,
        montant,
        cat,
        site
      };
      setTransactions([newTx, ...transactions]);
      setSoldeCaisse((prev) => prev + montant);
      setProcessingId(null);
      setShowCaisseForm(false);
      form.reset();
    }, 1500);
  };
  const handleChargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('charge');
    setTimeout(() => {
      const form = e.target as HTMLFormElement;
      const label = (form.elements.namedItem('label') as HTMLInputElement).value;
      const montant = parseInt(
        (form.elements.namedItem('montant') as HTMLInputElement).value
      );
      const freq = (form.elements.namedItem('freq') as HTMLSelectElement).value;
      const newCharge = {
        id: `CH-${Math.floor(Math.random() * 100)}`,
        label,
        montant,
        freq
      };
      setCharges([...charges, newCharge]);
      setProcessingId(null);
      setChargeModal(false);
    }, 1500);
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
            `Rapport_Financier_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`
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

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-opensans">
                      <div className="flex justify-between bg-orange-50 rounded px-2 py-1">
                        <span className="text-gray-600">Matériaux</span>
                        <span className="font-semibold text-gray-800">
                          {fmt(p.mat)}
                        </span>
                      </div>
                      <div className="flex justify-between bg-blue-50 rounded px-2 py-1">
                        <span className="text-gray-600">Main d'œuvre</span>
                        <span className="font-semibold text-gray-800">
                          {fmt(p.mo)}
                        </span>
                      </div>
                      <div className="flex justify-between bg-purple-50 rounded px-2 py-1">
                        <span className="text-gray-600">Sous-trait.</span>
                        <span className="font-semibold text-gray-800">
                          {fmt(p.st)}
                        </span>
                      </div>
                      <div className="flex justify-between bg-green-50 rounded px-2 py-1">
                        <span className="text-gray-600">Logistique</span>
                        <span className="font-semibold text-gray-800">
                          {fmt(p.log)}
                        </span>
                      </div>
                    </div>
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
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                  data={cashFlowData}
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
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange">
                      
                          <option value="Villa Bonapriso">
                            Villa Bonapriso
                          </option>
                          <option value="Immeuble Akwa">Immeuble Akwa</option>
                          <option value="Résidence Bonanjo">
                            Résidence Bonanjo
                          </option>
                          <option value="Entrepôt Bonabéri">
                            Entrepôt Bonabéri
                          </option>
                          <option value="Bureau Deïdo">Bureau Deïdo</option>
                          <option value="—">Aucun (Siège)</option>
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
                  `Journal_Caisse_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`
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
                  <div className="space-y-3">
                    {[
                  {
                    label: 'Matériaux',
                    val: projectModal.project.mat,
                    color: 'bg-orange-500'
                  },
                  {
                    label: "Main d'œuvre",
                    val: projectModal.project.mo,
                    color: 'bg-blue-500'
                  },
                  {
                    label: 'Sous-traitance',
                    val: projectModal.project.st,
                    color: 'bg-purple-500'
                  },
                  {
                    label: 'Logistique & Divers',
                    val: projectModal.project.log,
                    color: 'bg-green-500'
                  }].
                  map((item, idx) => {
                    const pct = Math.round(
                      item.val / projectModal.project.depenses * 100
                    );
                    return (
                      <div key={idx}>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-gray-700">{item.label}</span>
                            <span className="text-gray-900">
                              {fmt(item.val)} FCFA ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                            initial={{
                              width: 0
                            }}
                            animate={{
                              width: `${pct}%`
                            }}
                            transition={{
                              duration: 1,
                              delay: 0.2
                            }}
                            className={`h-full rounded-full ${item.color}`} />
                          
                          </div>
                        </div>);

                  })}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                onClick={() =>
                triggerDownload(
                  `Bilan_Projet_${projectModal.project?.id}.pdf`
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