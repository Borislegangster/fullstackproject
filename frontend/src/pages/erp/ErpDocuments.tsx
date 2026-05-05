import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BanknoteIcon,
  FileTextIcon,
  ReceiptIcon,
  BadgeCheckIcon,
  PackageOpenIcon,
  MapPinIcon,
  DownloadIcon,
  EyeIcon,
  FileOutputIcon,
  SearchIcon,
  PlusIcon,
  XIcon,
  Loader2Icon,
  CheckCircle2Icon,
  UsersIcon,
  AlertTriangleIcon } from
'lucide-react';
const templates = [
{
  icon: BanknoteIcon,
  name: 'Fiche de Paie',
  desc: 'Bulletin de salaire mensuel',
  count: 156,
  color: 'bg-green-100 text-green-600'
},
{
  icon: FileTextIcon,
  name: 'Contrat de Travail',
  desc: 'CDI, CDD, Temporaire',
  count: 89,
  color: 'bg-blue-100 text-blue-600'
},
{
  icon: ReceiptIcon,
  name: 'Note de Frais',
  desc: 'Remboursement de dépenses',
  count: 234,
  color: 'bg-orange-100 text-orange-600'
},
{
  icon: BadgeCheckIcon,
  name: 'Attestation de Travail',
  desc: "Certificat d'emploi",
  count: 45,
  color: 'bg-purple-100 text-purple-600'
},
{
  icon: PackageOpenIcon,
  name: 'Bon de Sortie Matériel',
  desc: 'Autorisation de sortie',
  count: 178,
  color: 'bg-yellow-100 text-yellow-700'
},
{
  icon: MapPinIcon,
  name: 'Ordre de Mission',
  desc: 'Déplacement professionnel',
  count: 67,
  color: 'bg-cyan-100 text-cyan-600'
}];

const recentDocs = [
{
  name: 'Fiche de paie — Paul Mbarga',
  type: 'Fiche de Paie',
  target: 'Paul Mbarga',
  date: '23/03/2026'
},
{
  name: 'Contrat CDD — Ouvrier #89',
  type: 'Contrat',
  target: 'Moussa Amadou',
  date: '22/03/2026'
},
{
  name: 'Note de frais — Carburant Mars',
  type: 'Note de Frais',
  target: 'Alain Messi',
  date: '21/03/2026'
},
{
  name: 'Bon de sortie — Bétonnière',
  type: 'Bon de Sortie',
  target: 'Villa Bonapriso',
  date: '20/03/2026'
},
{
  name: 'Attestation — Sophie Ekambi',
  type: 'Attestation',
  target: 'Sophie Ekambi',
  date: '19/03/2026'
},
{
  name: 'Ordre de mission — Douala-Yaoundé',
  type: 'Ordre de Mission',
  target: 'Jacques Nkoulou',
  date: '18/03/2026'
}];

