import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderGit2Icon,
  UploadCloudIcon,
  DownloadIcon,
  HistoryIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  XCircleIcon,
  FileIcon,
  AlertTriangleIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  EyeIcon,
  GitCompareIcon } from
'lucide-react';
const projects = ['Villa Bonapriso', 'Immeuble Akwa', 'Résidence Bonanjo'];
const planCategories = [
{
  label: 'Plans Architecturaux',
  plans: [
  {
    name: 'Plan RDC — Architecture',
    version: 'V3',
    status: 'active',
    author: 'Claire Fotso',
    date: '20/03/2026',
    history: [
    {
      v: 'V3',
      date: '20/03/2026',
      author: 'Claire Fotso',
      note: 'Modification escalier',
      status: 'active'
    },
    {
      v: 'V2',
      date: '15/02/2026',
      author: 'Claire Fotso',
      note: 'Ajout terrasse',
      status: 'obsolete'
    },
    {
      v: 'V1',
      date: '10/01/2026',
      author: 'Claire Fotso',
      note: 'Version initiale',
      status: 'obsolete'
    }]

  },
  {
    name: 'Plan R+1 — Architecture',
    version: 'V2',
    status: 'active',
    author: 'Claire Fotso',
    date: '18/03/2026',
    history: [
    {
      v: 'V2',
      date: '18/03/2026',
      author: 'Claire Fotso',
      note: 'Ajout balcon chambre 3',
      status: 'active'
    },
    {
      v: 'V1',
      date: '10/01/2026',
      author: 'Claire Fotso',
      note: 'Version initiale',
      status: 'obsolete'
    }]

  },
  {
    name: 'Plan Toiture',
    version: 'V1',
    status: 'active',
    author: 'Claire Fotso',
    date: '12/01/2026',
    history: [
    {
      v: 'V1',
      date: '12/01/2026',
      author: 'Claire Fotso',
      note: 'Version initiale',
      status: 'active'
    }]

  },
  {
    name: 'Plan Façades',
    version: 'V2',
    status: 'active',
    author: 'Claire Fotso',
    date: '01/03/2026',
    history: [
    {
      v: 'V2',
      date: '01/03/2026',
      author: 'Claire Fotso',
      note: 'Modification revêtement',
      status: 'active'
    },
    {
      v: 'V1',
      date: '15/01/2026',
      author: 'Claire Fotso',
      note: 'Version initiale',
      status: 'obsolete'
    }]

  }]

},
{
  label: 'Plans Structure',
  plans: [
  {
    name: 'Plan Fondations',
    version: 'V2',
    status: 'active',
    author: 'Ing. Mbarga',
    date: '05/02/2026',
    history: [
    {
      v: 'V2',
      date: '05/02/2026',
      author: 'Ing. Mbarga',
      note: 'Renforcement semelles',
      status: 'active'
    },
    {
      v: 'V1',
      date: '15/01/2026',
      author: 'Ing. Mbarga',
      note: 'Version initiale',
      status: 'obsolete'
    }]

  },
  {
    name: 'Plan Dalles & Poteaux',
    version: 'V1',
    status: 'active',
    author: 'Ing. Mbarga',
    date: '20/01/2026',
    history: [
    {
      v: 'V1',
      date: '20/01/2026',
      author: 'Ing. Mbarga',
      note: 'Version initiale',
      status: 'active'
    }]

  },
  {
    name: 'Plan Escalier',
    version: 'V3',
    status: 'active',
    author: 'Ing. Mbarga',
    date: '22/03/2026',
    history: [
    {
      v: 'V3',
      date: '22/03/2026',
      author: 'Ing. Mbarga',
      note: 'Modification hélicoïdal',
      status: 'active'
    },
    {
      v: 'V2',
      date: '10/02/2026',
      author: 'Ing. Mbarga',
      note: 'Ajout palier',
      status: 'obsolete'
    },
    {
      v: 'V1',
      date: '20/01/2026',
      author: 'Ing. Mbarga',
      note: 'Version initiale',
      status: 'obsolete'
    }]

  }]

},
{
  label: 'Plans Électricité',
  plans: [
  {
    name: 'Plan Électrique RDC',
    version: 'V2',
    status: 'active',
    author: 'Bureau Études',
    date: '15/03/2026',
    history: [
    {
      v: 'V2',
      date: '15/03/2026',
      author: 'Bureau Études',
      note: 'Ajout prises cuisine',
      status: 'active'
    },
    {
      v: 'V1',
      date: '01/02/2026',
      author: 'Bureau Études',
      note: 'Version initiale',
      status: 'obsolete'
    }]

  },
  {
    name: 'Plan Électrique R+1',
    version: 'V1',
    status: 'active',
    author: 'Bureau Études',
    date: '01/02/2026',
    history: [
    {
      v: 'V1',
      date: '01/02/2026',
      author: 'Bureau Études',
      note: 'Version initiale',
      status: 'active'
    }]

  }]

},
{
  label: 'Plans Plomberie',
  plans: [
  {
    name: 'Plan Plomberie RDC',
    version: 'V1',
    status: 'active',
    author: 'Bureau Études',
    date: '05/02/2026',
    history: [
    {
      v: 'V1',
      date: '05/02/2026',
      author: 'Bureau Études',
      note: 'Version initiale',
      status: 'active'
    }]

  },
  {
    name: 'Plan Plomberie R+1',
    version: 'V1',
    status: 'active',
    author: 'Bureau Études',
    date: '05/02/2026',
    history: [
    {
      v: 'V1',
      date: '05/02/2026',
      author: 'Bureau Études',
      note: 'Version initiale',
      status: 'active'
    }]

  }]

}];

