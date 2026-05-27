import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UsersIcon,
  HardHatIcon,
  ClockIcon,
  BanknoteIcon,
  SearchIcon,
  PlusIcon,
  QrCodeIcon,
  StarIcon,
  DownloadIcon,
  PhoneIcon,
  FilterIcon,
  XIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MailIcon,
  BriefcaseIcon,
  CalendarIcon,
  FileTextIcon,
  ScanIcon } from
'lucide-react';
import { useEmployees, useTempWorkers, useCreateEmployee, useCreateTempWorker } from '../../hooks/useErp';
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

const initialEmployees = [
{
  id: 1,
  initials: 'PM',
  name: 'Paul Mbarga',
  poste: 'Ingénieur Chef de Projet',
  dept: 'Technique',
  phone: '+237 699 112 233',
  email: 'p.mbarga@globus-btp.com',
  status: 'Actif',
  hireDate: '15/02/2020',
  contract: 'CDI'
},
{
  id: 2,
  initials: 'CF',
  name: 'Claire Fotso',
  poste: 'Architecte Senior',
  dept: "Bureau d'Études",
  phone: '+237 677 445 566',
  email: 'c.fotso@globus-btp.com',
  status: 'Actif',
  hireDate: '01/06/2021',
  contract: 'CDI'
},
{
  id: 3,
  initials: 'JN',
  name: 'Jacques Nkoulou',
  poste: 'Comptable',
  dept: 'Finance',
  phone: '+237 655 778 899',
  email: 'j.nkoulou@globus-btp.com',
  status: 'Actif',
  hireDate: '10/01/2022',
  contract: 'CDI'
},
{
  id: 4,
  initials: 'AM',
  name: 'Alain Messi',
  poste: 'Logisticien',
  dept: 'Logistique',
  phone: '+237 690 334 455',
  email: 'a.messi@globus-btp.com',
  status: 'En congé',
  hireDate: '05/09/2023',
  contract: 'CDD'
},
{
  id: 5,
  initials: 'SE',
  name: 'Sophie Ekambi',
  poste: 'Assistante RH',
  dept: 'Administration',
  phone: '+237 677 223 344',
  email: 's.ekambi@globus-btp.com',
  status: 'Actif',
  hireDate: '20/03/2024',
  contract: 'CDI'
}];

const initialWorkers = [
{
  id: 'W-001',
  initials: 'EN',
  name: 'Emmanuel Nganou',
  specialty: 'Maçon',
  phone: '+237 670 111 222',
  rating: 5,
  status: 'En mission'
},
{
  id: 'W-002',
  initials: 'JT',
  name: 'Joseph Tchinda',
  specialty: 'Ferrailleur',
  phone: '+237 655 333 444',
  rating: 4,
  status: 'Disponible'
},
{
  id: 'W-003',
  initials: 'PN',
  name: 'Pierre Ndjock',
  specialty: 'Coffreur',
  phone: '+237 690 555 666',
  rating: 4,
  status: 'En mission'
},
{
  id: 'W-004',
  initials: 'SM',
  name: 'Samuel Mbede',
  specialty: 'Peintre',
  phone: '+237 677 777 888',
  rating: 3,
  status: 'Disponible'
},
{
  id: 'W-005',
  initials: 'DK',
  name: 'David Kamga',
  specialty: 'Électricien',
  phone: '+237 699 999 000',
  rating: 5,
  status: 'En mission'
},
{
  id: 'W-006',
  initials: 'RO',
  name: 'Robert Onana',
  specialty: 'Plombier',
  phone: '+237 655 222 111',
  rating: 4,
  status: 'Disponible'
}];

