import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WalletIcon,
  CreditCardIcon,
  SmartphoneIcon,
  DownloadIcon,
  CheckCircle2Icon,
  XIcon,
  LockIcon,
  ReceiptIcon,
  FileTextIcon,
  AlertTriangleIcon,
  LoaderIcon,
  CheckIcon,
  EyeIcon } from
'lucide-react';
import { useClientFinances, useInitiatePayment } from '../../hooks/useClient';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer } from
'recharts';
import { useClientUser } from '../../hooks/useClientUser';
const appelsDeFonds = [
{
  id: 1,
  libelle: 'Acompte signature',
  montant: 8500000,
  date: '15/01/2024',
  status: 'payé'
},
{
  id: 2,
  libelle: 'Démarrage chantier',
  montant: 12750000,
  date: '01/03/2024',
  status: 'payé'
},
{
  id: 3,
  libelle: 'Fondations terminées',
  montant: 17000000,
  date: '15/05/2024',
  status: 'payé'
},
{
  id: 4,
  libelle: "Mise hors d'eau",
  montant: 12750000,
  date: '01/08/2024',
  status: 'en-attente'
},
{
  id: 5,
  libelle: "Mise hors d'air",
  montant: 12750000,
  date: '15/10/2024',
  status: 'à-venir'
},
{
  id: 6,
  libelle: 'Finitions',
  montant: 12750000,
  date: '01/01/2025',
  status: 'à-venir'
},
{
  id: 7,
  libelle: 'Solde livraison',
  montant: 8500000,
  date: '15/03/2025',
  status: 'à-venir'
}];

const budgetEvolutionData = [
{
  month: 'Jan',
  prevu: 8500000,
  reel: 8500000
},
{
  month: 'Fév',
  prevu: 8500000,
  reel: 8500000
},
{
  month: 'Mar',
  prevu: 21250000,
  reel: 21250000
},
{
  month: 'Avr',
  prevu: 21250000,
  reel: 21250000
},
{
  month: 'Mai',
  prevu: 38250000,
  reel: 38250000
},
{
  month: 'Jun',
  prevu: 38250000,
  reel: 38250000
},
{
  month: 'Jul',
  prevu: 51000000,
  reel: 38250000
} // Retard de paiement simulé
];
const receiptsData = [
{
  id: 1,
  title: 'Reçu #1 - Acompte',
  date: '16/01/2024',
  amount: 8500000,
  txn: 'TXN-2024-001',
  method: 'Carte Bancaire',
  appelRef: 'Acompte signature',
  tva: 19.25
},
{
  id: 2,
  title: 'Reçu #2 - Démarrage',
  date: '02/03/2024',
  amount: 12750000,
  txn: 'TXN-2024-045',
  method: 'Virement Bancaire',
  appelRef: 'Démarrage chantier',
  tva: 19.25
},
{
  id: 3,
  title: 'Reçu #3 - Fondations',
  date: '16/05/2024',
  amount: 17000000,
  txn: 'TXN-2024-112',
  method: 'Mobile Money',
  appelRef: 'Fondations terminées',
  tva: 19.25
}];

