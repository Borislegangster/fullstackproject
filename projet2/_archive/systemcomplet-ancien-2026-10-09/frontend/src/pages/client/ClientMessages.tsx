import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, SendIcon, PaperclipIcon, CalendarIcon, VideoIcon, ClockIcon, XIcon, CheckCircle2Icon, ImageIcon, MapPinIcon, FileIcon } from 'lucide-react';
import { useClientMessages, useSendClientMessage, useRequestAppointment, useClientProject, useClientProjectTimeline } from '../../hooks/useClient';
import { useMessagesLive } from '../../hooks/useMessagesLive';
import { useQuery } from '@tanstack/react-query';
import { formatTime, formatDateTimeParts } from '../../utils/datetime';
import { getSiteSettings } from '../../services/api/cms.api';
import { useAuth } from '../../context/AuthContext';

export function ClientMessages() {
  const { data: apiMessagesData } = useClientMessages();
  const { data: projectData } = useClientProject();
  const { data: timelineData } = useClientProjectTimeline();
  const projectId: string | null = projectData?.id || null;
  // Real next appointment (no hardcoded date).
  const nextAppointment = useMemo(() => {
    const appts = (timelineData as any)?.appointments;
    if (!Array.isArray(appts) || appts.length === 0) return null;
    const now = Date.now();
    const upcoming = appts
      .filter((a: any) => a.start_time && new Date(a.start_time).getTime() >= now)
      .sort(
        (a: any, b: any) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
    return upcoming[0] || null;
  }, [timelineData]);
  const { typingUsers, notifyTyping } = useMessagesLive({ projectId });
  const sendMessageMutation = useSendClientMessage();
  const requestAppointmentMutation = useRequestAppointment();
  const { user } = useAuth();
  const myId = user?.id || '';
  // Real company identity (CMS) for the project-team thread label.
  const { data: settings } = useQuery({
    queryKey: ['site-settings'],
    queryFn: getSiteSettings,
    staleTime: 5 * 60 * 1000,
  });
  const teamName = (settings as any)?.companyName
    ? `Équipe ${(settings as any).companyName}`
    : 'Équipe projet';
  const teamInitial = ((settings as any)?.companyName || 'EP')
    .split(/\s+/)
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  // Real typing indicator driven by the live channel (no fake timer).
  const isTyping = typingUsers.size > 0;

  const [activeConvId, setActiveConvId] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Single project thread served by the backend, exposed as conv #1.
  // Built live from the real messages (no mock conversation list).
  const conversations = React.useMemo(() => {
    const msgs = Array.isArray(apiMessagesData) ? apiMessagesData : [];
    const last = msgs[msgs.length - 1];
    return [{
      id: 1,
      name: teamName,
      role: 'Suivi de projet',
      initial: teamInitial,
      lastMsg: last?.content || 'Démarrez la conversation avec votre équipe projet.',
      time: formatTime(last?.created_at),
      unread: 0,
      active: true,
    }];
  }, [apiMessagesData]);

  // Live messages from API (conv 1 = the user's primary project thread).
  const messagesData = React.useMemo(() => {
    const out: Record<number, any[]> = { 1: [] };
    if (Array.isArray(apiMessagesData)) {
      out[1] = apiMessagesData.map((m: any) => ({
        id: m.id,
        sender: m.is_system ? 'system' : (myId && m.sender_id === myId ? 'me' : 'them'),
        text: m.content || '',
        time: formatTime(m.created_at),
        attachment: m.attachment_url
          ? { name: decodeURIComponent(m.attachment_url.split('/').pop() || 'pièce-jointe'), type: 'file' }
          : undefined,
      }));
    }
    return out;
  }, [apiMessagesData, myId]);
  // Attachment State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<{
    name: string;
    type: string;
  } | null>(null);
  // Modals State
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentSuccess, setAppointmentSuccess] = useState(false);
  const activeConv =
  conversations.find((c) => c.id === activeConvId) || conversations[0];
  const activeMessages = messagesData[activeConvId] || [];
  const filteredConversations = conversations.filter(
    (c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMsg.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, isTyping]);
  const handleSendMessage = () => {
    if (!messageInput.trim() && !attachment) return;
    const content = messageInput.trim() || (attachment ? `Fichier: ${attachment.name}` : '');
    sendMessageMutation
      .mutate(content);
    setMessageInput('');
    setAttachment(null);
    notifyTyping(false);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAttachment({
        name: file.name,
        type: file.type.includes('image') ? 'img' : 'doc'
      });
    }
  };
  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const type = (form.elements.namedItem('rdv_type') as RadioNodeList | null)?.value || 'visite';
    const date = (form.elements.namedItem('date') as HTMLInputElement)?.value || '';
    const time = (form.elements.namedItem('time') as HTMLSelectElement)?.value || '';
    const subject = (form.elements.namedItem('subject') as HTMLInputElement)?.value || '';
    if (!date || !time) return;
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const label = type === 'visio' ? 'Visioconférence' : 'Visite de chantier';
    try {
      await requestAppointmentMutation.mutateAsync({
        title: subject || label,
        description: label,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      setAppointmentSuccess(true);
      setTimeout(() => {
        setIsAppointmentModalOpen(false);
        setAppointmentSuccess(false);
      }, 2500);
    } catch {
      /* keep the modal open on error */
    }
  };
  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 relative">
      {/* Left Panel: Conversations & Appointments */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6 h-full">
        {/* Conversations List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4">
              Messagerie
            </h2>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-globus-light border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm font-opensans focus:outline-none focus:border-globus-orange" />
              
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length > 0 ?
            filteredConversations.map((conv) =>
            <div
              key={conv.id}
              onClick={() => {
                setActiveConvId(conv.id);
                // Server-side read-state will be reflected on next polling refetch.
              }}
              className={`p-4 border-b border-gray-50 cursor-pointer transition-colors flex items-start gap-3 ${activeConvId === conv.id ? 'bg-globus-blue/5 border-l-4 border-l-globus-blue' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}>
              
                  <div className="w-10 h-10 rounded-full bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-sm shrink-0">
                    {conv.initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark truncate">
                        {conv.name}
                      </h4>
                      <span className="text-xs text-gray-400 shrink-0">
                        {conv.time}
                      </span>
                    </div>
                    <p className="text-xs text-globus-orange font-semibold mb-1">
                      {conv.role}
                    </p>
                    <p
                  className={`text-sm truncate font-opensans ${conv.unread > 0 ? 'text-globus-blue-dark font-semibold' : 'text-globus-gray'}`}>
                  
                      {conv.lastMsg}
                    </p>
                  </div>
                  {conv.unread > 0 &&
              <div className="w-5 h-5 rounded-full bg-globus-orange text-white flex items-center justify-center text-xs font-bold shrink-0 mt-4">
                      {conv.unread}
                    </div>
              }
                </div>
            ) :

            <div className="p-8 text-center text-gray-500 font-opensans text-sm">
                Aucune conversation trouvée.
              </div>
            }
          </div>
        </div>

        {/* Appointments Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 shrink-0">
          <h3 className="font-montserrat font-bold text-globus-blue-dark mb-4 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-globus-orange" /> Réunions
          </h3>

          {nextAppointment ?
          <div className="bg-globus-light rounded-xl p-4 border border-gray-200 mb-4">
            <p className="font-montserrat font-bold text-sm text-globus-blue-dark mb-1">
              {nextAppointment.title || 'Prochaine visite de chantier'}
            </p>
            <div className="flex items-center gap-2 text-sm text-globus-gray font-opensans mb-1">
              <ClockIcon className="w-4 h-4" />
              {formatDateTimeParts(nextAppointment.start_time, {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
            {nextAppointment.location &&
            <div className="flex items-center gap-2 text-sm text-globus-gray font-opensans">
              <MapPinIcon className="w-4 h-4" /> {nextAppointment.location}
            </div>
            }
          </div> :
          <p className="text-sm text-gray-400 italic mb-4">
            Aucune visite planifiée pour le moment.
          </p>
          }

          <button
            onClick={() => setIsAppointmentModalOpen(true)}
            className="w-full border border-globus-orange text-globus-orange hover:bg-globus-orange hover:text-white font-montserrat font-bold py-2 rounded-lg text-sm transition-colors">
            
            Planifier un rendez-vous
          </button>
        </div>
      </div>

      {/* Right Panel: Chat Area */}
      <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-white z-10">
          <div className="w-12 h-12 rounded-full bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-lg shrink-0">
            {activeConv.initial}
          </div>
          <div>
            <h2 className="font-montserrat font-bold text-lg text-globus-blue-dark">
              {activeConv.name}
            </h2>
            <p className="text-sm text-green-500 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> En
              ligne
            </p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 space-y-6 flex flex-col">
          <div className="text-center">
            <span className="bg-gray-200 text-gray-500 text-xs px-3 py-1 rounded-full font-opensans">
              Aujourd'hui
            </span>
          </div>

          {activeMessages.map((msg) =>
          <motion.div
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            key={msg.id}
            className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            
              <div
              className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${msg.sender === 'me' ? 'bg-globus-orange text-white rounded-tr-none' : 'bg-white border border-gray-100 text-globus-blue-dark rounded-tl-none'}`}>
              
                {msg.attachment &&
              <div
                className={`flex items-center gap-2 p-2 rounded-lg mb-2 ${msg.sender === 'me' ? 'bg-white/20' : 'bg-gray-100'}`}>
                
                    {msg.attachment.type === 'img' ?
                <ImageIcon className="w-5 h-5" /> :

                <FileIcon className="w-5 h-5" />
                }
                    <span className="text-sm font-semibold truncate">
                      {msg.attachment.name}
                    </span>
                  </div>
              }
                {msg.text &&
              <p className="font-opensans text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </p>
              }
                <p
                className={`text-[10px] mt-1 text-right ${msg.sender === 'me' ? 'text-white/70' : 'text-gray-400'}`}>
                
                  {msg.time}
                </p>
              </div>
            </motion.div>
          )}

          {/* Typing Indicator */}
          {isTyping &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            className="flex justify-start mt-auto pt-4">
            
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{
                  animationDelay: '0ms'
                }}>
              </span>
                <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{
                  animationDelay: '150ms'
                }}>
              </span>
                <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{
                  animationDelay: '300ms'
                }}>
              </span>
                <span className="text-xs text-gray-400 font-opensans ml-2 italic">
                  {activeConv.name.split(' ')[0]} écrit...
                </span>
              </div>
            </motion.div>
          }
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-100">
          {attachment &&
          <div className="mb-3 flex items-center gap-2">
              <div className="bg-blue-50 border border-blue-200 text-globus-blue px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                {attachment.type === 'img' ?
              <ImageIcon className="w-4 h-4" /> :

              <FileIcon className="w-4 h-4" />
              }
                <span className="truncate max-w-[200px]">
                  {attachment.name}
                </span>
                <button
                onClick={() => setAttachment(null)}
                className="hover:text-red-500 ml-1">
                
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          }
          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden" />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-400 hover:text-globus-blue transition-colors rounded-full hover:bg-gray-100 shrink-0">
              
              <PaperclipIcon className="w-5 h-5" />
            </button>
            <textarea
              rows={1}
              placeholder="Écrivez votre message..."
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                // Announce typing — emits TYPING_START. The server auto-expires after 4 s.
                if (e.target.value) notifyTyping(true);
                else notifyTyping(false);
              }}
              onBlur={() => notifyTyping(false)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-globus-light border border-gray-200 rounded-2xl px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange resize-none max-h-32">
            </textarea>
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() && !attachment}
              className="p-3 bg-globus-orange hover:bg-globus-orange-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full transition-colors shadow-md shrink-0">
              
              <SendIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Appointment Modal */}
      <AnimatePresence>
        {isAppointmentModalOpen &&
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
          onClick={() => setIsAppointmentModalOpen(false)}>
          
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
                  Planifier un rendez-vous
                </h3>
                <button
                onClick={() => setIsAppointmentModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 sm:p-8">
                {appointmentSuccess ?
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.9
                }}
                animate={{
                  opacity: 1,
                  scale: 1
                }}
                className="text-center py-8">
                
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2Icon className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                      Rendez-vous demandé !
                    </h4>
                    <p className="font-opensans text-globus-gray">
                      Votre chef de projet vous confirmera ce rendez-vous très
                      prochainement.
                    </p>
                  </motion.div> :

              <form
                onSubmit={handleAppointmentSubmit}
                className="space-y-5">
                
                    <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-3">
                        Type de rendez-vous
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                        type="radio"
                        name="rdv_type"
                        value="visite"
                        defaultChecked
                        className="w-4 h-4 text-globus-orange focus:ring-globus-orange" />
                      
                          <span className="ml-3 font-opensans text-sm text-gray-700 flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4 text-gray-400" />{' '}
                            Visite de chantier
                          </span>
                        </label>
                        <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                        type="radio"
                        name="rdv_type"
                        value="visio"
                        className="w-4 h-4 text-globus-orange focus:ring-globus-orange" />
                      
                          <span className="ml-3 font-opensans text-sm text-gray-700 flex items-center gap-2">
                            <VideoIcon className="w-4 h-4 text-gray-400" />{' '}
                            Visioconférence
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                          Date souhaitée
                        </label>
                        <input
                      required
                      name="date"
                      type="date"
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                    
                      </div>
                      <div>
                        <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                          Heure préférée
                        </label>
                        <select
                      required
                      name="time"
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">

                          <option value="">Sélectionner...</option>
                          <option value="09:00">09:00</option>
                          <option value="10:00">10:00</option>
                          <option value="14:00">14:00</option>
                          <option value="15:00">15:00</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                        Objet
                      </label>
                      <input
                    required
                    name="subject"
                    type="text"
                    placeholder="Ex: Point d'avancement"
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                  
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                    type="button"
                    onClick={() => setIsAppointmentModalOpen(false)}
                    className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                    
                        Annuler
                      </button>
                      <button
                    type="submit"
                    className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm">
                    
                        Envoyer la demande
                      </button>
                    </div>
                  </form>
              }
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

    </div>);

}