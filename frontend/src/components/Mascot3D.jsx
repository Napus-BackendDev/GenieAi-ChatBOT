import { useState, useRef } from 'react';
import { Sparkles } from 'lucide-react';

const Mascot3D = ({
  size = 'md', // 'sm', 'md', 'lg', 'xl'
  showBadge = true,
  className = '',
  interactive = true
}) => {
  const containerRef = useRef(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Calculate tilt: max 18 deg
    const rotateY = (x / (rect.width / 2)) * 18;
    const rotateX = -(y / (rect.height / 2)) * 18;
    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-28 h-28',
    xl: 'w-44 h-44 sm:w-56 sm:h-56'
  }[size] || 'w-24 h-24';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className={`mascot-stage relative flex items-center justify-center cursor-pointer select-none ${className}`}
      style={{ perspective: '1000px' }}
    >
      {/* 3D Ambient Glowing Backlight Orb */}
      <div
        className={`mascot-glow absolute rounded-full bg-gradient-to-tr from-cyan-500/40 via-blue-500/30 to-indigo-500/40 blur-xl transition-all duration-500 pointer-events-none ${
          isHovered ? 'scale-125 opacity-100' : 'scale-100 opacity-60'
        }`}
        style={{
          width: '120%',
          height: '120%'
        }}
      />

      {/* 3D Holographic Orbit Ring */}
      <div
        className="mascot-orbit absolute inset-0 border-2 border-dashed border-cyan-400/40 rounded-full animate-spin-slow pointer-events-none transition-transform duration-300"
        style={{
          transform: `rotateX(${rotate.x * 0.5}deg) rotateY(${rotate.y * 0.5}deg) scale(${isHovered ? 1.1 : 1})`,
          transformStyle: 'preserve-3d'
        }}
      />

      {/* Main 3D Card Frame (Tilts dynamically with mouse physics) */}
      <div className={`mascot-float relative z-10 ${isHovered ? 'mascot-float-hover' : ''}`}>
      <div
        className="mascot-tilt relative flex items-center justify-center rounded-3xl p-1.5 transition-transform duration-150 ease-out"
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) translateZ(20px)`,
          transformStyle: 'preserve-3d',
          boxShadow: isHovered
            ? '0 20px 40px -10px rgba(6, 182, 212, 0.4), 0 0 30px rgba(6, 182, 212, 0.2)'
            : '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Mascot Avatar Cutout */}
        <div className={`relative overflow-hidden rounded-2xl border-2 border-cyan-400/50 bg-gradient-to-br from-slate-900 via-[#1A365D] to-slate-950 ${sizeClasses}`}>
          <img
            src="/genie_mascot_3d_clean.png"
            alt="GenieAI 3D Interactive Avatar"
            className={`mascot-character w-full h-full object-contain transition-transform duration-500 ${
              isHovered ? 'scale-110 mascot-character-excited' : 'scale-100'
            }`}
          />

          {/* Shimmer Light Reflection overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
        </div>

        {/* Floating 3D Sparkle Badges (Pops out in 3D Space) */}
        <div
          className="mascot-spark absolute -top-2 -right-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full p-1.5 shadow-lg border border-white/30 flex items-center justify-center z-20"
          style={{ transform: 'translateZ(35px)' }}
        >
          <Sparkles size={12} className="animate-pulse" />
        </div>

        {/* Status Tag */}
        {showBadge && (
          <div
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/90 dark:bg-slate-900/95 border border-cyan-500/50 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold text-cyan-300 shadow-xl whitespace-nowrap flex items-center gap-1.5 z-20 backdrop-blur-md"
            style={{ transform: 'translateZ(40px) translateX(-50%)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>3D Avatar • GenieAI</span>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default Mascot3D;
