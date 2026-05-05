import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  FileTextIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  SendIcon,
  ClockIcon,
  ActivityIcon,
  WalletIcon,
  AlertTriangleIcon } from
'lucide-react';
const initialPipelineColumns = [
{
  id: 'prospect',
  label: 'PROSPECT',
  color: 'border-t-gray-400',
  bg: 'bg-gray-50',
  items: [
  {
    id: 'P-001',
    name: 'M. Essomba',
    project: 'Villa 5 chambres',
    budget: 95000000,
    source: 'Recommandation',
    date: '20/03/2026',
    prob: 20,
    phone: '+237 699 00 11 22',
    email: 'essomba@email.com',
    location: 'Yaoundé'
  },
  {
    id: 'P-002',
    name: 'Société SABC',
    project: 'Extension usine',
    budget: 500000000,
    source: 'Salon BTP',
    date: '18/03/2026',
    prob: 15,
    phone: '+237 677 88 99 00',
    email: 'contact@sabc.cm',
    location: 'Douala'
  }]

},
{
  id: 'qualification',
  label: 'QUALIFICATION',
  color: 'border-t-blue-500',
  bg: 'bg-blue-50/30',
  items: [
  {
    id: 'P-003',
    name: 'Mme Ngo Bassa',
    project: 'Immeuble R+2',
    budget: 180000000,
    source: 'Site web',
    date: '15/03/2026',
    prob: 40,
    phone: '+237 655 44 33 22',
    email: 'ngo.bassa@email.com',
    location: 'Douala'
  },
  {
    id: 'P-004',
    name: 'Dr. Fotso',
    project: 'Clinique privée',
    budget: 250000000,
    source: 'Recommandation',
    date: '12/03/2026',
    prob: 50,
    phone: '+237 699 88 77 66',
    email: 'dr.fotso@clinique.cm',
    location: 'Bafoussam'
  }]

},
{
  id: 'devis',
  label: 'DEVIS ENVOYÉ',
  color: 'border-t-globus-orange',
  bg: 'bg-orange-50/30',
  items: [
  {
    id: 'P-005',
    name: 'M. Tchoupo',
    project: 'Villa 4 chambres',
    budget: 85000000,
    source: 'Site web',
    date: '10/03/2026',
    prob: 65,
    phone: '+237 677 11 22 33',
    email: 'tchoupo@email.com',
    location: 'Kribi'
  }]

},
{
  id: 'nego',
  label: 'NÉGOCIATION',
  color: 'border-t-purple-500',
  bg: 'bg-purple-50/30',
  items: [
  {
    id: 'P-006',
    name: 'Import-Export SA',
    project: 'Entrepôt 800m²',
    budget: 150000000,
    source: 'Salon BTP',
    date: '05/03/2026',
    prob: 80,
    phone: '+237 699 55 44 33',
    email: 'direction@importexport.cm',
    location: 'Douala Port'
  }]

},
{
  id: 'won',
  label: 'GAGNÉ',
  color: 'border-t-emerald-500',
  bg: 'bg-emerald-50/30',
  items: [
  {
    id: 'P-007',
    name: 'Mme Nguema',
    project: 'Immeuble R+3',
    budget: 350000000,
    source: 'Recommandation',
    date: '01/03/2026',
    prob: 100,
    phone: '+237 655 99 88 77',
    email: 'nguema@email.com',
    location: 'Yaoundé'
  },
  {
    id: 'P-008',
    name: 'CAMTEL',
    project: 'Rénovation bureau',
    budget: 25000000,
    source: "Appel d'offre",
    date: '25/02/2026',
    prob: 100,
    phone: '+237 222 33 44 55',
    email: 'marches@camtel.cm',
    location: 'Yaoundé'
  }]

}];

