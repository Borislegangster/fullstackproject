import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  UsersRoundIcon,
  ClipboardListIcon,
  ReceiptIcon,
  PlusIcon,
  StarIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  PhoneIcon,
  XIcon,
  Loader2Icon,
  AlertTriangleIcon,
  FileTextIcon,
  MapPinIcon,
  MailIcon,
  MessageSquareIcon } from
'lucide-react';
import { AnimatePresence } from 'framer-motion';
const subcontractors = [
{
  name: "Menuiserie Bois d'Ébène",
  specialty: 'Menuiserie',
  contact: 'M. Ondoua',
  phone: '+237 6XX XXX XXX',
  projects: 3,
  rating: 4.5
},
{
  name: 'Électricité Pro Douala',
  specialty: 'Électricité',
  contact: 'M. Tabi',
  phone: '+237 6XX XXX XXX',
  projects: 2,
  rating: 4
},
{
  name: 'Plomberie Express',
  specialty: 'Plomberie',
  contact: 'Mme Eyinga',
  phone: '+237 6XX XXX XXX',
  projects: 1,
  rating: 3.5
},
{
  name: 'Peinture & Déco',
  specialty: 'Peinture',
  contact: 'M. Fouda',
  phone: '+237 6XX XXX XXX',
  projects: 2,
  rating: 4.8
},
{
  name: 'Transport Lourd Cameroun',
  specialty: 'Logistique',
  contact: 'M. Atangana',
  phone: '+237 6XX XXX XXX',
  projects: 4,
  rating: 4.2
}];

const situations = [
{
  sub: "Menuiserie Bois d'Ébène",
  project: 'Villa Bonapriso',
  desc: 'Pose fenêtres RDC',
  pct: 50,
  amount: 3500000,
  status: 'pending'
},
{
  sub: 'Électricité Pro Douala',
  project: 'Immeuble Akwa',
  desc: 'Câblage étage 1',
  pct: 100,
  amount: 8000000,
  status: 'validated'
},
{
  sub: 'Plomberie Express',
  project: 'Résidence Bonanjo',
  desc: 'Installation sanitaires',
  pct: 30,
  amount: 2100000,
  status: 'pending'
},
{
  sub: 'Peinture & Déco',
  project: 'Villa Bonapriso',
  desc: 'Peinture extérieure',
  pct: 0,
  amount: 0,
  status: 'planned'
}];

const invoices = [
{
  id: 'FACT-ST-001',
  supplier: "Menuiserie Bois d'Ébène",
  amount: 3500000,
  date: '20/03/2026',
  status: 'Soumise'
},
{
  id: 'FACT-ST-002',
  supplier: 'Électricité Pro Douala',
  amount: 8000000,
  date: '18/03/2026',
  status: 'Validée'
},
{
  id: 'FACT-ST-003',
  supplier: 'Cimenterie du Cameroun',
  amount: 12500000,
  date: '15/03/2026',
  status: 'Payée'
},
{
  id: 'FACT-ST-004',
  supplier: 'Quincaillerie Générale',
  amount: 2800000,
  date: '12/03/2026',
  status: 'Payée'
},
{
  id: 'FACT-ST-005',
  supplier: 'Plomberie Express',
  amount: 2100000,
  date: '10/03/2026',
  status: 'En litige'
},
{
  id: 'FACT-ST-006',
  supplier: 'Transport Lourd',
  amount: 4500000,
  date: '08/03/2026',
  status: 'Validée'
}];

