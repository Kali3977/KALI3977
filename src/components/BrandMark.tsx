import React from 'react';

export const BrandMark: React.FC<{ size?: number; showLabel?: boolean }> = ({
  size = 26,
  showLabel = true,
}) => {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M16 2.5L27 7.2V15.4C27 22.4 22.3 27.9 16 29.8C9.7 27.9 5 22.4 5 15.4V7.2L16 2.5Z"
          fill="#0D1117"
          stroke="#10B981"
          strokeWidth="2"
        />
        <path
          d="M11.5 11V21M11.5 16L17.5 11M14.2 13.8L18.5 21"
          stroke="#10B981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="21.5" cy="12" r="1.6" fill="#06B6D4" />
      </svg>
      {showLabel && (
        <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
          KALI<span className="text-emerald-500">3977</span>
          <sup className="ml-0.5 text-[9px] font-mono text-slate-400">TM</sup>
        </span>
      )}
    </span>
  );
};