const timesheetData = [
{
  name: 'Emmanuel Nganou',
  arrival: '06:30',
  departure: '17:00',
  hours: '10h30',
  site: 'Villa Bonapriso',
  status: 'Présent'
},
{
  name: 'Joseph Tchinda',
  arrival: '06:45',
  departure: '17:00',
  hours: '10h15',
  site: 'Villa Bonapriso',
  status: 'Présent'
},
{
  name: 'Pierre Ndjock',
  arrival: '07:15',
  departure: '16:30',
  hours: '9h15',
  site: 'Immeuble Akwa',
  status: 'Retard'
},
{
  name: 'David Kamga',
  arrival: '06:30',
  departure: '17:30',
  hours: '11h00',
  site: 'Immeuble Akwa',
  status: 'Présent'
},
{
  name: 'Samuel Mbede',
  arrival: '—',
  departure: '—',
  hours: '—',
  site: 'Villa Bonapriso',
  status: 'Absent'
},
{
  name: 'Robert Onana',
  arrival: '07:00',
  departure: '16:00',
  hours: '9h00',
  site: 'Résidence Bonanjo',
  status: 'Présent'
},
{
  name: 'Alain Toko',
  arrival: '06:30',
  departure: '17:00',
  hours: '10h30',
  site: 'Résidence Bonanjo',
  status: 'Présent'
},
{
  name: 'Martin Essomba',
  arrival: '07:30',
  departure: '16:30',
  hours: '9h00',
  site: 'Bureau Deïdo',
  status: 'Retard'
}];

