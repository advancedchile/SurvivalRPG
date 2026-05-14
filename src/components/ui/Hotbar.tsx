import React from 'react';
import { Package, Hammer, Zap, Menu } from 'lucide-react';
import { Player, ToolType } from '../../types/game';

interface HotbarProps {
  player: Player;
  setPlayer: React.Dispatch<React.SetStateAction<Player>>;
  isInventoryOpen: boolean;
  setIsInventoryOpen: (open: boolean) => void;
  isCraftingOpen: boolean;
  setIsCraftingOpen: (open: boolean) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  setIsHoveringHotbarWindow: (hovering: boolean) => void;
  hoveredHotbarIndex: number | null;
  setHoveredHotbarIndex: (index: number | null) => void;
  draggingItem: any;
  setDraggingItem: (item: any) => void;
  moveItem: (sourceIndex: number | string, targetIndex: number | string, sourcePool: 'inventory' | 'hotbar' | 'equipment', targetPool: 'inventory' | 'hotbar' | 'equipment') => void;
  axeImage: HTMLImageElement | null;
  pickaxeImage: HTMLImageElement | null;
}

export function Hotbar({
  player,
  setPlayer,
  isInventoryOpen,
  setIsInventoryOpen,
  isCraftingOpen,
  setIsCraftingOpen,
  isMenuOpen,
  setIsMenuOpen,
  setIsHoveringHotbarWindow,
  hoveredHotbarIndex,
  setHoveredHotbarIndex,
  draggingItem,
  setDraggingItem,
  moveItem,
  axeImage,
  pickaxeImage
}: HotbarProps) {
  return (
    <div className="fixed bottom-0 left-0 w-full z-[60] pointer-events-none">
      <div className="w-full bg-black/80 backdrop-blur-3xl border-t border-white/10 shadow-[0_-10px_50px_rgba(0,0,0,0.5)] py-2 px-3 pointer-events-auto">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-6 px-4">
          
          <div 
            className="flex items-center gap-1.5"
            onMouseEnter={() => setIsHoveringHotbarWindow(true)}
            onMouseLeave={() => setIsHoveringHotbarWindow(false)}
          >
            {player.hotbar.map((tool, i) => (
              <div 
                key={i}
                onMouseEnter={() => setHoveredHotbarIndex(i)}
                onMouseLeave={() => setHoveredHotbarIndex(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isInventoryOpen) {
                    if (draggingItem) {
                      if (draggingItem.source === 'hotbar' && draggingItem.index === i) {
                        setDraggingItem(null);
                      } else {
                        moveItem(draggingItem.index, i, draggingItem.source, 'hotbar');
                        setDraggingItem(null);
                      }
                    } else if (tool) {
                      setDraggingItem({ source: 'hotbar', index: i, type: tool.type, amount: 1 });
                    }
                  } else {
                    setPlayer(p => ({ ...p, selectedHotbarIndex: i }));
                  }
                }}
                className={`w-8 h-8 rounded-md border flex flex-col items-center justify-center transition-all relative group cursor-pointer ${
                  player.selectedHotbarIndex === i && !isInventoryOpen
                    ? 'bg-white/10 border-amber-500 scale-110 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                    : (isInventoryOpen && hoveredHotbarIndex === i && draggingItem && (draggingItem.source !== 'hotbar' || draggingItem.index !== i))
                      ? 'bg-white/20 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)] scale-110 z-10'
                    : hoveredHotbarIndex === i && isInventoryOpen
                      ? 'bg-white/10 border-white/20 scale-105 z-10'
                    : hoveredHotbarIndex === i && !isInventoryOpen
                      ? 'bg-white/10 border-white/10 z-10'
                    : 'bg-white/[0.03] border-white/5'
                } ${draggingItem?.source === 'hotbar' && draggingItem.index === i ? 'opacity-30 border-amber-500/50 scale-95' : 'active:scale-95'}`}
              >
                <span className="absolute top-0.5 left-1 text-[6px] font-black opacity-30">{(i + 1) % 10}</span>
                {tool ? (
                  <div className="relative group-hover:scale-110 transition-transform mt-1 flex items-center justify-center pointer-events-none">
                    {tool.type === 'super_axe' ? (
                        axeImage ? <img src={`${import.meta.env.BASE_URL}assets/tools/super_axe.png`} className="w-7 h-7 object-contain -rotate-6 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" alt="Super Axe" /> : <Zap size={24} className="-rotate-6 text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" />
                      ) : tool.type === 'super_pickaxe' ? (
                        pickaxeImage ? <img src={`${import.meta.env.BASE_URL}assets/tools/super_pickaxe.png`} className="w-7 h-7 object-contain -rotate-6 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" alt="Super Pick" /> : <Zap size={24} className="-rotate-6 text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" />
                      ) : (tool.type.includes('axe') ? <Zap size={24} className="-rotate-6 text-blue-400" /> : <Hammer size={24} className="-rotate-6 text-stone-400" />)}
                  </div>
                ) : (
                  <div className="w-1 h-1 bg-white/10 rounded-full group-hover:scale-150 transition-all mt-1" />
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 hidden group-hover:block bg-white text-black px-2 py-1 rounded font-black text-[8px] tracking-widest whitespace-nowrap shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
                  {tool ? tool.type.replace('_', ' ').toUpperCase() : 'ESPACIO VACÍO'}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setIsInventoryOpen(!isInventoryOpen);
                setIsCraftingOpen(false);
                setIsMenuOpen(false);
              }}
              className={`group flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${isInventoryOpen ? 'bg-[#ffce00] text-black shadow-[0_0_30px_rgba(255,206,0,0.4)]' : 'hover:bg-white/5 text-white/60'}`}
            >
              <Package className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden lg:block">Inventario</span>
            </button>

            <button 
              onClick={() => {
                setIsCraftingOpen(!isCraftingOpen);
                setIsInventoryOpen(false);
                setIsMenuOpen(false);
              }}
              className={`group flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${isCraftingOpen ? 'bg-amber-500 text-black shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'hover:bg-white/5 text-white/60'}`}
            >
              <Hammer className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden lg:block">Crafteo</span>
            </button>

            <button 
              onClick={() => {
                setIsMenuOpen(!isMenuOpen);
                setIsInventoryOpen(false);
                setIsCraftingOpen(false);
              }}
              className={`group flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${isMenuOpen ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.4)]' : 'hover:bg-white/5 text-white/60'}`}
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden lg:block">Menú</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