export function ErpDocuments() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const filteredDocs = recentDocs.filter(
    (d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.target.toLowerCase().includes(searchQuery.toLowerCase())
  );
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
  const handleGenerateClick = (template: any) => {
    setSelectedTemplate(template);
    setShowGenerateModal(true);
    setIsBatchMode(false);
  };
  const handleGenerateSubmit = () => {
    setIsProcessing('generate');
    setTimeout(() => {
      setIsProcessing(null);
      setShowGenerateModal(false);
      showToast(
        isBatchMode ?
        'Documents générés en lot avec succès' :
        'Document généré avec succès',
        'success'
      );
    }, 1500);
  };
  const handlePreviewClick = (doc: any) => {
    setSelectedDoc(doc);
    setShowPreviewModal(true);
  };
  const handleDownload = (docName: string) => {
    setIsProcessing(`download-${docName}`);
    showToast('Téléchargement en cours...', 'info');
    setTimeout(() => {
      setIsProcessing(null);
      showToast('Document téléchargé ✓', 'success');
    }, 1500);
  };
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}>
        
        <div className="flex items-center gap-3 mb-6">
          <FileOutputIcon className="w-7 h-7 text-globus-blue-dark" />
          <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark">
            Génération de Documents — Zéro Papier
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {templates.map((t, idx) => {
            const Icon = t.icon;
            return (
              <motion.div
                key={t.name}
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
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${t.color}`}>
                    
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs text-globus-gray font-opensans bg-gray-100 px-2 py-1 rounded">
                    {t.count} générés
                  </span>
                </div>
                <h3 className="font-montserrat font-bold text-globus-blue-dark mb-1">
                  {t.name}
                </h3>
                <p className="text-xs text-globus-gray font-opensans mb-4">
                  {t.desc}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGenerateClick(t)}
                    className="flex-1 bg-globus-blue/10 hover:bg-globus-blue hover:text-white text-globus-blue font-montserrat font-bold py-2 rounded-lg transition-colors text-sm">
                    
                    Générer
                  </button>
                  {t.name === 'Fiche de Paie' &&
                  <button
                    onClick={() => {
                      setSelectedTemplate(t);
                      setIsBatchMode(true);
                      setShowGenerateModal(true);
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-globus-gray font-montserrat font-bold py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center"
                    title="Génération en lot">
                    
                      <UsersIcon className="w-4 h-4" />
                    </button>
                  }
                </div>
              </motion.div>);

          })}
        </div>
      </motion.div>

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
          delay: 0.3
        }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark">
            Documents Récemment Générés
          </h3>
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un document..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm font-opensans focus:outline-none focus:border-globus-orange" />
            
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-globus-light border-b border-gray-200">
                <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                  Document
                </th>
                <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                  Type
                </th>
                <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                  Employé/Projet
                </th>
                <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark">
                  Date
                </th>
                <th className="p-4 font-montserrat font-semibold text-xs text-globus-blue-dark text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="font-opensans text-sm">
              {filteredDocs.map((d, i) =>
              <tr
                key={i}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                
                  <td className="p-4 font-semibold text-globus-blue-dark">
                    {d.name}
                  </td>
                  <td className="p-4">
                    <span className="bg-gray-100 text-globus-gray text-xs font-bold px-2 py-1 rounded">
                      {d.type}
                    </span>
                  </td>
                  <td className="p-4 text-globus-gray">{d.target}</td>
                  <td className="p-4 text-globus-gray">{d.date}</td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button
                    onClick={() => handlePreviewClick(d)}
                    className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors"
                    title="Aperçu">
                    
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                    onClick={() => handleDownload(d.name)}
                    disabled={isProcessing === `download-${d.name}`}
                    className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                    title="Télécharger">
                    
                      {isProcessing === `download-${d.name}` ?
                    <Loader2Icon className="w-4 h-4 animate-spin" /> :

                    <DownloadIcon className="w-4 h-4" />
                    }
                    </button>
                  </td>
                </tr>
              )}
              {filteredDocs.length === 0 &&
              <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Aucun document trouvé pour "{searchQuery}"
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Generate Modal */}
      <AnimatePresence>
        {showGenerateModal && selectedTemplate &&
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
          onClick={() => setShowGenerateModal(false)}>
          
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
                <div className="flex items-center gap-3">
                  <selectedTemplate.icon className="w-6 h-6 text-globus-orange" />
                  <h3 className="font-montserrat font-bold text-xl">
                    {isBatchMode ? 'Génération en lot' : 'Nouveau Document'}
                  </h3>
                </div>
                <button
                onClick={() => setShowGenerateModal(false)}
                className="text-white/70 hover:text-white">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex items-center gap-3 mb-2">
                  <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selectedTemplate.color}`}>
                  
                    <selectedTemplate.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                      {selectedTemplate.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedTemplate.desc}
                    </p>
                  </div>
                </div>

                {isBatchMode ?
              <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Sélectionner les employés
                    </label>
                    <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-gray-50">
                      {[
                  'Paul Mbarga',
                  'Claire Fotso',
                  'Alain Messi',
                  'Sophie Ekambi',
                  'Moussa Amadou',
                  'Jacques Nkoulou'].
                  map((emp, i) =>
                  <label
                    key={i}
                    className="flex items-center gap-3 p-3 hover:bg-gray-100 border-b border-gray-200 last:border-0 cursor-pointer">
                    
                          <input
                      type="checkbox"
                      className="w-4 h-4 text-globus-orange rounded border-gray-300 focus:ring-globus-orange"
                      defaultChecked={i < 3} />
                    
                          <span className="font-opensans text-sm text-gray-700">
                            {emp}
                          </span>
                        </label>
                  )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      3 employés sélectionnés
                    </p>
                  </div> :

              <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      {selectedTemplate.name === 'Bon de Sortie Matériel' ?
                  'Projet / Chantier' :
                  'Employé concerné'}
                    </label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                      <option>Sélectionner...</option>
                      <option>Paul Mbarga</option>
                      <option>Claire Fotso</option>
                      <option>Alain Messi</option>
                    </select>
                  </div>
              }

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Date d'émission
                    </label>
                    <input
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                  
                  </div>
                  {selectedTemplate.name === 'Fiche de Paie' &&
                <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                        Période
                      </label>
                      <input
                    type="month"
                    defaultValue="2026-03"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                  
                    </div>
                }
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                  onClick={() => setShowGenerateModal(false)}
                  className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                  
                    Annuler
                  </button>
                  <button
                  onClick={handleGenerateSubmit}
                  disabled={isProcessing === 'generate'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {isProcessing === 'generate' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <FileOutputIcon className="w-4 h-4" />
                  }
                    {isBatchMode ? 'Générer le lot' : 'Générer le document'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && selectedDoc &&
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
          onClick={() => setShowPreviewModal(false)}>
          
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
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            
              <div className="bg-globus-blue-dark p-4 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <FileTextIcon className="w-5 h-5 text-globus-orange" />
                  <h3 className="font-montserrat font-bold text-lg">
                    {selectedDoc.name}
                  </h3>
                </div>
                <button
                onClick={() => setShowPreviewModal(false)}
                className="text-white/70 hover:text-white bg-white/10 p-1.5 rounded-full transition-colors">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-200 p-6 flex-grow overflow-y-auto flex justify-center min-h-[400px]">
                {/* Mock PDF Page */}
                <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-lg p-12 relative">
                  <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                    <img
                    src="/LogoGlobus.png"
                    alt="watermark"
                    className="w-64" />
                  
                  </div>
                  <div className="flex justify-between items-start border-b-2 border-globus-blue-dark pb-6 mb-8">
                    <img
                    src="/LogoGlobus.png"
                    alt="Logo"
                    className="h-12" />
                  
                    <div className="text-right">
                      <h1 className="font-montserrat font-bold text-xl text-globus-blue-dark uppercase">
                        {selectedDoc.type}
                      </h1>
                      <p className="text-sm text-gray-500 mt-1">
                        Date: {selectedDoc.date}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6 text-sm text-gray-800">
                    <div className="bg-gray-50 p-4 rounded border border-gray-100">
                      <p className="font-bold mb-1">Concerne :</p>
                      <p>{selectedDoc.target}</p>
                    </div>

                    <div className="h-48 bg-gray-50 border border-dashed border-gray-300 rounded flex items-center justify-center">
                      <p className="text-gray-400 italic">
                        Contenu du document généré automatiquement...
                      </p>
                    </div>

                    <div className="mt-12 flex justify-between">
                      <div>
                        <p className="font-bold mb-8">
                          Signature Employé/Tiers
                        </p>
                        <div className="w-40 border-b border-gray-400"></div>
                      </div>
                      <div>
                        <p className="font-bold mb-8">Direction Globus BTP</p>
                        <div className="w-40 border-b border-gray-400"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
                <button
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                
                  Fermer
                </button>
                <button
                onClick={() => handleDownload(selectedDoc.name)}
                disabled={isProcessing === `download-${selectedDoc.name}`}
                className="bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2 disabled:opacity-70">
                
                  {isProcessing === `download-${selectedDoc.name}` ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :

                <DownloadIcon className="w-4 h-4" />
                }{' '}
                  Télécharger PDF
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