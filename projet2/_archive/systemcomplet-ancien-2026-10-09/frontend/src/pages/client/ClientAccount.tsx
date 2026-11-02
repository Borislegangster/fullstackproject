import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserIcon,
  ShieldCheckIcon,
  SaveIcon,
  BellIcon,
  CheckCircle2Icon,
  LoaderIcon,
  CameraIcon,
  UsersIcon,
  PlusIcon,
  Trash2Icon,
  MailIcon,
  XIcon } from
'lucide-react';
import { useClientUser } from '../../hooks/useClientUser';
import { useClientGuests, useInviteClientGuest, useRemoveClientGuest } from '../../hooks/useClient';
import { updateProfileApi, changePasswordApi } from '../../services/api/auth.api';
import { userPrefsApi } from '../../services/api/erp.api';
import { TwoFactorPanel } from '../../components/auth/TwoFactorPanel';
import { SessionsPanel } from '../../components/auth/SessionsPanel';
export function ClientAccount() {
  const clientUser = useClientUser();
  // Family / guest access — real data from /client/guests.
  const { data: guestsData } = useClientGuests();
  const guests = Array.isArray(guestsData) ? guestsData : [];
  const inviteGuestMutation = useInviteClientGuest();
  const removeGuestMutation = useRemoveClientGuest();
  const [removingGuestId, setRemovingGuestId] = useState<string | null>(null);
  // Notification prefs are loaded from /me/preferences — no hardcoded defaults.
  const [notifs, setNotifs] = useState({
    chantier: { email: false, sms: false, push: false },
    finances: { email: false, sms: false, push: false },
    docs: { email: false, sms: false, push: false },
    messages: { email: false, sms: false, push: false }
  });
  // Raw per-channel dicts from the API (preserves categories not shown here, e.g. sav/qhse).
  const rawPrefsRef = useRef<{ notif_email: any; notif_sms: any; notif_push: any }>({
    notif_email: {}, notif_sms: {}, notif_push: {}
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
  const [inviteState, setInviteState] = useState<'idle' | 'sending' | 'success'>('idle');
  const [inviteData, setInviteData] = useState<{ email: string; name: string; role: 'READ_ONLY' | 'EDIT' }>({
    email: '', name: '', role: 'READ_ONLY'
  });
  // UI category id → API category key (the API uses 'documents', the UI uses 'docs').
  const CAT_MAP: Record<string, string> = {
    chantier: 'chantier', finances: 'finances', docs: 'documents', messages: 'messages'
  };
  // Load real notification preferences from the API on mount.
  useEffect(() => {
    let mounted = true;
    userPrefsApi.get().then((p: any) => {
      if (!mounted || !p) return;
      rawPrefsRef.current = {
        notif_email: p.notif_email || {},
        notif_sms: p.notif_sms || {},
        notif_push: p.notif_push || {}
      };
      const read = (
      channel: 'notif_email' | 'notif_sms' | 'notif_push',
      uiCat: string) =>
      !!(p[channel] || {})[CAT_MAP[uiCat]];
      setNotifs({
        chantier: { email: read('notif_email', 'chantier'), sms: read('notif_sms', 'chantier'), push: read('notif_push', 'chantier') },
        finances: { email: read('notif_email', 'finances'), sms: read('notif_sms', 'finances'), push: read('notif_push', 'finances') },
        docs: { email: read('notif_email', 'docs'), sms: read('notif_sms', 'docs'), push: read('notif_push', 'docs') },
        messages: { email: read('notif_email', 'messages'), sms: read('notif_sms', 'messages'), push: read('notif_push', 'messages') }
      });
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  // Persist the full per-channel dicts (merging preserved categories like sav/qhse).
  const persistNotifs = async (next: typeof notifs) => {
    const raw = rawPrefsRef.current;
    const build = (channel: 'email' | 'sms' | 'push') => ({
      ...(raw[`notif_${channel}` as 'notif_email' | 'notif_sms' | 'notif_push'] || {}),
      chantier: next.chantier[channel],
      finances: next.finances[channel],
      documents: next.docs[channel],
      messages: next.messages[channel]
    });
    const payload = {
      notif_email: build('email'),
      notif_sms: build('sms'),
      notif_push: build('push')
    };
    rawPrefsRef.current = payload;
    try {
      await userPrefsApi.update(payload);
      showToast('Préférences enregistrées');
    } catch {
      showToast('Erreur lors de la sauvegarde des préférences');
    }
  };
  const toggleNotif = (
  category: keyof typeof notifs,
  type: 'email' | 'sms' | 'push') =>
  {
    setNotifs((prev) => {
      const next = {
        ...prev,
        [category]: { ...prev[category], [type]: !prev[category][type] }
      };
      void persistNotifs(next);
      return next;
    });
  };
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    setSaveState('saving');
    try {
      const fullName = (form.elements.namedItem('name') as HTMLInputElement)?.value || '';
      const [first, ...rest] = fullName.split(' ');
      await updateProfileApi({
        first_name: first || fullName,
        last_name: rest.join(' '),
        phone: (form.elements.namedItem('phone') as HTMLInputElement)?.value || '',
      });
      showToast('Modifications enregistrées avec succès !');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur lors de la sauvegarde');
    } finally {
      setSaveState('idle');
    }
  };
  const handlePasswordChange = async (e: React.FormEvent) => {
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
    if (pwdData.new.length < 8) {
      setPwdError('Le nouveau mot de passe doit faire au moins 8 caractères.');
      return;
    }
    setPwdState('saving');
    try {
      await changePasswordApi({
        current_password: pwdData.current,
        new_password: pwdData.new,
      });
      setPwdState('success');
      setPwdData({ current: '', new: '', confirm: '' });
      setTimeout(() => setPwdState('idle'), 3000);
    } catch (err: any) {
      setPwdError(err?.response?.data?.detail || 'Erreur lors du changement de mot de passe');
      setPwdState('idle');
    }
  };
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingPhoto(true);
    // Real local preview of the chosen file — no mock image.
    setPhotoPreview(URL.createObjectURL(file));
    setIsUploadingPhoto(false);
    showToast('Photo sélectionnée');
  };
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteState('sending');
    try {
      await inviteGuestMutation.mutateAsync({
        email: inviteData.email,
        name: inviteData.name,
        role: inviteData.role,
      });
      setInviteState('success');
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteState('idle');
        setInviteData({ email: '', name: '', role: 'READ_ONLY' });
      }, 2500);
    } catch (err: any) {
      setInviteState('idle');
      showToast(err?.response?.data?.detail || "Erreur lors de l'envoi de l'invitation");
    }
  };
  const handleRemoveGuest = async (id: string) => {
    setRemovingGuestId(id);
    try {
      await removeGuestMutation.mutateAsync(id);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur lors du retrait');
    } finally {
      setRemovingGuestId(null);
    }
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
            <div className="p-6 space-y-6">
              <TwoFactorPanel />
              <SessionsPanel />
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

        </div>

        {/* Right Col: Family Access — real /client/guests */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
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
                {/* Account owner (real, from useClientUser) */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-xs shrink-0">
                    {clientUser.initials || '—'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-montserrat font-bold text-sm text-globus-blue-dark truncate">
                      {clientUser.name || '—'}
                    </p>
                    <p className="font-opensans text-xs text-globus-gray">Propriétaire</p>
                  </div>
                </div>

                {/* Real invited guests from /client/guests */}
                {guests.map((g) =>
                <div
                  key={g.id}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-globus-blue text-white flex items-center justify-center font-montserrat font-bold text-xs shrink-0">
                        {(g.name || g.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-montserrat font-bold text-sm text-globus-blue-dark truncate">
                          {g.name || g.email}
                        </p>
                        <p className="font-opensans text-xs text-globus-gray">
                          {g.role === 'EDIT' ? 'Modification' : 'Lecture seule'}
                          {g.status === 'PENDING' ? ' • Invitation envoyée' : ''}
                        </p>
                      </div>
                    </div>
                    <button
                    onClick={() => handleRemoveGuest(g.id)}
                    disabled={removingGuestId === g.id}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0">
                      {removingGuestId === g.id ?
                    <LoaderIcon className="w-4 h-4 animate-spin" /> :
                    <Trash2Icon className="w-4 h-4" />}
                    </button>
                  </div>
                )}
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

      {/* Invite Modal — real POST /client/guests */}
      <AnimatePresence>
        {isInviteModalOpen &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => inviteState === 'idle' && setIsInviteModalOpen(false)}>

            <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">

              <div className="bg-globus-blue-dark p-6 text-white flex items-center justify-between">
                <h3 className="font-montserrat font-bold text-xl">Inviter un membre</h3>
                <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors">
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {inviteState === 'success' ?
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2Icon className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                      Invitation enregistrée !
                    </h4>
                    <p className="font-opensans text-globus-gray">
                      {inviteData.email} a été ajouté(e) à vos accès.
                    </p>
                  </motion.div> :

              <form onSubmit={handleInvite} className="space-y-4">
                    <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                        Nom (optionnel)
                      </label>
                      <input
                    type="text"
                    value={inviteData.name}
                    onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                    </div>
                    <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                        Adresse E-mail
                      </label>
                      <input
                    required
                    type="email"
                    value={inviteData.email}
                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                    </div>
                    <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                        Niveau d'accès
                      </label>
                      <select
                    value={inviteData.role}
                    onChange={(e) => setInviteData({ ...inviteData, role: e.target.value as 'READ_ONLY' | 'EDIT' })}
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                        <option value="READ_ONLY">Lecture seule</option>
                        <option value="EDIT">Modification (Signature, Paiement)</option>
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
                    <MailIcon className="w-4 h-4" />}
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