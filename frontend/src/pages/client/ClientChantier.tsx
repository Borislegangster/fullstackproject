import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListIcon,
  ImageIcon,
  VideoIcon,
  BoxIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  PlayCircleIcon,
  CalendarIcon } from
'lucide-react';
const timelineData = [
{
  step: 'Études et conception',
  status: 'validé',
  date: 'Janvier 2024',
  desc: 'Plans architecturaux validés par le client',
  img: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200&q=80'
},
{
  step: 'Terrassement',
  status: 'validé',
  date: 'Mars 2024',
  desc: 'Préparation du terrain et nivellement',
  img: 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=200&q=80'
},
{
  step: 'Fondations',
  status: 'validé',
  date: 'Mai 2024',
  desc: 'Fondations sur semelles filantes coulées',
  img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200&q=80'
},
{
  step: 'Élévation murs RDC',
  status: 'en-cours',
  date: 'Juillet 2024',
  desc: 'Montage des murs en parpaings, chaînages',
  img: null
},
{
  step: 'Plancher haut RDC',
  status: 'à-venir',
  date: null,
  desc: 'Coffrage et coulage de la dalle',
  img: null
},
{
  step: 'Élévation R+1',
  status: 'à-venir',
  date: null,
  desc: "Montage des murs de l'étage",
  img: null
},
{
  step: "Mise hors d'eau",
  status: 'à-venir',
  date: null,
  desc: 'Pose de la charpente et couverture',
  img: null
},
{
  step: 'Second œuvre',
  status: 'à-venir',
  date: null,
  desc: 'Plomberie, électricité, cloisons',
  img: null
},
{
  step: 'Finitions',
  status: 'à-venir',
  date: null,
  desc: 'Peinture, revêtements, menuiseries',
  img: null
},
{
  step: 'Livraison',
  status: 'à-venir',
  date: null,
  desc: 'Remise des clés',
  img: null
}];

const photosData = [
{
  id: 1,
  url: 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=800&q=80',
  date: '15 Mars 2024',
  caption: 'Début du terrassement'
},
{
  id: 2,
  url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
  date: '10 Mai 2024',
  caption: 'Coulage des fondations'
},
{
  id: 3,
  url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80',
  date: '05 Juillet 2024',
  caption: 'Élévation des murs RDC'
},
{
  id: 4,
  url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80',
  date: '15 Janvier 2024',
  caption: 'Validation des plans'
}];

