'use client';

import { useState } from 'react';

interface LeftSidebarProps {
  onToolSelect: (tool: 'capasUrbanismo' | 'riesgoInundacion' | 'contaminacion') => void;
}

export default function LeftSidebar({ onToolSelect }: LeftSidebarProps) {
  const [tooltip, setTooltip] = useState<{ name: string; top: number; left: number } | null>(null);

  const tools: { icon: string; name: string; key: 'capasUrbanismo' | 'riesgoInundacion' | 'contaminacion' }[] = [
    { icon: '🏗️', name: 'Capas Urbanismo', key: 'capasUrbanismo' },
    { icon: '💧', name: 'Riesgo Inundación', key: 'riesgoInundacion' },
    { icon: '☢️', name: 'Contaminación', key: 'contaminacion' },
  ];

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex w-[3vw] min-w-12 flex-col items-center justify-center gap-6 z-3000 bg-[#F4EDE6] relative">
        {tools.map((tool, index) => (
          <div
            key={tool.key}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-black hover:bg-black/10 transition relative cursor-pointer"
            onClick={() => onToolSelect(tool.key)}
            onMouseEnter={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setTooltip({ name: tool.name, top: rect.top + rect.height / 2, left: rect.right });
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            {tool.icon}
          </div>
        ))}
      </aside>

      {/* Tooltip encima del mapa */}
      {tooltip && (
        <div
          className="fixed bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-[9999] whitespace-nowrap"
          style={{ top: tooltip.top, left: tooltip.left, transform: 'translateY(-50%)' }}
        >
          {tooltip.name}
        </div>
      )}

      {/* Mobile */}
      <div className="fixed top-1/2 right-3 -translate-y-1/2 flex md:hidden flex-col gap-3 z-[5000]">
        {tools.map((tool) => (
          <div
            key={tool.key}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#211304] text-white shadow-lg hover:scale-110 transition cursor-pointer"
            onClick={() => onToolSelect(tool.key)}
          >
            {tool.icon}
          </div>
        ))}
      </div>
    </>
  );
}