const initialQuotes = [
{
  id: 'DEV-2026-015',
  project: 'Villa 4 chambres',
  client: 'M. Tchoupo',
  amount: 85000000,
  status: 'Envoyé',
  date: '15/03/2026'
},
{
  id: 'DEV-2026-014',
  project: 'Immeuble R+3',
  client: 'Mme Nguema',
  amount: 350000000,
  status: 'Accepté',
  date: '10/03/2026'
},
{
  id: 'DEV-2026-013',
  project: 'Rénovation bureau',
  client: 'CAMTEL',
  amount: 25000000,
  status: 'En rédaction',
  date: '08/03/2026'
},
{
  id: 'DEV-2026-012',
  project: 'Entrepôt 500m²',
  client: 'Import-Export SA',
  amount: 120000000,
  status: 'Refusé',
  date: '01/03/2026'
}];

const fmt = (v: number) =>
new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0
}).format(v) + ' FCFA';
const fmtShort = (v: number) => {
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace('.0', '') + 'M FCFA';
  return fmt(v);
};
export function ErpCRM() {
  const [activeTab, setActiveTab] = useState('pipeline');
  // Data States
  const [pipelineColumns, setPipelineColumns] = useState(initialPipelineColumns);
  const [quotes, setQuotes] = useState(initialQuotes);
  // UI States
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState({
    active: false,
    progress: 0,
    done: false,
    filename: ''
  });
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
  const handleNewProspect = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('new-prospect');
    setTimeout(() => {
      const form = e.target as HTMLFormElement;
      const newProspect = {
        id: `P-${Math.floor(Math.random() * 1000)}`,
        name: (form.elements.namedItem('name') as HTMLInputElement).value,
        project: (form.elements.namedItem('project') as HTMLInputElement).value,
        budget: parseInt(
          (form.elements.namedItem('budget') as HTMLInputElement).value
        ),
        source: (form.elements.namedItem('source') as HTMLSelectElement).value,
        prob: parseInt(
          (form.elements.namedItem('prob') as HTMLInputElement).value
        ),
        phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
        email: (form.elements.namedItem('email') as HTMLInputElement).value,
        location: (form.elements.namedItem('location') as HTMLInputElement).
        value,
        date: new Date().toLocaleDateString('fr-FR')
      };
      setPipelineColumns((prev) =>
      prev.map((col) => {
        if (col.id === 'prospect') {
          return {
            ...col,
            items: [newProspect, ...col.items]
          };
        }
        return col;
      })
      );
      setProcessingId(null);
      setProspectModal(false);
    }, 1500);
  };
  const handleMoveProspect = (
  prospectId: string,
  fromColId: string,
  toColId: string) =>
  {
    setProcessingId(`move-${prospectId}`);
    setTimeout(() => {
      let prospectToMove: any = null;
      setPipelineColumns((prev) => {
        // First find and remove from source column
        const newCols = prev.map((col) => {
          if (col.id === fromColId) {
            prospectToMove = col.items.find((p) => p.id === prospectId);
            return {
              ...col,
              items: col.items.filter((p) => p.id !== prospectId)
            };
          }
          return col;
        });
        // Then add to target column
        if (prospectToMove) {
          // Update probability based on column
          if (toColId === 'won') prospectToMove.prob = 100;else
          if (toColId === 'nego') prospectToMove.prob = 80;else
          if (toColId === 'devis') prospectToMove.prob = 60;else
          if (toColId === 'qualification') prospectToMove.prob = 40;else
          if (toColId === 'prospect') prospectToMove.prob = 20;
          return newCols.map((col) => {
            if (col.id === toColId) {
              return {
                ...col,
                items: [prospectToMove, ...col.items]
              };
            }
            return col;
          });
        }
        return newCols;
      });
      setProcessingId(null);
      setProspectDetailModal({
        isOpen: false,
        prospect: null,
        colId: ''
      });
    }, 1000);
  };
  const handleNewDevis = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('new-devis');
    setTimeout(() => {
      const form = e.target as HTMLFormElement;
      const newDevis = {
        id: `DEV-2026-${Math.floor(Math.random() * 100) + 20}`,
        project: (form.elements.namedItem('project') as HTMLInputElement).value,
        client: (form.elements.namedItem('client') as HTMLInputElement).value,
        amount: parseInt(
          (form.elements.namedItem('amount') as HTMLInputElement).value
        ),
        status: 'En rédaction',
        date: new Date().toLocaleDateString('fr-FR')
      };
      setQuotes([newDevis, ...quotes]);
      setProcessingId(null);
      setDevisModal(false);
    }, 1500);
  };
  const handleEditDevis = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('edit-devis');
    setTimeout(() => {
      const form = e.target as HTMLFormElement;
      const status = (form.elements.namedItem('status') as HTMLSelectElement).
      value;
      setQuotes((prev) =>
      prev.map((q) =>
      q.id === editDevisModal.quote.id ?
      {
        ...q,
        status
      } :
      q
      )
      );
      setProcessingId(null);
      setEditDevisModal({
        isOpen: false,
        quote: null
      });
    }, 1000);
  };
  const handleDuplicateDevis = (quote: any) => {
    setProcessingId(`dup-${quote.id}`);
    setTimeout(() => {
      const duplicated = {
        ...quote,
        id: `DEV-2026-${Math.floor(Math.random() * 100) + 20}`,
        status: 'En rédaction',
        date: new Date().toLocaleDateString('fr-FR')
      };
      setQuotes([duplicated, ...quotes]);
      setProcessingId(null);
    }, 1000);
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
        
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
              Tunnel de Vente
            </h2>
            <button
            onClick={() => setProspectModal(true)}
            className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
            
              <PlusIcon className="w-4 h-4" /> Nouveau Prospect
            </button>
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
                    onClick={() => triggerDownload(`Devis_${q.id}.pdf`)}
                    className="p-2 text-gray-500 hover:text-globus-blue hover:bg-white rounded-md transition-all shadow-sm"
                    title="Télécharger">
                    
                        <DownloadIcon className="w-4 h-4" />
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
                    </div>
                  </div>
                </motion.div>
            )}
            </AnimatePresence>
          </div>
        </motion.div>
      }

      {activeTab === 'portail' &&
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}>
        
          <div className="space-y-6">
            {/* Client Info Header */}
            <div className="bg-gradient-to-r from-globus-blue-dark to-globus-blue rounded-xl shadow-sm border border-gray-200 p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                  JT
                </div>
                <div>
                  <h3 className="font-montserrat font-bold text-xl">
                    M. Jean Talla
                  </h3>
                  <p className="text-blue-100 text-sm">
                    Villa Moderne Bonapriso
                  </p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1">
                      <PhoneIcon className="w-3.5 h-3.5" /> +237 699 123 456
                    </span>
                    <span className="flex items-center gap-1">
                      <MailIcon className="w-3.5 h-3.5" /> jean.talla@email.com
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages & Appointments Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Messages */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4 flex items-center gap-2">
                  <MessageSquareIcon className="w-5 h-5 text-globus-orange" />
                  Messages Client
                </h3>
                <div className="space-y-3">
                  {[
                {
                  from: 'Jean Talla',
                  to: 'Paul Mbarga',
                  subject: 'Question sur les finitions',
                  preview:
                  'Bonjour, je souhaiterais discuter des choix de carrelage...',
                  date: '23/03/2026 14:30',
                  unread: true
                },
                {
                  from: 'Jean Talla',
                  to: 'Support Technique',
                  subject: 'Accès caméra chantier',
                  preview: 'La caméra ne fonctionne plus depuis hier...',
                  date: '22/03/2026 09:15',
                  unread: false
                },
                {
                  from: 'Jean Talla',
                  to: 'Claire Fotso',
                  subject: 'Modification plan',
                  preview: 'Serait-il possible de modifier légèrement...',
                  date: '20/03/2026 16:45',
                  unread: false
                }].
                map((msg, idx) =>
                <div
                  key={idx}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${msg.unread ? 'bg-blue-50 border-globus-blue/30' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                  
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {msg.unread &&
                      <div className="w-2 h-2 rounded-full bg-globus-blue"></div>
                      }
                          <span className="font-montserrat font-bold text-sm text-globus-blue-dark">
                            {msg.subject}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {msg.date}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">
                        De: {msg.from} → À: {msg.to}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {msg.preview}
                      </p>
                      <button
                    onClick={() => {
                      setProcessingId(`reply-${idx}`);
                      setTimeout(() => {
                        setProcessingId(null);
                        showToast('Réponse envoyée au client', 'success');
                      }, 1500);
                    }}
                    disabled={processingId === `reply-${idx}`}
                    className="mt-2 text-xs font-bold text-globus-blue hover:text-globus-orange transition-colors flex items-center gap-1">
                    
                        {processingId === `reply-${idx}` ?
                    <Loader2Icon className="w-3 h-3 animate-spin" /> :

                    <SendIcon className="w-3 h-3" />
                    }{' '}
                        Répondre
                      </button>
                    </div>
                )}
                </div>
              </div>

              {/* Appointments */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-globus-orange" />
                  Demandes de RDV
                </h3>
                <div className="space-y-3">
                  {[
                {
                  type: 'Visite chantier',
                  date: '28/03/2026',
                  time: '10:00',
                  status: 'En attente',
                  note: "Souhaite voir l'avancement des travaux"
                },
                {
                  type: 'Choix finitions',
                  date: '30/03/2026',
                  time: '14:00',
                  status: 'Confirmé',
                  note: 'Sélection carrelage et peinture'
                }].
                map((rdv, idx) =>
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-montserrat font-bold text-sm text-globus-blue-dark">
                          {rdv.type}
                        </span>
                        <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rdv.status === 'Confirmé' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      
                          {rdv.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" /> {rdv.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" /> {rdv.time}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{rdv.note}</p>
                      {rdv.status === 'En attente' &&
                  <div className="flex gap-2 mt-2">
                          <button
                      onClick={() => {
                        setProcessingId(`confirm-${idx}`);
                        setTimeout(() => {
                          setProcessingId(null);
                          showToast('RDV confirmé', 'success');
                        }, 1000);
                      }}
                      disabled={processingId === `confirm-${idx}`}
                      className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg font-bold transition-colors">
                      
                            {processingId === `confirm-${idx}` ?
                      <Loader2Icon className="w-3 h-3 animate-spin mx-auto" /> :

                      'Confirmer'
                      }
                          </button>
                          <button className="flex-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 rounded-lg font-bold transition-colors">
                            Refuser
                          </button>
                        </div>
                  }
                    </div>
                )}
                </div>
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4 flex items-center gap-2">
                <ActivityIcon className="w-5 h-5 text-globus-orange" />
                Activité Portail Client
              </h3>
              <div className="space-y-3">
                {[
              {
                action: 'Paiement effectué',
                detail: 'Appel de fonds #3 - 17 000 000 FCFA (MTN MoMo)',
                date: '15/05/2024 16:23',
                icon: WalletIcon,
                color: 'text-green-600',
                bg: 'bg-green-100'
              },
              {
                action: 'Document signé',
                detail: 'Avenant budgétaire #1 (signature OTP)',
                date: '10/05/2024 11:45',
                icon: FileTextIcon,
                color: 'text-blue-600',
                bg: 'bg-blue-100'
              },
              {
                action: 'Ticket SAV créé',
                detail: 'Prise électrique défectueuse - Chambre 2',
                date: '01/06/2025 09:30',
                icon: AlertTriangleIcon,
                color: 'text-orange-600',
                bg: 'bg-orange-100'
              },
              {
                action: 'Validation matériaux',
                detail: 'Choix carrelage cuisine confirmé',
                date: '25/04/2024 14:15',
                icon: CheckCircle2Icon,
                color: 'text-purple-600',
                bg: 'bg-purple-100'
              },
              {
                action: 'Connexion portail',
                detail: 'Consultation planning et photos',
                date: '24/03/2026 08:12',
                icon: UserIcon,
                color: 'text-gray-600',
                bg: 'bg-gray-100'
              }].
              map((activity, idx) => {
                const Icon = activity.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    
                      <div
                      className={`w-8 h-8 rounded-lg ${activity.bg} flex items-center justify-center shrink-0`}>
                      
                        <Icon className={`w-4 h-4 ${activity.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                          {activity.action}
                        </p>
                        <p className="text-xs text-gray-600">
                          {activity.detail}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {activity.date}
                        </p>
                      </div>
                    </div>);

              })}
              </div>
            </div>
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
                'Génération du PDF...'}
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