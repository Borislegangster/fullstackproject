import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BoxIcon,
  ArrowRightLeftIcon,
  WrenchIcon,
  PlusIcon,
  QrCodeIcon,
  TruckIcon,
  MapPinIcon,
  CalendarIcon,
  XIcon,
  Loader2Icon,
  CheckCircle2Icon,
  DownloadIcon } from
'lucide-react';
import { useEquipment, useCreateEquipment, useEquipmentAssignments, useCreateEquipmentAssignment } from '../../hooks/useErp';
const initialEquipment = [
{
  id: 'MAT-001',
  name: 'Bétonnière 350L',
  site: 'Villa Bonapriso',
  state: 'Bon',
  type: 'machine'
},
{
  id: 'MAT-002',
  name: 'Grue à tour 40m',
  site: 'Immeuble Akwa',
  state: 'Bon',
  type: 'machine'
},
{
  id: 'MAT-003',
  name: 'Compacteur vibrant',
  site: 'Dépôt central',
  state: 'En maintenance',
  type: 'machine'
},
{
  id: 'MAT-004',
  name: 'Groupe électrogène 50KVA',
  site: 'Résidence Bonanjo',
  state: 'Bon',
  type: 'machine'
},
{
  id: 'VEH-001',
  name: 'Toyota Hilux',
  site: '45 230 km',
  state: 'Bon',
  type: 'vehicle'
},
{
  id: 'VEH-002',
  name: 'Camion Benne 10T',
  site: '89 100 km',
  state: 'Pneus à changer',
  type: 'vehicle'
}];

const initialAssignments = [
{
  equip: 'Bétonnière 350L',
  site: 'Villa Bonapriso',
  since: '01/02/2024',
  resp: 'Paul Mbarga'
},
{
  equip: 'Grue à tour 40m',
  site: 'Immeuble Akwa',
  since: '15/01/2024',
  resp: 'Chef Tabi'
},
{
  equip: 'Groupe électrogène 50KVA',
  site: 'Résidence Bonanjo',
  since: '01/03/2024',
  resp: 'Alain Messi'
},
{
  equip: 'Toyota Hilux',
  site: 'Logistique générale',
  since: '01/01/2024',
  resp: 'Alain Messi'
},
{
  equip: 'Camion Benne 10T',
  site: 'Villa Bonapriso',
  since: '10/02/2024',
  resp: 'Chauffeur Ndjock'
}];

const initialMaintenanceUpcoming = [
{
  equip: 'MAT-003 Compacteur',
  task: 'Révision moteur',
  date: '25/03/2026',
  status: 'En cours'
},
{
  equip: 'VEH-002 Camion Benne',
  task: 'Changement pneus',
  date: '28/03/2026',
  status: 'Planifié'
},
{
  equip: 'MAT-002 Grue',
  task: 'Contrôle annuel',
  date: '15/04/2026',
  status: 'Planifié'
},
{
  equip: 'VEH-001 Hilux',
  task: 'Vidange 50 000 km',
  date: '01/05/2026',
  status: 'Planifié'
}];

const maintenanceHistory = [
{
  equip: 'MAT-001 Bétonnière',
  task: 'Changement courroie',
  date: '10/02/2026',
  cost: 150000
},
{
  equip: 'VEH-001 Hilux',
  task: 'Vidange + filtres',
  date: '15/01/2026',
  cost: 85000
},
{
  equip: 'MAT-002 Grue',
  task: 'Graissage câbles',
  date: '20/12/2025',
  cost: 200000
},
{
  equip: 'VEH-002 Camion',
  task: 'Freins avant',
  date: '05/12/2025',
  cost: 320000
},
{
  equip: 'MAT-004 Groupe',
  task: 'Révision générale',
  date: '01/11/2025',
  cost: 450000
}];

