import React, { useRef, useEffect, useState } from 'react';
import { Player, WorldResource, MAP_SIZE, Tile } from '../types/game';

interface MapProps {
  player: Player;
  resources: WorldResource[];
  isLarge: boolean;
  onClose?: () => void;
  getTile: (x: number, y: number) => Tile | null;
}

const TILE_COLORS: Record<string, string> = {
  grass: '#426938',
  dirt: '#70543e',
  water: '#3b82a8',
};

const RESOURCE_COLORS: Record<string, string> = {
  wood: '#15803d',
  stone: '#71717a',
  iron: '#94a3b8',
  copper: '#b45309',
  coal: '#1c1917',
  gold: '#fbbf24',
};

export function GameMap({ player, resources, isLarge, onClose, getTile }: MapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(isLarge ? 2 : 1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Reset offset and zoom when switching modes
    setOffset({ x: 0, y: 0 });
    setZoom(isLarge ? 4 : 1);
  }, [isLarge]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      if (!canvas || !canvas.parentElement) return;

      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Center based on player position, plus offset/zoom
      ctx.translate(canvas.width / 2 + offset.x, canvas.height / 2 + offset.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-player.pos.x, -player.pos.y);

      // Determine viewport bounds
      const viewLeft = player.pos.x - (canvas.width / 2 + offset.x) / zoom;
      const viewRight = player.pos.x + (canvas.width / 2 - offset.x) / zoom;
      const viewTop = player.pos.y - (canvas.height / 2 + offset.y) / zoom;
      const viewBottom = player.pos.y + (canvas.height / 2 - offset.y) / zoom;

      // Draw discovered terrain
      const minTx = Math.floor(viewLeft);
      const maxTx = Math.ceil(viewRight);
      const minTy = Math.floor(viewTop);
      const maxTy = Math.ceil(viewBottom);

      for (let tx = minTx; tx <= maxTx; tx++) {
        for (let ty = minTy; ty <= maxTy; ty++) {
          // Lazy calculation for map: just sample every other tile for perf, or draw roughly?
          // For big maps, scale determines if we should skip
          if (zoom < 0.5 && (tx % 2 !== 0 || ty % 2 !== 0)) continue;

          const tile = getTile(tx, ty);
          if (tile && tile.explored) {
            ctx.fillStyle = TILE_COLORS[tile.type];
            ctx.fillRect(tx, ty, 1.1, 1.1); // slight overlap
          }
        }
      }

      // Draw resources
      for (const res of resources) {
        if (res.pos.x >= viewLeft && res.pos.x <= viewRight && res.pos.y >= viewTop && res.pos.y <= viewBottom) {
          const tile = getTile(Math.floor(res.pos.x), Math.floor(res.pos.y));
          if (tile && tile.explored) {
            ctx.fillStyle = RESOURCE_COLORS[res.type] || '#ffffff';
            ctx.fillRect(res.pos.x - 0.5, res.pos.y - 0.5, 1, 1);
          }
        }
      }

      // Draw player
      ctx.fillStyle = '#ff4d4d';
      ctx.shadowColor = '#ff4d4d';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(player.pos.x, player.pos.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();

      // Cardinal directions
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('N', canvas.width / 2, 20);
      ctx.fillText('S', canvas.width / 2, canvas.height - 10);
      ctx.textAlign = 'right';
      ctx.fillText('E', canvas.width - 10, canvas.height / 2);
      ctx.textAlign = 'left';
      ctx.fillText('W', 10, canvas.height / 2);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [player.pos, resources, isLarge, zoom, offset, getTile]);

  // Handle native wheel events to stop propagation to the main container
  useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setZoom(z => Math.max(0.5, Math.min(z * (e.deltaY > 0 ? 0.9 : 1.1), 10)));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isLarge) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !isLarge) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className={`relative ${isLarge ? 'w-full h-full bg-black/90 pointer-events-auto' : 'w-full h-full pointer-events-auto'} rounded-xl overflow-hidden`}
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseUp}
         style={{ cursor: isDragging ? 'grabbing' : (isLarge ? 'grab' : 'default') }}>
         
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />
      
      {/* Zoom controls */}
      <div className="absolute right-2 bottom-2 flex flex-col gap-1 z-10 pointer-events-auto">
        <button className="w-6 h-6 bg-black/60 border border-white/20 text-white rounded hover:bg-white/20 flex items-center justify-center font-bold" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(10, z * 1.5)); }}>+</button>
        <button className="w-6 h-6 bg-black/60 border border-white/20 text-white rounded hover:bg-white/20 flex items-center justify-center font-bold" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.5, z / 1.5)); }}>-</button>
      </div>

      {isLarge && (
        <button className="absolute top-4 right-4 px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white font-bold rounded" onClick={onClose}>
          CERRAR (M)
        </button>
      )}
    </div>
  );
}
