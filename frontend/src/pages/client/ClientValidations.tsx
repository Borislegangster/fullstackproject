import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2Icon, XCircleIcon, ClockIcon, FileTextIcon,
  AlertTriangleIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { axiosClient as api } from '../../services/api/axiosClient';

interface Validation {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  due_date: string;
  documents: { name: string; url: string }[];
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  EN_ATTENTE: { label: 'En attente', color: 'text-yellow-600 bg-yellow-50', icon: ClockIcon },
  APPROUVE: { label: 'Approuvé', color: 'text-green-600 bg-green-50', icon: CheckCircle2Icon },
  REFUSE: { label: 'Refusé', color: 'text-red-600 bg-red-50', icon: XCircleIcon },
  EN_REVISION: { label: 'En révision', color: 'text-blue-600 bg-blue-50', icon: AlertTriangleIcon },
};

export function ClientValidations() {
  useEffect(() => { document.title = 'Validations | Espace Client'; }, []);
  const { data: validations = [] } = useQuery({
    queryKey: ['client-validations'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/client/validations');
        return data;
      } catch {
        return demoValidations;
      }
    },
  });

  const demoValidations: Validation[] = [
    { id: '1', title: 'Plan architectural RDC', description: 'Validation du plan du rez-de-chaussée - Version finale', type: 'PLAN', status: 'EN_ATTENTE', due_date: '2026-10-15', documents: [{ name: 'Plan_RDC_v3.pdf', url: '#' }], created_at: '2026-10-05' },
    { id: '2', title: 'Choix carrelage salle de bain', description: 'Sélection des carreaux pour les 3 salles de bain', type: 'MATERIAU', status: 'EN_ATTENTE', due_date: '2026-10-20', documents: [{ name: 'Catalogue_carrelage.pdf', url: '#' }], created_at: '2026-10-07' },
    { id: '3', title: 'Devis lot plomberie', description: 'Validation du devis du sous-traitant plomberie', type: 'DEVIS', status: 'APPROUVE', due_date: '2026-10-01', documents: [{ name: 'Devis_plomberie.pdf', url: '#' }], created_at: '2026-09-25' },
    { id: '4', title: 'Façade principale - Couleur enduit', description: 'Choix de la couleur d\'enduit pour la façade', type: 'MATERIAU', status: 'REFUSE', due_date: '2026-09-28', documents: [], created_at: '2026-09-20' },
  ];

  const items = validations.length > 0 ? validations : demoValidations;
  const pending = items.filter((v: Validation) => v.status === 'EN_ATTENTE');
  const resolved = items.filter((v: Validation) => v.status !== 'EN_ATTENTE');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-gilroy text-globus-text">Validations</h1>
        <p className="text-gray-500 text-sm">Validez les plans, matériaux et devis de votre projet</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'En attente', value: pending.length, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Approuvées', value: items.filter((v: Validation) => v.status === 'APPROUVE').length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Refusées', value: items.filter((v: Validation) => v.status === 'REFUSE').length, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Total', value: items.length, color: 'text-globus-blue', bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-600">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending Validations */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-globus-text mb-4 flex items-center gap-2">
            <ClockIcon size={18} className="text-yellow-500" /> En attente de votre validation
          </h2>
          <div className="space-y-3">
            {pending.map((v: Validation) => {
              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-yellow-400"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {v.type}
                        </span>
                        <span className="text-xs text-gray-400">Échéance: {v.due_date}</span>
                      </div>
                      <h3 className="font-semibold text-globus-text">{v.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{v.description}</p>
                      {v.documents?.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {v.documents.map((d, i) => (
                            <a key={i} href={d.url} className="flex items-center gap-1 text-xs text-globus-blue hover:underline bg-blue-50 px-2 py-1 rounded">
                              <FileTextIcon size={12} /> {d.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button className="flex items-center gap-1 px-4 py-2 rounded-lg bg-globus-success text-white text-sm font-semibold hover:bg-green-700 transition-colors">
                        <CheckCircle2Icon size={14} /> Approuver
                      </button>
                      <button className="flex items-center gap-1 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
                        <XCircleIcon size={14} /> Refuser
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      {resolved.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-globus-text mb-4">Historique</h2>
          <div className="space-y-2">
            {resolved.map((v: Validation) => {
              const cfg = statusConfig[v.status] || statusConfig.EN_ATTENTE;
              const Icon = cfg.icon;
              return (
                <div key={v.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={cfg.color.split(' ')[0]} />
                    <div>
                      <div className="font-medium text-globus-text text-sm">{v.title}</div>
                      <div className="text-xs text-gray-400">{v.type} - {v.created_at}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
