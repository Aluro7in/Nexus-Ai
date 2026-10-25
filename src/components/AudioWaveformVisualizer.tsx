import React from 'react';

interface AudioWaveformVisualizerProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
  variant?: 'banner' | 'compact' | 'orb';
  barCount?: number;
  className?: string;
}

export const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({
  status,
  variant = 'banner',
  barCount = 28,
  className = '',
}) => {
  const isActive = status === 'listening' || status === 'speaking';
  const isListening = status === 'listening';
  const isSpeaking = status === 'speaking';
  const isThinking = status === 'thinking';

  // Palette selection based on voice assistant state
  const primaryGradientId = `wave-grad-primary-${variant}`;
  const secondaryGradientId = `wave-grad-sec-${variant}`;
  const barGradientId = `bar-grad-${variant}`;

  const colors = isListening
    ? {
        primary: '#06b6d4', // cyan-500
        secondary: '#14b8a6', // teal-500
        glow: 'rgba(6, 182, 212, 0.45)',
        barStart: '#22d3ee',
        barEnd: '#0d9488',
      }
    : isSpeaking
    ? {
        primary: '#a855f7', // purple-500
        secondary: '#ec4899', // pink-500
        glow: 'rgba(168, 85, 247, 0.45)',
        barStart: '#c084fc',
        barEnd: '#6366f1',
      }
    : isThinking
    ? {
        primary: '#f59e0b', // amber-500
        secondary: '#f97316', // orange-500
        glow: 'rgba(245, 158, 11, 0.35)',
        barStart: '#fbbf24',
        barEnd: '#d97706',
      }
    : {
        primary: '#64748b', // slate-500
        secondary: '#475569',
        glow: 'transparent',
        barStart: '#94a3b8',
        barEnd: '#64748b',
      };

  // Pre-generate deterministic frequency bar properties
  const bars = React.useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      // Bell-curve shape for natural voice formant emphasis in mid-range (human voice 300Hz-3.4kHz)
      const normalizedPos = i / (barCount - 1); // 0 to 1
      const centerFactor = Math.sin(normalizedPos * Math.PI); // 0 at edges, 1 at center
      const baseHeight = Math.max(12, Math.round(centerFactor * 52) + (i % 3) * 6);
      
      const animClasses = ['animate-freq-a', 'animate-freq-b', 'animate-freq-c', 'animate-freq-d'];
      const animClass = animClasses[i % 4];
      const delay = `${((i * 0.065) % 0.8).toFixed(3)}s`;

      return {
        id: i,
        baseHeight,
        animClass,
        delay,
        x: 10 + i * (460 / barCount),
      };
    });
  }, [barCount]);

  if (variant === 'compact') {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${className}`}
        role="img"
        aria-label={`Audio waveform state: ${status}`}
      >
        <svg
          viewBox="0 0 200 40"
          className="h-8 w-44 overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`${barGradientId}-compact`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.barStart} />
              <stop offset="100%" stopColor={colors.barEnd} />
            </linearGradient>
          </defs>

          {/* SVG Equalizer Bars */}
          {bars.slice(0, 16).map((b, idx) => {
            const h = isActive ? b.baseHeight * 0.55 : 4;
            const y = 20 - h / 2;
            return (
              <rect
                key={idx}
                x={12 + idx * 11}
                y={y}
                width="3.5"
                height={h}
                rx="1.75"
                fill={`url(#${barGradientId}-compact)`}
                className={isActive ? b.animClass : 'transition-all duration-300'}
                style={{
                  animationDelay: isActive ? b.delay : '0s',
                  transformOrigin: `${12 + idx * 11 + 1.75}px 20px`,
                }}
              />
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      role="img"
      aria-label={`Voice assistant visual audio waveform and frequency spectrum in ${status} state`}
    >
      {/* SVG Waveform & Frequency Bar Overlay */}
      <svg
        viewBox="0 0 600 80"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible select-none pointer-events-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={primaryGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.primary} stopOpacity="0" />
            <stop offset="20%" stopColor={colors.primary} stopOpacity="0.8" />
            <stop offset="50%" stopColor={colors.secondary} stopOpacity="1" />
            <stop offset="80%" stopColor={colors.primary} stopOpacity="0.8" />
            <stop offset="100%" stopColor={colors.secondary} stopOpacity="0" />
          </linearGradient>

          <linearGradient id={secondaryGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.secondary} stopOpacity="0" />
            <stop offset="30%" stopColor={colors.secondary} stopOpacity="0.6" />
            <stop offset="70%" stopColor={colors.primary} stopOpacity="0.7" />
            <stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
          </linearGradient>

          <linearGradient id={barGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.barStart} />
            <stop offset="50%" stopColor={colors.primary} />
            <stop offset="100%" stopColor={colors.barEnd} />
          </linearGradient>

          <filter id={`glow-${variant}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient background waveform path 1 (flowing wave) */}
        {isActive && (
          <path
            d="M 0 40 Q 75 10 150 40 T 300 40 T 450 40 T 600 40"
            stroke={`url(#${primaryGradientId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            className="animate-waveform-1 animate-wave-pulse"
            filter={`url(#glow-${variant})`}
          />
        )}

        {/* Ambient background waveform path 2 (counter-flowing wave) */}
        {isActive && (
          <path
            d="M 0 40 Q 100 68 200 40 T 400 40 T 600 40"
            stroke={`url(#${secondaryGradientId})`}
            strokeWidth="1.8"
            strokeLinecap="round"
            className="animate-waveform-2 animate-wave-pulse"
            opacity="0.75"
          />
        )}

        {/* Subtle center baseline guide */}
        <line
          x1="20"
          y1="40"
          x2="580"
          y2="40"
          stroke={isActive ? colors.primary : '#334155'}
          strokeWidth="1"
          strokeDasharray={isActive ? '4 4' : '2 2'}
          opacity={isActive ? 0.35 : 0.2}
        />

        {/* Dynamic Equalizer Frequency Bars */}
        <g id="frequency-bars" transform="translate(45, 0)">
          {bars.map((bar) => {
            const barWidth = 4;
            const h = isActive ? bar.baseHeight : 6;
            const y = 40 - h / 2;
            const centerX = bar.x + barWidth / 2;

            return (
              <rect
                key={bar.id}
                x={bar.x}
                y={y}
                width={barWidth}
                height={h}
                rx="2"
                fill={`url(#${barGradientId})`}
                opacity={isActive ? 0.95 : 0.3}
                className={isActive ? bar.animClass : 'transition-all duration-300'}
                style={{
                  animationDelay: isActive ? bar.delay : '0s',
                  transformOrigin: `${centerX}px 40px`,
                }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};
