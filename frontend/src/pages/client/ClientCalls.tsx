import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  PhoneIcon, VideoIcon, MonitorIcon, MicIcon, MicOffIcon,
  PhoneOffIcon, Users2Icon, CalendarIcon, ClockIcon,
} from 'lucide-react';

export function ClientCalls() {
  useEffect(() => { document.title = 'Appels | Espace Client'; }, []);
  const [activeCall, setActiveCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(true);

  const startCall = async (_type: string) => {
    setActiveCall(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-gilroy text-globus-text">Communication</h1>
        <p className="text-gray-500 text-sm">Appelez votre chef de projet en audio, vidéo ou partage d'écran</p>
      </div>

      {/* Active Call */}
      {activeCall && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900 rounded-2xl p-8 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-globus-blue/20 flex items-center justify-center mx-auto mb-4">
            <Users2Icon size={36} className="text-globus-blue" />
          </div>
          <h3 className="text-white text-xl font-semibold mb-1">Appel en cours</h3>
          <p className="text-gray-400 text-sm mb-6">Chef de projet - Jean Nkoulou</p>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => setMuted(!muted)}
              className={`p-4 rounded-full transition-colors ${muted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}
            >
              {muted ? <MicOffIcon size={20} className="text-white" /> : <MicIcon size={20} className="text-white" />}
            </button>
            <button
              onClick={() => setVideoOn(!videoOn)}
              className={`p-4 rounded-full transition-colors ${!videoOn ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <VideoIcon size={20} className="text-white" />
            </button>
            <button className="p-4 rounded-full bg-white/10 hover:bg-white/20">
              <MonitorIcon size={20} className="text-white" />
            </button>
            <button
              onClick={() => setActiveCall(false)}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600"
            >
              <PhoneOffIcon size={20} className="text-white" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      {!activeCall && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => startCall('AUDIO')}
            className="bg-white rounded-xl p-6 shadow-sm text-center hover:shadow-md transition-shadow"
          >
            <div className="w-14 h-14 rounded-full bg-globus-blue/10 flex items-center justify-center mx-auto mb-3">
              <PhoneIcon size={24} className="text-globus-blue" />
            </div>
            <h3 className="font-semibold text-globus-text mb-1">Appel Audio</h3>
            <p className="text-xs text-gray-500">Appeler votre chef de projet</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => startCall('VIDEO')}
            className="bg-white rounded-xl p-6 shadow-sm text-center hover:shadow-md transition-shadow"
          >
            <div className="w-14 h-14 rounded-full bg-globus-orange/10 flex items-center justify-center mx-auto mb-3">
              <VideoIcon size={24} className="text-globus-orange" />
            </div>
            <h3 className="font-semibold text-globus-text mb-1">Appel Vidéo</h3>
            <p className="text-xs text-gray-500">Visite virtuelle en direct</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => startCall('SCREEN_SHARE')}
            className="bg-white rounded-xl p-6 shadow-sm text-center hover:shadow-md transition-shadow"
          >
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <MonitorIcon size={24} className="text-green-600" />
            </div>
            <h3 className="font-semibold text-globus-text mb-1">Partage d'écran</h3>
            <p className="text-xs text-gray-500">Partager documents ou plans</p>
          </motion.button>
        </div>
      )}

      {/* Scheduled Calls */}
      <div>
        <h2 className="text-lg font-semibold text-globus-text mb-4 flex items-center gap-2">
          <CalendarIcon size={18} /> Appels programmés
        </h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {[
            { title: 'Point hebdomadaire chantier', date: '12 Oct 2026, 10h00', type: 'VIDEO', with: 'Jean Nkoulou - Chef de projet' },
            { title: 'Revue des plans modifiés', date: '15 Oct 2026, 14h30', type: 'SCREEN_SHARE', with: 'Marie Atangana - Architecte' },
          ].map((c, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-globus-blue/10 flex items-center justify-center">
                  {c.type === 'VIDEO' ? <VideoIcon size={18} className="text-globus-blue" /> :
                   c.type === 'AUDIO' ? <PhoneIcon size={18} className="text-globus-blue" /> :
                   <MonitorIcon size={18} className="text-globus-blue" />}
                </div>
                <div>
                  <div className="font-medium text-globus-text text-sm">{c.title}</div>
                  <div className="text-xs text-gray-500">{c.with}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-globus-text">{c.date}</div>
                <button className="text-xs text-globus-blue hover:underline">Rejoindre</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Call History */}
      <div>
        <h2 className="text-lg font-semibold text-globus-text mb-4 flex items-center gap-2">
          <ClockIcon size={18} /> Historique des appels
        </h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {[
            { title: 'Point avancement fondations', date: '5 Oct 2026', duration: '25 min', type: 'VIDEO' },
            { title: 'Discussion choix matériaux', date: '1 Oct 2026', duration: '42 min', type: 'AUDIO' },
            { title: 'Revue plan électrique', date: '28 Sep 2026', duration: '18 min', type: 'SCREEN_SHARE' },
          ].map((c, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {c.type === 'VIDEO' ? <VideoIcon size={16} className="text-gray-400" /> :
                 c.type === 'AUDIO' ? <PhoneIcon size={16} className="text-gray-400" /> :
                 <MonitorIcon size={16} className="text-gray-400" />}
                <div>
                  <div className="font-medium text-globus-text text-sm">{c.title}</div>
                  <div className="text-xs text-gray-500">{c.date} - {c.duration}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
