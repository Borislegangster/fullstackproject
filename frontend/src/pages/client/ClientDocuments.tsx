import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangleIcon, FolderIcon, FileTextIcon, ImageIcon, DownloadIcon, CheckCircle2Icon, PenToolIcon, SearchIcon, UploadCloudIcon, XIcon, CheckIcon, LoaderIcon, FileIcon } from 'lucide-react';
import { useClientDocuments, useUploadClientDocumentFile, useSubmitMaterialChoice, useClientMaterialChoices } from '../../hooks/useClient';
import { openOrDownloadUrl } from '../../utils/download';
import { formatDate } from '../../utils/datetime';
import { SigningOtpDialog } from '../../components/client/SigningOtpDialog';
import { useQueryClient } from '@tanstack/react-query';
// Document folders (UI structure only — the counts are computed from real data).
const categories: { id: string; label: string; alert?: boolean }[] = [
{ id: 'administratif', label: 'Administratif' },
{ id: 'technique', label: 'Technique' },
{ id: 'financier', label: 'Financier' },
{ id: 'validations', label: 'Validations Requises', alert: true },
{ id: 'envois', label: 'Mes Envois' }];

function categoryFromBackend(cat: string): string {
  // Map backend categories to UI tabs
  switch ((cat || '').toLowerCase()) {
    case 'contrat': return 'administratif';
    case 'architecture':
    case 'structure':
    case 'electricite':
    case 'plomberie': return 'technique';
    case 'facture': return 'financier';
    case 'envoi_client': return 'envois';
    default: return 'administratif';
  }
}

