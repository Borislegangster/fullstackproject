import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, HomeIcon,
  BuildingIcon, CrownIcon, GlobeIcon, MapPinIcon, WalletIcon,
  PaletteIcon, SendIcon, Loader2Icon,
} from 'lucide-react';
import { axiosClient as api } from '../../services/api/axiosClient';

const STEPS = [
  { id: 1, label: 'Votre projet', icon: HomeIcon },
  { id: 2, label: 'Budget & délais', icon: WalletIcon },
  { id: 3, label: 'Besoins détaillés', icon: PaletteIcon },
  { id: 4, label: 'Vos coordonnées', icon: SendIcon },
];

const PROJECT_TYPES = [
  { value: 'construction_neuve', label: 'Construction neuve' },
  { value: 'renovation', label: 'Rénovation' },
  { value: 'extension', label: 'Extension' },
  { value: 'amenagement', label: 'Aménagement intérieur' },
];

const UNIVERSES = [
  { value: 'HOME', label: 'GLOBUS HOME', desc: 'Particuliers', icon: HomeIcon },
  { value: 'BUSINESS', label: 'GLOBUS BUSINESS', desc: 'Entreprises', icon: BuildingIcon },
  { value: 'PREMIUM', label: 'GLOBUS PREMIUM', desc: 'Haut de gamme', icon: CrownIcon },
  { value: 'DIASPORA', label: 'GLOBUS DIASPORA', desc: 'Depuis l\'étranger', icon: GlobeIcon },
];

const BUDGET_RANGES = [
  '10 - 25 millions FCFA',
  '25 - 50 millions FCFA',
  '50 - 100 millions FCFA',
  '100 - 250 millions FCFA',
  '250 - 500 millions FCFA',
  '500+ millions FCFA',
];

const SPECIAL_FEATURES = [
  'Piscine', 'Garage', 'Jardin', 'Terrasse', 'Ascenseur',
  'Domotique', 'Panneaux solaires', 'Récupération eau de pluie',
  'Clôture sécurisée', 'Local commercial', 'Studio indépendant',
];