export function ClientFinances() {
  const { data: financesData } = useClientFinances();
  const initiatePaymentMutation = useInitiatePayment();
  const [activeTab, setActiveTab] = useState('factures');
  const clientUser = useClientUser();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentState, setPaymentState] = useState<
    'idle' | 'processing' | 'success'>(
    'idle');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [downloadState, setDownloadState] = useState<{
    isDownloading: boolean;
    progress: number;
    fileName: string;
    isComplete: boolean;
  }>({
    isDownloading: false,
    progress: 0,
    fileName: '',
    isComplete: false
  });
  const [showAlert, setShowAlert] = useState(true);
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      maximumFractionDigits: 0
    }).
    format(value).
    replace('XAF', 'FCFA');
  };
  const handleOpenPayment = (appel: any) => {
    setSelectedPayment(appel);
    setPaymentState('idle');
    setIsPaymentModalOpen(true);
  };
  const handleOpenReceipt = (receipt: any) => {
    setSelectedReceipt(receipt);
    setIsReceiptModalOpen(true);
  };
  const handleOpenReceiptFromAppel = (appelId: number) => {
    const receipt = receiptsData.find((r) => r.id === appelId);
    if (receipt) {
      handleOpenReceipt(receipt);
    }
  };
  const handleProcessPayment = () => {
    setPaymentState('processing');
    setTimeout(() => {
      setPaymentState('success');
      setTimeout(() => {
        setIsPaymentModalOpen(false);
        setPaymentState('idle');
      }, 4000);
    }, 2000);
  };
  const handleDownload = (fileName: string) => {
    if (downloadState.isDownloading) return;
    setDownloadState({
      isDownloading: true,
      progress: 0,
      fileName,
      isComplete: false
    });
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15 + 5;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setDownloadState((prev) => ({
          ...prev,
          progress: 100,
          isComplete: true
        }));
        setTimeout(() => {
          setDownloadState({
            isDownloading: false,
            progress: 0,
            fileName: '',
            isComplete: false
          });
        }, 3000);
      } else {
        setDownloadState((prev) => ({
          ...prev,
          progress: currentProgress
        }));
      }
    }, 200);
  };
  const pendingAppel = appelsDeFonds.find((a) => a.status === 'en-attente');
  return (
    <div className="max-w-7xl mx-auto space-y-6 relative pb-20">
      {/* Alert Banner */}
      <AnimatePresence>
        {showAlert && pendingAppel &&
        <motion.div
          initial={{
            opacity: 0,
            y: -20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            height: 0,
            marginBottom: 0
          }}
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-montserrat font-bold text-amber-900 text-sm">
                  Appel de fonds en attente de règlement
                </p>
                <p className="font-opensans text-sm text-amber-700 mt-1">
                  {pendingAppel.libelle} —{' '}
                  <span className="font-bold">
                    {formatCurrency(pendingAppel.montant)}
                  </span>{' '}
                  — Échéance : {pendingAppel.date}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
              onClick={() => handleOpenPayment(pendingAppel)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-montserrat font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm">
              
                Régler maintenant
              </button>
              <button
              onClick={() => setShowAlert(false)}
              className="text-amber-400 hover:text-amber-600 transition-colors p-1">
              
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Header Actions */}
      <div className="flex justify-end">
        <button
          onClick={() => handleDownload('Recap_Financier_Globus_2024.pdf')}
          className="flex items-center gap-2 bg-white border border-gray-200 hover:border-globus-blue hover:text-globus-blue text-globus-blue-dark font-montserrat font-bold text-sm px-4 py-2 rounded-lg transition-colors shadow-sm">
          
          <DownloadIcon className="w-4 h-4" /> Exporter le récapitulatif
        </button>
      </div>

      {/* Budget Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          
          <p className="text-sm text-globus-gray font-opensans mb-1">
            Budget Initial
          </p>
          <p className="font-montserrat font-bold text-2xl text-globus-blue-dark">
            {formatCurrency(75000000)}
          </p>
        </motion.div>
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: 0.1
          }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          
          <p className="text-sm text-globus-gray font-opensans mb-1">
            Avenants Validés
          </p>
          <p className="font-montserrat font-bold text-2xl text-globus-orange">
            +{formatCurrency(10000000)}
          </p>
        </motion.div>
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: 0.2
          }}
          className="bg-globus-blue-dark p-6 rounded-2xl shadow-lg border border-transparent text-white">
          
          <p className="text-sm text-seconda-blue font-opensans mb-1">
            Budget Actualisé Total
          </p>
          <p className="font-montserrat font-bold text-3xl">
            {formatCurrency(85000000)}
          </p>
        </motion.div>
      </div>

      {/* Payment Progress */}
      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          delay: 0.3
        }}
        className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        
        <div className="flex justify-between items-end mb-4">
          <div>
            <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
              Montant Réglé
            </h3>
            <p className="font-opensans text-sm text-globus-gray">
              {formatCurrency(38250000)} sur {formatCurrency(85000000)}
            </p>
          </div>
          <span className="font-montserrat font-extrabold text-3xl text-green-500">
            45%
          </span>
        </div>
        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{
              width: 0
            }}
            animate={{
              width: '45%'
            }}
            transition={{
              duration: 1,
              delay: 0.5
            }}
            className="h-full bg-green-500 rounded-full relative">
            
            <div
              className="absolute inset-0 bg-white/20"
              style={{
                backgroundImage:
                'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)',
                backgroundSize: '1rem 1rem'
              }}>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Budget Evolution Chart */}
      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          delay: 0.35
        }}
        className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        
        <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-6">
          Évolution des Dépenses (2024)
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={budgetEvolutionData}
              margin={{
                top: 10,
                right: 10,
                left: 0,
                bottom: 0
              }}>
              
              <defs>
                <linearGradient id="colorReel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPrevu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
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
                  fontSize: 12,
                  fill: '#6b7280'
                }}
                dy={10} />
              
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                  fontSize: 12,
                  fill: '#6b7280'
                }}
                tickFormatter={(value) => `${value / 1000000}M`}
                dx={-10} />
              
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), '']}
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }} />
              
              <Area
                type="monotone"
                dataKey="prevu"
                name="Prévu"
                stroke="#1D4ED8"
                strokeDasharray="5 5"
                fillOpacity={1}
                fill="url(#colorPrevu)" />
              
              <Area
                type="stepAfter"
                dataKey="reel"
                name="Réel"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReel)" />
              
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2 text-sm font-opensans text-globus-gray">
            <div className="w-3 h-0.5 border-t-2 border-dashed border-globus-blue"></div>{' '}
            Budget Prévu
          </div>
          <div className="flex items-center gap-2 text-sm font-opensans text-globus-gray">
            <div className="w-3 h-0.5 bg-green-500"></div> Dépenses Réelles
          </div>
        </div>
      </motion.div>

      {/* Appels de fonds Table */}
      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          delay: 0.4
        }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <WalletIcon className="w-6 h-6 text-globus-blue-dark" />
          <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark">
            Échéancier & Appels de fonds
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-globus-light border-b border-gray-200">
                <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark">
                  N°
                </th>
                <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark">
                  Libellé
                </th>
                <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark">
                  Échéance
                </th>
                <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark">
                  Montant
                </th>
                <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark">
                  Statut
                </th>
                <th className="p-4 font-montserrat font-semibold text-sm text-globus-blue-dark text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="font-opensans text-sm">
              {appelsDeFonds.map((appel) =>
              <tr
                key={appel.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                
                  <td className="p-4 text-globus-gray">#{appel.id}</td>
                  <td className="p-4 font-semibold text-globus-blue-dark">
                    {appel.libelle}
                  </td>
                  <td className="p-4 text-globus-gray">{appel.date}</td>
                  <td className="p-4 font-bold text-globus-blue-dark">
                    {formatCurrency(appel.montant)}
                  </td>
                  <td className="p-4">
                    {appel.status === 'payé' &&
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        <CheckCircle2Icon className="w-3.5 h-3.5" /> Payé
                      </span>
                  }
                    {appel.status === 'en-attente' &&
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-globus-orange/10 text-globus-orange">
                        <span className="w-2 h-2 rounded-full bg-globus-orange animate-pulse"></span>{' '}
                        À régler
                      </span>
                  }
                    {appel.status === 'à-venir' &&
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                        À venir
                      </span>
                  }
                  </td>
                  <td className="p-4 text-right">
                    {appel.status === 'payé' &&
                  <button
                    onClick={() => handleOpenReceiptFromAppel(appel.id)}
                    className="inline-flex items-center gap-2 text-globus-blue hover:text-globus-blue-dark font-semibold transition-colors">
                    
                        <EyeIcon className="w-4 h-4" /> Reçu
                      </button>
                  }
                    {appel.status === 'en-attente' &&
                  <button
                    onClick={() => handleOpenPayment(appel)}
                    className="inline-flex items-center gap-2 bg-globus-orange hover:bg-globus-orange-hover text-white px-4 py-2 rounded-lg font-montserrat font-bold transition-colors shadow-sm">
                    
                        Payer en ligne
                      </button>
                  }
                    {appel.status === 'à-venir' &&
                  <span className="text-gray-400">-</span>
                  }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Historique des Reçus */}
      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          delay: 0.5
        }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        
        <div className="flex items-center gap-3 mb-6">
          <ReceiptIcon className="w-6 h-6 text-globus-blue-dark" />
          <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark">
            Historique des Reçus
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {receiptsData.map((recu) =>
          <div
            key={recu.id}
            onClick={() => handleOpenReceipt(recu)}
            className="border border-gray-200 rounded-xl p-4 hover:border-globus-blue/30 hover:shadow-md transition-all group cursor-pointer bg-white">
            
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600 group-hover:bg-globus-blue group-hover:text-white transition-colors">
                  <ReceiptIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">
                  {recu.txn}
                </span>
              </div>
              <h4 className="font-montserrat font-bold text-globus-blue-dark mb-1">
                {recu.title}
              </h4>
              <div className="flex justify-between items-end mb-4">
                <p className="font-opensans text-xs text-globus-gray">
                  {recu.date}
                </p>
                <p className="font-montserrat font-bold text-globus-blue">
                  {formatCurrency(recu.amount)}
                </p>
              </div>
              <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(`Recu_${recu.id}_Globus.pdf`);
              }}
              className="w-full py-2 bg-gray-50 hover:bg-globus-blue hover:text-white text-globus-blue-dark text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
              
                <DownloadIcon className="w-4 h-4" /> Télécharger PDF
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedPayment &&
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
          onClick={() =>
          paymentState === 'idle' && setIsPaymentModalOpen(false)
          }>
          
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
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
            
              {paymentState === 'idle' &&
            <>
                  <div className="bg-globus-blue-dark p-6 text-white relative">
                    <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors">
                  
                      <XIcon className="w-6 h-6" />
                    </button>
                    <h3 className="font-montserrat font-bold text-xl mb-1">
                      Règlement en ligne
                    </h3>
                    <p className="text-seconda-blue font-opensans text-sm">
                      Appel de fonds #{selectedPayment.id} :{' '}
                      {selectedPayment.libelle}
                    </p>
                  </div>

                  <div className="p-6 md:p-8">
                    <div className="text-center mb-8">
                      <p className="text-sm text-globus-gray font-opensans mb-1">
                        Montant à régler
                      </p>
                      <p className="font-montserrat font-extrabold text-4xl text-globus-blue-dark">
                        {formatCurrency(selectedPayment.montant)}
                      </p>
                    </div>

                    <p className="font-montserrat font-bold text-sm text-globus-blue-dark mb-4">
                      Choisissez votre méthode de paiement :
                    </p>

                    <div className="space-y-3 mb-8">
                      <label className="flex items-center p-4 border-2 border-globus-orange bg-globus-orange/5 rounded-xl cursor-pointer transition-colors">
                        <input
                      type="radio"
                      name="payment"
                      className="w-4 h-4 text-globus-orange focus:ring-globus-orange"
                      defaultChecked />
                    
                        <div className="ml-4 flex-1 flex items-center justify-between">
                          <span className="font-montserrat font-bold text-globus-blue-dark">
                            Carte Bancaire
                          </span>
                          <CreditCardIcon className="w-6 h-6 text-globus-blue-dark" />
                        </div>
                      </label>

                      <label className="flex items-center p-4 border-2 border-gray-200 hover:border-gray-300 rounded-xl cursor-pointer transition-colors">
                        <input
                      type="radio"
                      name="payment"
                      className="w-4 h-4 text-globus-orange focus:ring-globus-orange" />
                    
                        <div className="ml-4 flex-1 flex items-center justify-between">
                          <span className="font-montserrat font-bold text-globus-blue-dark">
                            Orange Money
                          </span>
                          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                            OM
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center p-4 border-2 border-gray-200 hover:border-gray-300 rounded-xl cursor-pointer transition-colors">
                        <input
                      type="radio"
                      name="payment"
                      className="w-4 h-4 text-globus-orange focus:ring-globus-orange" />
                    
                        <div className="ml-4 flex-1 flex items-center justify-between">
                          <span className="font-montserrat font-bold text-globus-blue-dark">
                            MTN Mobile Money
                          </span>
                          <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-black font-bold text-xs">
                            MOMO
                          </div>
                        </div>
                      </label>
                    </div>

                    <button
                  onClick={handleProcessPayment}
                  className="w-full bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-4 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2">
                  
                      <LockIcon className="w-5 h-5" /> Procéder au paiement
                      sécurisé
                    </button>

                    <p className="text-center text-xs text-globus-gray font-opensans mt-4 flex items-center justify-center gap-1">
                      <LockIcon className="w-3 h-3" /> Paiement sécurisé via
                      Stripe / Flutterwave. Globus ne stocke jamais vos données
                      bancaires.
                    </p>
                  </div>
                </>
            }

              {paymentState === 'processing' &&
            <div className="p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                  <LoaderIcon className="w-16 h-16 text-globus-orange animate-spin mb-6" />
                  <h3 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-2">
                    Traitement en cours...
                  </h3>
                  <p className="font-opensans text-globus-gray">
                    Veuillez ne pas fermer cette fenêtre.
                  </p>
                </div>
            }

              {paymentState === 'success' &&
            <div className="p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2Icon className="w-10 h-10 text-green-500" />
                  </div>
                  <h3 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-2">
                    Paiement effectué !
                  </h3>
                  <p className="font-opensans text-globus-gray mb-6">
                    Votre règlement de {formatCurrency(selectedPayment.montant)}{' '}
                    a été validé avec succès.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4 w-full mb-6 text-sm font-mono text-gray-600">
                    Réf: TXN-2024-
                    {Math.floor(Math.random() * 1000).
                toString().
                padStart(3, '0')}
                  </div>
                  <p className="text-sm font-opensans text-globus-blue font-semibold">
                    Un reçu a été envoyé à votre adresse email.
                  </p>
                  <button
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setPaymentState('idle');
                }}
                className="mt-8 w-full py-3 border-2 border-globus-blue text-globus-blue font-montserrat font-bold rounded-xl hover:bg-globus-blue hover:text-white transition-colors">
                
                    Fermer
                  </button>
                </div>
            }
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Receipt Preview Modal */}
      <AnimatePresence>
        {isReceiptModalOpen && selectedReceipt &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 py-10 overflow-y-auto"
          onClick={() => setIsReceiptModalOpen(false)}>
          
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
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden my-auto">
            
              {/* Receipt Header */}
              <div className="p-8 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-globus-blue-dark rounded flex items-center justify-center">
                      <span className="text-white font-montserrat font-bold text-xs">
                        GE
                      </span>
                    </div>
                    <span className="font-montserrat font-extrabold text-xl text-globus-blue-dark tracking-tight">
                      GLOBUS{' '}
                      <span className="text-globus-orange">ENGINEERING</span>
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-opensans space-y-1">
                    <p>Douala, Cameroun</p>
                    <p>RCCM: RC/DLA/2020/B/1234</p>
                    <p>NIU: M012012345678Z</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="font-montserrat font-bold text-3xl text-gray-200 uppercase tracking-widest mb-2">
                    REÇU
                  </h2>
                  <p className="font-mono text-sm font-bold text-globus-blue-dark">
                    {selectedReceipt.txn}
                  </p>
                  <p className="text-sm text-gray-500 font-opensans mt-1">
                    Date: {selectedReceipt.date}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                    <CheckCircle2Icon className="w-3.5 h-3.5" /> PAYÉ
                  </div>
                </div>
              </div>

              {/* Client Info */}
              <div className="p-8 border-b border-gray-100 flex justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">
                    Facturé à
                  </p>
                  <p className="font-montserrat font-bold text-globus-blue-dark">
                    {clientUser.name}
                  </p>
                  <p className="text-sm text-gray-600 font-opensans">
                    {clientUser.email}
                  </p>
                  <p className="text-sm text-gray-600 font-opensans">
                    {clientUser.phone}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">
                    Projet
                  </p>
                  <p className="font-montserrat font-bold text-globus-blue-dark">
                    {clientUser.projectName}
                  </p>
                  <p className="text-sm text-gray-600 font-opensans">
                    Réf: PRJ-2024-089
                  </p>
                </div>
              </div>

              {/* Line Items */}
              <div className="p-8">
                <table className="w-full text-left mb-8">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="pb-3 font-montserrat font-bold text-sm text-gray-600">
                        Description
                      </th>
                      <th className="pb-3 font-montserrat font-bold text-sm text-gray-600 text-center">
                        Qté
                      </th>
                      <th className="pb-3 font-montserrat font-bold text-sm text-gray-600 text-right">
                        Prix Unitaire
                      </th>
                      <th className="pb-3 font-montserrat font-bold text-sm text-gray-600 text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-opensans text-sm">
                    <tr className="border-b border-gray-100">
                      <td className="py-4 font-semibold text-globus-blue-dark">
                        {selectedReceipt.appelRef}
                      </td>
                      <td className="py-4 text-center text-gray-600">1</td>
                      <td className="py-4 text-right text-gray-600">
                        {formatCurrency(selectedReceipt.amount)}
                      </td>
                      <td className="py-4 text-right font-bold text-globus-blue-dark">
                        {formatCurrency(selectedReceipt.amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-3">
                    <div className="flex justify-between text-sm text-gray-600 font-opensans">
                      <span>Sous-total</span>
                      <span>{formatCurrency(selectedReceipt.amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 font-opensans">
                      <span>TVA ({selectedReceipt.tva}%)</span>
                      <span>Inclus</span>
                    </div>
                    <div className="flex justify-between text-lg font-montserrat font-bold text-globus-blue-dark pt-3 border-t border-gray-200">
                      <span>Total TTC</span>
                      <span>{formatCurrency(selectedReceipt.amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="mt-8 bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                    Détails du paiement
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm font-opensans">
                    <div>
                      <span className="text-gray-500">Méthode:</span>
                      <span className="ml-2 font-semibold text-globus-blue-dark">
                        {selectedReceipt.method}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Date:</span>
                      <span className="ml-2 font-semibold text-globus-blue-dark">
                        {selectedReceipt.date}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-200 transition-colors text-sm">
                
                  Fermer
                </button>
                <button
                onClick={() =>
                handleDownload(`Recu_${selectedReceipt.id}_Globus.pdf`)
                }
                className="bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2">
                
                  <DownloadIcon className="w-4 h-4" /> Télécharger le reçu
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Download Toast */}
      <AnimatePresence>
        {downloadState.isDownloading &&
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
          className="fixed bottom-6 right-6 z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 w-80">
          
            <div className="flex items-start gap-4">
              <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${downloadState.isComplete ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-globus-blue'}`}>
              
                {downloadState.isComplete ?
              <CheckIcon className="w-5 h-5" /> :

              <FileTextIcon className="w-5 h-5" />
              }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-montserrat font-bold text-sm text-globus-blue-dark truncate">
                  {downloadState.fileName}
                </p>
                <p className="text-xs text-gray-500 font-opensans mt-0.5">
                  {downloadState.isComplete ?
                'Téléchargement terminé' :
                'Téléchargement en cours...'}
                </p>

                {!downloadState.isComplete &&
              <div className="mt-3 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                  className="h-full bg-globus-blue rounded-full"
                  initial={{
                    width: 0
                  }}
                  animate={{
                    width: `${downloadState.progress}%`
                  }}
                  transition={{
                    ease: 'linear'
                  }} />
                
                  </div>
              }
              </div>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}