export function ErpSousTraitants() {
  const [activeTab, setActiveTab] = useState('subs');
  // New states for interactive features
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any | null>(null);
  const [showNewSituation, setShowNewSituation] = useState(false);
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
  const handleAddPartner = () => {
    setIsProcessing('add-partner');
    setTimeout(() => {
      setIsProcessing(null);
      setShowAddPartner(false);
      showToast('Nouveau sous-traitant ajouté', 'success');
    }, 1500);
  };
  const handleNewSituation = () => {
    setIsProcessing('new-situation');
    setTimeout(() => {
      setIsProcessing(null);
      setShowNewSituation(false);
      showToast('Nouvelle situation déclarée', 'success');
    }, 1500);
  };
  const handleValidateSituation = (id: number) => {
    setIsProcessing(`val-sit-${id}`);
    setTimeout(() => {
      setIsProcessing(null);
      showToast('Situation validée avec succès', 'success');
    }, 1500);
  };
  const handleRefuseSituation = (id: number) => {
    setIsProcessing(`ref-sit-${id}`);
    setTimeout(() => {
      setIsProcessing(null);
      showToast('Situation refusée', 'info');
    }, 1500);
  };
  const handleInvoiceAction = (id: string, action: string) => {
    setIsProcessing(`${action}-${id}`);
    setTimeout(() => {
      setIsProcessing(null);
      const msg =
      action === 'val' ?
      'Facture validée' :
      action === 'pay' ?
      'Facture payée' :
      'Litige résolu';
      showToast(msg, 'success');
    }, 1500);
  };
  const handleRateSubmit = () => {
    setIsProcessing('rate');
    setTimeout(() => {
      setIsProcessing(null);
      setShowRatingModal(false);
      setRatingValue(0);
      showToast('Évaluation enregistrée', 'success');
    }, 1500);
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
            {subcontractors.map((sub, idx) =>
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
              Déclarations d'Avancement
            </h2>
            <button
            onClick={() => setShowNewSituation(true)}
            className="bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
            
              <PlusIcon className="w-4 h-4" /> Nouvelle Déclaration
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-globus-light border-b border-gray-200">
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                      Sous-Traitant
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                      Projet
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                      Déclaration
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                      Avancement
                    </th>
                    <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                      Montant
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
                  {situations.map((s, i) =>
                <tr
                  key={i}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  
                      <td className="p-4 font-semibold text-globus-blue-dark">
                        {s.sub}
                      </td>
                      <td className="p-4 text-globus-gray">{s.project}</td>
                      <td className="p-4 text-globus-gray">{s.desc}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                          className={`h-full rounded-full ${s.pct === 100 ? 'bg-emerald-500' : s.pct > 0 ? 'bg-globus-orange' : 'bg-gray-300'}`}
                          style={{
                            width: `${s.pct}%`
                          }}>
                        </div>
                          </div>
                          <span className="text-xs font-bold text-globus-blue-dark">
                            {s.pct}%
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-globus-blue-dark">
                        {s.amount > 0 ? fmt(s.amount) : '-'}
                      </td>
                      <td className="p-4">
                        <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold font-montserrat ${s.status === 'validated' ? 'bg-green-100 text-green-700' : s.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                      
                          {s.status === 'validated' ?
                      'Validé' :
                      s.status === 'pending' ?
                      'En attente' :
                      'Planifié'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {s.status === 'pending' &&
                    <div className="flex justify-end gap-2">
                            <button
                        onClick={() => handleValidateSituation(i)}
                        disabled={
                        isProcessing === `val-sit-${i}` ||
                        isProcessing === `ref-sit-${i}`
                        }
                        className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 disabled:opacity-50">
                        
                              {isProcessing === `val-sit-${i}` ?
                        <Loader2Icon className="w-3 h-3 animate-spin" /> :

                        <CheckCircle2Icon className="w-3 h-3" />
                        }{' '}
                              Valider
                            </button>
                            <button
                        onClick={() => handleRefuseSituation(i)}
                        disabled={
                        isProcessing === `val-sit-${i}` ||
                        isProcessing === `ref-sit-${i}`
                        }
                        className="text-xs bg-red-100 hover:bg-red-500 hover:text-white text-red-600 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 disabled:opacity-50">
                        
                              {isProcessing === `ref-sit-${i}` ?
                        <Loader2Icon className="w-3 h-3 animate-spin" /> :

                        <XCircleIcon className="w-3 h-3" />
                        }{' '}
                              Refuser
                            </button>
                          </div>
                    }
                        {s.status === 'validated' &&
                    <div className="flex items-center justify-end gap-3">
                            <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                              <CheckCircle2Icon className="w-3.5 h-3.5" />{' '}
                              Validé
                            </span>
                            {s.pct === 100 &&
                      <button
                        onClick={() => {
                          setPartnerToRate(s.sub);
                          setShowRatingModal(true);
                        }}
                        className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded font-bold transition-colors flex items-center gap-1">
                        
                                <StarIcon className="w-3 h-3" /> Évaluer
                              </button>
                      }
                          </div>
                    }
                        {s.status === 'planned' &&
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
                3 en attente
              </span>
              <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg">
                12 validées
              </span>
              <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">
                8 payées
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
                  {invoices.map((inv, i) =>
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
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <MailIcon className="w-4 h-4 text-globus-orange" />{' '}
                      contact@partenaire.com
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <MapPinIcon className="w-4 h-4 text-globus-orange" />{' '}
                      Douala, Cameroun
                    </div>
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
                <div className="space-y-3">
                  {[1, 2].map((i) =>
                <div
                  key={i}
                  className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                  
                      <div>
                        <p className="font-bold text-sm text-globus-blue-dark">
                          Villa Bonapriso - Phase {i}
                        </p>
                        <p className="text-xs text-gray-500">
                          Terminé le 15/02/2026
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <StarIcon className="w-3 h-3 text-globus-orange fill-globus-orange" />
                        <StarIcon className="w-3 h-3 text-globus-orange fill-globus-orange" />
                        <StarIcon className="w-3 h-3 text-globus-orange fill-globus-orange" />
                        <StarIcon className="w-3 h-3 text-globus-orange fill-globus-orange" />
                        <StarIcon className="w-3 h-3 text-gray-300" />
                      </div>
                    </div>
                )}
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
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

      {/* New Situation Modal */}
      <AnimatePresence>
        {showNewSituation &&
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
          onClick={() => setShowNewSituation(false)}>
          
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
                  Nouvelle Déclaration
                </h3>
                <button
                onClick={() => setShowNewSituation(false)}
                className="text-white/70 hover:text-white">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                    Sous-Traitant
                  </label>
                  <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                    {subcontractors.map((s) =>
                  <option key={s.name}>{s.name}</option>
                  )}
                  </select>
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                    Projet
                  </label>
                  <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                    <option>Villa Bonapriso</option>
                    <option>Immeuble Akwa</option>
                    <option>Résidence Bonanjo</option>
                  </select>
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                    Description des travaux
                  </label>
                  <input
                  type="text"
                  placeholder="Ex: Pose fenêtres RDC"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                      % Avancement
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      defaultValue="50"
                      className="w-full accent-globus-orange" />
                    
                      <span className="font-bold text-sm w-10">50%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                      Montant (FCFA)
                    </label>
                    <input
                    type="number"
                    placeholder="0"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                  
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                  onClick={() => setShowNewSituation(false)}
                  className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                  
                    Annuler
                  </button>
                  <button
                  onClick={handleNewSituation}
                  disabled={isProcessing === 'new-situation'}
                  className="bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {isProcessing === 'new-situation' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }{' '}
                    Soumettre
                  </button>
                </div>
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