export function ErpGED() {
  const [activeProject, setActiveProject] = useState(0);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  // New states for interactive features
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);
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
  const handleDownload = (planName: string) => {
    setIsProcessing(`download-${planName}`);
    showToast('Téléchargement en cours...', 'info');
    setTimeout(() => {
      setIsProcessing(null);
      showToast('Plan téléchargé ✓', 'success');
    }, 1500);
  };
  const handleUpload = () => {
    setIsProcessing('upload');
    setTimeout(() => {
      setIsProcessing(null);
      setShowUploadModal(false);
      showToast('Plan uploadé avec succès', 'success');
    }, 1500);
  };
  const handleNewVersion = () => {
    setIsProcessing('new-version');
    setTimeout(() => {
      setIsProcessing(null);
      showToast('Nouvelle version ajoutée', 'success');
    }, 1500);
  };
  const handleDelete = (planName: string) => {
    setConfirmDelete({
      title: 'Supprimer le plan',
      message: `Êtes-vous sûr de vouloir supprimer "${planName}" et tout son historique ? Cette action est irréversible.`,
      onConfirm: () => {
        setIsProcessing(`delete-${planName}`);
        setConfirmDelete(null);
        setTimeout(() => {
          setIsProcessing(null);
          setSelectedPlan(null);
          showToast('Plan supprimé', 'success');
        }, 1500);
      }
    });
  };
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {

      // Handle file drop visually
    }};
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <FolderGit2Icon className="w-7 h-7 text-globus-blue-dark" />
          <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark">
            GED Technique — Gestion des Plans
          </h2>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm shrink-0">
          
          <UploadCloudIcon className="w-4 h-4" /> Uploader un Plan
        </button>
      </motion.div>

      <div className="flex gap-2 flex-wrap">
        {projects.map((p, i) =>
        <button
          key={p}
          onClick={() => setActiveProject(i)}
          className={`px-4 py-2 rounded-lg font-montserrat font-bold text-sm transition-all ${activeProject === i ? 'bg-globus-blue-dark text-white shadow-md' : 'bg-white text-globus-gray border border-gray-200 hover:border-globus-blue-dark'}`}>
          
            {p}
          </button>
        )}
      </div>

      <div className="space-y-8">
        {planCategories.map((cat, ci) =>
        <motion.div
          key={cat.label}
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
          }}>
          
            <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4">
              {cat.label}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cat.plans.map((plan) => {
              const isExpanded = expandedPlan === plan.name;
              return (
                <div
                  key={plan.name}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  
                    <div
                    className="h-24 bg-gradient-to-br from-slate-700 to-slate-900 relative flex items-center justify-center cursor-pointer group"
                    onClick={() => setSelectedPlan(plan)}>
                    
                      <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        backgroundImage:
                        'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                      }}>
                    </div>
                      <FileIcon className="w-10 h-10 text-white/30 group-hover:scale-110 transition-transform" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <EyeIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="absolute top-2 right-2">
                        <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-montserrat ${plan.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                        
                          {plan.version}{' '}
                          {plan.status === 'active' ? '✓' : 'PÉRIMÉ'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h4
                      className="font-montserrat font-bold text-sm text-globus-blue-dark mb-1 truncate cursor-pointer hover:text-globus-blue transition-colors"
                      onClick={() => setSelectedPlan(plan)}>
                      
                        {plan.name}
                      </h4>
                      <p className="text-xs text-globus-gray font-opensans mb-3">
                        {plan.author} • {plan.date}
                      </p>
                      <div className="flex gap-2">
                        <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(plan.name);
                        }}
                        disabled={isProcessing === `download-${plan.name}`}
                        className="flex-1 text-xs bg-globus-blue/10 text-globus-blue hover:bg-globus-blue hover:text-white py-1.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 disabled:opacity-70">
                        
                          {isProcessing === `download-${plan.name}` ?
                        <Loader2Icon className="w-3 h-3 animate-spin" /> :

                        <DownloadIcon className="w-3 h-3" />
                        }{' '}
                          Télécharger
                        </button>
                        <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedPlan(isExpanded ? null : plan.name);
                        }}
                        className="flex-1 text-xs bg-gray-100 text-globus-gray hover:bg-gray-200 py-1.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-1">
                        
                          <HistoryIcon className="w-3 h-3" /> Historique
                          <ChevronDownIcon
                          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded &&
                    <motion.div
                      initial={{
                        height: 0
                      }}
                      animate={{
                        height: 'auto'
                      }}
                      exit={{
                        height: 0
                      }}
                      className="overflow-hidden">
                      
                          <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-2">
                            {plan.history.map((h) =>
                        <div
                          key={h.v}
                          className={`flex items-start gap-2 p-2 rounded-lg text-xs ${h.status === 'obsolete' ? 'opacity-60' : ''}`}>
                          
                                {h.status === 'active' ?
                          <CheckCircle2Icon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> :

                          <XCircleIcon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          }
                                <div>
                                  <p className="font-montserrat font-bold text-globus-blue-dark flex items-center gap-2">
                                    {h.v}
                                    {h.status === 'active' &&
                              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px]">
                                        Active
                                      </span>
                              }
                                    {h.status === 'obsolete' &&
                              <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[9px] line-through">
                                        Périmé
                                      </span>
                              }
                                    {h.status === 'obsolete' &&
                              <button
                                className="ml-auto text-globus-blue hover:text-globus-orange transition-colors"
                                title="Comparer avec la version active">
                                
                                        <GitCompareIcon className="w-3.5 h-3.5" />
                                      </button>
                              }
                                  </p>
                                  <p className="text-globus-gray">
                                    {h.date} — {h.author} — {h.note}
                                  </p>
                                </div>
                              </div>
                        )}
                          </div>
                        </motion.div>
                    }
                    </AnimatePresence>
                  </div>);

            })}
            </div>
          </motion.div>
        )}

        {/* NEW: Documents Client Section */}
        <motion.div
          initial={{
            opacity: 0,
            y: 10
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: 0.2
          }}
          className="mt-12 pt-8 border-t border-gray-200">
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FolderGit2Icon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                Documents & Validations Client
              </h3>
              <p className="text-sm text-gray-500">
                M. Jean Talla — Villa Moderne Bonapriso
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Documents Envoyés */}
            <div className="bg-blue-50/50 rounded-xl shadow-sm border border-blue-100 p-5">
              <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-4 flex items-center gap-2">
                <UploadCloudIcon className="w-4 h-4 text-blue-600" />
                Documents Reçus du Client
              </h4>
              <div className="space-y-3">
                {[
                {
                  name: "Pièce d'identité (CNI)",
                  date: '10/01/2026',
                  status: 'Validé'
                },
                {
                  name: 'Titre Foncier',
                  date: '12/01/2026',
                  status: 'Validé'
                },
                {
                  name: "Attestation d'assurance",
                  date: '15/01/2026',
                  status: 'En révision'
                }].
                map((doc, idx) =>
                <div
                  key={idx}
                  className="bg-white p-3 rounded-lg border border-blue-100 flex items-center justify-between">
                  
                    <div className="flex items-center gap-3">
                      <FileIcon className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="font-semibold text-sm text-gray-800">
                          {doc.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Reçu le {doc.date}
                        </p>
                      </div>
                    </div>
                    <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${doc.status === 'Validé' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    
                      {doc.status}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Signatures en attente */}
            <div className="bg-orange-50/50 rounded-xl shadow-sm border border-orange-100 p-5">
              <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-4 flex items-center gap-2">
                <FileIcon className="w-4 h-4 text-orange-600" />
                Signatures OTP (En attente)
              </h4>
              <div className="space-y-3">
                {[
                {
                  name: 'Avenant Budgétaire #1',
                  sent: '18/03/2026',
                  deadline: '25/03/2026'
                },
                {
                  name: 'Validation Plan RDC V3',
                  sent: '20/03/2026',
                  deadline: '27/03/2026'
                }].
                map((doc, idx) =>
                <div
                  key={idx}
                  className="bg-white p-3 rounded-lg border border-orange-100">
                  
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm text-gray-800">
                        {doc.name}
                      </p>
                      <button className="text-xs text-orange-600 hover:text-orange-700 font-bold">
                        Relancer
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Envoyé: {doc.sent}</span>
                      <span className="text-orange-600">
                        Échéance: {doc.deadline}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Validations Matériaux */}
            <div className="bg-purple-50/50 rounded-xl shadow-sm border border-purple-100 p-5">
              <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-4 flex items-center gap-2">
                <CheckCircle2Icon className="w-4 h-4 text-purple-600" />
                Choix Matériaux Validés
              </h4>
              <div className="space-y-3">
                {[
                {
                  category: 'Carrelage Salon',
                  choice: 'Grès cérame 60x60 Beige',
                  date: '15/02/2026'
                },
                {
                  category: 'Peinture Extérieure',
                  choice: 'Acrylique Blanc Cassé',
                  date: '28/02/2026'
                },
                {
                  category: 'Robinetterie',
                  choice: 'Gamme Grohe Eurosmart',
                  date: '10/03/2026'
                }].
                map((val, idx) =>
                <div
                  key={idx}
                  className="bg-white p-3 rounded-lg border border-purple-100 flex items-start gap-3">
                  
                    <CheckCircle2Icon className="w-5 h-5 text-purple-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-gray-800">
                        {val.category}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {val.choice}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Validé le {val.date}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal &&
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
          onClick={() => setShowUploadModal(false)}>
          
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
                  Uploader un Plan
                </h3>
                <button
                onClick={() => setShowUploadModal(false)}
                className="text-white/70 hover:text-white">
                
                  <XCircleIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive ? 'border-globus-orange bg-orange-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}>
                
                  <UploadCloudIcon
                  className={`w-12 h-12 mx-auto mb-3 ${dragActive ? 'text-globus-orange' : 'text-gray-400'}`} />
                
                  <p className="font-montserrat font-bold text-globus-blue-dark mb-1">
                    Glissez-déposez votre fichier ici
                  </p>
                  <p className="text-sm text-gray-500 mb-4">ou</p>
                  <button className="bg-white border border-gray-300 text-gray-700 font-montserrat font-semibold py-2 px-4 rounded-lg text-sm shadow-sm hover:bg-gray-50 transition-colors">
                    Parcourir les fichiers
                  </button>
                  <p className="text-xs text-gray-400 mt-4">
                    Formats acceptés : PDF, DWG, DXF (Max 50MB)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Projet
                    </label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                      {projects.map((p) =>
                    <option key={p}>{p}</option>
                    )}
                    </select>
                  </div>
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Catégorie
                    </label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                      {planCategories.map((c) =>
                    <option key={c.label}>{c.label}</option>
                    )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Nom du document
                  </label>
                  <input
                  type="text"
                  placeholder="Ex: Plan RDC - Architecture"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                
                </div>

                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Note de version
                  </label>
                  <textarea
                  rows={2}
                  placeholder="Ex: Version initiale..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange resize-none" />
                
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                  
                    Annuler
                  </button>
                  <button
                  onClick={handleUpload}
                  disabled={isProcessing === 'upload'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {isProcessing === 'upload' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <UploadCloudIcon className="w-4 h-4" />
                  }{' '}
                    Uploader
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Plan Detail Modal */}
      <AnimatePresence>
        {selectedPlan &&
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
          onClick={() => setSelectedPlan(null)}>
          
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
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            
              <div className="bg-globus-blue-dark p-6 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-montserrat font-bold text-xl flex items-center gap-2">
                    {selectedPlan.name}
                  </h3>
                  <p className="text-sm text-blue-200 mt-1">
                    Version Actuelle : {selectedPlan.version}
                  </p>
                </div>
                <button
                onClick={() => setSelectedPlan(null)}
                className="text-white/70 hover:text-white bg-white/10 p-2 rounded-full transition-colors">
                
                  <XCircleIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row h-full overflow-hidden">
                {/* Preview Area */}
                <div className="w-full md:w-2/3 bg-gray-100 p-6 flex flex-col items-center justify-center border-r border-gray-200 relative min-h-[300px]">
                  <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                    'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                  }}>
                </div>
                  <FileIcon className="w-32 h-32 text-gray-300 mb-4 relative z-10" />
                  <p className="text-gray-500 font-montserrat font-semibold relative z-10">
                    Aperçu du plan PDF/DWG
                  </p>

                  <div className="absolute bottom-4 right-4 z-10 flex gap-2">
                    <button
                    onClick={() => handleDownload(selectedPlan.name)}
                    disabled={
                    isProcessing === `download-${selectedPlan.name}`
                    }
                    className="bg-white text-globus-blue hover:text-white hover:bg-globus-blue font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2 text-sm disabled:opacity-70">
                    
                      {isProcessing === `download-${selectedPlan.name}` ?
                    <Loader2Icon className="w-4 h-4 animate-spin" /> :

                    <DownloadIcon className="w-4 h-4" />
                    }{' '}
                      Télécharger
                    </button>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="w-full md:w-1/3 flex flex-col bg-white">
                  <div className="p-5 border-b border-gray-100 shrink-0">
                    <h4 className="font-montserrat font-bold text-globus-blue-dark mb-4">
                      Actions
                    </h4>
                    <div className="space-y-2">
                      <button
                      onClick={handleNewVersion}
                      disabled={isProcessing === 'new-version'}
                      className="w-full bg-globus-orange hover:bg-globus-orange-hover text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-70">
                      
                        {isProcessing === 'new-version' ?
                      <Loader2Icon className="w-4 h-4 animate-spin" /> :

                      <PlusIcon className="w-4 h-4" />
                      }{' '}
                        Nouvelle Version
                      </button>
                      <button
                      onClick={() => handleDelete(selectedPlan.name)}
                      className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
                      
                        <Trash2Icon className="w-4 h-4" /> Supprimer
                      </button>
                    </div>
                  </div>

                  <div className="p-5 overflow-y-auto flex-grow">
                    <h4 className="font-montserrat font-bold text-globus-blue-dark mb-4">
                      Historique des versions
                    </h4>
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                      {selectedPlan.history.map((h: any, idx: number) =>
                    <div
                      key={h.v}
                      className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      
                          <div className="flex items-center justify-center w-10 h-10 rounded-full border-white border-4 bg-slate-200 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            {h.status === 'active' ?
                        <CheckCircle2Icon className="w-5 h-5 text-emerald-500" /> :

                        <HistoryIcon className="w-4 h-4" />
                        }
                          </div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-3 rounded border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span
                            className={`font-bold text-sm ${h.status === 'active' ? 'text-emerald-600' : 'text-slate-700'}`}>
                            
                                {h.v}
                              </span>
                              <span className="text-xs text-slate-500">
                                {h.date}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mb-1">
                              {h.note}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Par {h.author}
                            </p>
                            {h.status === 'obsolete' &&
                        <button className="mt-2 text-[10px] font-bold text-globus-blue hover:text-globus-orange flex items-center gap-1 transition-colors">
                                <GitCompareIcon className="w-3 h-3" /> Comparer
                              </button>
                        }
                          </div>
                        </div>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDelete &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          
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
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangleIcon className="w-8 h-8" />
              </div>
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                {confirmDelete.title}
              </h3>
              <p className="text-gray-600 mb-6">{confirmDelete.message}</p>
              <div className="flex gap-3 justify-center">
                <button
                onClick={() => setConfirmDelete(null)}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                
                  Annuler
                </button>
                <button
                onClick={confirmDelete.onConfirm}
                disabled={isProcessing?.startsWith('delete')}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-md flex items-center gap-2 disabled:opacity-70">
                
                  {isProcessing?.startsWith('delete') ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :

                <Trash2Icon className="w-4 h-4" />
                }{' '}
                  Supprimer
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

            <DownloadIcon className="w-5 h-5" />
            }
              {toast.message}
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}