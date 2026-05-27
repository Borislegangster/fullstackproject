import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SearchIcon,
  SendIcon,
  PaperclipIcon,
  CalendarIcon,
  VideoIcon,
  ClockIcon,
  XIcon,
  CheckCircle2Icon,
  PhoneIcon,
  MicIcon,
  MicOffIcon,
  CameraIcon,
  ImageIcon,
  MapPinIcon,
  FileIcon,
  LoaderIcon } from
'lucide-react';
import { useClientMessages, useSendClientMessage, useRequestAppointment } from '../../hooks/useClient';
const initialConversations = [
{
  id: 1,
  name: 'Ing. Paul Mbarga',
  role: 'Chef de projet',
  initial: 'PM',
  lastMsg: 'Les fondations sont terminées, nous attaquons...',
  time: '10:30',
  unread: 2,
  active: true
},
{
  id: 2,
  name: 'Support Globus',
  role: 'Assistance',
  initial: 'SG',
  lastMsg: 'Votre facture a bien été générée.',
  time: 'Hier',
  unread: 0,
  active: false
},
{
  id: 3,
  name: 'Mme. Claire Fotso',
  role: 'Architecte',
  initial: 'CF',
  lastMsg: 'Voici les options pour le carrelage.',
  time: 'Lun.',
  unread: 0,
  active: false
}];