export function ProjectBriefPage() {
  useEffect(() => { document.title = 'Décrire mon projet | Globus Engineering'; }, []);
  const [step, setStep] = useState(1);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');

  const [step1, setStep1] = useState({
    project_type: '', universe: '', construction_type: '',
    surface_m2: 0, floors: 1, location_city: '', location_address: '',
    terrain_owned: false, terrain_description: '',
  });
  const [step2, setStep2] = useState({
    budget_range: '', timeline: '', urgency: 'NORMAL',
    desired_start_date: '', desired_end_date: '',
  });
  const [step3, setStep3] = useState({
    rooms: [] as string[], special_features: [] as string[],
    style_preferences: [] as string[], description_libre: '',
  });
  const [step4, setStep4] = useState({
    contact_name: '', contact_email: '', contact_phone: '',
    contact_whatsapp: '', company_name: '', how_found_us: '',
    accept_terms: false, newsletter_opt_in: false,
  });

  const toggleFeature = (f: string) => {
    setStep3(prev => ({
      ...prev,
      special_features: prev.special_features.includes(f)
        ? prev.special_features.filter(x => x !== f)
        : [...prev.special_features, f],
    }));
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      if (step === 1) {
        const { data } = await api.post('/project-brief/start', step1);
        setBriefId(data.id);
        setCode(data.code);
        setStep(2);
      } else if (step === 2 && briefId) {
        await api.patch(`/project-brief/${briefId}/step2`, step2);
        setStep(3);
      } else if (step === 3 && briefId) {
        await api.patch(`/project-brief/${briefId}/step3`, step3);
        setStep(4);
      } else if (step === 4 && briefId) {
        await api.patch(`/project-brief/${briefId}/step4`, step4);
        setSubmitted(true);
      }
    } catch { /* silently continue */ }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-globus-bg py-10 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <CheckCircle2Icon size={64} className="mx-auto text-globus-success mb-4" />
          <h1 className="text-2xl font-bold font-gilroy text-globus-text mb-2">Projet soumis avec succès !</h1>
          <p className="text-gray-600 mb-4">Votre référence : <strong className="text-globus-blue">{code || ''}</strong></p>
          <p className="text-sm text-gray-500">Notre équipe vous contactera sous 24h pour discuter de votre projet.</p>
          <a href="/" className="inline-block mt-6 px-6 py-3 bg-globus-blue text-white rounded-lg font-semibold hover:bg-globus-blue-dark transition-colors">Retour à l'accueil</a>
        </div>
      </div>
    );
  }

  return (
    <>

    <div className="min-h-screen bg-globus-bg py-10">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
            <h1 className="text-3xl lg:text-4xl font-bold font-gilroy text-globus-text mb-3">
              Décrivez votre projet
            </h1>
            <p className="text-gray-600">Remplissez ce formulaire et recevez un devis gratuit sous 24h</p>
          </div>

          {/* Progress */}
          <div className="flex items-center justify-between mb-10">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm transition-colors ${
                  step > s.id ? 'bg-globus-success text-white' :
                  step === s.id ? 'bg-globus-blue text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.id ? <CheckCircle2Icon size={18} /> : s.id}
                </div>
                <span className={`hidden sm:block ml-2 text-sm font-medium ${step >= s.id ? 'text-globus-text' : 'text-gray-400'}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 ${step > s.id ? 'bg-globus-success' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h2 className="text-xl font-bold text-globus-text">Votre projet</h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type de projet</label>
                    <div className="grid grid-cols-2 gap-3">
                      {PROJECT_TYPES.map(t => (
                        <button key={t.value} onClick={() => setStep1(p => ({ ...p, project_type: t.value }))}
                          className={`p-3 rounded-lg border-2 text-left transition-colors ${step1.project_type === t.value ? 'border-globus-blue bg-globus-blue/5' : 'border-gray-200 hover:border-gray-300'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Univers</label>
                    <div className="grid grid-cols-2 gap-3">
                      {UNIVERSES.map(u => (
                        <button key={u.value} onClick={() => setStep1(p => ({ ...p, universe: u.value }))}
                          className={`p-4 rounded-lg border-2 text-left transition-colors ${step1.universe === u.value ? 'border-globus-blue bg-globus-blue/5' : 'border-gray-200 hover:border-gray-300'}`}>
                          <u.icon size={20} className="text-globus-blue mb-1" />
                          <div className="font-semibold text-sm">{u.label}</div>
                          <div className="text-xs text-gray-500">{u.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Surface (m²)</label>
                      <input type="number" value={step1.surface_m2 || ''} onChange={e => setStep1(p => ({ ...p, surface_m2: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" placeholder="Ex: 250" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de niveaux</label>
                      <input type="number" value={step1.floors} onChange={e => setStep1(p => ({ ...p, floors: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ville / Localisation</label>
                    <div className="relative">
                      <MapPinIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" value={step1.location_city} onChange={e => setStep1(p => ({ ...p, location_city: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" placeholder="Ex: Douala, Yaoundé..." />
                    </div>
                  </div>

                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={step1.terrain_owned} onChange={e => setStep1(p => ({ ...p, terrain_owned: e.target.checked }))}
                      className="rounded border-gray-300 text-globus-blue focus:ring-globus-blue" />
                    <span className="text-sm text-gray-700">J'ai déjà un terrain</span>
                  </label>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h2 className="text-xl font-bold text-globus-text">Budget & Délais</h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget estimé</label>
                    <div className="grid grid-cols-2 gap-3">
                      {BUDGET_RANGES.map(b => (
                        <button key={b} onClick={() => setStep2(p => ({ ...p, budget_range: b }))}
                          className={`p-3 rounded-lg border-2 text-sm text-left transition-colors ${step2.budget_range === b ? 'border-globus-blue bg-globus-blue/5' : 'border-gray-200 hover:border-gray-300'}`}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Délai souhaité</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['3 mois', '6 mois', '1 an', '18 mois', '2 ans', 'Flexible'].map(t => (
                        <button key={t} onClick={() => setStep2(p => ({ ...p, timeline: t }))}
                          className={`p-3 rounded-lg border-2 text-sm text-center transition-colors ${step2.timeline === t ? 'border-globus-blue bg-globus-blue/5' : 'border-gray-200 hover:border-gray-300'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de début souhaitée</label>
                    <input type="date" value={step2.desired_start_date} onChange={e => setStep2(p => ({ ...p, desired_start_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h2 className="text-xl font-bold text-globus-text">Besoins détaillés</h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Caractéristiques souhaitées</label>
                    <div className="flex flex-wrap gap-2">
                      {SPECIAL_FEATURES.map(f => (
                        <button key={f} onClick={() => toggleFeature(f)}
                          className={`px-4 py-2 rounded-full text-sm transition-colors ${step3.special_features.includes(f) ? 'bg-globus-blue text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description libre de votre projet</label>
                    <textarea rows={5} value={step3.description_libre} onChange={e => setStep3(p => ({ ...p, description_libre: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue"
                      placeholder="Décrivez votre vision, vos inspirations, vos contraintes particulières..." />
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h2 className="text-xl font-bold text-globus-text">Vos coordonnées</h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                      <input type="text" required value={step4.contact_name} onChange={e => setStep4(p => ({ ...p, contact_name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input type="email" required value={step4.contact_email} onChange={e => setStep4(p => ({ ...p, contact_email: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                      <input type="tel" required value={step4.contact_phone} onChange={e => setStep4(p => ({ ...p, contact_phone: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                      <input type="tel" value={step4.contact_whatsapp} onChange={e => setStep4(p => ({ ...p, contact_whatsapp: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise</label>
                      <input type="text" value={step4.company_name} onChange={e => setStep4(p => ({ ...p, company_name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
                    </div>
                  </div>

                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={step4.accept_terms} onChange={e => setStep4(p => ({ ...p, accept_terms: e.target.checked }))}
                      className="rounded border-gray-300 text-globus-blue focus:ring-globus-blue mt-1" />
                    <span className="text-sm text-gray-700">J'accepte les conditions générales et la politique de confidentialité *</span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={step4.newsletter_opt_in} onChange={e => setStep4(p => ({ ...p, newsletter_opt_in: e.target.checked }))}
                      className="rounded border-gray-300 text-globus-blue focus:ring-globus-blue mt-1" />
                    <span className="text-sm text-gray-700">Je souhaite recevoir des conseils et actualités par email</span>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
              {step > 1 ? (
                <button onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-2 text-gray-600 hover:text-globus-text transition-colors">
                  <ArrowLeftIcon size={18} /> Précédent
                </button>
              ) : <div />}
              <button
                onClick={handleNext}
                disabled={loading || (step === 4 && !step4.accept_terms)}
                className="flex items-center gap-2 bg-globus-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-globus-blue-dark transition-colors disabled:opacity-50"
              >
                {loading && <Loader2Icon size={18} className="animate-spin" />}
                {step === 4 ? 'Soumettre mon projet' : 'Suivant'}
                {step < 4 && <ArrowRightIcon size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
