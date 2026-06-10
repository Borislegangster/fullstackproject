import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UsersIcon, HardHatIcon, ClockIcon, BanknoteIcon, SearchIcon, PlusIcon, QrCodeIcon, StarIcon, DownloadIcon, PhoneIcon, XIcon, CheckCircle2Icon, Loader2Icon, MailIcon, BriefcaseIcon, CalendarIcon, FileTextIcon, ScanIcon, Trash2Icon } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/datetime';
import {
  useEmployees, useTempWorkers, useCreateEmployee, useCreateTempWorker,
  useDeleteEmployee, useRecordAttendance, useAttendance, usePayrollList,
  useGeneratePayroll, useValidatePayroll, useMarkPayrollPaid,
} from '../../hooks/useErp';
import { downloadPayrollPdf, exportEmployeesXlsx, exportTempWorkersXlsx, exportPayrollXlsx } from '../../services/api/downloads';
import { TempWorkerQrModal } from '../../components/erp/TempWorkerQrModal';
const tabs = [
{
  id: 'employes',
  label: 'Employés',
  icon: UsersIcon
},
{
  id: 'ouvriers',
  label: 'Ouvriers Temporaires',
  icon: HardHatIcon
},
{
  id: 'pointage',
  label: 'Pointage',
  icon: ClockIcon
},
{
  id: 'paie',
  label: 'Paie',
  icon: BanknoteIcon
}];





const formatCurrency = (v: number) =>
new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0
}).format(v);
const specColors: Record<string, string> = {
  Maçon: 'bg-orange-100 text-orange-700',
  Ferrailleur: 'bg-blue-100 text-blue-700',
  Coffreur: 'bg-purple-100 text-purple-700',
  Peintre: 'bg-pink-100 text-pink-700',
  Électricien: 'bg-yellow-100 text-yellow-700',
  Plombier: 'bg-cyan-100 text-cyan-700'
};
const statusColor = (s: string) => {
  if (s === 'Actif' || s === 'Présent') return 'bg-green-100 text-green-700';
  if (s === 'En congé' || s === 'Retard') return 'bg-yellow-100 text-yellow-700';
  if (s === 'Absent') return 'bg-red-100 text-red-700';
  if (s === 'En mission') return 'bg-blue-100 text-blue-700';
  if (s === 'Disponible') return 'bg-green-100 text-green-700';
  return 'bg-gray-100 text-gray-700';
};
type AnyEmp = any;
type AnyWorker = any;