export function ErpMateriel() {
  // API hooks
  const { data: apiEquipment } = useEquipment();
  const { data: apiAssignments } = useEquipmentAssignments();
  const createEqMutation = useCreateEquipment();
  const assignEqMutation = useCreateEquipmentAssignment();

  const [activeTab, setActiveTab] = useState('inventaire');
  const [equipment, setEquipment] = useState(initialEquipment);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [maintenanceUpcoming, setMaintenanceUpcoming] = useState(
    initialMaintenanceUpcoming
  );
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState({
    active: false,
    progress: 0,
    done: false
  });
  const [addEqModal, setAddEqModal] = useState(false);
  const [transferModal, setTransferModal] = useState<{
    isOpen: boolean;
    equip: string | null;
  }>({
    isOpen: false,
    equip: null
  });
  const [planMaintModal, setPlanMaintModal] = useState(false);
  const [qrModal, setQrModal] = useState<{
    isOpen: boolean;
    eqId: string | null;
  }>({
    isOpen: false,
    eqId: null
  });
  const tabs = [
  {
    id: 'inventaire',
    label: 'Inventaire',
    icon: BoxIcon
  },
  {
    id: 'affectations',
    label: 'Affectations',
    icon: ArrowRightLeftIcon
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    icon: WrenchIcon
  }];

  const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';
  const handleAddEq = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('add-eq');
    setTimeout(() => {
      const type = (e.target as any).type.value;
      const newEq = {
        id: `${type === 'vehicle' ? 'VEH' : 'MAT'}-00${Math.floor(Math.random() * 9) + 5}`,
        name: (e.target as any).name.value,
        site: 'Dépôt central',
        state: 'Bon',
        type
      };
      setEquipment([newEq, ...equipment]);
      setProcessingId(null);
      setAddEqModal(false);
    }, 1500);
  };
  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('transfer');
    setTimeout(() => {
      const site = (e.target as any).site.value;
      const resp = (e.target as any).resp.value;
      setAssignments((prev) =>
      prev.map((a) =>
      a.equip === transferModal.equip ?
      {
        ...a,
        site,
        resp,
        since: new Date().toLocaleDateString('fr-FR')
      } :
      a
      )
      );
      setEquipment((prev) =>
      prev.map((eq) =>
      eq.name === transferModal.equip ?
      {
        ...eq,
        site
      } :
      eq
      )
      );
      setProcessingId(null);
      setTransferModal({
        isOpen: false,
        equip: null
      });
    }, 1500);
  };
  const handlePlanMaint = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('plan-maint');
    setTimeout(() => {
      const newMaint = {
        equip: (e.target as any).equip.value,
        task: (e.target as any).task.value,
        date: (e.target as any).date.value,
        status: 'Planifié'
      };
      setMaintenanceUpcoming([newMaint, ...maintenanceUpcoming]);
      setProcessingId(null);
      setPlanMaintModal(false);
    }, 1500);
  };
  const triggerDownload = () => {
    if (downloadState.active) return;
    setDownloadState({
      active: true,
      progress: 0,
      done: false
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
        setTimeout(() => {
          setDownloadState({
            active: false,
            progress: 0,
            done: false
          });
          setQrModal({
            isOpen: false,
            eqId: null
          });
        }, 2000);
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
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-montserrat font-bold text-sm transition-all ${activeTab === tab.id ? 'bg-globus-orange text-white shadow-md' : 'text-globus-gray hover:bg-globus-light'}`}>
              
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>);

        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'inventaire' &&
        <motion.div
          key="inv"
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
          }}>
          
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                Parc Matériel
              </h2>
              <button
              onClick={() => setAddEqModal(true)}
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
              
                <PlusIcon className="w-4 h-4" /> Ajouter Équipement
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {equipment.map((eq, idx) =>
              <motion.div
                key={eq.id}
                layout
                initial={{
                  opacity: 0,
                  scale: 0.9
                }}
                animate={{
                  opacity: 1,
                  scale: 1
                }}
                transition={{
                  delay: idx * 0.05
                }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                
                    <div className="flex items-start justify-between mb-3">
                      <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${eq.type === 'vehicle' ? 'bg-blue-100 text-blue-600' : 'bg-globus-orange/10 text-globus-orange'}`}>
                    
                        {eq.type === 'vehicle' ?
                    <TruckIcon className="w-6 h-6" /> :

                    <BoxIcon className="w-6 h-6" />
                    }
                      </div>
                      <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                        {eq.id}
                      </span>
                    </div>
                    <h3 className="font-montserrat font-bold text-globus-blue-dark mb-2">
                      {eq.name}
                    </h3>
                    <p className="text-xs text-globus-gray font-opensans flex items-center gap-1 mb-3">
                      <MapPinIcon className="w-3 h-3" /> {eq.site}
                    </p>
                    <div className="flex items-center justify-between">
                      <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold font-montserrat ${eq.state === 'Bon' ? 'bg-green-100 text-green-700' : eq.state === 'En maintenance' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    
                        {eq.state}
                      </span>
                      <button
                    onClick={() =>
                    setQrModal({
                      isOpen: true,
                      eqId: eq.id
                    })
                    }
                    className="text-xs text-globus-blue hover:underline font-semibold flex items-center gap-1">
                    
                        <QrCodeIcon className="w-3 h-3" /> QR Code
                      </button>
                    </div>
                  </motion.div>
              )}
              </AnimatePresence>
            </div>
          </motion.div>
        }

        {activeTab === 'affectations' &&
        <motion.div
          key="aff"
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
          }}>
          
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                  Affectations en Cours
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-globus-light border-b border-gray-200">
                      <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Équipement
                      </th>
                      <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Affecté à
                      </th>
                      <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Depuis
                      </th>
                      <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Responsable
                      </th>
                      <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-opensans text-sm">
                    <AnimatePresence>
                      {assignments.map((a, i) =>
                    <motion.tr
                      layout
                      key={a.equip}
                      initial={{
                        opacity: 0
                      }}
                      animate={{
                        opacity: 1
                      }}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      
                          <td className="p-4 font-semibold text-globus-blue-dark">
                            {a.equip}
                          </td>
                          <td className="p-4 text-globus-gray">{a.site}</td>
                          <td className="p-4 text-globus-gray">{a.since}</td>
                          <td className="p-4 text-globus-gray">{a.resp}</td>
                          <td className="p-4 text-right">
                            <button
                          onClick={() =>
                          setTransferModal({
                            isOpen: true,
                            equip: a.equip
                          })
                          }
                          className="text-xs bg-globus-blue/10 text-globus-blue hover:bg-globus-blue hover:text-white px-3 py-1.5 rounded-lg font-bold transition-colors">
                          
                              Transférer
                            </button>
                          </td>
                        </motion.tr>
                    )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        }

        {activeTab === 'maintenance' &&
        <motion.div
          key="maint"
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
          
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                  Maintenance Préventive — À Venir
                </h2>
                <button
                onClick={() => setPlanMaintModal(true)}
                className="bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
                
                  <PlusIcon className="w-4 h-4" /> Planifier
                </button>
              </div>
              <div className="space-y-4">
                <AnimatePresence>
                  {maintenanceUpcoming.map((m, i) =>
                <motion.div
                  layout
                  key={m.equip + m.task}
                  initial={{
                    opacity: 0,
                    scale: 0.95
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1
                  }}
                  className={`flex items-center justify-between p-4 rounded-xl border ${m.status === 'En cours' ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white'}`}>
                  
                      <div className="flex items-center gap-4">
                        <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${m.status === 'En cours' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      
                          <WrenchIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                            {m.equip}
                          </p>
                          <p className="text-xs text-globus-gray font-opensans">
                            {m.task}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-globus-gray font-opensans flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" /> {m.date}
                        </span>
                        <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold font-montserrat ${m.status === 'En cours' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      
                          {m.status}
                        </span>
                      </div>
                    </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Historique des Interventions
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-globus-light border-b border-gray-200">
                      <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Équipement
                      </th>
                      <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Intervention
                      </th>
                      <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Date
                      </th>
                      <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Coût
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-opensans text-sm">
                    {maintenanceHistory.map((m, i) =>
                  <tr
                    key={i}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    
                        <td className="p-4 font-semibold text-globus-blue-dark">
                          {m.equip}
                        </td>
                        <td className="p-4 text-globus-gray">{m.task}</td>
                        <td className="p-4 text-globus-gray">{m.date}</td>
                        <td className="p-4 font-bold text-globus-blue-dark">
                          {fmt(m.cost)}
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

      {/* Add Equipment Modal */}
      <AnimatePresence>
        {addEqModal &&
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
                  <BoxIcon className="w-5 h-5 text-globus-orange" /> Ajouter
                  Équipement
                </h3>
                <button
                onClick={() => setAddEqModal(false)}
                className="text-gray-400 hover:text-gray-600">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddEq} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Nom de l'équipement
                  </label>
                  <input
                  name="name"
                  type="text"
                  required
                  placeholder="Ex: Bétonnière 500L"
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Type
                  </label>
                  <select
                  name="type"
                  required
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">
                  
                    <option value="machine">Machine / Outil</option>
                    <option value="vehicle">Véhicule / Engin</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                  type="button"
                  onClick={() => setAddEqModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'add-eq'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'add-eq' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }{' '}
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {transferModal.isOpen &&
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
                  <ArrowRightLeftIcon className="w-5 h-5 text-globus-blue" />{' '}
                  Transférer Équipement
                </h3>
                <button
                onClick={() =>
                setTransferModal({
                  isOpen: false,
                  equip: null
                })
                }
                className="text-gray-400 hover:text-gray-600">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleTransfer} className="p-6 space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
                  <p className="font-bold text-globus-blue-dark">
                    {transferModal.equip}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Nouveau Chantier
                  </label>
                  <select
                  name="site"
                  required
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-blue focus:ring-2 focus:ring-globus-blue/20 outline-none">
                  
                    <option value="Villa Bonapriso">Villa Bonapriso</option>
                    <option value="Immeuble Akwa">Immeuble Akwa</option>
                    <option value="Résidence Bonanjo">Résidence Bonanjo</option>
                    <option value="Dépôt central">
                      Dépôt central (Retour)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Nouveau Responsable
                  </label>
                  <input
                  name="resp"
                  type="text"
                  required
                  placeholder="Nom du responsable"
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-blue focus:ring-2 focus:ring-globus-blue/20 outline-none" />
                
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                  type="button"
                  onClick={() =>
                  setTransferModal({
                    isOpen: false,
                    equip: null
                  })
                  }
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'transfer'}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'transfer' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <ArrowRightLeftIcon className="w-4 h-4" />
                  }{' '}
                    Valider Transfert
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Plan Maintenance Modal */}
      <AnimatePresence>
        {planMaintModal &&
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
                  <WrenchIcon className="w-5 h-5 text-globus-orange" />{' '}
                  Planifier Maintenance
                </h3>
                <button
                onClick={() => setPlanMaintModal(false)}
                className="text-gray-400 hover:text-gray-600">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handlePlanMaint} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Équipement
                  </label>
                  <select
                  name="equip"
                  required
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">
                  
                    {equipment.map((eq) =>
                  <option key={eq.id} value={`${eq.id} ${eq.name}`}>
                        {eq.id} - {eq.name}
                      </option>
                  )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Intervention prévue
                  </label>
                  <input
                  name="task"
                  type="text"
                  required
                  placeholder="Ex: Vidange, Révision..."
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Date prévue
                  </label>
                  <input
                  name="date"
                  type="date"
                  required
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                  type="button"
                  onClick={() => setPlanMaintModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'plan-maint'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'plan-maint' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }{' '}
                    Planifier
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrModal.isOpen &&
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-8">
            
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                QR Code Équipement
              </h3>
              <p className="font-mono text-sm text-globus-gray mb-6 bg-gray-100 py-1 px-3 rounded inline-block">
                {qrModal.eqId}
              </p>

              <div className="w-48 h-48 mx-auto bg-white border-4 border-globus-blue-dark rounded-xl p-2 mb-6 relative">
                <div className="absolute inset-2 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <QrCodeIcon className="w-24 h-24 text-globus-blue-dark" />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                onClick={() =>
                setQrModal({
                  isOpen: false,
                  eqId: null
                })
                }
                className="flex-1 py-2.5 rounded-lg border border-gray-200 font-montserrat font-bold text-sm text-globus-gray hover:bg-gray-50 transition-colors">
                
                  Fermer
                </button>
                <button
                onClick={triggerDownload}
                disabled={downloadState.active}
                className="flex-1 bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                
                  {downloadState.active ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :

                <DownloadIcon className="w-4 h-4" />
                }{' '}
                  Télécharger
                </button>
              </div>
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

            <div className="w-8 h-8 rounded-full bg-globus-blue/10 flex items-center justify-center shrink-0">
                  <Loader2Icon className="w-4 h-4 text-globus-blue animate-spin" />
                </div>
            }
              <div>
                <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                  {downloadState.done ?
                'Téléchargement terminé' :
                'Génération du QR Code...'}
                </p>
                <p className="font-opensans text-xs text-globus-gray">
                  QR_{qrModal.eqId}.png
                </p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
              className={`h-full rounded-full ${downloadState.done ? 'bg-green-500' : 'bg-globus-blue'}`}
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