export function ClientChantier() {
  const [activeTab, setActiveTab] = useState('timeline');
  const tabs = [
  {
    id: 'timeline',
    label: 'Timeline',
    icon: ListIcon
  },
  {
    id: 'photos',
    label: 'Photos & Vidéos',
    icon: ImageIcon
  },
  {
    id: 'camera',
    label: 'Caméra Live',
    icon: VideoIcon
  },
  {
    id: '3d',
    label: 'Maquette 3D',
    icon: BoxIcon
  }];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Tabs Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-montserrat font-bold text-sm transition-all ${isActive ? 'bg-globus-orange text-white shadow-md' : 'text-globus-gray hover:bg-globus-light hover:text-globus-blue-dark'}`}>
              
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>);

        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 min-h-[600px]">
        <AnimatePresence mode="wait">
          {/* TIMELINE TAB */}
          {activeTab === 'timeline' &&
          <motion.div
            key="timeline"
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            exit={{
              opacity: 0,
              y: -10
            }}
            transition={{
              duration: 0.2
            }}>
            
              <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-8">
                Avancement du Chantier
              </h2>
              <div className="relative pl-4 md:pl-8">
                {/* Vertical Line */}
                <div className="absolute left-[27px] md:left-[43px] top-4 bottom-4 w-0.5 bg-gray-200 -z-10"></div>

                <div className="space-y-8">
                  {timelineData.map((item, index) =>
                <div
                  key={index}
                  className="relative flex items-start gap-6 group">
                  
                      <div className="relative z-10 bg-white py-1">
                        {item.status === 'validé' &&
                    <CheckCircle2Icon className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
                    }
                        {item.status === 'en-cours' &&
                    <div className="relative">
                            <CircleDotIcon className="w-6 h-6 md:w-8 md:h-8 text-globus-orange relative z-10" />
                            <div className="absolute inset-0 bg-globus-orange rounded-full animate-ping opacity-30"></div>
                          </div>
                    }
                        {item.status === 'à-venir' &&
                    <CircleIcon className="w-6 h-6 md:w-8 md:h-8 text-gray-300" />
                    }
                      </div>

                      <div
                    className={`flex-1 pt-1 pb-6 ${index !== timelineData.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <h4
                        className={`font-montserrat font-bold text-lg ${item.status === 'à-venir' ? 'text-gray-400' : 'text-globus-blue-dark'}`}>
                        
                            {item.step}
                          </h4>
                          {item.status === 'en-cours' &&
                      <span className="inline-block text-xs font-bold px-3 py-1 bg-globus-orange/10 text-globus-orange rounded-full self-start">
                              En cours
                            </span>
                      }
                          {item.date && item.status === 'validé' &&
                      <span className="text-sm text-globus-gray font-opensans flex items-center gap-1.5 self-start">
                              <CalendarIcon className="w-3.5 h-3.5" />{' '}
                              {item.date}
                            </span>
                      }
                        </div>
                        <p
                      className={`text-sm font-opensans ${item.status === 'à-venir' ? 'text-gray-400' : 'text-globus-gray'}`}>
                      
                          {item.desc}
                        </p>

                        {item.img &&
                    <div className="mt-4 w-32 h-20 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                            <img
                        src={item.img}
                        alt={item.step}
                        className="w-full h-full object-cover" />
                      
                          </div>
                    }
                      </div>
                    </div>
                )}
                </div>
              </div>
            </motion.div>
          }

          {/* PHOTOS TAB */}
          {activeTab === 'photos' &&
          <motion.div
            key="photos"
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            exit={{
              opacity: 0,
              y: -10
            }}
            transition={{
              duration: 0.2
            }}>
            
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark">
                  Galerie du Chantier
                </h2>
                <select className="bg-globus-light border border-gray-200 rounded-lg px-4 py-2 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                  <option>Toutes les étapes</option>
                  <option>Fondations</option>
                  <option>Élévation RDC</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {photosData.map((photo) =>
              <div
                key={photo.id}
                className="group rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer">
                
                    <div className="aspect-[4/3] overflow-hidden relative">
                      <img
                    src={photo.url}
                    alt={photo.caption}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="p-4 bg-white">
                      <p className="font-montserrat font-bold text-globus-blue-dark text-sm mb-1">
                        {photo.caption}
                      </p>
                      <p className="font-opensans text-xs text-globus-gray flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" /> {photo.date}
                      </p>
                    </div>
                  </div>
              )}
              </div>
            </motion.div>
          }

          {/* CAMERA TAB */}
          {activeTab === 'camera' &&
          <motion.div
            key="camera"
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            exit={{
              opacity: 0,
              y: -10
            }}
            transition={{
              duration: 0.2
            }}
            className="flex flex-col h-full">
            
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark">
                  Caméra de chantier en direct
                </h2>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-montserrat font-bold text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  En ligne
                </span>
              </div>

              <div className="relative w-full aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-lg group cursor-pointer mb-4">
                <img
                src="https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=1600&q=80"
                alt="Live Cam Placeholder"
                className="w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity" />
              
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 bg-globus-orange/90 rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <PlayCircleIcon className="w-10 h-10 ml-1" />
                  </div>
                </div>
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg font-mono text-sm flex items-center gap-2">
                  <VideoIcon className="w-4 h-4 text-red-500" /> CAM-01 (Vue
                  Globale)
                </div>
                <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg font-mono text-sm">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>

              <p className="font-opensans text-sm text-globus-gray text-center bg-globus-light p-4 rounded-xl border border-gray-100">
                ℹ️ La caméra est active du lundi au samedi, de 7h00 à 18h00
                (Heure locale).
              </p>
            </motion.div>
          }

          {/* 3D TAB */}
          {activeTab === '3d' &&
          <motion.div
            key="3d"
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            exit={{
              opacity: 0,
              y: -10
            }}
            transition={{
              duration: 0.2
            }}>
            
              <div className="text-center mb-8 max-w-2xl mx-auto">
                <div className="w-16 h-16 bg-globus-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BoxIcon className="w-8 h-8 text-globus-blue" />
                </div>
                <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-2">
                  Maquette 3D Interactive
                </h2>
                <p className="font-opensans text-globus-gray">
                  Visualisez votre futur bâtiment en 3D. Faites tourner, zoomez
                  et explorez chaque détail de la conception architecturale.
                </p>
              </div>

              <div className="w-full min-h-[400px] bg-globus-blue-dark/5 border-2 border-dashed border-globus-blue-dark/20 rounded-2xl flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                {/* Decorative background grid */}
                <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                  'linear-gradient(#1e3a5f 1px, transparent 1px), linear-gradient(90deg, #1e3a5f 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }}>
              </div>

                <BoxIcon className="w-16 h-16 text-globus-blue-dark/30 mb-4 animate-bounce" />
                <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2 relative z-10">
                  Chargement de la maquette 3D...
                </h3>
                <p className="font-opensans text-sm text-globus-gray max-w-md relative z-10">
                  Cette fonctionnalité nécessite un navigateur compatible WebGL.
                  L'intégration complète avec Three.js sera disponible
                  prochainement.
                </p>
              </div>
            </motion.div>
          }
        </AnimatePresence>
      </div>
    </div>);

}