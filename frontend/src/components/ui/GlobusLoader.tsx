import { motion } from 'framer-motion';
const letters = [
{
  char: 'G',
  color: '#0f2a4a'
},
{
  char: 'L',
  color: '#f97316'
},
{
  char: 'O',
  color: '#1e3a5f'
},
{
  char: 'B',
  color: '#0f2a4a'
},
{
  char: 'U',
  color: '#f97316'
},
{
  char: 'S',
  color: '#3b82f6'
} // seconda-blue
];
export function GlobusLoader() {
  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center">
      <div className="flex items-center gap-1">
        {letters.map((letter, i) =>
        <motion.span
          key={i}
          className="font-montserrat font-extrabold text-5xl md:text-6xl"
          style={{
            color: letter.color
          }}
          initial={{
            opacity: 0,
            y: 30
          }}
          animate={{
            opacity: [0, 1, 1, 0.6, 1],
            y: [30, 0, -8, 0, 0],
            scale: [0.8, 1, 1.1, 1, 1]
          }}
          transition={{
            duration: 1.6,
            delay: i * 0.12,
            repeat: Infinity,
            repeatDelay: 0.8,
            ease: 'easeInOut'
          }}>
          
            {letter.char}
          </motion.span>
        )}
      </div>

      {/* Animated underline */}
      <div className="mt-6 w-32 h-1 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #0f2a4a, #f97316, #3b82f6)'
          }}
          initial={{
            x: '-100%'
          }}
          animate={{
            x: '100%'
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'easeInOut'
          }} />
        
      </div>

      <motion.p
        className="mt-4 font-opensans text-sm text-gray-400 tracking-widest uppercase"
        initial={{
          opacity: 0
        }}
        animate={{
          opacity: 1
        }}
        transition={{
          delay: 0.5
        }}>
        
        Chargement...
      </motion.p>
    </div>);

}