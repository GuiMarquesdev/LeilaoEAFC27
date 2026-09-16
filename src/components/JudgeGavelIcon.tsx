import React from 'react';

interface JudgeGavelIconProps {
  className?: string;
  animated?: boolean;
}

export const JudgeGavelIcon: React.FC<JudgeGavelIconProps> = ({ className = 'w-14 h-14', animated = true }) => {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Martelo de Juiz da Khedira League"
      role="img"
    >
      <defs>
        {/* CSS Keyframes for realistic wooden strike animation */}
        {animated && (
          <style>{`
            @keyframes gavelStrikeAction {
              0% {
                transform: rotate(18deg);
              }
              10% {
                transform: rotate(22deg);
              }
              19% {
                transform: rotate(-7deg);
              }
              23% {
                transform: rotate(3deg);
              }
              29% {
                transform: rotate(-7.5deg);
              }
              34% {
                transform: rotate(-2deg);
              }
              39% {
                transform: rotate(-6.5deg);
              }
              54% {
                transform: rotate(18deg);
              }
              100% {
                transform: rotate(18deg);
              }
            }

            @keyframes soundBlockImpact {
              0%, 18% {
                transform: translateY(0);
              }
              19% {
                transform: translateY(2.2px);
              }
              22% {
                transform: translateY(-0.8px);
              }
              25% {
                transform: translateY(0);
              }
              28% {
                transform: translateY(0);
              }
              29% {
                transform: translateY(2.5px);
              }
              32% {
                transform: translateY(-0.8px);
              }
              36% {
                transform: translateY(0);
              }
              100% {
                transform: translateY(0);
              }
            }

            @keyframes impactSparkFlash {
              0%, 18% {
                opacity: 0;
                transform: scale(0.3);
              }
              19%, 22% {
                opacity: 1;
                transform: scale(1.15);
              }
              26% {
                opacity: 0;
                transform: scale(0.7);
              }
              28% {
                opacity: 0;
                transform: scale(0.3);
              }
              29%, 33% {
                opacity: 1;
                transform: scale(1.3);
              }
              38% {
                opacity: 0;
                transform: scale(0.6);
              }
              100% {
                opacity: 0;
                transform: scale(0.3);
              }
            }

            @keyframes shockwaveRing {
              0%, 18% {
                opacity: 0;
                transform: scale(0.2);
              }
              19% {
                opacity: 0.9;
                transform: scale(0.8);
              }
              25% {
                opacity: 0;
                transform: scale(1.5);
              }
              28% {
                opacity: 0;
                transform: scale(0.2);
              }
              29% {
                opacity: 1;
                transform: scale(0.9);
              }
              36% {
                opacity: 0;
                transform: scale(1.7);
              }
              100% {
                opacity: 0;
              }
            }

            .anim-gavel-arm {
              transform-origin: 195px 65px;
              transform-box: view-box;
              animation: gavelStrikeAction 2.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
            }

            .anim-sound-block {
              transform-origin: 110px 145px;
              transform-box: view-box;
              animation: soundBlockImpact 2.2s ease-out infinite;
            }

            .anim-sparks {
              transform-origin: 45px 120px;
              transform-box: view-box;
              animation: impactSparkFlash 2.2s ease-out infinite;
            }

            .anim-shockwave {
              transform-origin: 75px 135px;
              transform-box: view-box;
              animation: shockwaveRing 2.2s ease-out infinite;
            }
          `}</style>
        )}

        {/* Wood gradients */}
        <linearGradient id="woodGavelTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5D2B1E" />
          <stop offset="100%" stopColor="#381710" />
        </linearGradient>

        <linearGradient id="woodGavelBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4A2016" />
          <stop offset="100%" stopColor="#2A0F0A" />
        </linearGradient>

        <linearGradient id="woodHandle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6C3224" />
          <stop offset="40%" stopColor="#823E2E" />
          <stop offset="100%" stopColor="#421C14" />
        </linearGradient>

        <linearGradient id="woodBlockTop" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#58271C" />
          <stop offset="100%" stopColor="#451D14" />
        </linearGradient>

        {/* Gold metal band gradients */}
        <linearGradient id="goldBandLeft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E39615" />
          <stop offset="100%" stopColor="#F5B22E" />
        </linearGradient>

        <linearGradient id="goldBandCenter" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FED758" />
          <stop offset="70%" stopColor="#F7BC29" />
          <stop offset="100%" stopColor="#E59914" />
        </linearGradient>

        <linearGradient id="goldBandRight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D98A0D" />
          <stop offset="100%" stopColor="#B36A04" />
        </linearGradient>
      </defs>

      {/* 1. Base / Sound Block (Tábua de bater do juiz) */}
      <g id="sound-block" className={animated ? 'anim-sound-block' : undefined}>
        {/* Sound block bottom/side shadow plate */}
        <path
          d="M 28 144 L 28 152 C 28 157 32 161 38 161 L 182 161 C 188 161 192 157 192 152 L 192 144 Z"
          fill="#2A0F0A"
        />
        {/* Sound block vertical front face */}
        <path
          d="M 26 138 L 26 148 C 26 153 30 156 35 156 L 185 156 C 190 156 194 153 194 148 L 194 138 Z"
          fill="#3B1710"
        />
        {/* Sound block top beveled surface */}
        <path
          d="M 33 133 C 28 133 25 135 26 138 L 28 140 C 29 143 33 145 37 145 L 183 145 C 187 145 191 143 192 140 L 194 138 C 195 135 192 133 187 133 Z"
          fill="url(#woodBlockTop)"
        />
        {/* Sound block top highlight edge */}
        <line x1="36" y1="134" x2="184" y2="134" stroke="#753526" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        
        {/* Dynamic wood impact shockwave */}
        {animated && (
          <ellipse
            cx="75"
            cy="136"
            rx="18"
            ry="4.5"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="1.8"
            className="anim-shockwave"
          />
        )}
      </g>

      {/* 2. Impact lines (Batida do martelo na madeira) */}
      <g
        id="impact-sparks"
        className={animated ? 'anim-sparks' : undefined}
        stroke="#E39615"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <line x1="20" y1="90" x2="36" y2="99" stroke="#F59E0B" />
        <line x1="14" y1="108" x2="30" y2="110" stroke="#FBBF24" />
        <line x1="18" y1="126" x2="34" y2="120" stroke="#EF4444" />
        {/* Additional radial sparks for impact punch */}
        <circle cx="48" cy="118" r="2" fill="#FDE047" stroke="none" />
        <circle cx="36" cy="132" r="1.5" fill="#F59E0B" stroke="none" />
      </g>

      {/* 3. The Gavel Assembly (Braço e martelo articulados batendo na madeira) */}
      <g className={animated ? 'anim-gavel-arm' : undefined}>
        <g id="gavel" transform="rotate(-24 105 105)">
        {/* Gavel Handle (Cabo de madeira suavemente cônico) */}
        <g id="gavel-handle">
          {/* Handle drop shadow under collar */}
          <path
            d="M 102 82 L 208 97 C 214 98 217 107 210 109 L 104 94 Z"
            fill="#220B06"
            opacity="0.5"
          />
          {/* Main handle shaft */}
          <path
            d="M 100 80 L 206 95 C 212 96 215 104 209 106 L 102 91 Z"
            fill="url(#woodHandle)"
          />
          {/* Handle glossy top highlight */}
          <path
            d="M 104 82 L 204 96 C 208 97 210 100 206 101 L 106 87 Z"
            fill="#9C4B37"
            opacity="0.6"
          />
          {/* Rounded ergonomic knob at end of handle */}
          <ellipse cx="207" cy="100" rx="6" ry="8" fill="#3B1710" />
          <ellipse cx="206" cy="99" rx="4" ry="6" fill="#58271C" />

          {/* Collar ring joining handle to hammer head */}
          <path
            d="M 94 77 C 102 78 105 92 97 95 C 91 94 89 78 94 77 Z"
            fill="#3B1710"
          />
          <path
            d="M 95 79 C 100 80 102 90 97 92 Z"
            fill="#5D2B1E"
          />
        </g>

        {/* Gavel Head (Cabeça com chanfros, madeira escura e anel de ouro) */}
        <g id="gavel-head">
          {/* --- TOP WOODEN CAP --- */}
          {/* Top cap dome */}
          <path
            d="M 64 34 C 64 29 96 29 96 34 L 96 46 L 64 46 Z"
            fill="url(#woodGavelTop)"
          />
          {/* Top cap upper rounded bevel */}
          <ellipse cx="80" cy="34" rx="16" ry="6" fill="#5D2B1E" />
          <ellipse cx="80" cy="34" rx="12" ry="4" fill="#753526" opacity="0.6" />
          {/* Top rim flange */}
          <rect x="62" y="44" width="36" height="8" rx="3" fill="#2E100A" />
          <rect x="63" y="45" width="34" height="4" rx="2" fill="#4A2016" />

          {/* --- CENTRAL GOLDEN BRASS BAND (Anel de metal dourado reluzente) --- */}
          {/* Gold band body background */}
          <rect x="64" y="52" width="32" height="38" fill="#E59914" />
          
          {/* Left golden shaded facet */}
          <path
            d="M 64 52 L 72 52 L 72 90 L 64 90 Z"
            fill="url(#goldBandLeft)"
          />
          {/* Center golden bright specular highlight */}
          <path
            d="M 72 52 L 86 52 L 86 90 L 72 90 Z"
            fill="url(#goldBandCenter)"
          />
          {/* Right golden shadow facet */}
          <path
            d="M 86 52 L 96 52 L 96 90 L 86 90 Z"
            fill="url(#goldBandRight)"
          />
          {/* Curved 3D specular light edge on top of gold ring */}
          <path
            d="M 64 52 C 72 55 88 55 96 52 L 96 54 C 88 57 72 57 64 54 Z"
            fill="#FFF1A8"
            opacity="0.8"
          />
          {/* Curved bottom edge shadow */}
          <path
            d="M 64 88 C 72 91 88 91 96 88 L 96 90 C 88 93 72 93 64 90 Z"
            fill="#8F5002"
            opacity="0.6"
          />

          {/* --- BOTTOM STRIKING WOODEN HEAD --- */}
          {/* Lower rim flange */}
          <rect x="62" y="90" width="36" height="8" rx="3" fill="#2E100A" />
          <rect x="63" y="91" width="34" height="4" rx="2" fill="#4A2016" />

          {/* Bottom cylinder body */}
          <path
            d="M 64 98 L 96 98 L 96 112 C 96 118 64 118 64 112 Z"
            fill="url(#woodGavelBody)"
          />

          {/* Striking Face Bevel (Chanfro e face de impacto do martelo) */}
          {/* Dark outer rim */}
          <ellipse cx="80" cy="112" rx="17" ry="7" fill="#220B06" />
          {/* Middle bevel */}
          <ellipse cx="80" cy="112" rx="14" ry="5.5" fill="#451D14" />
          {/* Inner striking face core highlight */}
          <ellipse cx="80" cy="112" rx="10" ry="4" fill="#5D2B1E" />
        </g>
      </g>
    </g>
    </svg>
  );
};