const initialMessagesData: Record<number, any[]> = {
  1: [
  {
    id: 1,
    sender: 'them',
    text: "Bonjour M. Talla, j'espère que vous allez bien.",
    time: '10:15'
  },
  {
    id: 2,
    sender: 'them',
    text: "Je vous informe que le coulage des fondations s'est terminé hier avec succès.",
    time: '10:16'
  },
  {
    id: 3,
    sender: 'me',
    text: 'Bonjour Paul. Excellente nouvelle ! Avez-vous pu prendre quelques photos ?',
    time: '10:20'
  },
  {
    id: 4,
    sender: 'them',
    text: 'Oui tout à fait, je viens de les uploader dans l\'onglet "Suivi de Chantier".',
    time: '10:25'
  },
  {
    id: 5,
    sender: 'them',
    text: "Les fondations sont terminées, nous attaquons l'élévation des murs la semaine prochaine.",
    time: '10:30'
  }],

  2: [
  {
    id: 1,
    sender: 'them',
    text: "Bonjour, votre facture #3 a été générée et est disponible dans l'onglet Finances.",
    time: 'Hier 14:00'
  },
  {
    id: 2,
    sender: 'me',
    text: 'Merci, je la télécharge de suite.',
    time: 'Hier 14:30'
  },
  {
    id: 3,
    sender: 'them',
    text: "N'hésitez pas si vous avez des questions concernant le règlement.",
    time: 'Hier 14:35'
  }],

  3: [
  {
    id: 1,
    sender: 'them',
    text: "Bonjour M. Talla, voici les 3 options pour le carrelage du salon disponibles dans l'onglet Documents > Validations.",
    time: 'Lun. 09:00'
  },
  {
    id: 2,
    sender: 'me',
    text: 'Merci Claire, je vais étudier ça ce week-end avec mon épouse.',
    time: 'Lun. 10:15'
  },
  {
    id: 3,
    sender: 'them',
    text: 'Parfait, prenez votre temps. La deadline pour la commande est le 30 août.',
    time: 'Lun. 10:30'
  }]

};
export function ClientMessages() {
  const { data: apiMessagesData } = useClientMessages();
  const sendMessageMutation = useSendClientMessage();
  const requestAppointmentMutation = useRequestAppointment();

  const [activeConvId, setActiveConvId] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messagesData, setMessagesData] = useState(initialMessagesData);
  const [conversations, setConversations] = useState(initialConversations);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Attachment State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<{
    name: string;
    type: string;
  } | null>(null);
  // Modals State
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentSuccess, setAppointmentSuccess] = useState(false);
  const [zoomState, setZoomState] = useState<
    'idle' | 'connecting' | 'connected'>(
    'idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
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
    const newMessage = {
      id: Date.now(),
      sender: 'me',
      text: messageInput.trim(),
      time: new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      attachment: attachment
    };
    setMessagesData((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), newMessage]
    }));
    // Update conversation last message
    setConversations((prev) =>
    prev.map((c) =>
    c.id === activeConvId ?
    {
      ...c,
      lastMsg: attachment ?
      `Fichier: ${attachment.name}` :
      newMessage.text,
      time: newMessage.time
    } :
    c
    )
    );
    setMessageInput('');
    setAttachment(null);
    // Simulate reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const replyMessage = {
        id: Date.now() + 1,
        sender: 'them',
        text: "C'est bien noté. Je m'en occupe rapidement.",
        time: new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      };
      setMessagesData((prev) => ({
        ...prev,
        [activeConvId]: [...(prev[activeConvId] || []), replyMessage]
      }));
      setConversations((prev) =>
      prev.map((c) =>
      c.id === activeConvId ?
      {
        ...c,
        lastMsg: replyMessage.text,
        time: replyMessage.time
      } :
      c
      )
      );
    }, 2000);
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
  const handleAppointmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppointmentSuccess(true);
    setTimeout(() => {
      setIsAppointmentModalOpen(false);
      setAppointmentSuccess(false);
    }, 3000);
  };
  const handleJoinZoom = () => {
    setZoomState('connecting');
    setTimeout(() => {
      setZoomState('connected');
    }, 2000);
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
                // Mark as read
                setConversations((prev) =>
                prev.map((c) =>
                c.id === conv.id ?
                {
                  ...c,
                  unread: 0
                } :
                c
                )
                );
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

          <div className="bg-globus-light rounded-xl p-4 border border-gray-200 mb-4">
            <p className="font-montserrat font-bold text-sm text-globus-blue-dark mb-1">
              Prochaine visite de chantier
            </p>
            <div className="flex items-center gap-2 text-sm text-globus-gray font-opensans mb-3">
              <ClockIcon className="w-4 h-4" /> 15 Août 2024 à 10h00
            </div>
            <button
              onClick={handleJoinZoom}
              className="w-full bg-blue-50 hover:bg-blue-100 text-globus-blue font-semibold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
              
              <VideoIcon className="w-4 h-4" /> Rejoindre sur Zoom
            </button>
          </div>

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
              onChange={(e) => setMessageInput(e.target.value)}
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
                      type="date"
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                    
                      </div>
                      <div>
                        <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                          Heure préférée
                        </label>
                        <select
                      required
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

      {/* Zoom Simulation Modal */}
      <AnimatePresence>
        {zoomState !== 'idle' &&
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
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          
            {zoomState === 'connecting' ?
          <div className="text-center text-white">
                <LoaderIcon className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-6" />
                <h3 className="font-montserrat font-bold text-2xl mb-2">
                  Connexion à la visioconférence...
                </h3>
                <p className="font-opensans text-gray-400">
                  Veuillez patienter
                </p>
              </div> :

          <motion.div
            initial={{
              scale: 0.95,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            className="w-full max-w-5xl aspect-video bg-gray-900 rounded-2xl overflow-hidden relative shadow-2xl border border-gray-800 flex flex-col">
            
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg text-white flex items-center gap-2 z-10">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="font-montserrat font-bold text-sm">
                    Point d'avancement mensuel
                  </span>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-2 p-2">
                  <div className="bg-gray-800 rounded-xl relative overflow-hidden flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-4xl">
                      PM
                    </div>
                    <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-white text-sm">
                      Ing. Paul Mbarga
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-xl relative overflow-hidden flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full bg-globus-orange text-white flex items-center justify-center font-montserrat font-bold text-4xl">
                      VO
                    </div>
                    <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-white text-sm">
                      Vous
                    </div>
                    {isVideoOff &&
                <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
                        <CameraIcon className="w-12 h-12 text-gray-500" />
                      </div>
                }
                  </div>
                </div>

                <div className="h-20 bg-gray-950 flex items-center justify-center gap-6">
                  <button
                onClick={() => setIsMuted(!isMuted)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
                
                    {isMuted ?
                <MicOffIcon className="w-5 h-5" /> :

                <MicIcon className="w-5 h-5" />
                }
                  </button>
                  <button
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
                
                    <VideoIcon className="w-5 h-5" />
                  </button>
                  <button
                onClick={() => setZoomState('idle')}
                className="px-6 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-lg">
                
                    Quitter
                  </button>
                </div>
              </motion.div>
          }
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}