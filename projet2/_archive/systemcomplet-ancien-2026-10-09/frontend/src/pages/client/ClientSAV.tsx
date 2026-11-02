import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheckIcon, AlertTriangleIcon, UploadCloudIcon, ChevronDownIcon, CheckCircle2Icon, ClockIcon, StarIcon, HashIcon, XIcon, LoaderIcon, ImageIcon } from 'lucide-react';
import { useClientSAVTickets, useCreateClientSAVTicket, useRateClientSAVTicket, useClientProject } from '../../hooks/useClient';
import { formatDate, formatDateParts } from '../../utils/datetime';

function savStatusToUi(s: string): string {
  switch ((s || '').toUpperCase()) {
    case 'RESOLU': return 'résolu';
    case 'EN_COURS': return 'en-cours';
    case 'FERME': return 'fermé';
    case 'OUVERT': return 'ouvert';
    default: return 'ouvert';
  }
}

export function ClientSAV() {
  const { data: apiTickets } = useClientSAVTickets();
  const { data: projectData } = useClientProject();
  const createTicketMutation = useCreateClientSAVTicket();
  const rateTicketMutation = useRateClientSAVTicket();
  const deliveryDate = formatDateParts((projectData as any)?.estimated_end_date, {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [priority, setPriority] = useState('normal');
  const [rating, setRating] = useState(0);

  // Live tickets from API
  const tickets = React.useMemo(() => {
    if (!Array.isArray(apiTickets)) return [];
    return apiTickets.map((t: any) => ({
      id: t.code || t.id,
      raw_id: t.id,
      title: t.subject || '',
      category: t.category || 'general',
      status: savStatusToUi(t.status),
      date: formatDate(t.created_at),
      desc: t.description || '',
      rating: t.rating || undefined,
      resolvedDate: formatDate(t.resolved_at),
    }));
  }, [apiTickets]);
  // Legal construction warranties — computed from the real delivery date
  // (Parfait Achèvement 1 an, Biennale 2 ans, Décennale 10 ans). No hardcoded dates.
  const warranties = React.useMemo(() => {
    const end = (projectData as any)?.estimated_end_date;
    if (!end) return [] as { label: string; expires: string; active: boolean }[];
    const base = new Date(end);
    const mk = (label: string, years: number) => {
      const exp = new Date(base);
      exp.setFullYear(exp.getFullYear() + years);
      return {
        label,
        expires: formatDate(exp),
        active: exp.getTime() > Date.now(),
      };
    };
    return [
      mk('Parfait Achèvement', 1),
      mk('Garantie Biennale', 2),
      mk('Garantie Décennale', 10),
    ];
  }, [projectData]);
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'Plomberie',
    desc: ''
  });
  const [submitState, setSubmitState] = useState<
    'idle' | 'processing' | 'success'>(
    'idle');
  const [newTicketId, setNewTicketId] = useState('');
  // Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    {
      name: string;
      size: string;
    }[]>(
    []);
  // Rating State
  const [ratingState, setRatingState] = useState<
    'idle' | 'processing' | 'success'>(
    'idle');
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      }));
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };
  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.desc) return;
    setSubmitState('processing');
    try {
      const priorityMap: Record<string, 'BASSE' | 'NORMALE' | 'HAUTE' | 'URGENTE'> = {
        low: 'BASSE',
        normal: 'NORMALE',
        high: 'HAUTE',
        urgent: 'URGENTE',
      };
      const created = await createTicketMutation.mutateAsync({
        subject: formData.title,
        description: formData.desc,
        category: formData.category.toLowerCase(),
        priority: priorityMap[priority] || 'NORMALE',
      });
      setNewTicketId(created?.code || 'SAV');
      setSubmitState('success');
    } catch (err) {
      console.error('Create ticket failed', err);
      setSubmitState('idle');
    }
  };
  const handleCloseSuccess = () => {
    setSubmitState('idle');
    setIsFormOpen(false);
    setFormData({
      title: '',
      category: 'Plomberie',
      desc: ''
    });
    setUploadedFiles([]);
    setPriority('normal');
  };
  const handleRatingSubmit = async (ticketId: string) => {
    setRatingState('processing');
    const ticket = tickets.find((t) => t.id === ticketId);
    const realId = (ticket as any)?.raw_id || ticketId;
    try {
      await rateTicketMutation.mutateAsync({ id: realId, rating });
      setRatingState('success');
      showToast('Merci pour votre évaluation !');
      setTimeout(() => setRatingState('idle'), 2000);
    } catch (err) {
      console.error('Rate ticket failed', err);
      setRatingState('idle');
    }
  };
  return (
    <div className="max-w-5xl mx-auto space-y-8 relative pb-20">
      {/* Delivery Banner */}
      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="bg-gradient-to-r from-globus-blue-dark to-globus-blue rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
        
        <div className="absolute right-0 top-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheckIcon className="w-8 h-8 text-globus-orange" />
            <h1 className="font-montserrat font-extrabold text-2xl md:text-3xl">
              SAV & Garanties
            </h1>
          </div>
          <p className="font-opensans text-seconda-blue text-lg mb-8">
            {deliveryDate
              ? <>Votre bâtiment a été livré le <strong>{deliveryDate}</strong>.</>
              : 'Suivi de la garantie et du service après-vente de votre bâtiment.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {warranties.length === 0 ?
            <p className="text-sm text-seconda-blue col-span-full">
              Les garanties seront affichées dès la livraison du bâtiment.
            </p> :
            warranties.map((w) =>
            <div
              key={w.label}
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
              <h3 className="font-montserrat font-bold text-sm mb-1">
                {w.label}
              </h3>
              <p className="text-xs text-seconda-blue mb-2">
                Valide jusqu'au {w.expires}
              </p>
              <span
                className={`inline-block px-2 py-1 text-xs font-bold rounded ${w.active ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
                {w.active ? 'Active' : 'Expirée'}
              </span>
            </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats Summary */}
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
        className="grid grid-cols-3 gap-4">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-globus-blue/10 flex items-center justify-center shrink-0">
            <HashIcon className="w-5 h-5 text-globus-blue" />
          </div>
          <div>
            <p className="text-xs text-globus-gray font-opensans">
              Total tickets
            </p>
            <p className="font-montserrat font-bold text-xl text-globus-blue-dark">
              {tickets.length}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-globus-orange/10 flex items-center justify-center shrink-0">
            <ClockIcon className="w-5 h-5 text-globus-orange" />
          </div>
          <div>
            <p className="text-xs text-globus-gray font-opensans">En cours</p>
            <p className="font-montserrat font-bold text-xl text-globus-blue-dark">
              {tickets.filter((t) => t.status === 'en-cours').length}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2Icon className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-globus-gray font-opensans">Résolus</p>
            <p className="font-montserrat font-bold text-xl text-globus-blue-dark">
              {tickets.filter((t) => t.status === 'résolu').length}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex justify-between items-center">
        <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark">
          Vos Déclarations
        </h2>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md flex items-center gap-2">
          
          <AlertTriangleIcon className="w-4 h-4" /> Déclarer un incident
        </button>
      </div>

      {/* Incident Form (Collapsible) */}
      <AnimatePresence>
        {isFormOpen &&
        <motion.div
          initial={{
            height: 0,
            opacity: 0
          }}
          animate={{
            height: 'auto',
            opacity: 1
          }}
          exit={{
            height: 0,
            opacity: 0
          }}
          className="overflow-hidden">
          
            <div className="bg-white rounded-2xl shadow-md border-2 border-globus-orange/20 p-6 md:p-8 mb-8">
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-6">
                Nouveau Ticket SAV
              </h3>
              <form onSubmit={handleSubmitTicket} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Titre de l'incident
                    </label>
                    <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      title: e.target.value
                    })
                    }
                    placeholder="Ex: Fuite sous l'évier"
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange" />
                  
                  </div>
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Catégorie
                    </label>
                    <select
                    value={formData.category}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value
                    })
                    }
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange appearance-none">
                    
                      <option>Plomberie</option>
                      <option>Électricité</option>
                      <option>Menuiserie</option>
                      <option>Étanchéité</option>
                      <option>Maçonnerie</option>
                      <option>Autre</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Niveau de priorité
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label
                    className={`cursor-pointer border-2 rounded-xl p-4 flex items-start gap-3 transition-colors ${priority === 'normal' ? 'border-globus-blue bg-globus-blue/5' : 'border-gray-200 hover:border-gray-300'}`}>
                    
                      <input
                      type="radio"
                      name="priority"
                      value="normal"
                      checked={priority === 'normal'}
                      onChange={() => setPriority('normal')}
                      className="sr-only" />
                    
                      <ClockIcon
                      className={`w-5 h-5 shrink-0 mt-0.5 ${priority === 'normal' ? 'text-globus-blue' : 'text-gray-400'}`} />
                    
                      <div>
                        <p
                        className={`font-montserrat font-bold text-sm ${priority === 'normal' ? 'text-globus-blue-dark' : 'text-gray-600'}`}>
                        
                          Normal
                        </p>
                        <p className="font-opensans text-xs text-gray-500 mt-1">
                          Intervention sous 5 jours ouvrés
                        </p>
                      </div>
                    </label>
                    <label
                    className={`cursor-pointer border-2 rounded-xl p-4 flex items-start gap-3 transition-colors ${priority === 'urgent' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    
                      <input
                      type="radio"
                      name="priority"
                      value="urgent"
                      checked={priority === 'urgent'}
                      onChange={() => setPriority('urgent')}
                      className="sr-only" />
                    
                      <AlertTriangleIcon
                      className={`w-5 h-5 shrink-0 mt-0.5 ${priority === 'urgent' ? 'text-red-500' : 'text-gray-400'}`} />
                    
                      <div>
                        <p
                        className={`font-montserrat font-bold text-sm ${priority === 'urgent' ? 'text-red-600' : 'text-gray-600'}`}>
                        
                          Urgent
                        </p>
                        <p className="font-opensans text-xs text-gray-500 mt-1">
                          Intervention sous 24-48h (fuite majeure, panne
                          électrique totale)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Description détaillée
                  </label>
                  <textarea
                  required
                  value={formData.desc}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    desc: e.target.value
                  })
                  }
                  rows={4}
                  placeholder="Décrivez le problème constaté..."
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans focus:outline-none focus:border-globus-orange resize-none">
                </textarea>
                </div>

                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Photos (Optionnel)
                  </label>
                  <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept="image/*"
                  className="hidden" />
                
                  <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer mb-4">
                  
                    <UploadCloudIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="font-opensans text-sm text-globus-gray">
                      Cliquez ou glissez vos photos ici
                    </p>
                  </div>

                  {uploadedFiles.length > 0 &&
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {uploadedFiles.map((file, idx) =>
                  <div
                    key={idx}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-2 flex items-center justify-between group">
                    
                          <div className="flex items-center gap-2 overflow-hidden">
                            <ImageIcon className="w-4 h-4 text-globus-blue shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-semibold text-gray-700 truncate">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {file.size}
                              </p>
                            </div>
                          </div>
                          <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="text-gray-400 hover:text-red-500 shrink-0">
                      
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                  )}
                    </div>
                }
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-6 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={submitState === 'processing'}
                  className="bg-globus-blue hover:bg-globus-blue/90 disabled:opacity-70 text-white font-montserrat font-bold py-2.5 px-8 rounded-lg transition-colors shadow-md flex items-center gap-2">
                  
                    {submitState === 'processing' &&
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                  }
                    {submitState === 'processing' ?
                  'Envoi...' :
                  'Soumettre le ticket'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Tickets List */}
      <div className="space-y-4">
        {tickets.length === 0 &&
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-globus-gray font-opensans text-sm">
            Aucune demande SAV pour le moment. Créez un ticket si vous rencontrez un problème.
          </div>
        }
        {tickets.map((ticket) =>
        <div
          key={ticket.id}
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          
            <div
            onClick={() =>
            setExpandedTicket(
              expandedTicket === ticket.id ? null : ticket.id
            )
            }
            className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors">
            
              <div className="flex items-center gap-4">
                <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${ticket.status === 'résolu' ? 'bg-green-100 text-green-600' : ticket.status === 'en-cours' ? 'bg-globus-orange/10 text-globus-orange' : 'bg-blue-100 text-blue-600'}`}>
                
                  {ticket.status === 'résolu' ?
                <CheckCircle2Icon className="w-5 h-5" /> :
                ticket.status === 'en-cours' ?
                <ClockIcon className="w-5 h-5" /> :

                <AlertTriangleIcon className="w-5 h-5" />
                }
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-gray-400">
                      #{ticket.id}
                    </span>
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      {ticket.title}
                    </h3>
                  </div>
                  <p className="font-opensans text-xs text-globus-gray">
                    {ticket.category} • Déclaré le {ticket.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                <span
                className={`px-3 py-1 rounded-full text-xs font-bold font-montserrat ${ticket.status === 'résolu' ? 'bg-green-100 text-green-700' : ticket.status === 'en-cours' ? 'bg-globus-orange/10 text-globus-orange' : 'bg-blue-100 text-blue-700'}`}>
                
                  {ticket.status.toUpperCase()}
                </span>
                <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedTicket === ticket.id ? 'rotate-180' : ''}`} />
              
              </div>
            </div>

            <AnimatePresence>
              {expandedTicket === ticket.id &&
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
              
                  <div className="p-5 bg-gray-50 border-t border-gray-100 font-opensans text-sm text-globus-gray">
                    <p className="mb-4">
                      <strong>Description :</strong> {ticket.desc}
                    </p>

                    <div className="relative pl-4 border-l-2 border-gray-200 space-y-4 mt-6">
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-gray-300"></div>
                        <p className="font-semibold text-globus-blue-dark text-xs">
                          {ticket.date}
                        </p>
                        <p>Ticket ouvert.</p>
                      </div>
                      {ticket.status === 'résolu' && ticket.resolvedDate &&
                  <div className="relative">
                          <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-green-500"></div>
                          <p className="font-semibold text-globus-blue-dark text-xs">
                            {ticket.resolvedDate}
                          </p>
                          <p>Ticket résolu.</p>
                        </div>
                  }
                    </div>

                    {/* Satisfaction Rating for Resolved Tickets */}
                    {ticket.status === 'résolu' &&
                <div className="mt-8 pt-6 border-t border-gray-200">
                        {ticket.rating ?
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                            <p className="font-montserrat font-bold text-green-800 mb-2">
                              Merci pour votre évaluation !
                            </p>
                            <div className="flex justify-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) =>
                      <StarIcon
                        key={star}
                        className={`w-5 h-5 ${star <= ticket.rating! ? 'text-globus-orange fill-globus-orange' : 'text-gray-300'}`} />

                      )}
                            </div>
                          </div> :

                  <div>
                            <h4 className="font-montserrat font-bold text-globus-blue-dark mb-3">
                              Évaluer cette intervention
                            </h4>
                            <div className="flex gap-2 mb-4">
                              {[1, 2, 3, 4, 5].map((star) =>
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="focus:outline-none transition-transform hover:scale-110">
                        
                                  <StarIcon
                          className={`w-8 h-8 ${rating >= star ? 'text-globus-orange fill-globus-orange' : 'text-gray-300'}`} />
                        
                                </button>
                      )}
                            </div>
                            <textarea
                      placeholder="Votre avis nous aide à nous améliorer (optionnel)..."
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange resize-none mb-3"
                      rows={2}>
                    </textarea>
                            <button
                      onClick={() => handleRatingSubmit(ticket.id)}
                      disabled={
                      rating === 0 || ratingState === 'processing'
                      }
                      className="bg-globus-blue hover:bg-globus-blue/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-montserrat font-bold py-2 px-6 rounded-lg transition-colors shadow-sm text-sm flex items-center gap-2">
                      
                              {ratingState === 'processing' &&
                      <LoaderIcon className="w-4 h-4 animate-spin" />
                      }
                              Envoyer mon avis
                            </button>
                          </div>
                  }
                      </div>
                }
                  </div>
                </motion.div>
            }
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {submitState === 'success' &&
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
              scale: 0.95
            }}
            animate={{
              scale: 1
            }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2Icon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                Ticket SAV créé avec succès
              </h3>
              <p className="font-opensans text-gray-600 mb-2">
                Votre demande a bien été enregistrée sous la référence :
              </p>
              <p className="font-mono font-bold text-lg text-globus-blue mb-6">
                {newTicketId}
              </p>
              <p className="font-opensans text-sm text-gray-500 mb-6">
                Notre équipe technique vous contactera sous 24-48h pour
                planifier une intervention.
              </p>
              <button
              onClick={handleCloseSuccess}
              className="w-full bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-3 rounded-xl transition-colors">
              
                Fermer
              </button>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMessage &&
        <motion.div
          initial={{
            opacity: 0,
            x: 50
          }}
          animate={{
            opacity: 1,
            x: 0
          }}
          exit={{
            opacity: 0,
            x: 50
          }}
          className="fixed top-24 right-6 z-50 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg font-montserrat font-bold text-sm flex items-center gap-2">
          
            <CheckCircle2Icon className="w-5 h-5 text-green-500" />
            {toastMessage}
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}