export function ClientDocuments() {
  const { data: apiDocumentsData } = useClientDocuments();
  const uploadFileMutation = useUploadClientDocumentFile();
  const submitMaterialChoiceMutation = useSubmitMaterialChoice();
  const { data: apiMaterialChoices } = useClientMaterialChoices();
  const materialChoicesList: any[] = Array.isArray(apiMaterialChoices) ? apiMaterialChoices : [];
  const pendingChoice: any = materialChoicesList.find((c: any) => !c.selected) || materialChoicesList[0] || null;
  const choiceOptionLabel = (opt: any): string =>
    typeof opt === 'string' ? opt : (opt?.label || opt?.name || opt?.title || '');

  const [activeCategory, setActiveCategory] = useState('administratif');
  const [searchQuery, setSearchQuery] = useState('');

  // Live documents from API, grouped by category for the existing UI structure.
  const documentsData = React.useMemo(() => {
    const grouped: Record<string, any[]> = {
      administratif: [],
      technique: [],
      financier: [],
      validations: [],
      envois: [],
    };
    if (!Array.isArray(apiDocumentsData)) return grouped;
    for (const d of apiDocumentsData) {
      const catUi = categoryFromBackend(d.category);
      grouped[catUi].push({
        id: d.id,
        name: d.name,
        date: formatDate(d.created_at),
        size: d.file_size || '',
        type: (d.name || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'doc',
        file_url: d.file_url,
        signed_at: d.signed_at,
      });
    }
    return grouped;
  }, [apiDocumentsData]);
  // Download State
  const [downloadState, setDownloadState] = useState({
    isDownloading: false,
    progress: 0,
    fileName: '',
    isComplete: false
  });
  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  // Phase 7 — real OTP signing flow (request-otp + verify-otp + hash).
  const [signingDoc, setSigningDoc] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  // Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<
    'idle' | 'uploading' | 'success'>(
    'idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toastMessage, setToastMessage] = useState('');
  // Material Choice State
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [materialChoiceState, setMaterialChoiceState] = useState<
    'idle' | 'confirming' | 'success'>(
    'idle');
  // Flatten all documents for search
  const allDocuments = Object.entries(documentsData).flatMap(([catId, docs]) =>
  docs.map((doc) => ({
    ...doc,
    categoryId: catId
  }))
  );
  // Real per-category counts (validations = documents not yet signed).
  const validationsCount = allDocuments.filter((d: any) => !d.signed_at).length;
  const categoryCount = (catId: string) =>
    catId === 'validations' ? validationsCount : documentsData[catId]?.length || 0;
  const filteredDocuments = searchQuery ?
  allDocuments.filter((doc) =>
  doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) :
  documentsData[activeCategory] || [];
  // Handlers
  const handleDownload = async (doc: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (downloadState.isDownloading) return;
    const fileUrl = doc?.file_url;
    const fileName = doc?.name || 'document';
    if (!fileUrl) {
      setToastMessage('Aucun fichier disponible pour ce document');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }
    setDownloadState({ isDownloading: true, progress: 0, fileName, isComplete: false });
    try {
      await openOrDownloadUrl(fileUrl, fileName, (pct) =>
        setDownloadState((prev) => ({ ...prev, progress: pct })),
      );
      setDownloadState((prev) => ({ ...prev, progress: 100, isComplete: true }));
      setTimeout(
        () =>
          setDownloadState({ isDownloading: false, progress: 0, fileName: '', isComplete: false }),
        2500,
      );
    } catch {
      setDownloadState({ isDownloading: false, progress: 0, fileName: '', isComplete: false });
      setToastMessage('Échec du téléchargement');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadState('uploading');
      setUploadProgress(0);
      try {
        // Real binary upload — the backend stores the file and returns its URL.
        await uploadFileMutation.mutateAsync({
          file,
          category: 'envoi_client',
          onProgress: (pct) => setUploadProgress(pct),
        });
        setUploadState('success');
      } catch {
        setUploadState('idle');
        setToastMessage("Échec de l'envoi du document");
        setTimeout(() => setToastMessage(''), 3000);
      } finally {
        setTimeout(() => setUploadState('idle'), 3000);
        e.target.value = '';
      }
    }
  };
  const handleMaterialConfirm = async () => {
    if (!selectedMaterial || !pendingChoice) return;
    try {
      await submitMaterialChoiceMutation.mutateAsync({
        choice_id: pendingChoice.id,
        selection: selectedMaterial,
      });
      setMaterialChoiceState('success');
      setTimeout(() => {
        setMaterialChoiceState('idle');
      }, 3000);
    } catch (err) {
      console.error('Material choice failed', err);
      setMaterialChoiceState('idle');
    }
  };
  return (
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8 relative pb-20">
      {/* Sidebar Categories */}
      <div className="w-full md:w-64 shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24">
          <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4 px-2">
            Coffre-fort
          </h3>
          <nav className="space-y-1">
            {categories.map((cat) =>
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setSearchQuery('');
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-montserrat font-semibold text-sm transition-colors ${activeCategory === cat.id && !searchQuery ? 'bg-globus-blue/10 text-globus-blue' : 'text-globus-gray hover:bg-gray-50 hover:text-globus-blue-dark'}`}>
              
                <div className="flex items-center gap-3">
                  {cat.id === 'envois' ?
                <UploadCloudIcon
                  className={`w-4 h-4 ${activeCategory === cat.id && !searchQuery ? 'text-globus-blue' : 'text-gray-400'}`} /> :


                <FolderIcon
                  className={`w-4 h-4 ${activeCategory === cat.id && !searchQuery ? 'text-globus-blue' : 'text-gray-400'}`} />

                }
                  {cat.label}
                </div>
                <div className="flex items-center gap-2">
                  {cat.alert && categoryCount(cat.id) > 0 &&
                <span className="w-2 h-2 rounded-full bg-globus-orange animate-pulse"></span>
                }
                  <span
                  className={`text-xs ${activeCategory === cat.id ? 'bg-globus-blue/20 text-globus-blue' : 'bg-gray-100 text-gray-500'} px-2 py-0.5 rounded-full`}>
                  
                    {categoryCount(cat.id)}
                  </span>
                </div>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Search Bar */}
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-4 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange shadow-sm transition-all" />
          
        </div>

        {searchQuery ?
        <motion.div
          initial={{
            opacity: 0,
            y: 10
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                Résultats pour "{searchQuery}"
              </h2>
              <p className="font-opensans text-sm text-globus-gray mt-1">
                {filteredDocuments.length} document(s) trouvé(s)
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredDocuments.length > 0 ?
            filteredDocuments.map((doc) =>
            <div
              key={doc.id}
              onClick={() => setPreviewDoc(doc)}
              className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer">
              
                    <div className="flex items-center gap-4">
                      <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${doc.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                  
                        {doc.type === 'pdf' ?
                  <FileTextIcon className="w-5 h-5" /> :

                  <ImageIcon className="w-5 h-5" />
                  }
                      </div>
                      <div>
                        <p className="font-montserrat font-bold text-sm text-globus-blue-dark group-hover:text-globus-blue transition-colors">
                          {doc.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                            {doc.categoryId}
                          </span>
                          <p className="font-opensans text-xs text-globus-gray">
                            {doc.date} • {doc.size}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                onClick={(e) => handleDownload(doc, e)}
                className="p-2 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded-lg transition-colors">
                
                      <DownloadIcon className="w-5 h-5" />
                    </button>
                  </div>
            ) :

            <div className="p-8 text-center text-globus-gray font-opensans">
                  Aucun document ne correspond à votre recherche.
                </div>
            }
            </div>
          </motion.div> :
        activeCategory === 'envois' ?
        <motion.div
          key="envois"
          initial={{
            opacity: 0,
            y: 10
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                Mes Envois
              </h2>
              <p className="font-opensans text-sm text-globus-gray mt-1">
                Documents que vous avez transmis à Globus BTP.
              </p>
            </div>

            <div className="p-6 border-b border-gray-100">
              <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden" />
            

              {uploadState === 'idle' &&
            <div
              onClick={handleUploadClick}
              className="w-full border-2 border-dashed border-globus-orange/30 bg-globus-orange/5 rounded-2xl p-8 text-center hover:bg-globus-orange/10 transition-colors cursor-pointer group">
              
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                    <UploadCloudIcon className="w-8 h-8 text-globus-orange" />
                  </div>
                  <p className="font-montserrat font-bold text-globus-blue-dark mb-1">
                    Déposez vos documents ici
                  </p>
                  <p className="font-opensans text-sm text-globus-gray">
                    Assurance, garantie bancaire, justificatifs, etc. (PDF, JPG,
                    PNG)
                  </p>
                  <button className="mt-4 bg-white border border-gray-200 text-globus-blue-dark font-montserrat font-bold py-2 px-6 rounded-lg shadow-sm hover:border-globus-orange transition-colors">
                    Parcourir les fichiers
                  </button>
                </div>
            }

              {uploadState === 'uploading' &&
            <div className="w-full border-2 border-globus-blue/30 bg-blue-50 rounded-2xl p-8 text-center">
                  <LoaderIcon className="w-10 h-10 text-globus-blue animate-spin mx-auto mb-4" />
                  <p className="font-montserrat font-bold text-globus-blue-dark mb-2">
                    Envoi en cours...
                  </p>
                  <div className="w-full max-w-xs mx-auto h-2 bg-white rounded-full overflow-hidden">
                    <div
                  className="h-full bg-globus-blue transition-all duration-200"
                  style={{
                    width: `${uploadProgress}%`
                  }}>
                </div>
                  </div>
                  <p className="text-xs text-globus-blue mt-2">
                    {uploadProgress}%
                  </p>
                </div>
            }

              {uploadState === 'success' &&
            <div className="w-full border-2 border-green-200 bg-green-50 rounded-2xl p-8 text-center">
                  <CheckCircle2Icon className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="font-montserrat font-bold text-green-800">
                    Document envoyé avec succès
                  </p>
                </div>
            }
            </div>

            <div className="divide-y divide-gray-100">
              {documentsData['envois']?.map((doc) =>
            <div
              key={doc.id}
              onClick={() => setPreviewDoc(doc)}
              className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer">
              
                  <div className="flex items-center gap-4">
                    <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${doc.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                  
                      {doc.type === 'pdf' ?
                  <FileTextIcon className="w-5 h-5" /> :

                  <ImageIcon className="w-5 h-5" />
                  }
                    </div>
                    <div>
                      <p className="font-montserrat font-bold text-sm text-globus-blue-dark group-hover:text-globus-blue transition-colors">
                        {doc.name}
                      </p>
                      <p className="font-opensans text-xs text-globus-gray">
                        Envoyé le {doc.date} • {doc.size}
                      </p>
                    </div>
                  </div>
                  <button
                onClick={(e) => handleDownload(doc, e)}
                className="p-2 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded-lg transition-colors">
                
                    <DownloadIcon className="w-5 h-5" />
                  </button>
                </div>
            )}
            </div>
          </motion.div> :
        activeCategory !== 'validations' ?
        <motion.div
          key={activeCategory}
          initial={{
            opacity: 0,
            y: 10
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark capitalize">
                Dossier {activeCategory}
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {documentsData[activeCategory]?.map((doc) =>
            <div
              key={doc.id}
              onClick={() => setPreviewDoc(doc)}
              className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer">
              
                  <div className="flex items-center gap-4">
                    <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${doc.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                  
                      {doc.type === 'pdf' ?
                  <FileTextIcon className="w-5 h-5" /> :

                  <ImageIcon className="w-5 h-5" />
                  }
                    </div>
                    <div>
                      <p className="font-montserrat font-bold text-sm text-globus-blue-dark group-hover:text-globus-blue transition-colors">
                        {doc.name}
                      </p>
                      <p className="font-opensans text-xs text-globus-gray">
                        {doc.date} • {doc.size}
                      </p>
                    </div>
                  </div>
                  <button
                onClick={(e) => handleDownload(doc, e)}
                className="p-2 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded-lg transition-colors">
                
                    <DownloadIcon className="w-5 h-5" />
                  </button>
                </div>
            )}
            </div>
          </motion.div> :

        <motion.div
          key="validations"
          initial={{
            opacity: 0,
            y: 10
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="space-y-6">
          
            <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-6">
              Validations & Signatures requises
            </h2>

            {/* Real signature flow — any unsigned doc shared with the client */}
            {(allDocuments.filter((d: any) => !d.signed_at).length > 0) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-3">
                  Documents en attente de signature
                </h3>
                <ul className="divide-y divide-gray-100">
                  {allDocuments
                    .filter((d: any) => !d.signed_at)
                    .slice(0, 8)
                    .map((d: any) => (
                      <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-montserrat font-bold text-sm text-globus-blue-dark truncate">
                            {d.name}
                          </p>
                          <p className="text-xs text-globus-gray font-opensans">
                            {d.date} • {d.size}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSigningDoc({ id: String(d.id), name: d.name })}
                          className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold text-xs py-2 px-3 rounded-lg shrink-0">
                          Signer (OTP)
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Material Choice Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <PenToolIcon className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1 flex justify-between items-start">
                  <div>
                    <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-1">
                      {pendingChoice?.category || 'Choix de matériaux'}
                    </h3>
                    <p className="font-opensans text-sm text-globus-gray">
                      {pendingChoice
                        ? "Veuillez sélectionner l'une des options proposées par l'architecte."
                        : 'Aucun choix de matériaux en attente.'}
                    </p>
                  </div>
                  {materialChoiceState === 'success' &&
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold font-montserrat shrink-0">
                      Validé ✓
                    </span>
                }
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {(pendingChoice?.options || []).map((opt: any, i: number) => {
                const label = choiceOptionLabel(opt) || `Option ${i + 1}`;
                const img = typeof opt === 'object' ? (opt.image || opt.img) : undefined;
                const desc = typeof opt === 'object' ? (opt.description || opt.desc) : undefined;
                return (
                  <label
                    key={i}
                    className={`cursor-pointer group ${materialChoiceState === 'success' && selectedMaterial !== label ? 'opacity-50 grayscale' : ''}`}>

                    <input
                      type="radio"
                      name="material-option"
                      className="peer sr-only"
                      checked={selectedMaterial === label}
                      onChange={() =>
                      materialChoiceState !== 'success' &&
                      setSelectedMaterial(label)
                      }
                      disabled={materialChoiceState === 'success'} />

                    <div className="border-2 border-gray-200 rounded-xl overflow-hidden peer-checked:border-globus-orange peer-checked:ring-1 peer-checked:ring-globus-orange transition-all">
                      {img &&
                      <div className="aspect-square bg-gray-200 relative">
                        <img src={img} alt={label} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-globus-orange/20 opacity-0 peer-checked:opacity-100 transition-opacity flex items-center justify-center">
                          <CheckCircle2Icon className="w-10 h-10 text-white drop-shadow-md" />
                        </div>
                      </div>
                      }
                      <div className="p-3 bg-white text-center">
                        <p className="font-montserrat font-bold text-sm text-globus-blue-dark">{label}</p>
                        {desc &&
                        <p className="font-opensans text-xs text-globus-gray">{desc}</p>
                        }
                      </div>
                    </div>
                  </label>
                );
              })}
              </div>

              {pendingChoice && materialChoiceState !== 'success' &&
            <div className="flex justify-end">
                  <button
                onClick={handleMaterialConfirm}
                disabled={!selectedMaterial}
                className="bg-globus-orange hover:bg-globus-orange-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md">

                    Valider ce choix
                  </button>
                </div>
            }
            </div>

          </motion.div>
        }
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc &&
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
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}>
          
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
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${previewDoc.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                  
                    {previewDoc.type === 'pdf' ?
                  <FileTextIcon className="w-5 h-5" /> :

                  <ImageIcon className="w-5 h-5" />
                  }
                  </div>
                  <div>
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      {previewDoc.name}
                    </h3>
                    <p className="font-opensans text-xs text-gray-500">
                      {previewDoc.date} • {previewDoc.size}
                    </p>
                  </div>
                </div>
                <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-200">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-gray-100 p-8 flex items-center justify-center min-h-[400px]">
                {previewDoc.type === 'pdf' ?
              <div className="bg-white w-full max-w-2xl h-[600px] shadow-lg border border-gray-200 flex flex-col items-center justify-center text-gray-400">
                    <FileTextIcon className="w-24 h-24 mb-4 opacity-20" />
                    <p className="font-montserrat font-bold text-xl">
                      Aperçu du document PDF
                    </p>
                    <p className="font-opensans text-sm mt-2">
                      {previewDoc.name}
                    </p>
                  </div> :

              previewDoc.file_url ?
              <img
                src={previewDoc.file_url}
                alt={previewDoc.name}
                className="max-w-full max-h-full object-contain shadow-lg" /> :

              <div className="bg-white w-full max-w-2xl h-[400px] shadow-lg border border-gray-200 flex flex-col items-center justify-center text-gray-400">
                    <ImageIcon className="w-20 h-20 mb-4 opacity-20" />
                    <p className="font-opensans text-sm">{previewDoc.name}</p>
                  </div>

              }
              </div>

              <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
                <button
                onClick={() => setPreviewDoc(null)}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                
                  Fermer
                </button>
                <button
                onClick={() => {
                  handleDownload(previewDoc);
                  setPreviewDoc(null);
                }}
                className="bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2">
                
                  <DownloadIcon className="w-4 h-4" /> Télécharger
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Material Confirmation Modal */}
      <AnimatePresence>
        {materialChoiceState === 'confirming' &&
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
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
            
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangleIcon className="w-8 h-8 text-globus-orange" />
              </div>
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                Confirmer votre choix
              </h3>
              <p className="font-opensans text-gray-600 mb-6">
                Confirmez-vous le choix de l'
                <strong>Option {selectedMaterial}</strong> pour le carrelage RDC
                ? Ce choix sera définitif pour la commande.
              </p>
              <div className="flex justify-center gap-3">
                <button
                onClick={() => setMaterialChoiceState('idle')}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors">
                
                  Annuler
                </button>
                <button
                onClick={handleMaterialConfirm}
                className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md">
                
                  Oui, je confirme
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Small Toast Notification */}
      <AnimatePresence>
        {toastMessage &&
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
            y: -20
          }}
          className="fixed top-24 right-6 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg font-opensans text-sm">
          
            {toastMessage}
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

              <FileIcon className="w-5 h-5" />
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

      {/* Phase 7 — Electronic signature dialog (OTP + document hash) */}
      <AnimatePresence>
        {signingDoc && (
          <SigningOtpDialog
            documentId={signingDoc.id}
            documentName={signingDoc.name}
            onClose={() => setSigningDoc(null)}
            onSigned={() => {
              queryClient.invalidateQueries({ queryKey: ['client-documents'] });
            }}
          />
        )}
      </AnimatePresence>
    </div>);

}