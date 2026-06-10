/* ──────────────────────────────────────────────────────────────
   ErpCMS Modals — All CRUD modals for the CMS admin
   Extracted from ErpCMS.tsx for maintainability
   ────────────────────────────────────────────────────────────── */
import React, { useState } from 'react';
import { formatDateTime } from '../../utils/datetime';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, SaveIcon, Loader2Icon, Trash2Icon, FolderOpenIcon } from 'lucide-react';

// ── Shared Modal Shell ───────────────────────────────────────
interface ModalShellProps {
  show: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export function ModalShell({ show, title, onClose, children, maxWidth = 'max-w-2xl' }: ModalShellProps) {
  if (!show) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`bg-white rounded-xl shadow-xl w-full ${maxWidth} overflow-hidden flex flex-col max-h-[90vh]`}
          onClick={(e) => e.stopPropagation()}>
          <div className="bg-globus-blue-dark p-4 flex justify-between items-center shrink-0">
            <h3 className="text-white font-montserrat font-bold text-lg">{title}</h3>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <XIcon className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">{children}</div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Field helpers ────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue";
const textareaCls = `${inputCls} resize-none`;
const selectCls = inputCls;

function SaveBtn({ loading, label = 'Enregistrer' }: { loading: boolean; label?: string }) {
  return (
    <button type="submit" disabled={loading}
      className="px-5 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2 disabled:opacity-70">
      {loading ? <><Loader2Icon className="w-4 h-4 animate-spin" /> Sauvegarde...</> : <><SaveIcon className="w-4 h-4" /> {label}</>}
    </button>
  );
}

// ── Article Modal ────────────────────────────────────────────
interface ArticleModalProps {
  show: boolean;
  onClose: () => void;
  formData: any;
  setFormData: (d: any) => void;
  onSave: (e: React.FormEvent) => void;
  isEdit: boolean;
  loading: boolean;
  onPickMedia?: () => void;
}

export function ArticleModal({ show, onClose, formData, setFormData, onSave, isEdit, loading, onPickMedia }: ArticleModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  return (
    <ModalShell show={show} title={isEdit ? 'Modifier l\'Article' : 'Nouvel Article'} onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={onSave} className="space-y-4">
        <Field label="Titre"><input type="text" value={formData.title || ''} onChange={e => upd('title', e.target.value)} className={inputCls} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Catégorie">
            <select value={formData.category || ''} onChange={e => upd('category', e.target.value)} className={selectCls}>
              <option value="">Sélectionner</option>
              {['Conseils', 'Design', 'Actualités', 'Réglementation', 'Chantier'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Auteur"><input type="text" value={formData.author || ''} onChange={e => upd('author', e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Extrait"><textarea rows={2} value={formData.excerpt || ''} onChange={e => upd('excerpt', e.target.value)} className={textareaCls} /></Field>
        <Field label="Image URL">
          <div className="flex gap-2 items-center">
            <input type="text" value={formData.image || ''} onChange={e => upd('image', e.target.value)} className={inputCls + ' flex-1'} placeholder="https://..." />
            {onPickMedia && (
              <button type="button" onClick={onPickMedia}
                className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0"
                title="Choisir depuis la médiathèque">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
              </button>
            )}
          </div>
          {formData.image && (
            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 h-32 flex items-center justify-center">
              <img src={formData.image} alt="Aperçu" className="max-h-full max-w-full object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
        </Field>
        <Field label="Contenu HTML"><textarea rows={8} value={formData.html_content || ''} onChange={e => upd('html_content', e.target.value)} className={textareaCls} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Statut">
            <select value={formData.status || 'draft'} onChange={e => upd('status', e.target.value)} className={selectCls}>
              <option value="draft">Brouillon</option>
              <option value="published">Publié</option>
              <option value="scheduled">Planifié</option>
            </select>
          </Field>
          <Field label="Temps de lecture"><input type="text" value={formData.read_time || ''} onChange={e => upd('read_time', e.target.value)} className={inputCls} placeholder="5 min" /></Field>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Article Preview Modal ────────────────────────────────────
interface ArticlePreviewProps {
  show: boolean;
  onClose: () => void;
  article: any;
}

export function ArticlePreviewModal({ show, onClose, article }: ArticlePreviewProps) {
  if (!show || !article) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}>
          {/* Header image */}
          {article.image && (
            <div className="h-48 relative overflow-hidden shrink-0">
              <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 text-white">
                <span className="bg-globus-orange px-3 py-1 rounded-full text-xs font-bold uppercase">{article.category}</span>
                <h2 className="font-montserrat font-bold text-xl mt-2">{article.title}</h2>
              </div>
            </div>
          )}
          {/* Meta */}
          <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 text-xs text-gray-500 shrink-0">
            <span>✍️ {article.author || '—'}</span>
            <span>📅 {article.date || '—'}</span>
            <span>⏱ {article.read_time || '—'}</span>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${article.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
              {article.status === 'published' ? 'Publié' : 'Brouillon'}
            </span>
          </div>
          {/* Content */}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {article.excerpt && <p className="text-gray-600 italic mb-4 font-opensans text-sm">{article.excerpt}</p>}
            {article.html_content ? (
              <div className="prose prose-sm max-w-none font-opensans" dangerouslySetInnerHTML={{ __html: article.html_content }} />
            ) : (
              <p className="text-gray-400 italic text-sm">Aucun contenu HTML</p>
            )}
          </div>
          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-100 flex justify-end shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Project Modal ────────────────────────────────────────────
interface ProjectModalProps {
  show: boolean;
  onClose: () => void;
  formData: any;
  setFormData: (d: any) => void;
  onSave: (e: React.FormEvent) => void;
  isEdit: boolean;
  loading: boolean;
  onPickMedia?: (callback: (url: string) => void) => void;
}

export function ProjectModal({ show, onClose, formData, setFormData, onSave, isEdit, loading, onPickMedia }: ProjectModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  const imgs: string[] = formData.images || [];
  const addImage = (url: string) => upd('images', [...imgs, url]);
  const removeImage = (idx: number) => upd('images', imgs.filter((_: string, i: number) => i !== idx));

  // Progression timeline — [{ step, status, date }] (public project detail page)
  const progression: any[] = formData.progression || [];
  const addStep = () => upd('progression', [...progression, { step: '', status: 'à-venir', date: '' }]);
  const updateStep = (idx: number, key: string, val: string) =>
    upd('progression', progression.map((s: any, i: number) => i === idx ? { ...s, [key]: val } : s));
  const removeStep = (idx: number) => upd('progression', progression.filter((_: any, i: number) => i !== idx));

  return (
    <ModalShell show={show} title={isEdit ? 'Modifier le Projet' : 'Nouveau Projet'} onClose={onClose} maxWidth="max-w-4xl">
      <form onSubmit={onSave} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* ── Informations générales ── */}
        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark border-b pb-1">Informations générales</h4>
        <Field label="Titre"><input type="text" value={formData.title || ''} onChange={e => upd('title', e.target.value)} className={inputCls} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Catégorie">
            <select value={formData.category || ''} onChange={e => upd('category', e.target.value)} className={selectCls}>
              <option value="">Sélectionner</option>
              {['Résidentiel', 'Commercial', 'Institutionnel', 'Industriel', 'Gros Œuvre'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Statut">
            <select value={formData.status || 'En Cours'} onChange={e => upd('status', e.target.value)} className={selectCls}>
              {['En Cours', 'Livré en 2022', 'Livré en 2023', 'Livré en 2024', 'Livré en 2025', 'Livré en 2026', 'Planifié'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Localisation"><input type="text" value={formData.location || ''} onChange={e => upd('location', e.target.value)} className={inputCls} placeholder="Douala, Bonapriso" /></Field>
          <Field label="Client"><input type="text" value={formData.client_name || ''} onChange={e => upd('client_name', e.target.value)} className={inputCls} placeholder="Nom du client" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Surface"><input type="text" value={formData.area || ''} onChange={e => upd('area', e.target.value)} className={inputCls} placeholder="450 m²" /></Field>
          <Field label="Durée"><input type="text" value={formData.duration || ''} onChange={e => upd('duration', e.target.value)} className={inputCls} placeholder="14 mois" /></Field>
          <Field label="Architecte"><input type="text" value={formData.architect || ''} onChange={e => upd('architect', e.target.value)} className={inputCls} placeholder="Cabinet X" /></Field>
        </div>
        <Field label="Description"><textarea rows={3} value={formData.description || ''} onChange={e => upd('description', e.target.value)} className={textareaCls} /></Field>

        {/* ── Défis & Solutions ── */}
        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark border-b pb-1 mt-2">Défis & Solutions</h4>
        <Field label="Défi"><textarea rows={2} value={formData.challenge || ''} onChange={e => upd('challenge', e.target.value)} className={textareaCls} placeholder="Décrivez le défi technique..." /></Field>
        <Field label="Solution"><textarea rows={2} value={formData.solution || ''} onChange={e => upd('solution', e.target.value)} className={textareaCls} placeholder="Décrivez la solution apportée..." /></Field>

        {/* ── Média ── */}
        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark border-b pb-1 mt-2">Média</h4>
        <Field label="URL Vidéo YouTube"><input type="text" value={formData.video_url || ''} onChange={e => upd('video_url', e.target.value)} className={inputCls} placeholder="https://www.youtube.com/embed/..." /></Field>
        <Field label="Images du projet">
          <div className="flex flex-wrap gap-3 mb-2">
            {imgs.map((img: string, idx: number) => (
              <div key={idx} className="relative w-24 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
                <img src={img} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="80"><rect fill="%23f3f4f6" width="96" height="80"/><text x="48" y="44" text-anchor="middle" fill="%239ca3af" font-size="10">Erreur</text></svg>'; }} />
                <button type="button" onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">×</button>
              </div>
            ))}
            {onPickMedia && (
              <button type="button" onClick={() => onPickMedia(addImage)}
                className="w-24 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-globus-orange hover:text-globus-orange transition-colors cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                <span className="text-[10px] mt-1">Ajouter</span>
              </button>
            )}
          </div>
          <input type="text" placeholder="Ou coller une URL d'image et appuyer Entrée..."
            className={inputCls}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = (e.target as HTMLInputElement).value.trim(); if (v) { addImage(v); (e.target as HTMLInputElement).value = ''; } } }} />
        </Field>

        {/* ── Avancement (timeline) ── */}
        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark border-b pb-1 mt-2">Avancement du projet (page détail)</h4>
        {progression.map((s: any, idx: number) => (
          <div key={idx} className="flex gap-2 items-start border border-gray-200 rounded-lg p-2">
            <input type="text" value={s.step || ''} onChange={e => updateStep(idx, 'step', e.target.value)} className={inputCls + ' flex-1'} placeholder={`Étape ${idx + 1} (ex: Fondations)`} />
            <select value={s.status || 'à-venir'} onChange={e => updateStep(idx, 'status', e.target.value)} className={selectCls + ' w-32 shrink-0'}>
              <option value="validé">Validé</option>
              <option value="en-cours">En cours</option>
              <option value="à-venir">À venir</option>
            </select>
            <input type="text" value={s.date || ''} onChange={e => updateStep(idx, 'date', e.target.value)} className={inputCls + ' w-28 shrink-0'} placeholder="Mai 2024" />
            <button type="button" onClick={() => removeStep(idx)} className="p-1.5 text-red-400 hover:text-red-600 shrink-0" title="Supprimer">×</button>
          </div>
        ))}
        <button type="button" onClick={addStep} className="text-xs font-semibold text-globus-orange hover:underline">+ Ajouter une étape d'avancement</button>

        {/* ── Paramètres avancés ── */}
        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark border-b pb-1 mt-2">Paramètres</h4>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Progression (%)"><input type="number" min={0} max={100} value={formData.progress ?? 0} onChange={e => upd('progress', parseInt(e.target.value) || 0)} className={inputCls} /></Field>
          <Field label="Ordre d'affichage"><input type="number" value={formData.sort_order ?? 0} onChange={e => upd('sort_order', parseInt(e.target.value) || 0)} className={inputCls} /></Field>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" checked={formData.featured || false} onChange={e => upd('featured', e.target.checked)} className="w-4 h-4 accent-globus-orange" />
            Projet en vedette
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" checked={formData.is_ongoing || false} onChange={e => upd('is_ongoing', e.target.checked)} className="w-4 h-4 accent-globus-orange" />
            Chantier en cours
          </label>
        </div>
        {formData.is_ongoing && (
          <Field label="Description chantier en cours"><textarea rows={2} value={formData.ongoing_description || ''} onChange={e => upd('ongoing_description', e.target.value)} className={textareaCls} /></Field>
        )}

        <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-white pb-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Shared entity modal props ────────────────────────────────
interface EntityModalProps {
  show: boolean;
  onClose: () => void;
  formData: any;
  setFormData: (d: any) => void;
  onSave: (e: React.FormEvent) => void;
  isEdit: boolean;
  loading: boolean;
  onPickMedia?: (callback: (url: string) => void) => void;
}

// ── Service Modal ────────────────────────────────────────────
interface ServiceModalProps {
  show: boolean;
  onClose: () => void;
  formData: any;
  setFormData: (d: any) => void;
  onSave: (e: React.FormEvent) => void;
  isEdit: boolean;
  loading: boolean;
  onPickMedia?: (callback: (url: string) => void) => void;
}

export function ServiceModal({ show, onClose, formData, setFormData, onSave, isEdit, loading, onPickMedia }: ServiceModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  const imgs: string[] = formData.images || [];
  const addImage = (url: string) => upd('images', [...imgs, url]);
  const removeImage = (idx: number) => upd('images', imgs.filter((_: string, i: number) => i !== idx));
  const benefits: string[] = formData.benefits || [];
  const addBenefit = () => upd('benefits', [...benefits, '']);
  const updateBenefit = (idx: number, val: string) => upd('benefits', benefits.map((b: string, i: number) => i === idx ? val : b));
  const removeBenefit = (idx: number) => upd('benefits', benefits.filter((_: string, i: number) => i !== idx));

  // Process steps — [{ title, desc, iconKey }] (rendered on the public service page)
  const steps: any[] = formData.process_steps || [];
  const addStep = () => upd('process_steps', [...steps, { title: '', desc: '', iconKey: 'ClipboardListIcon' }]);
  const updateStep = (idx: number, key: string, val: string) =>
    upd('process_steps', steps.map((s: any, i: number) => i === idx ? { ...s, [key]: val } : s));
  const removeStep = (idx: number) => upd('process_steps', steps.filter((_: any, i: number) => i !== idx));

  // FAQ — [{ q, a }]
  const faq: any[] = formData.faq || [];
  const addFaq = () => upd('faq', [...faq, { q: '', a: '' }]);
  const updateFaq = (idx: number, key: string, val: string) =>
    upd('faq', faq.map((f: any, i: number) => i === idx ? { ...f, [key]: val } : f));
  const removeFaq = (idx: number) => upd('faq', faq.filter((_: any, i: number) => i !== idx));

  return (
    <ModalShell show={show} title={isEdit ? 'Modifier le Service' : 'Nouveau Service'} onClose={onClose} maxWidth="max-w-4xl">
      <form onSubmit={onSave} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* ── Informations générales ── */}
        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark border-b pb-1">Informations générales</h4>
        <Field label="Titre"><input type="text" value={formData.title || ''} onChange={e => upd('title', e.target.value)} className={inputCls} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Sous-titre"><input type="text" value={formData.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} className={inputCls} placeholder="Résidentiel & Commercial" /></Field>
          <Field label="Icône (clé)"><input type="text" value={formData.icon_key || ''} onChange={e => upd('icon_key', e.target.value)} className={inputCls} placeholder="BuildingIcon" /></Field>
        </div>
        <Field label="Description courte"><textarea rows={3} value={formData.desc || ''} onChange={e => upd('desc', e.target.value)} className={textareaCls} /></Field>
        <Field label="Détails complets"><textarea rows={3} value={formData.details || ''} onChange={e => upd('details', e.target.value)} className={textareaCls} placeholder="Description détaillée du service..." /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Catégorie liée">
            <select value={formData.related_category || ''} onChange={e => upd('related_category', e.target.value)} className={selectCls}>
              <option value="">Sélectionner</option>
              {['Résidentiel', 'Commercial', 'Institutionnel', 'Industriel'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Ordre d'affichage"><input type="number" value={formData.sort_order ?? 0} onChange={e => upd('sort_order', parseInt(e.target.value) || 0)} className={inputCls} /></Field>
        </div>

        {/* ── Avantages ── */}
        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark border-b pb-1 mt-2">Avantages</h4>
        {benefits.map((b: string, idx: number) => (
          <div key={idx} className="flex gap-2 items-center">
            <input type="text" value={b} onChange={e => updateBenefit(idx, e.target.value)} className={inputCls + ' flex-1'} placeholder={`Avantage ${idx + 1}`} />
            <button type="button" onClick={() => removeBenefit(idx)} className="p-1.5 text-red-400 hover:text-red-600 shrink-0" title="Supprimer">×</button>
          </div>
        ))}
        <button type="button" onClick={addBenefit} className="text-xs font-semibold text-globus-orange hover:underline">+ Ajouter un avantage</button>

        {/* ── Processus (étapes) ── */}
        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark border-b pb-1 mt-2">Notre processus (page détail)</h4>
        {steps.map((s: any, idx: number) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 relative">
            <button type="button" onClick={() => removeStep(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs font-bold" title="Supprimer l'étape">× Étape</button>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Titre étape ${idx + 1}`}><input type="text" value={s.title || ''} onChange={e => updateStep(idx, 'title', e.target.value)} className={inputCls} placeholder="Étude & Planification" /></Field>
              <Field label="Icône (clé)"><input type="text" value={s.iconKey || ''} onChange={e => updateStep(idx, 'iconKey', e.target.value)} className={inputCls} placeholder="ClipboardListIcon" /></Field>
            </div>
            <Field label="Description"><textarea rows={2} value={s.desc || ''} onChange={e => updateStep(idx, 'desc', e.target.value)} className={textareaCls} placeholder="Analyse du terrain, plans..." /></Field>
          </div>
        ))}
        <button type="button" onClick={addStep} className="text-xs font-semibold text-globus-orange hover:underline">+ Ajouter une étape</button>

        {/* ── FAQ ── */}
        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark border-b pb-1 mt-2">Questions fréquentes (page détail)</h4>
        {faq.map((f: any, idx: number) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 relative">
            <button type="button" onClick={() => removeFaq(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs font-bold" title="Supprimer la question">× Question</button>
            <Field label={`Question ${idx + 1}`}><input type="text" value={f.q || ''} onChange={e => updateFaq(idx, 'q', e.target.value)} className={inputCls} placeholder="Combien de temps dure...?" /></Field>
            <Field label="Réponse"><textarea rows={2} value={f.a || ''} onChange={e => updateFaq(idx, 'a', e.target.value)} className={textareaCls} placeholder="La durée varie selon..." /></Field>
          </div>
        ))}
        <button type="button" onClick={addFaq} className="text-xs font-semibold text-globus-orange hover:underline">+ Ajouter une question</button>

        {/* ── Média ── */}
        <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark border-b pb-1 mt-2">Média</h4>
        <Field label="Image principale">
          <div className="flex gap-2 items-center">
            <input type="text" value={formData.image || ''} onChange={e => upd('image', e.target.value)} className={inputCls + ' flex-1'} placeholder="https://..." />
            {onPickMedia && (
              <button type="button" onClick={() => onPickMedia((url: string) => upd('image', url))}
                className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0" title="Médiathèque">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
              </button>
            )}
          </div>
          {formData.image && (
            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 h-24 w-36">
              <img src={formData.image} alt="Aperçu" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
        </Field>
        <Field label="Galerie d'images">
          <div className="flex flex-wrap gap-3 mb-2">
            {imgs.map((img: string, idx: number) => (
              <div key={idx} className="relative w-24 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
                <img src={img} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="80"><rect fill="%23f3f4f6" width="96" height="80"/><text x="48" y="44" text-anchor="middle" fill="%239ca3af" font-size="10">Err</text></svg>'; }} />
                <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">×</button>
              </div>
            ))}
            {onPickMedia && (
              <button type="button" onClick={() => onPickMedia(addImage)}
                className="w-24 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-globus-orange hover:text-globus-orange transition-colors cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                <span className="text-[10px] mt-1">Ajouter</span>
              </button>
            )}
          </div>
        </Field>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" checked={formData.is_published !== false} onChange={e => upd('is_published', e.target.checked)} className="w-4 h-4 accent-globus-orange" />
            Service publié
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-white pb-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Team Member Modal ────────────────────────────────────────
interface MediaModalProps extends EntityModalProps {
  onPickMedia?: (callback: (url: string) => void) => void;
}

export function TeamModal({ show, onClose, formData, setFormData, onSave, isEdit, loading, onPickMedia }: MediaModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  return (
    <ModalShell show={show} title={isEdit ? 'Modifier le Membre' : 'Nouveau Membre'} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-4">
        <Field label="Nom complet"><input type="text" value={formData.name || ''} onChange={e => upd('name', e.target.value)} className={inputCls} required /></Field>
        <Field label="Poste / Rôle"><input type="text" value={formData.role || ''} onChange={e => upd('role', e.target.value)} className={inputCls} placeholder="Chef de Chantier" /></Field>
        <Field label="Citation"><textarea rows={2} value={formData.quote || ''} onChange={e => upd('quote', e.target.value)} className={textareaCls} placeholder="Sa devise professionnelle..." /></Field>
        <Field label="Classe CSS gradient">
          <select value={formData.image_class || ''} onChange={e => upd('image_class', e.target.value)} className={selectCls}>
            <option value="">Par défaut</option>
            <option value="from-seconda-blue to-globus-blue">Bleu → Bleu foncé</option>
            <option value="from-globus-orange to-seconda-blue">Orange → Bleu</option>
            <option value="from-blue-400 to-blue-700">Bleu clair → Bleu</option>
            <option value="from-orange-400 to-orange-600">Orange clair → Orange</option>
          </select>
        </Field>
        <Field label="Photo">
          <div className="flex gap-2 items-center">
            <input type="text" value={formData.photo || ''} onChange={e => upd('photo', e.target.value)} className={inputCls + ' flex-1'} placeholder="https://..." />
            {onPickMedia && (
              <button type="button" onClick={() => onPickMedia((url: string) => upd('photo', url))}
                className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0" title="Médiathèque">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
              </button>
            )}
          </div>
          {formData.photo && (
            <div className="mt-2 w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 mx-auto">
              <img src={formData.photo} alt="Aperçu" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
        </Field>
        <Field label="Ordre d'affichage"><input type="number" value={formData.sort_order ?? 0} onChange={e => upd('sort_order', parseInt(e.target.value) || 0)} className={inputCls} /></Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Testimonial Modal ────────────────────────────────────────
export function TestimonialModal({ show, onClose, formData, setFormData, onSave, isEdit, loading, onPickMedia }: MediaModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  return (
    <ModalShell show={show} title={isEdit ? 'Modifier le Témoignage' : 'Nouveau Témoignage'} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-4">
        <Field label="Nom du client"><input type="text" value={formData.name || ''} onChange={e => upd('name', e.target.value)} className={inputCls} required /></Field>
        <Field label="Projet associé"><input type="text" value={formData.project || ''} onChange={e => upd('project', e.target.value)} className={inputCls} placeholder="Villa Les Alizés" /></Field>
        <Field label="Témoignage"><textarea rows={4} value={formData.text || ''} onChange={e => upd('text', e.target.value)} className={textareaCls} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Note (1-5)">
            <div className="flex items-center gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => upd('rating', n)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${(formData.rating || 5) >= n ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  ★
                </button>
              ))}
            </div>
          </Field>
          <Field label="Ordre d'affichage"><input type="number" value={formData.sort_order ?? 0} onChange={e => upd('sort_order', parseInt(e.target.value) || 0)} className={inputCls} /></Field>
        </div>
        <Field label="Photo">
          <div className="flex gap-2 items-center">
            <input type="text" value={formData.photo || ''} onChange={e => upd('photo', e.target.value)} className={inputCls + ' flex-1'} placeholder="https://..." />
            {onPickMedia && (
              <button type="button" onClick={() => onPickMedia((url: string) => upd('photo', url))}
                className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0" title="Médiathèque">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
              </button>
            )}
          </div>
          {formData.photo && (
            <div className="mt-2 w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 mx-auto">
              <img src={formData.photo} alt="Aperçu" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
          <input type="checkbox" checked={formData.is_published !== false} onChange={e => upd('is_published', e.target.checked)} className="w-4 h-4 accent-globus-orange" />
          Témoignage publié
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Partner Modal ────────────────────────────────────────────
export function PartnerModal({ show, onClose, formData, setFormData, onSave, isEdit, loading }: EntityModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  return (
    <ModalShell show={show} title={isEdit ? 'Modifier le Partenaire' : 'Nouveau Partenaire'} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-4">
        <Field label="Nom du partenaire"><input type="text" value={formData.name || ''} onChange={e => upd('name', e.target.value)} className={inputCls} required /></Field>
        <Field label="Logo URL"><input type="text" value={formData.logo || ''} onChange={e => upd('logo', e.target.value)} className={inputCls} /></Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── FAQ Item Modal ───────────────────────────────────────────
export function FaqItemModal({ show, onClose, formData, setFormData, onSave, isEdit, loading, categories }: EntityModalProps & { categories: { id: string; name: string }[] }) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  return (
    <ModalShell show={show} title={isEdit ? 'Modifier la Question' : 'Nouvelle Question'} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-4">
        <Field label="Catégorie">
          <select value={formData.category_id || ''} onChange={e => upd('category_id', e.target.value)} className={selectCls} required>
            <option value="">Sélectionner</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Question"><input type="text" value={formData.question || ''} onChange={e => upd('question', e.target.value)} className={inputCls} required /></Field>
        <Field label="Réponse"><textarea rows={4} value={formData.answer || ''} onChange={e => upd('answer', e.target.value)} className={textareaCls} required /></Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── FAQ Category Modal ───────────────────────────────────────
export function FaqCategoryModal({ show, onClose, formData, setFormData, onSave, isEdit, loading }: EntityModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  return (
    <ModalShell show={show} title={isEdit ? 'Modifier la Catégorie' : 'Nouvelle Catégorie FAQ'} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-4">
        <Field label="Nom de la catégorie"><input type="text" value={formData.name || ''} onChange={e => upd('name', e.target.value)} className={inputCls} required /></Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Hero Slide Modal ─────────────────────────────────────────
export function HeroSlideModal({ show, onClose, formData, setFormData, onSave, isEdit, loading, onPickMedia }: EntityModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  return (
    <ModalShell show={show} title={isEdit ? 'Modifier le Slide' : 'Nouveau Slide Hero'} onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={onSave} className="space-y-4">
        <Field label="Tag"><input type="text" value={formData.tag || ''} onChange={e => upd('tag', e.target.value)} className={inputCls} placeholder="BTP & Construction" /></Field>
        <Field label="Titre"><input type="text" value={formData.title || ''} onChange={e => upd('title', e.target.value)} className={inputCls} required /></Field>
        <Field label="Sous-titre"><textarea rows={2} value={formData.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} className={textareaCls} /></Field>
        <Field label="Image URL">
          <div className="flex gap-2 items-center">
            <input type="text" value={formData.image || ''} onChange={e => upd('image', e.target.value)} className={inputCls + ' flex-1'} />
            {onPickMedia && (
              <button type="button" onClick={() => onPickMedia((url) => upd('image', url))}
                className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0"
                title="Choisir depuis la médiathèque">
                <FolderOpenIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          {formData.image && (
            <div className="mt-2">
              <img src={formData.image} alt="Preview" className="h-32 rounded-lg object-cover border border-gray-200" />
            </div>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="CTA 1 — Texte"><input type="text" value={formData.cta1_text || ''} onChange={e => upd('cta1_text', e.target.value)} className={inputCls} /></Field>
          <Field label="CTA 1 — Lien"><input type="text" value={formData.cta1_href || ''} onChange={e => upd('cta1_href', e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="CTA 2 — Texte"><input type="text" value={formData.cta2_text || ''} onChange={e => upd('cta2_text', e.target.value)} className={inputCls} /></Field>
          <Field label="CTA 2 — Lien"><input type="text" value={formData.cta2_href || ''} onChange={e => upd('cta2_href', e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Delete Confirm Modal ─────────────────────────────────────
interface DeleteModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  itemName?: string;
}

export function DeleteConfirmModal({ show, onClose, onConfirm, loading, itemName }: DeleteModalProps) {
  if (!show) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2Icon className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="font-montserrat font-bold text-lg text-gray-800 mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-gray-500 mb-6">
              Êtes-vous sûr de vouloir supprimer{itemName ? ` "${itemName}"` : ' cet élément'} ? Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={onClose} className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={onConfirm} disabled={loading}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-70">
                {loading ? <><Loader2Icon className="w-4 h-4 animate-spin" /> Suppression...</> : <><Trash2Icon className="w-4 h-4" /> Supprimer</>}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Contact Message Modal ─────────────────────────────────────
interface ContactMessageModalProps {
  show: boolean;
  onClose: () => void;
  message: any;
  replyText: string;
  setReplyText: (v: string) => void;
  onMarkRead: () => void;
  onReply: () => void;
  isReplying: boolean;
}

export function ContactMessageModal({ show, onClose, message, replyText, setReplyText, onMarkRead, onReply, isReplying }: ContactMessageModalProps) {
  if (!show || !message) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
            <div>
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">{message.name}</h3>
              <p className="text-xs text-gray-500">{message.email} · {message.date}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${message.status === 'Nouveau' ? 'bg-blue-100 text-blue-700' : message.status === 'Répondu' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {message.status}
              </span>
              <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Body */}
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Sujet</p>
              <p className="font-semibold text-gray-800">{message.subject}</p>
            </div>
            {message.phone && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Téléphone</p>
                <p className="text-gray-700">{message.phone}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Message</p>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-100">
                {message.message || message.body || '(Aucun contenu)'}
              </div>
            </div>
            {/* Reply section */}
            {message.status !== 'Répondu' && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Répondre par email</p>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-globus-blue/30 focus:border-globus-blue outline-none resize-none"
                  placeholder="Tapez votre réponse ici..."
                />
              </div>
            )}
          </div>
          {/* Actions */}
          <div className="flex justify-between items-center p-5 border-t border-gray-100 bg-gray-50">
            {message.status === 'Nouveau' && (
              <button onClick={onMarkRead} className="text-sm font-semibold text-yellow-600 hover:text-yellow-700 flex items-center gap-1">
                ✓ Marquer comme lu
              </button>
            )}
            {message.status === 'Répondu' ? (
              <span className="text-sm text-green-600 font-semibold">✓ Réponse envoyée</span>
            ) : (
              <button
                onClick={onReply}
                disabled={isReplying || !replyText.trim()}
                className="ml-auto bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm">
                {isReplying ? (
                  <><Loader2Icon className="w-4 h-4 animate-spin" /> Envoi...</>
                ) : (
                  <>📧 Envoyer la réponse</>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Engagement Modal ─────────────────────────────────────────
export function EngagementModal({ show, onClose, formData, setFormData, onSave, isEdit, loading }: EntityModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  return (
    <ModalShell show={show} title={isEdit ? "Modifier l'Engagement" : 'Nouvel Engagement'} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-4">
        <Field label="Icône (Clé Lucide)"><input type="text" value={formData.icon_key || ''} onChange={e => upd('icon_key', e.target.value)} className={inputCls} placeholder="HardHatIcon" required /></Field>
        <Field label="Titre"><input type="text" value={formData.title || ''} onChange={e => upd('title', e.target.value)} className={inputCls} placeholder="Expertise Technique" required /></Field>
        <Field label="Description"><textarea value={formData.desc || ''} onChange={e => upd('desc', e.target.value)} className={inputCls} rows={3} placeholder="Description courte..." /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Couleur de fond (Classe Tailwind)"><input type="text" value={formData.bg_color || ''} onChange={e => upd('bg_color', e.target.value)} className={inputCls} placeholder="bg-globus-blue" /></Field>
          <Field label="Couleur de texte (Classe Tailwind)"><input type="text" value={formData.text_color || ''} onChange={e => upd('text_color', e.target.value)} className={inputCls} placeholder="text-white" /></Field>
        </div>
        <Field label="Ordre (Tri)"><input type="number" value={formData.sort_order || 0} onChange={e => upd('sort_order', parseInt(e.target.value))} className={inputCls} /></Field>
        <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-semibold transition-colors">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Methodology Step Modal ───────────────────────────────────
export function MethodologyStepModal({ show, onClose, formData, setFormData, onSave, isEdit, loading, onPickMedia }: EntityModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  return (
    <ModalShell show={show} title={isEdit ? "Modifier l'Étape" : 'Nouvelle Étape de Méthodologie'} onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={onSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Icône (Clé Lucide)"><input type="text" value={formData.icon_key || ''} onChange={e => upd('icon_key', e.target.value)} className={inputCls} placeholder="PencilRulerIcon" required /></Field>
          <Field label="Ordre (Tri)"><input type="number" value={formData.sort_order || 0} onChange={e => upd('sort_order', parseInt(e.target.value))} className={inputCls} /></Field>
        </div>
        <Field label="Titre"><input type="text" value={formData.title || ''} onChange={e => upd('title', e.target.value)} className={inputCls} placeholder="Étude & Conception" required /></Field>
        <Field label="Description"><textarea value={formData.desc || ''} onChange={e => upd('desc', e.target.value)} className={inputCls} rows={4} placeholder="Description détaillée..." /></Field>
        
        <Field label="Image">
          <div className="flex gap-2">
            <input type="text" value={formData.image || ''} onChange={e => upd('image', e.target.value)} className={inputCls} placeholder="https://..." />
            {onPickMedia && (
              <button type="button" onClick={() => onPickMedia((url) => upd('image', url))} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 shrink-0">
                <FolderOpenIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          {formData.image && <img src={formData.image} alt="Preview" className="mt-2 h-32 rounded-lg object-cover border border-gray-200" />}
        </Field>

        <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-semibold transition-colors">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Guarantee Modal ──────────────────────────────────────────
export function GuaranteeModal({ show, onClose, formData, setFormData, onSave, isEdit, loading }: EntityModalProps) {
  const upd = (k: string, v: any) => setFormData({ ...formData, [k]: v });
  return (
    <ModalShell show={show} title={isEdit ? "Modifier la Garantie" : 'Nouvelle Garantie'} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-4">
        <Field label="Icône (Clé Lucide)"><input type="text" value={formData.icon_key || ''} onChange={e => upd('icon_key', e.target.value)} className={inputCls} placeholder="CheckCircleIcon" required /></Field>
        <Field label="Titre"><input type="text" value={formData.title || ''} onChange={e => upd('title', e.target.value)} className={inputCls} placeholder="Garantie Décennale" required /></Field>
        <Field label="Description"><textarea value={formData.desc || ''} onChange={e => upd('desc', e.target.value)} className={inputCls} rows={3} placeholder="Description..." /></Field>
        <Field label="Ordre (Tri)"><input type="number" value={formData.sort_order || 0} onChange={e => upd('sort_order', parseInt(e.target.value))} className={inputCls} /></Field>
        
        <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-semibold transition-colors">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

export function StatModal({ show, onClose, formData, setFormData, onSave, isEdit, loading }: EntityModalProps) {
  if (!show) return null;
  return (
    <ModalShell show={show} onClose={onClose} title={isEdit ? "Modifier la Statistique" : "Nouvelle Statistique"}>
      <form onSubmit={onSave} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Valeur</label>
          <input type="text" required value={formData.value || ''} onChange={e => setFormData({ ...formData, value: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" placeholder="ex: 150+" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Libellé</label>
          <input type="text" required value={formData.label || ''} onChange={e => setFormData({ ...formData, label: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" placeholder="ex: Projets Réalisés" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Clé Icône (Optionnel)</label>
          <input type="text" value={formData.iconKey || ''} onChange={e => setFormData({ ...formData, iconKey: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" placeholder="ex: BriefcaseIcon" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Ordre d'affichage</label>
          <input type="number" required value={formData.sort_order || 0} onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
        </div>
        <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-semibold transition-colors">Annuler</button>
          <SaveBtn loading={loading} />
        </div>
      </form>
    </ModalShell>
  );
}

interface YouTubeImportModalProps {
  show: boolean;
  onClose: () => void;
  onImport: (url: string) => void;
  loading: boolean;
}

export function YouTubeImportModal({ show, onClose, onImport, loading }: YouTubeImportModalProps) {
  const [url, setUrl] = useState('');

  if (!show) return null;

  return (
    <ModalShell show={show} onClose={onClose} title="Importer une vidéo YouTube">
      <form onSubmit={(e) => { e.preventDefault(); onImport(url); setUrl(''); }} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">URL YouTube</label>
          <input 
            type="url" 
            required 
            value={url} 
            onChange={e => setUrl(e.target.value)} 
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-600" 
            placeholder="ex: https://www.youtube.com/watch?v=..." 
          />
        </div>
        <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-semibold transition-colors">Annuler</button>
          <button 
            type="submit" 
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center justify-center min-w-[120px] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2Icon className="w-5 h-5 animate-spin" /> : 'Importer'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Analytics Modal ─────────────────────────────────────────
export function AnalyticsModal({ show, onClose, stats }: { show: boolean; onClose: () => void; stats: any }) {
  if (!show || !stats) return null;

  return (
    <ModalShell show={show} onClose={onClose} title="Statistiques de Visite (Ce mois)" maxWidth="max-w-4xl">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-500 mb-2">Vues Totales</h4>
            <p className="text-3xl font-montserrat font-bold text-globus-blue">{stats.total_views_month}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-500 mb-2">Top Pays</h4>
            <p className="text-xl font-montserrat font-bold text-green-600">
              {Object.entries(stats.countries || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-500 mb-2">Top Navigateur</h4>
            <p className="text-xl font-montserrat font-bold text-globus-orange">
              {Object.entries(stats.browsers || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-500 mb-2">Top Appareil</h4>
            <p className="text-xl font-montserrat font-bold text-globus-blue-dark">
              {Object.entries(stats.devices || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A'}
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-montserrat font-bold text-gray-800 mb-3 border-b pb-2">Dernières visites</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Date</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Navigateur</th>
                  <th className="px-4 py-3">OS</th>
                  <th className="px-4 py-3">Appareil</th>
                  <th className="px-4 py-3">Pays</th>
                  <th className="px-4 py-3 rounded-tr-lg">Page</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.logs?.slice(0, 50).map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{formatDateTime(log.timestamp)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.ip_address}</td>
                    <td className="px-4 py-3">{log.browser}</td>
                    <td className="px-4 py-3">{log.os}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${log.device_type === 'Mobile' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {log.device_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-green-700">{log.country || 'Inconnu'}</td>
                    <td className="px-4 py-3 text-globus-blue truncate max-w-[200px]" title={log.path}>{log.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.logs?.length === 0 && (
              <p className="text-center py-6 text-gray-400 italic">Aucune donnée disponible ce mois-ci.</p>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
