import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon } from 'lucide-react';
import { GameMap } from '../GameMap';
import { Player, WorldResource, Tile } from '../../types/game';

interface MinimapProps {
  isMapOpen: boolean;
  setIsMapOpen: (open: boolean) => void;
  player: Player;
  resources: WorldResource[];
  getTile: (x: number, y: number) => Tile | null;
}

export function Minimap({ isMapOpen, setIsMapOpen, player, resources, getTile }: MinimapProps) {
  return (
    <>
      {/* Small Minimap (Top Right) */}
      {!isMapOpen && (
        <div className="absolute top-4 right-4 w-40 h-40 bg-black/60 backdrop-blur-sm border border-white/10 pointer-events-auto shadow-2xl rounded-xl z-40 overflow-hidden group">
          <GameMap 
            player={player} 
            resources={resources} 
            isLarge={false} 
            getTile={getTile}
          />
          <button 
            onClick={() => setIsMapOpen(true)} 
            className="absolute top-2 left-2 w-6 h-6 bg-black/60 text-white hover:bg-white/20 border border-white/20 rounded flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10" 
            title="Abrir Mapa (M)"
          >
            <MapIcon size={12} />
          </button>
          <div className="absolute inset-0 border border-white/10 pointer-events-none rounded-xl" />
        </div>
      )}

      {/* Large Map Overlay */}
      <AnimatePresence>
        {isMapOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 p-8 pointer-events-auto flex flex-col items-center justify-center bg-black/60 backdrop-blur-md"
          >
            <div className="absolute top-8 left-8 text-white font-black text-2xl tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Mundo <span className="opacity-50 font-normal">Explorado</span>
            </div>
            <div className="w-full h-full max-w-6xl max-h-[800px] border border-white/20 shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden relative">
              <GameMap 
                player={player} 
                resources={resources} 
                isLarge={true} 
                onClose={() => setIsMapOpen(false)}
                getTile={getTile}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
