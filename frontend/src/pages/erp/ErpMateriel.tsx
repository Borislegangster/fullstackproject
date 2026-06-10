import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate } from '../../utils/datetime';
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
  DownloadIcon,
  Undo2Icon } from
'lucide-react';
import {
  useEquipment, useCreateEquipment, useEquipmentAssignments, useCreateEquipmentAssignment,
  useMaintenance, useCreateMaintenance, useCompleteMaintenance, useReturnEquipmentAssignment,
  useProjects,
} from '../../hooks/useErp';



export function ErpMateriel() {
  // API hooks
  const { data: apiEquipment } = useEquipment();
  const { data: apiProjects } = useProjects();
  const projectOptions: any[] = Array.isArray(apiProjects) ? apiProjects : [];
  const { data: apiAssignments } = useEquipmentAssignments();
  const { data: apiMaintenance } = useMaintenance();
  const createEqMutation = useCreateEquipment();
  const assignEqMutation = useCreateEquipmentAssignment();
  const createMaintenanceMutation = useCreateMaintenance();
  const completeMaintenanceMutation = useCompleteMaintenance();
  const returnAssignmentMutation = useReturnEquipmentAssignment();

  const [activeTab, setActiveTab] = useState('inventaire');

  // Live data from API (fallback to static demo when empty)
  const equipment = useMemo<any[]>(() => {
    if (!Array.isArray(apiEquipment)) return [] as any[];
    return apiEquipment.map((e: any) => ({
      id: e.code || e.id,
      name: e.name || '',
      site: e.current_project_id || 'Dépôt central',
      state: e.status === 'DISPONIBLE' ? 'Bon'
        : e.status === 'EN_MAINTENANCE' ? 'En maintenance'
        : e.status === 'HORS_SERVICE' ? 'Hors service'
        : 'En service',
      type: e.category === 'Véhicule' ? 'vehicle' : 'machine',
      raw_id: e.id,
    }));
  }, [apiEquipment]);

  const assignments = useMemo<any[]>(() => {
    if (!Array.isArray(apiAssignments)) return [] as any[];
    return apiAssignments.map((a: any) => ({
      equip: a.equipment_name || '',
      site: a.project_id || '',
      since: formatDate(a.assigned_from),
      resp: a.responsible_id || '—',
      raw_id: a.id,
    }));
  }, [apiAssignments]);

  const maintenanceUpcoming = useMemo<any[]>(() => {
    if (!Array.isArray(apiMaintenance)) return [] as any[];
    return apiMaintenance
      .filter((m: any) => m.status !== 'DONE' && m.status !== 'CANCELLED')
      .map((m: any) => ({
        equip: m.equipment_id || '',
        task: m.description || '',
        type: m.maintenance_type === 'PREVENTIVE' ? 'Préventive' : 'Curative',
        date: formatDate(m.scheduled_for, 'À planifier'),
        when: formatDate(m.scheduled_for, 'À planifier'),
        status: m.status === 'IN_PROGRESS' ? 'En cours' : 'Planifié',
        raw_id: m.id,
      }));
  }, [apiMaintenance]);

  const maintenanceDone = useMemo<any[]>(() => {
    if (!Array.isArray(apiMaintenance)) return [];
    return apiMaintenance
      .filter((m: any) => m.status === 'DONE' || m.status === 'COMPLETED' || m.status === 'TERMINE')
      .map((m: any) => ({
        equip: m.equipment_name || m.equipment_id || '',
        task: m.description || '',
        date: formatDate(m.completed_at || m.scheduled_for),
        cost: m.cost || 0,
      }));
  }, [apiMaintenance]);
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
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  // Generate a *real* scannable QR (PNG data URL) for the equipment.
  const openQr = async (eqId: string) => {
    setQrModal({ isOpen: true, eqId });
    setQrDataUrl('');
    try {
      const QRCode = (await import('qrcode')).default;
      setQrDataUrl(
        await QRCode.toDataURL(`GLOBUS-EQUIP:${eqId}`, { width: 320, margin: 1 }),
      );
    } catch {
      setQrDataUrl('');
    }
  };
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
  const handleAddEq = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('add-eq');
    try {
      const type = (e.target as any).type.value;
      await createEqMutation.mutateAsync({
        name: (e.target as any).name.value,
        category: type === 'vehicle' ? 'Véhicule' : 'Engin',
      });
      setAddEqModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('transfer');
    const equipName = transferModal.equip;
    const equipObj = equipment.find((eq) => eq.name === equipName);
    try {
      const projectId = (e.target as any).site.value;
      const responsibleId = (e.target as any).resp.value;
      if (!equipObj?.raw_id) {
        throw new Error('Équipement introuvable');
      }
      await assignEqMutation.mutateAsync({
        equipment_id: equipObj.raw_id,
        project_id: projectId,
        responsible_id: responsibleId,
      });
      setTransferModal({ isOpen: false, equip: null });
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handlePlanMaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('plan-maint');
    try {
      const equipName = (e.target as any).equip.value;
      const equipObj = equipment.find((eq) => eq.name === equipName);
      if (!equipObj?.raw_id) {
        throw new Error('Équipement introuvable');
      }
      await createMaintenanceMutation.mutateAsync({
        equipment_id: equipObj.raw_id,
        description: (e.target as any).task.value,
        maintenance_type: 'PREVENTIVE',
        scheduled_for: (e.target as any).date.value,
      });
      setPlanMaintModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleReturnAssignment = async (assignmentId: string) => {
    setProcessingId(`return-${assignmentId}`);
    try {
      await returnAssignmentMutation.mutateAsync(assignmentId);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const handleCompleteMaintenance = async (maintenanceId: string) => {
    setProcessingId(`complete-${maintenanceId}`);
    try {
      await completeMaintenanceMutation.mutateAsync({ id: maintenanceId });
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };
  const triggerDownload = () => {
    if (downloadState.active || !qrDataUrl) return;
    // Real PNG download of the generated QR.
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${qrModal.eqId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloadState({ active: true, progress: 100, done: true });
    setTimeout(() => {
      setDownloadState({ active: false, progress: 0, done: false });
      setQrModal({ isOpen: false, eqId: null });
    }, 1500);
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
                    onClick={() => openQr(eq.id)}
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
                      {assignments.map((a) =>
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
                            <div className="flex items-center justify-end gap-2">
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
                              <button
                          onClick={() => handleReturnAssignment(a.raw_id)}
                          disabled={processingId === `return-${a.raw_id}`}
                          title="Marquer comme retourné au dépôt"
                          className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 disabled:opacity-60">
                                {processingId === `return-${a.raw_id}` ?
                          <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :
                          <Undo2Icon className="w-3.5 h-3.5" />}
                                Retour
                              </button>
                            </div>
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
                  {maintenanceUpcoming.map((m) =>
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
                        {m.status !== 'Terminé' &&
                    <button
                      onClick={() => handleCompleteMaintenance(m.raw_id)}
                      disabled={processingId === `complete-${m.raw_id}`}
                      title="Marquer la maintenance comme terminée"
                      className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2.5 py-1 rounded-lg font-bold transition-colors flex items-center gap-1 disabled:opacity-60">
                          {processingId === `complete-${m.raw_id}` ?
                      <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :
                      <CheckCircle2Icon className="w-3.5 h-3.5" />}
                          Terminer
                        </button>
                    }
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
                    {maintenanceDone.length === 0 &&
                  <tr><td colSpan={4} className="p-8 text-center text-globus-gray">Aucune intervention terminée.</td></tr>
                  }
                    {maintenanceDone.map((m, i) =>
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
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-blue focus:ring-2 focus:ring-globus-blue/20 outline-none">

                    <option value="">Dépôt central (Retour)</option>
                    {projectOptions.map((p) =>
                    <option key={p.id} value={p.id}>{p.name || p.code}</option>
                    )}
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

              <div className="w-48 h-48 mx-auto bg-white border-4 border-globus-blue-dark rounded-xl p-2 mb-6 relative flex items-center justify-center">
                {qrDataUrl ?
                <img
                  src={qrDataUrl}
                  alt={`QR ${qrModal.eqId}`}
                  className="w-full h-full object-contain" /> :

                <Loader2Icon className="w-10 h-10 text-globus-blue-dark animate-spin" />
                }
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
                disabled={downloadState.active || !qrDataUrl}
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