const payrollData = [
{
  name: 'Paul Mbarga',
  type: 'Fixe',
  days: 22,
  base: 850000,
  primes: 150000,
  avances: 0,
  net: 1000000
},
{
  name: 'Claire Fotso',
  type: 'Fixe',
  days: 22,
  base: 750000,
  primes: 100000,
  avances: 50000,
  net: 800000
},
{
  name: 'Emmanuel Nganou',
  type: 'Temporaire',
  days: 26,
  base: 5000,
  primes: 0,
  avances: 20000,
  net: 110000
},
{
  name: 'Joseph Tchinda',
  type: 'Temporaire',
  days: 24,
  base: 5000,
  primes: 0,
  avances: 0,
  net: 120000
},
{
  name: 'Jacques Nkoulou',
  type: 'Fixe',
  days: 22,
  base: 500000,
  primes: 50000,
  avances: 100000,
  net: 450000
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
export function ErpRH() {
  // API hooks
  const { data: apiEmployees } = useEmployees();
  const { data: apiWorkers } = useTempWorkers();
  const createEmployeeMutation = useCreateEmployee();
  const createTempWorkerMutation = useCreateTempWorker();

  const [activeTab, setActiveTab] = useState('employes');
  // Search & Filter States
  const [empSearch, setEmpSearch] = useState('');
  const [empDept, setEmpDept] = useState('Tous les départements');
  const [workerSearch, setWorkerSearch] = useState('');
  // Modal States
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<
    (typeof initialEmployees)[0] | null>(
    null);
  const [selectedQRWorker, setSelectedQRWorker] = useState<
    (typeof initialWorkers)[0] | null>(
    null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  // Form States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [workerRating, setWorkerRating] = useState(0);
  // Download State
  const [downloadState, setDownloadState] = useState({
    active: false,
    progress: 0,
    text: ''
  });
  // Derived Data
  const filteredEmployees = initialEmployees.filter((emp) => {
    const matchesSearch =
    emp.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    emp.poste.toLowerCase().includes(empSearch.toLowerCase());
    const matchesDept =
    empDept === 'Tous les départements' || emp.dept === empDept;
    return matchesSearch && matchesDept;
  });
  const filteredWorkers = initialWorkers.filter(
    (w) =>
    w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
    w.specialty.toLowerCase().includes(workerSearch.toLowerCase())
  );
  // Handlers
  const handleAddSubmit = (e: React.FormEvent, type: 'emp' | 'worker') => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        if (type === 'emp') setIsAddEmpModalOpen(false);else
        setIsAddWorkerModalOpen(false);
      }, 2000);
    }, 1500);
  };
  const handleDownload = (type: 'single' | 'batch' | 'csv' | 'qr') => {
    if (downloadState.active) return;
    setDownloadState({
      active: true,
      progress: 0,
      text:
      type === 'batch' ?
      'Fiche 1/5...' :
      type === 'csv' ?
      'Génération CSV...' :
      type === 'qr' ?
      'Génération QR...' :
      'Préparation PDF...'
    });
    let p = 0;
    const interval = setInterval(() => {
      p += type === 'batch' ? 2 : 5;
      let text = downloadState.text;
      if (type === 'batch') {
        const current = Math.min(5, Math.ceil(p / 100 * 5));
        text = `Fiche ${current}/5...`;
      }
      setDownloadState((prev) => ({
        ...prev,
        progress: p,
        text
      }));
      if (p >= 100) {
        clearInterval(interval);
        setDownloadState((prev) => ({
          ...prev,
          text: 'Téléchargement terminé'
        }));
        setTimeout(
          () =>
          setDownloadState({
            active: false,
            progress: 0,
            text: ''
          }),
          3000
        );
      }
    }, 50);
  };
  const handleScan = () => {
    setIsScannerOpen(true);
    setIsSubmitting(true); // using as scanning state
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsScannerOpen(false);
      }, 2500);
    }, 2500);
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
              <button
              onClick={() => setIsAddEmpModalOpen(true)}
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
              
                <PlusIcon className="w-4 h-4" /> Nouvel Employé
              </button>
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
                            <button
                        onClick={() => setSelectedEmp(emp)}
                        className="text-xs font-semibold text-globus-blue hover:underline">
                        
                              Voir
                            </button>
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
                      <button
                  onClick={() => setSelectedQRWorker(w)}
                  className="flex items-center gap-1 text-xs font-semibold text-globus-blue hover:underline bg-blue-50 px-2 py-1 rounded-md">
                  
                        <QrCodeIcon className="w-3.5 h-3.5" /> QR Code
                      </button>
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
                    {timesheetData.map((row, i) =>
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
                    {payrollData.map((row, i) =>
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
                          <button
                        onClick={() => handleDownload('single')}
                        className="text-xs font-semibold text-globus-blue hover:underline flex items-center gap-1 ml-auto">
                        
                            <DownloadIcon className="w-3.5 h-3.5" /> PDF
                          </button>
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
                        payrollData.reduce((s, r) => s + r.net, 0)
                      )}{' '}
                        FCFA
                      </td>
                      <td className="p-3 lg:hidden font-montserrat font-bold text-sm">
                        {formatCurrency(
                        payrollData.reduce((s, r) => s + r.net, 0)
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

      {/* QR Code Modal */}
      <AnimatePresence>
        {selectedQRWorker &&
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
          onClick={() => setSelectedQRWorker(null)}>
          
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center relative">
            
              <button
              onClick={() => setSelectedQRWorker(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
              
                <XIcon className="w-6 h-6" />
              </button>

              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-1">
                Badge Ouvrier
              </h3>
              <p className="font-opensans text-sm text-globus-gray mb-6">
                {selectedQRWorker.name} — {selectedQRWorker.specialty}
              </p>

              <div className="w-48 h-48 mx-auto bg-white border-4 border-globus-blue-dark rounded-xl p-4 flex items-center justify-center mb-6 shadow-inner relative overflow-hidden">
                {/* Simulated QR Pattern */}
                <div className="absolute inset-2 grid grid-cols-5 grid-rows-5 gap-1 opacity-80">
                  {Array.from({
                  length: 25
                }).map((_, i) =>
                <div
                  key={i}
                  className={`bg-globus-blue-dark ${Math.random() > 0.5 ? 'rounded-sm' : 'rounded-full'} ${Math.random() > 0.7 ? 'opacity-0' : 'opacity-100'}`} />

                )}
                </div>
                <div className="absolute top-2 left-2 w-8 h-8 border-4 border-globus-blue-dark rounded-sm" />
                <div className="absolute top-2 right-2 w-8 h-8 border-4 border-globus-blue-dark rounded-sm" />
                <div className="absolute bottom-2 left-2 w-8 h-8 border-4 border-globus-blue-dark rounded-sm" />
                <div className="relative z-10 bg-white px-2 py-1 font-mono font-bold text-xs border border-gray-200 rounded shadow-sm">
                  {selectedQRWorker.id}
                </div>
              </div>

              <button
              onClick={() => {
                setSelectedQRWorker(null);
                handleDownload('qr');
              }}
              className="w-full bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
              
                <DownloadIcon className="w-5 h-5" /> Télécharger QR Code
              </button>
            </motion.div>
          </motion.div>
        }
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
                    Emmanuel Nganou
                  </p>
                  <p className="font-opensans text-sm text-gray-500 mb-6">
                    Pointage enregistré à{' '}
                    {new Date().toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
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
                  <p className="font-opensans text-white/70 mb-8">
                    Placez le QR code au centre du cadre
                  </p>
                  <button
                onClick={() => setIsScannerOpen(false)}
                className="bg-white/10 hover:bg-white/20 text-white font-montserrat font-bold py-3 px-8 rounded-full transition-colors backdrop-blur-sm">
                
                    Annuler
                  </button>
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