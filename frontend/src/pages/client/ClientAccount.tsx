import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserIcon,
  ShieldCheckIcon,
  UsersIcon,
  SaveIcon,
  Trash2Icon,
  PlusIcon,
  BellIcon,
  MonitorIcon,
  SmartphoneIcon,
  LaptopIcon,
  XIcon,
  CheckCircle2Icon,
  LoaderIcon,
  MailIcon,
  CameraIcon } from
'lucide-react';
import { useClientUser } from '../../hooks/useClientUser';
import { useClientProfile } from '../../hooks/useClient';
export function ClientAccount() {
  const { data: apiProfileData } = useClientProfile();
  const clientUser = useClientUser();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [notifs, setNotifs] = useState({
    chantier: {
      email: true,
      sms: true,
      push: true
    },
    finances: {
      email: true,
      sms: true,
      push: false
    },
    docs: {
      email: true,
      sms: false,
      push: false
    },
    messages: {
      email: false,
      sms: false,
      push: true
    }
  });
  // Toast State
  const [toastMessage, setToastMessage] = useState('');
  // Profile Save State
  const [saveState, setSaveState] = useState<'idle' | 'saving'>('idle');
  // Password State
  const [pwdState, setPwdState] = useState<'idle' | 'saving' | 'success'>(
    'idle'
  );
  const [pwdData, setPwdData] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [pwdError, setPwdError] = useState('');
  // Photo Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteState, setInviteState] = useState<
    'idle' | 'sending' | 'success'>(
    'idle');
  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'Lecture seule'
  });
  const toggleNotif = (
  category: keyof typeof notifs,
  type: 'email' | 'sms' | 'push') =>
  {
    setNotifs((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: !prev[category][type]
      }
    }));
  };
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveState('saving');
    setTimeout(() => {
      setSaveState('idle');
      showToast('Modifications enregistrées avec succès !');
    }, 2000);
  };
  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (!pwdData.current || !pwdData.new || !pwdData.confirm) {
      setPwdError('Veuillez remplir tous les champs.');
      return;
    }
    if (pwdData.new !== pwdData.confirm) {
      setPwdError('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setPwdState('saving');
    setTimeout(() => {
      setPwdState('success');
      setPwdData({
        current: '',
        new: '',
        confirm: ''
      });
    }, 2000);
  };
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploadingPhoto(true);
      setTimeout(() => {
        setIsUploadingPhoto(false);
        setPhotoPreview(
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&q=80'
        );
        showToast('Photo de profil mise à jour !');
      }, 2000);
    }
  };
  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteState('sending');
    setTimeout(() => {
      setInviteState('success');
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteState('idle');
        setInviteData({
          email: '',
          role: 'Lecture seule'
        });
      }, 3000);
    }, 2000);
  };
  return (
    <div className="max-w-5xl mx-auto space-y-8 relative pb-20">
      <motion.h1
        initial={{
          opacity: 0,
          y: -10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="font-montserrat font-extrabold text-3xl text-globus-blue-dark">
        
        Mon Compte
      </motion.h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Profile & Security */}
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Form */}
          <motion.div
            initial={{
              opacity: 0,
              y: 20
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <UserIcon className="w-6 h-6 text-globus-blue-dark" />
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                Informations Personnelles
              </h2>
            </div>
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-globus-orange text-white flex items-center justify-center font-montserrat font-bold text-3xl shadow-md overflow-hidden">
                    {isUploadingPhoto ?
                    <LoaderIcon className="w-8 h-8 animate-spin" /> :
                    photoPreview ?
                    <img
                      src={photoPreview}
                      alt="Profile"
                      className="w-full h-full object-cover" /> :


                    clientUser.initials
                    }
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="hidden" />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full shadow-md border border-gray-200 text-globus-blue hover:text-globus-orange transition-colors">
                    
                    <CameraIcon className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-montserrat font-bold text-globus-blue hover:underline">
                    
                    Modifier la photo
                  </button>
                  <p className="text-xs text-globus-gray font-opensans mt-1">
                    JPG, GIF ou PNG. Max 2MB.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Nom Complet
                    </label>
                    <input
                      type="text"
                      defaultValue={clientUser.name}
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange" />
                    
                  </div>
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      defaultValue={clientUser.phone}
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange" />
                    
                  </div>
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Adresse E-mail
                  </label>
                  <input
                    type="email"
                    defaultValue={clientUser.email}
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-gray-500 cursor-not-allowed"
                    disabled />
                  
                  <p className="text-xs text-globus-gray mt-1">
                    L'adresse email ne peut être modifiée que par le support.
                  </p>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={saveState === 'saving'}
                    className="bg-globus-orange hover:bg-globus-orange-hover disabled:opacity-70 text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md flex items-center gap-2">
                    
                    {saveState === 'saving' ?
                    <LoaderIcon className="w-4 h-4 animate-spin" /> :

                    <SaveIcon className="w-4 h-4" />
                    }
                    {saveState === 'saving' ?
                    'Enregistrement...' :
                    'Enregistrer les modifications'}
                  </button>
                </div>
              </form>

              <div className="pt-8 mt-8 border-t border-gray-100">
                <h3 className="font-montserrat font-bold text-md text-globus-blue-dark mb-4">
                  Changer le mot de passe
                </h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <input
                    type="password"
                    placeholder="Mot de passe actuel"
                    value={pwdData.current}
                    onChange={(e) =>
                    setPwdData({
                      ...pwdData,
                      current: e.target.value
                    })
                    }
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="password"
                      placeholder="Nouveau mot de passe"
                      value={pwdData.new}
                      onChange={(e) =>
                      setPwdData({
                        ...pwdData,
                        new: e.target.value
                      })
                      }
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange" />
                    
                    <input
                      type="password"
                      placeholder="Confirmer le mot de passe"
                      value={pwdData.confirm}
                      onChange={(e) =>
                      setPwdData({
                        ...pwdData,
                        confirm: e.target.value
                      })
                      }
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange" />
                    
                  </div>
                  {pwdError &&
                  <p className="text-red-500 text-sm font-opensans">
                      {pwdError}
                    </p>
                  }
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={pwdState === 'saving'}
                      className="bg-globus-blue hover:bg-globus-blue-dark disabled:opacity-70 text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md flex items-center gap-2 text-sm">
                      
                      {pwdState === 'saving' ?
                      <LoaderIcon className="w-4 h-4 animate-spin" /> :

                      <ShieldCheckIcon className="w-4 h-4" />
                      }
                      Mettre à jour le mot de passe
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>

          {/* Security */}
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
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <ShieldCheckIcon className="w-6 h-6 text-globus-blue-dark" />
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                Sécurité
              </h2>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div>
                <h3 className="font-montserrat font-bold text-globus-blue-dark mb-1">
                  Authentification à deux facteurs (2FA)
                </h3>
                <p className="font-opensans text-sm text-globus-gray max-w-md">
                  Protégez votre compte avec un code de vérification
                  supplémentaire envoyé par SMS lors de la connexion.
                </p>
                <span
                  className={`inline-block mt-2 text-xs font-bold px-2.5 py-1 rounded-full ${is2FAEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  
                  {is2FAEnabled ? 'Activé' : 'Non activé'}
                </span>
              </div>
              <button
                onClick={() => {
                  setIs2FAEnabled(!is2FAEnabled);
                  showToast(
                    is2FAEnabled ? '2FA désactivé' : '2FA activé avec succès'
                  );
                }}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${is2FAEnabled ? 'bg-globus-orange' : 'bg-gray-300'}`}>
                
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${is2FAEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                
              </button>
            </div>
          </motion.div>

          {/* Notification Preferences */}
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
              delay: 0.15
            }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <BellIcon className="w-6 h-6 text-globus-blue-dark" />
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                Préférences de Notifications
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {[
                {
                  id: 'chantier',
                  label: 'Mises à jour du chantier'
                },
                {
                  id: 'finances',
                  label: 'Appels de fonds et paiements'
                },
                {
                  id: 'docs',
                  label: 'Nouveaux documents'
                },
                {
                  id: 'messages',
                  label: 'Messages'
                }].
                map((item) =>
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-50 last:border-0 last:pb-0">
                  
                    <span className="font-montserrat font-semibold text-sm text-globus-blue-dark">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-4">
                      {(['email', 'sms', 'push'] as const).map((type) => {
                      const isActive =
                      notifs[item.id as keyof typeof notifs][type];
                      return (
                        <button
                          key={type}
                          onClick={() =>
                          toggleNotif(item.id as keyof typeof notifs, type)
                          }
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${isActive ? 'bg-globus-blue/10 text-globus-blue' : 'bg-gray-100 text-gray-400'}`}>
                          
                            <div
                            className={`w-2 h-2 rounded-full ${isActive ? 'bg-globus-blue' : 'bg-gray-300'}`}>
                          </div>
                            {type.toUpperCase()}
                          </button>);

                    })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Session History */}
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
              delay: 0.2
            }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <MonitorIcon className="w-6 h-6 text-globus-blue-dark" />
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                Dernières Connexions
              </h2>
            </div>
            <div className="p-0">
              <div className="divide-y divide-gray-100">
                {[
                {
                  id: 1,
                  device: 'Chrome sur Windows',
                  location: 'Paris, France',
                  time: "Aujourd'hui 14:30",
                  active: true,
                  icon: LaptopIcon
                },
                {
                  id: 2,
                  device: 'Safari sur iPhone',
                  location: 'Douala, Cameroun',
                  time: 'Hier 09:15',
                  active: false,
                  icon: SmartphoneIcon
                },
                {
                  id: 3,
                  device: 'Chrome sur MacBook',
                  location: 'Paris, France',
                  time: '20/07/2024 18:00',
                  active: false,
                  icon: LaptopIcon
                }].
                map((session) => {
                  const Icon = session.icon;
                  return (
                    <div
                      key={session.id}
                      className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${session.active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-montserrat font-bold text-sm text-globus-blue-dark flex items-center gap-2">
                            {session.device}
                            {session.active &&
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                                Active
                              </span>
                            }
                          </p>
                          <p className="font-opensans text-xs text-globus-gray">
                            {session.location} • {session.time}
                          </p>
                        </div>
                      </div>
                    </div>);

                })}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Col: Family Access */}
        <div className="lg:col-span-1">
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
              delay: 0.2
            }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-24">
            
            <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-globus-light">
              <UsersIcon className="w-6 h-6 text-globus-blue-dark" />
              <h2 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                Accès Famille & Invités
              </h2>
            </div>
            <div className="p-6">
              <p className="font-opensans text-sm text-globus-gray mb-6">
                Invitez votre conjoint, associé ou investisseur à consulter
                l'avancement du projet.
              </p>

              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-xs shrink-0">
                      MT
                    </div>
                    <div>
                      <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                        Marie Talla
                      </p>
                      <p className="font-opensans text-xs text-globus-gray">
                        Lecture seule
                      </p>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2Icon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="w-full border-2 border-dashed border-gray-300 hover:border-globus-orange hover:text-globus-orange text-globus-gray font-montserrat font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                
                <PlusIcon className="w-4 h-4" /> Inviter un membre
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Success Toasts */}
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

      {/* Password Success Modal */}
      <AnimatePresence>
        {pwdState === 'success' &&
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
                Mot de passe modifié !
              </h3>
              <p className="font-opensans text-gray-600 mb-6">
                Votre mot de passe a été mis à jour avec succès. Vous serez
                déconnecté pour des raisons de sécurité.
              </p>
              <button
              onClick={() => setPwdState('idle')}
              className="w-full bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-3 rounded-xl transition-colors">
              
                OK, j'ai compris
              </button>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen &&
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
          onClick={() =>
          inviteState === 'idle' && setIsInviteModalOpen(false)
          }>
          
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
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            
              <div className="bg-globus-blue-dark p-6 text-white flex items-center justify-between">
                <h3 className="font-montserrat font-bold text-xl">
                  Inviter un membre
                </h3>
                <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {inviteState === 'success' ?
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.9
                }}
                animate={{
                  opacity: 1,
                  scale: 1
                }}
                className="text-center py-6">
                
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2Icon className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                      Invitation envoyée !
                    </h4>
                    <p className="font-opensans text-globus-gray">
                      Un email a été envoyé à {inviteData.email} avec les
                      instructions de connexion.
                    </p>
                  </motion.div> :

              <form onSubmit={handleInvite} className="space-y-4">
                    <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                        Adresse E-mail
                      </label>
                      <input
                    required
                    type="email"
                    value={inviteData.email}
                    onChange={(e) =>
                    setInviteData({
                      ...inviteData,
                      email: e.target.value
                    })
                    }
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                  
                    </div>
                    <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                        Niveau d'accès
                      </label>
                      <select
                    value={inviteData.role}
                    onChange={(e) =>
                    setInviteData({
                      ...inviteData,
                      role: e.target.value
                    })
                    }
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                    
                        <option>Lecture seule</option>
                        <option>Modification (Signature, Paiement)</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                    
                        Annuler
                      </button>
                      <button
                    type="submit"
                    disabled={inviteState === 'sending'}
                    className="bg-globus-orange hover:bg-globus-orange-hover disabled:opacity-70 text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2">
                    
                        {inviteState === 'sending' ?
                    <LoaderIcon className="w-4 h-4 animate-spin" /> :

                    <MailIcon className="w-4 h-4" />
                    }
                        Envoyer l'invitation
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