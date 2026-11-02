import { useState, useEffect } from 'react';
import {
  Box as BoxIcon, Layers, Eye, RotateCcw, ZoomIn, ZoomOut,
  Maximize2, Camera, Download, Loader2Icon,
} from 'lucide-react';

export function ClientBIM() {
  useEffect(() => { document.title = 'Immersion 3D | Espace Client'; }, []);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState('all');

  const layers = [
    { id: 'all', label: 'Toutes les disciplines', color: '#385AA6' },
    { id: 'arch', label: 'Architecture', color: '#385AA6' },
    { id: 'struct', label: 'Structure', color: '#DC2626' },
    { id: 'elec', label: 'Électricité', color: '#EAB308' },
    { id: 'plumb', label: 'Plomberie', color: '#16A34A' },
    { id: 'hvac', label: 'CVC', color: '#7C3AED' },
  ];

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-gilroy text-globus-text">Immersion 3D</h1>
          <p className="text-gray-500 text-sm">Explorez votre projet en 3D interactive</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50">
            <Camera size={18} className="text-gray-600" />
          </button>
          <button className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50">
            <Download size={18} className="text-gray-600" />
          </button>
          <button className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50">
            <Maximize2 size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 3D Viewer Area */}
        <div className="lg:col-span-3">
          <div className="bg-gray-900 rounded-2xl overflow-hidden relative" style={{ aspectRatio: '16/9' }}>
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2Icon size={40} className="animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Chargement du modèle 3D...</p>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <BoxIcon size={60} className="mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-semibold mb-2">Visionneuse 3D</p>
                  <p className="text-sm text-gray-400 max-w-sm mx-auto">
                    Connectez votre projet Autodesk / IFC pour visualiser votre maquette BIM.
                    Navigation: clic gauche pour orbiter, molette pour zoomer.
                  </p>
                </div>
              </div>
            )}

            {/* Toolbar overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 rounded-lg p-2">
              <button className="p-2 rounded hover:bg-white/10 text-white"><RotateCcw size={16} /></button>
              <button className="p-2 rounded hover:bg-white/10 text-white"><ZoomIn size={16} /></button>
              <button className="p-2 rounded hover:bg-white/10 text-white"><ZoomOut size={16} /></button>
              <button className="p-2 rounded hover:bg-white/10 text-white"><Eye size={16} /></button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Layers */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-globus-text mb-3 flex items-center gap-2">
              <Layers size={16} /> Disciplines
            </h3>
            <div className="space-y-2">
              {layers.map(l => (
                <button
                  key={l.id}
                  onClick={() => setActiveLayer(l.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                    activeLayer === l.id ? 'bg-globus-blue/10 text-globus-blue font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-globus-text mb-3">Avancement</h3>
            <div className="space-y-3">
              {[
                { label: 'Fondations', pct: 100 },
                { label: 'Structure', pct: 85 },
                { label: 'Maçonnerie', pct: 60 },
                { label: 'Toiture', pct: 30 },
                { label: 'Finitions', pct: 0 },
              ].map(p => (
                <div key={p.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{p.label}</span>
                    <span className="font-semibold">{p.pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-globus-blue rounded-full transition-all" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-globus-text mb-3">Actions rapides</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                <Camera size={14} /> Capture d'écran
              </button>
              <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                <Download size={14} /> Exporter PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