export function ErpRH() {
  // API hooks
  const { data: apiEmployees } = useEmployees();
  const { data: apiWorkers } = useTempWorkers();
  const { data: apiAttendance } = useAttendance();
  const { data: apiPayroll } = usePayrollList();
  const createEmployeeMutation = useCreateEmployee();
  const createTempWorkerMutation = useCreateTempWorker();
  const deleteEmployeeMutation = useDeleteEmployee();
  const recordAttendanceMutation = useRecordAttendance();
  const generatePayrollMutation = useGeneratePayroll();
  const validatePayrollMutation = useValidatePayroll();
  const markPayrollPaidMutation = useMarkPayrollPaid();

  // Map API → UI shape
  const employees = useMemo(() => {
    if (!Array.isArray(apiEmployees)) return [] as AnyEmp[];
    return apiEmployees.map((e: any) => ({
      id: e.id,
      initials: `${(e.first_name || '').charAt(0)}${(e.last_name || '').charAt(0)}`.toUpperCase(),
      name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
      poste: e.position || '',
      dept: e.department || '',
      phone: e.phone || '',
      email: e.email || '',
      status: e.is_active ? 'Actif' : 'Inactif',
      hireDate: formatDate(e.hire_date),
      contract: e.contract_type || 'CDI',
      base_salary: e.base_salary || 0,
      raw: e,
    }));
  }, [apiEmployees]);

  const workers = useMemo(() => {
    if (!Array.isArray(apiWorkers)) return [] as AnyWorker[];
    return apiWorkers.map((w: any) => ({
      id: w.id,
      name: `${w.first_name || ''} ${w.last_name || ''}`.trim(),
      specialty: w.speciality || '',
      phone: w.phone || '',
      daily_rate: w.daily_rate || 0,
      rating: w.rating || 0,
      qr_code_data: w.qr_code_data,
      status: w.is_active ? 'Actif' : 'Inactif',
      raw: w,
    }));
  }, [apiWorkers]);

  // Worker-id → display name lookup (employees + temp workers).
  const workerNameById = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.name));
    workers.forEach((w) => m.set(w.id, w.name));
    return m;
  }, [employees, workers]);

  // Pointage table — live from attendance records (no mock).
  const liveTimesheet = useMemo(() => {
    if (!Array.isArray(apiAttendance)) return [];
    const fmtTime = (t: any) => formatTime(t, '—');
    const statusMap: Record<string, string> = { PRESENT: 'Présent', RETARD: 'Retard', ABSENT: 'Absent' };
    return apiAttendance.map((a: any) => {
      let hours = '—';
      if (a.check_in && a.check_out) {
        const diff = (new Date(a.check_out).getTime() - new Date(a.check_in).getTime()) / 3_600_000;
        if (diff > 0) hours = `${Math.floor(diff)}h${String(Math.round((diff % 1) * 60)).padStart(2, '0')}`;
      }
      return {
        name: workerNameById.get(a.worker_id) || a.worker_id || '—',
        arrival: fmtTime(a.check_in),
        departure: fmtTime(a.check_out),
        hours,
        site: a.project_id || '—',
        status: statusMap[a.status] || a.status || '',
      };
    });
  }, [apiAttendance, workerNameById]);

  // Paie table — live from payroll records (no mock).
  const livePayroll = useMemo(() => {
    if (!Array.isArray(apiPayroll)) return [];
    return apiPayroll.map((p: any) => ({
      id: p.id,
      name: workerNameById.get(p.worker_id) || p.worker_id || '—',
      type: p.worker_type === 'employee' ? 'Fixe' : 'Temporaire',
      days: p.days_worked || 0,
      base: p.base_amount || 0,
      primes: p.bonuses || 0,
      avances: p.advances || 0,
      net: p.net_amount || 0,
      status: p.status || 'BROUILLON',
      worker_type: p.worker_type || 'employee',
      worker_id: p.worker_id || '',
    }));
  }, [apiPayroll, workerNameById]);

  const [activeTab, setActiveTab] = useState('employes');
  const [empSearch, setEmpSearch] = useState('');
  const [empDept, setEmpDept] = useState('Tous les départements');
  const [workerSearch, setWorkerSearch] = useState('');
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<AnyEmp | null>(null);
  const [selectedQRWorker, setSelectedQRWorker] = useState<AnyWorker | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState<{ id: string; name: string } | null>(null);
  const [scanError, setScanError] = useState('');
  const [workerRating, setWorkerRating] = useState(0);
  const [downloadState, setDownloadState] = useState({
    active: false,
    progress: 0,
    text: '',
  });
  // Derived
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(empSearch.toLowerCase()) ||
      emp.poste.toLowerCase().includes(empSearch.toLowerCase());
    const matchesDept =
      empDept === 'Tous les départements' || emp.dept === empDept;
    return matchesSearch && matchesDept;
  });
  const filteredWorkers = workers.filter(
    (w) =>
      w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
      w.specialty.toLowerCase().includes(workerSearch.toLowerCase())
  );
  // Handlers
  const handleAddSubmit = async (e: React.FormEvent, type: 'emp' | 'worker') => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = e.target as HTMLFormElement;
    try {
      if (type === 'emp') {
        const fullName = (form.elements.namedItem('name') as HTMLInputElement)?.value || '';
        const [first, ...rest] = fullName.split(' ');
        await createEmployeeMutation.mutateAsync({
          first_name: first || fullName,
          last_name: rest.join(' '),
          email: (form.elements.namedItem('email') as HTMLInputElement)?.value || '',
          phone: (form.elements.namedItem('phone') as HTMLInputElement)?.value || '',
          position: (form.elements.namedItem('poste') as HTMLInputElement)?.value || '',
          department: (form.elements.namedItem('dept') as HTMLSelectElement)?.value || '',
          contract_type: (form.elements.namedItem('contract') as HTMLSelectElement)?.value || 'CDI',
          base_salary: parseFloat((form.elements.namedItem('salary') as HTMLInputElement)?.value || '0'),
        });
      } else {
        const fullName = (form.elements.namedItem('name') as HTMLInputElement)?.value || '';
        const [first, ...rest] = fullName.split(' ');
        await createTempWorkerMutation.mutateAsync({
          first_name: first || fullName,
          last_name: rest.join(' '),
          phone: (form.elements.namedItem('phone') as HTMLInputElement)?.value || '',
          speciality: (form.elements.namedItem('specialty') as HTMLInputElement)?.value || '',
          daily_rate: parseFloat((form.elements.namedItem('rate') as HTMLInputElement)?.value || '0'),
        });
      }
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        if (type === 'emp') setIsAddEmpModalOpen(false);
        else setIsAddWorkerModalOpen(false);
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDownload = async (
    type: 'single' | 'batch' | 'csv' | 'qr',
    payrollId?: string,
  ) => {
    if (downloadState.active) return;
    setDownloadState({
      active: true,
      progress: 30,
      text:
        type === 'batch'
          ? 'Préparation de l’export Excel paie…'
          : type === 'csv'
            ? 'Génération Excel employés…'
            : type === 'qr'
              ? 'Génération QR…'
              : 'Génération PDF…',
    });
    try {
      if (type === 'csv') {
        await exportEmployeesXlsx();
      } else if (type === 'batch') {
        await exportPayrollXlsx();
      } else if (type === 'single' && payrollId) {
        const row = (apiPayroll as any[])?.find((p) => p.id === payrollId);
        await downloadPayrollPdf(payrollId, row?.period || 'bulletin');
      }
      setDownloadState({ active: true, progress: 100, text: 'Téléchargement terminé ✓' });
    } catch (e: any) {
      setDownloadState({
        active: true,
        progress: 100,
        text: e?.response?.data?.detail || 'Échec du téléchargement',
      });
    } finally {
      setTimeout(() => setDownloadState({ active: false, progress: 0, text: '' }), 2000);
    }
  };
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const handleDeleteEmployee = async (empId: string) => {
    setRowBusy(`del-${empId}`);
    try {
      await deleteEmployeeMutation.mutateAsync(empId);
      setSelectedEmp(null);
    } catch (err) {
      console.error('Delete employee failed', err);
    } finally {
      setRowBusy(null);
    }
  };
  const handleGeneratePayroll = async (emp: AnyEmp) => {
    setRowBusy(`pay-${emp.id}`);
    try {
      await generatePayrollMutation.mutateAsync({
        worker_type: 'employee',
        worker_id: emp.id,
        period: currentPeriod,
        days_worked: 26,
      });
    } catch (err) {
      console.error('Generate payroll failed', err);
    } finally {
      setRowBusy(null);
    }
  };
  const handleValidatePayroll = async (payrollId: string) => {
    setRowBusy(`val-${payrollId}`);
    try {
      await validatePayrollMutation.mutateAsync(payrollId);
    } catch (err) {
      console.error('Validate payroll failed', err);
    } finally {
      setRowBusy(null);
    }
  };
  const handleMarkPayrollPaid = async (payrollId: string) => {
    setRowBusy(`paid-${payrollId}`);
    try {
      await markPayrollPaidMutation.mutateAsync(payrollId);
    } catch (err) {
      console.error('Mark payroll paid failed', err);
    } finally {
      setRowBusy(null);
    }
  };
  const handleRecordAttendance = async (worker: AnyWorker) => {
    setRowBusy(`att-${worker.id}`);
    try {
      await recordAttendanceMutation.mutateAsync({
        worker_type: 'temp',
        worker_id: worker.id,
        status: 'PRESENT',
      });
    } catch (err) {
      console.error('Record attendance failed', err);
    } finally {
      setRowBusy(null);
    }
  };
  const handleScan = () => {
    setScanInput('');
    setScanResult(null);
    setScanError('');
    setIsSuccess(false);
    setIsScannerOpen(true);
  };
  // Real badge scan: industrial QR/barcode readers act as keyboards and type
  // the badge token into the focused field; we match it to a worker and record
  // a *real* attendance entry. No fabricated names, no fake success.
  const handleScanSubmit = async (raw: string) => {
    const token = raw.trim();
    if (!token) return;
    const worker = workers.find(
      (w: AnyWorker) => w.qr_code_data === token || w.id === token,
    );
    if (!worker) {
      setScanError('Badge non reconnu');
      setScanInput('');
      return;
    }
    setScanError('');
    setIsSubmitting(true);
    try {
      await recordAttendanceMutation.mutateAsync({
        worker_type: 'temp',
        worker_id: worker.id,
        status: 'PRESENT',
      });
      setScanResult({ id: worker.id, name: worker.name });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsScannerOpen(false);
        setScanResult(null);
        setScanInput('');
      }, 2500);
    } catch {
      setScanError("Échec de l'enregistrement du pointage");
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">
      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-montserrat font-bold text-xs transition-all ${isActive ? 'bg-globus-blue-dark text-white shadow-md' : 'text-globus-gray hover:bg-gray-50'}`}>
              
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>);

        })}
      </div>

      <AnimatePresence mode="wait">
        {/* EMPLOYÉS */}
        {activeTab === 'employes' &&
        <motion.div
          key="emp"
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
                Gestion des Employés Fixes
              </h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleDownload('csv')}
                  className="bg-white hover:bg-gray-50 border border-gray-200 text-globus-blue-dark font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2"
                  title="Exporter la liste au format Excel">
                  <DownloadIcon className="w-4 h-4" />
                  Export Excel
                </button>
                <button
                onClick={() => setIsAddEmpModalOpen(true)}
                className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">

                  <PlusIcon className="w-4 h-4" /> Nouvel Employé
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                type="text"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Rechercher par nom ou poste..."
                className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-globus-blue focus:ring-2 focus:ring-globus-blue/20 transition-all" />
              
              </div>
              <select
              value={empDept}
              onChange={(e) => setEmpDept(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue focus:ring-2 focus:ring-globus-blue/20 transition-all">
              
                <option>Tous les départements</option>
                <option>Technique</option>
                <option>Bureau d'Études</option>
                <option>Finance</option>
                <option>Logistique</option>
                <option>Administration</option>
              </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Employé
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden md:table-cell">
                        Poste
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden lg:table-cell">
                        Département
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden sm:table-cell">
                        Téléphone
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Statut
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-opensans text-sm">
                    {filteredEmployees.length > 0 ?
                  filteredEmployees.map((emp) =>
                  <tr
                    key={emp.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-xs shrink-0">
                                {emp.initials}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">
                                  {emp.name}
                                </p>
                                <p className="text-xs text-globus-gray md:hidden">
                                  {emp.poste}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-gray-600 hidden md:table-cell">
                            {emp.poste}
                          </td>
                          <td className="p-3 text-gray-600 hidden lg:table-cell">
                            {emp.dept}
                          </td>
                          <td className="p-3 text-gray-600 hidden sm:table-cell font-mono text-xs">
                            {emp.phone}
                          </td>
                          <td className="p-3">
                            <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusColor(emp.status)}`}>
                        
                              {emp.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                        onClick={() => setSelectedEmp(emp)}
                        className="text-xs font-semibold text-globus-blue hover:underline">

                                Voir
                              </button>
                              <button
                        onClick={() => handleGeneratePayroll(emp)}
                        disabled={rowBusy === `pay-${emp.id}`}
                        title="Générer le bulletin de paie du mois"
                        className="p-1.5 text-gray-400 hover:text-globus-orange hover:bg-orange-50 rounded transition-colors disabled:opacity-50">
                                {rowBusy === `pay-${emp.id}` ?
                        <Loader2Icon className="w-4 h-4 animate-spin" /> :
                        <BanknoteIcon className="w-4 h-4" />}
                              </button>
                              <button
                        onClick={() => handleDeleteEmployee(emp.id)}
                        disabled={rowBusy === `del-${emp.id}`}
                        title="Désactiver l'employé"
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50">
                                {rowBusy === `del-${emp.id}` ?
                        <Loader2Icon className="w-4 h-4 animate-spin" /> :
                        <Trash2Icon className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                  ) :

                  <tr>
                        <td
                      colSpan={6}
                      className="p-8 text-center text-gray-500 font-opensans">
                      
                          Aucun employé trouvé.
                        </td>
                      </tr>
                  }
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        }

        {/* OUVRIERS */}
        {activeTab === 'ouvriers' &&
        <motion.div
          key="ouv"
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
                Base de Données Ouvriers
              </h2>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                  type="text"
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-globus-blue focus:ring-2 focus:ring-globus-blue/20" />
                
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try { await exportTempWorkersXlsx(); } catch { /* ignore */ }
                  }}
                  className="bg-white hover:bg-gray-50 border border-gray-200 text-globus-blue-dark font-montserrat font-bold py-2 px-3 rounded-lg text-sm flex items-center gap-2"
                  title="Exporter au format Excel">
                  <DownloadIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Export Excel</span>
                </button>
                <button
                onClick={() => setIsAddWorkerModalOpen(true)}
                className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm shrink-0">

                  <PlusIcon className="w-4 h-4" />{' '}
                  <span className="hidden sm:inline">Enregistrer</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkers.length > 0 ?
            filteredWorkers.map((w, i) =>
            <motion.div
              key={w.id}
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
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-sm">
                          {w.initials}
                        </div>
                        <div>
                          <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                            {w.name}
                          </p>
                          <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${specColors[w.specialty] || 'bg-gray-100 text-gray-700'}`}>
                      
                            {w.specialty}
                          </span>
                        </div>
                      </div>
                      <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(w.status)}`}>
                  
                        {w.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((s) =>
                <StarIcon
                  key={s}
                  className={`w-3.5 h-3.5 ${s <= w.rating ? 'text-globus-orange fill-globus-orange' : 'text-gray-300'}`} />

                )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-globus-gray">
                        <PhoneIcon className="w-3 h-3" /> {w.phone}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                  onClick={() => handleRecordAttendance(w)}
                  disabled={rowBusy === `att-${w.id}`}
                  title="Pointer présent aujourd'hui"
                  className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline bg-green-50 px-2 py-1 rounded-md disabled:opacity-50">
                          {rowBusy === `att-${w.id}` ?
                  <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :
                  <CheckCircle2Icon className="w-3.5 h-3.5" />} Présent
                        </button>
                        <button
                  onClick={() => setSelectedQRWorker(w)}
                  className="flex items-center gap-1 text-xs font-semibold text-globus-blue hover:underline bg-blue-50 px-2 py-1 rounded-md">

                          <QrCodeIcon className="w-3.5 h-3.5" /> QR Code
                        </button>
                      </div>
                    </div>
                  </motion.div>
            ) :

            <div className="col-span-full p-8 text-center text-gray-500 font-opensans bg-white rounded-xl border border-gray-200">
                  Aucun ouvrier trouvé.
                </div>
            }
            </div>
          </motion.div>
        }

        {/* POINTAGE */}
        {activeTab === 'pointage' &&
        <motion.div
          key="point"
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
              <div>
                <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                  Pointage Numérique
                </h2>
                <p className="font-opensans text-sm text-globus-gray">
                  Lundi 23 Mars 2026
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                onClick={() => handleDownload('csv')}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-globus-blue-dark font-montserrat font-bold py-2.5 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
                
                  <DownloadIcon className="w-4 h-4" /> Exporter
                </button>
                <button
                onClick={handleScan}
                className="bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold py-2.5 px-5 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-md flex-1 sm:flex-none justify-center">
                
                  <QrCodeIcon className="w-5 h-5" /> Scanner QR Code
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="font-montserrat font-extrabold text-2xl text-green-600">
                  45
                </p>
                <p className="text-xs text-globus-gray font-opensans">
                  Présents
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="font-montserrat font-extrabold text-2xl text-yellow-600">
                  3
                </p>
                <p className="text-xs text-globus-gray font-opensans">
                  Retards
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="font-montserrat font-extrabold text-2xl text-red-600">
                  8
                </p>
                <p className="text-xs text-globus-gray font-opensans">
                  Absents
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Ouvrier
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Arrivée
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Départ
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden sm:table-cell">
                        Heures
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden md:table-cell">
                        Chantier
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-opensans text-sm">
                    {liveTimesheet.length === 0 &&
                      <tr><td colSpan={6} className="p-8 text-center text-globus-gray">
                        Aucun pointage enregistré
                      </td></tr>
                    }
                    {liveTimesheet.map((row, i) =>
                  <tr
                    key={i}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    
                        <td className="p-3 font-semibold text-gray-800">
                          {row.name}
                        </td>
                        <td className="p-3 font-mono text-xs text-gray-600">
                          {row.arrival}
                        </td>
                        <td className="p-3 font-mono text-xs text-gray-600">
                          {row.departure}
                        </td>
                        <td className="p-3 font-mono text-xs text-gray-600 hidden sm:table-cell">
                          {row.hours}
                        </td>
                        <td className="p-3 text-gray-600 hidden md:table-cell">
                          {row.site}
                        </td>
                        <td className="p-3">
                          <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusColor(row.status)}`}>
                        
                            {row.status}
                          </span>
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        }

        {/* PAIE */}
        {activeTab === 'paie' &&
        <motion.div
          key="paie"
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
                Génération de la Paie — Mars 2026
              </h2>
              <button
              onClick={() => handleDownload('batch')}
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
              
                <DownloadIcon className="w-4 h-4" /> Générer toutes les fiches
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Employé
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Type
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden sm:table-cell">
                        Jours
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden md:table-cell">
                        Base
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden md:table-cell">
                        Primes
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark hidden lg:table-cell">
                        Avances
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark">
                        Net à Payer
                      </th>
                      <th className="p-3 font-montserrat font-semibold text-xs text-globus-blue-dark text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-opensans text-sm">
                    {livePayroll.length === 0 &&
                      <tr><td colSpan={8} className="p-8 text-center text-globus-gray">
                        Aucun bulletin de paie pour la période
                      </td></tr>
                    }
                    {livePayroll.map((row, i) =>
                  <tr
                    key={i}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    
                        <td className="p-3 font-semibold text-gray-800">
                          {row.name}
                        </td>
                        <td className="p-3">
                          <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.type === 'Fixe' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        
                            {row.type}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600 hidden sm:table-cell">
                          {row.days}
                        </td>
                        <td className="p-3 text-gray-600 hidden md:table-cell font-mono text-xs">
                          {formatCurrency(row.base)}
                        </td>
                        <td className="p-3 text-gray-600 hidden md:table-cell font-mono text-xs">
                          {formatCurrency(row.primes)}
                        </td>
                        <td className="p-3 text-red-600 hidden lg:table-cell font-mono text-xs">
                          {row.avances > 0 ?
                      `-${formatCurrency(row.avances)}` :
                      '—'}
                        </td>
                        <td className="p-3 font-montserrat font-bold text-globus-blue-dark">
                          {formatCurrency(row.net)}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {row.status !== 'PAYE' && row.status !== 'VALIDE' &&
                          <button
                            onClick={() => handleValidatePayroll(row.id)}
                            disabled={rowBusy === `val-${row.id}`}
                            className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50">
                              {rowBusy === `val-${row.id}` ?
                            <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :
                            <CheckCircle2Icon className="w-3.5 h-3.5" />} Valider
                            </button>
                          }
                            {row.status === 'VALIDE' &&
                          <button
                            onClick={() => handleMarkPayrollPaid(row.id)}
                            disabled={rowBusy === `paid-${row.id}`}
                            className="text-xs font-bold text-green-700 hover:bg-green-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50">
                              {rowBusy === `paid-${row.id}` ?
                            <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :
                            <BanknoteIcon className="w-3.5 h-3.5" />} Payer
                            </button>
                          }
                            {row.status === 'PAYE' &&
                          <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                              <CheckCircle2Icon className="w-3.5 h-3.5" /> Payé
                            </span>
                          }
                            <button
                          onClick={() => handleDownload('single', row.id)}
                          className="text-xs font-semibold text-globus-blue hover:underline flex items-center gap-1">

                              <DownloadIcon className="w-3.5 h-3.5" /> PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                  )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-globus-blue-dark text-white">
                      <td
                      colSpan={6}
                      className="p-3 font-montserrat font-bold text-sm hidden lg:table-cell">
                      
                        TOTAL
                      </td>
                      <td
                      colSpan={6}
                      className="p-3 font-montserrat font-bold text-sm lg:hidden">
                      
                        TOTAL
                      </td>
                      <td className="p-3 font-montserrat font-bold text-sm hidden lg:table-cell">
                        {formatCurrency(
                        livePayroll.reduce((s, r) => s + r.net, 0)
                      )}{' '}
                        FCFA
                      </td>
                      <td className="p-3 lg:hidden font-montserrat font-bold text-sm">
                        {formatCurrency(
                        livePayroll.reduce((s, r) => s + r.net, 0)
                      )}{' '}
                        FCFA
                      </td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* ===== MODALS ===== */}

      {/* Add Employee Modal */}
      <AnimatePresence>
        {isAddEmpModalOpen &&
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
                <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark flex items-center gap-2">
                  <UsersIcon className="w-5 h-5 text-globus-orange" /> Nouvel
                  Employé
                </h3>
                <button
                onClick={() => setIsAddEmpModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              {isSuccess ?
            <div className="p-12 text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2Icon className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                    Employé ajouté !
                  </h4>
                  <p className="text-gray-500 font-opensans">
                    Le profil a été créé avec succès.
                  </p>
                </div> :

            <form
              onSubmit={(e) => handleAddSubmit(e, 'emp')}
              className="p-6 space-y-4">
              
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-globus-blue-dark mb-1 font-montserrat">
                        Prénom
                      </label>
                      <input
                    required
                    type="text"
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20" />
                  
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-globus-blue-dark mb-1 font-montserrat">
                        Nom
                      </label>
                      <input
                    required
                    type="text"
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20" />
                  
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1 font-montserrat">
                      Poste
                    </label>
                    <input
                  required
                  type="text"
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20" />
                
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1 font-montserrat">
                      Département
                    </label>
                    <select
                  required
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20">
                  
                      <option value="">Sélectionner...</option>
                      <option>Technique</option>
                      <option>Bureau d'Études</option>
                      <option>Finance</option>
                      <option>Logistique</option>
                      <option>Administration</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-globus-blue-dark mb-1 font-montserrat">
                        Téléphone
                      </label>
                      <input
                    required
                    type="tel"
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20" />
                  
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-globus-blue-dark mb-1 font-montserrat">
                        Email
                      </label>
                      <input
                    required
                    type="email"
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20" />
                  
                    </div>
                  </div>
                  <div className="pt-4 flex justify-end gap-3">
                    <button
                  type="button"
                  onClick={() => setIsAddEmpModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                  
                      Annuler
                    </button>
                    <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white px-6 py-2.5 rounded-lg font-montserrat font-bold transition-colors flex items-center gap-2 disabled:opacity-70">
                  
                      {isSubmitting ?
                  <>
                          <Loader2Icon className="w-4 h-4 animate-spin" />{' '}
                          Enregistrement...
                        </> :

                  'Enregistrer'
                  }
                    </button>
                  </div>
                </form>
            }
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Add Worker Modal */}
      <AnimatePresence>
        {isAddWorkerModalOpen &&
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
                <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark flex items-center gap-2">
                  <HardHatIcon className="w-5 h-5 text-globus-orange" /> Nouvel
                  Ouvrier
                </h3>
                <button
                onClick={() => setIsAddWorkerModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              {isSuccess ?
            <div className="p-12 text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2Icon className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                    Ouvrier enregistré !
                  </h4>
                  <p className="text-gray-500 font-opensans">
                    Le profil a été créé avec succès.
                  </p>
                </div> :

            <form
              onSubmit={(e) => handleAddSubmit(e, 'worker')}
              className="p-6 space-y-4">
              
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1 font-montserrat">
                      Nom Complet
                    </label>
                    <input
                  required
                  type="text"
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20" />
                
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1 font-montserrat">
                      Spécialité
                    </label>
                    <select
                  required
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20">
                  
                      <option value="">Sélectionner...</option>
                      <option>Maçon</option>
                      <option>Ferrailleur</option>
                      <option>Coffreur</option>
                      <option>Peintre</option>
                      <option>Électricien</option>
                      <option>Plombier</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1 font-montserrat">
                      Téléphone
                    </label>
                    <input
                  required
                  type="tel"
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20" />
                
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1 font-montserrat">
                      Note Initiale
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) =>
                  <button
                    key={star}
                    type="button"
                    onClick={() => setWorkerRating(star)}
                    className="focus:outline-none">
                    
                          <StarIcon
                      className={`w-8 h-8 ${star <= workerRating ? 'text-globus-orange fill-globus-orange' : 'text-gray-300'}`} />
                    
                        </button>
                  )}
                    </div>
                  </div>
                  <div className="pt-4 flex justify-end gap-3">
                    <button
                  type="button"
                  onClick={() => setIsAddWorkerModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                  
                      Annuler
                    </button>
                    <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white px-6 py-2.5 rounded-lg font-montserrat font-bold transition-colors flex items-center gap-2 disabled:opacity-70">
                  
                      {isSubmitting ?
                  <>
                          <Loader2Icon className="w-4 h-4 animate-spin" />{' '}
                          Enregistrement...
                        </> :

                  'Enregistrer'
                  }
                    </button>
                  </div>
                </form>
            }
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Employee Detail Modal */}
      <AnimatePresence>
        {selectedEmp &&
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
          onClick={() => setSelectedEmp(null)}>
          
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
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            
              <div className="bg-globus-blue-dark p-6 text-center relative">
                <button
                onClick={() => setSelectedEmp(null)}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                
                  <XIcon className="w-6 h-6" />
                </button>
                <div className="w-24 h-24 rounded-full bg-white text-globus-blue-dark flex items-center justify-center font-montserrat font-bold text-3xl mx-auto mb-4 shadow-lg">
                  {selectedEmp.initials}
                </div>
                <h3 className="font-montserrat font-bold text-2xl text-white mb-1">
                  {selectedEmp.name}
                </h3>
                <p className="text-globus-orange font-opensans text-sm">
                  {selectedEmp.poste}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-xs text-globus-gray font-opensans mb-1 flex items-center gap-1">
                      <BriefcaseIcon className="w-3 h-3" /> Département
                    </p>
                    <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                      {selectedEmp.dept}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-xs text-globus-gray font-opensans mb-1 flex items-center gap-1">
                      <FileTextIcon className="w-3 h-3" /> Contrat
                    </p>
                    <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                      {selectedEmp.contract}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <PhoneIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-globus-gray font-opensans">
                        Téléphone
                      </p>
                      <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                        {selectedEmp.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                      <MailIcon className="w-4 h-4 text-globus-orange" />
                    </div>
                    <div>
                      <p className="text-xs text-globus-gray font-opensans">
                        Email
                      </p>
                      <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                        {selectedEmp.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                      <CalendarIcon className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-globus-gray font-opensans">
                        Date d'embauche
                      </p>
                      <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                        {selectedEmp.hireDate}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                  onClick={() => setSelectedEmp(null)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 font-montserrat font-bold text-sm text-globus-gray hover:bg-gray-50 transition-colors">
                  
                    Fermer
                  </button>
                  <button className="flex-1 py-2.5 rounded-lg bg-globus-blue-dark hover:bg-globus-blue text-white font-montserrat font-bold text-sm transition-colors">
                    Modifier
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* QR Code Modal — real PNG fetched from /hr/temp-workers/{id}/qr.png */}
      <AnimatePresence>
        {selectedQRWorker && (
          <TempWorkerQrModal
            workerId={selectedQRWorker.id}
            workerName={`${selectedQRWorker.name}${selectedQRWorker.specialty ? ` — ${selectedQRWorker.specialty}` : ''}`}
            onClose={() => setSelectedQRWorker(null)}
          />
        )}
      </AnimatePresence>

      {/* Scanner Modal */}
      <AnimatePresence>
        {isScannerOpen &&
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
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          
            <div className="w-full max-w-md text-center">
              {isSuccess ?
            <motion.div
              initial={{
                scale: 0.8,
                opacity: 0
              }}
              animate={{
                scale: 1,
                opacity: 1
              }}
              className="bg-white rounded-2xl p-8">
              
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2Icon className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                    Ouvrier identifié
                  </h3>
                  <p className="font-montserrat font-bold text-lg text-globus-orange mb-1">
                    {scanResult?.name}
                  </p>
                  <p className="font-opensans text-sm text-gray-500 mb-6">
                    Pointage enregistré à{' '}
                    {formatTime(new Date())}
                  </p>
                </motion.div> :

            <>
                  <h3 className="font-montserrat font-bold text-xl text-white mb-6 flex items-center justify-center gap-2">
                    <ScanIcon className="w-6 h-6" /> Scanner le QR Code
                  </h3>
                  <div className="relative w-64 h-64 mx-auto mb-8">
                    {/* Scanner frame */}
                    <div className="absolute inset-0 border-2 border-white/20 rounded-2xl overflow-hidden">
                      {/* Scanning line animation */}
                      <motion.div
                    animate={{
                      y: ['0%', '100%', '0%']
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear'
                    }}
                    className="w-full h-1 bg-globus-orange shadow-[0_0_15px_rgba(249,115,22,0.8)]" />
                  
                    </div>
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-globus-orange rounded-tl-2xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-globus-orange rounded-tr-2xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-globus-orange rounded-bl-2xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-globus-orange rounded-br-2xl" />
                  </div>
                  <p className="font-opensans text-white/70 mb-4">
                    Scannez le badge de l'ouvrier ou saisissez son code
                  </p>
                  <input
                autoFocus
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleScanSubmit(scanInput);
                }}
                placeholder="Code du badge"
                className="w-full max-w-xs mx-auto block bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg px-4 py-3 font-mono text-center focus:outline-none focus:border-globus-orange mb-2" />

                  {scanError &&
                <p className="text-red-300 text-sm mb-2">{scanError}</p>
                }
                  <div className="flex gap-3 justify-center mt-6">
                    <button
                  onClick={() => setIsScannerOpen(false)}
                  className="bg-white/10 hover:bg-white/20 text-white font-montserrat font-bold py-3 px-8 rounded-full transition-colors backdrop-blur-sm">

                      Annuler
                    </button>
                    <button
                  onClick={() => handleScanSubmit(scanInput)}
                  disabled={isSubmitting || !scanInput.trim()}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3 px-8 rounded-full transition-colors disabled:opacity-50">

                      {isSubmitting ? 'Enregistrement...' : 'Valider'}
                    </button>
                  </div>
                </>
            }
            </div>
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
              {downloadState.text === 'Téléchargement terminé' ?
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2Icon className="w-4 h-4 text-green-600" />
                </div> :

            <div className="w-8 h-8 rounded-full bg-globus-orange/10 flex items-center justify-center shrink-0">
                  <Loader2Icon className="w-4 h-4 text-globus-orange animate-spin" />
                </div>
            }
              <div>
                <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                  {downloadState.text}
                </p>
                <p className="font-opensans text-xs text-globus-gray">
                  Document_RH_Globus
                </p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
              className={`h-full rounded-full ${downloadState.text === 'Téléchargement terminé' ? 'bg-green-500' : 'bg-globus-orange'}`}
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