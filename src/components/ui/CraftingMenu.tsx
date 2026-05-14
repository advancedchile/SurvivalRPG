import React from 'react';
import { motion } from 'motion/react';
import { Hammer, Zap } from 'lucide-react';
import { Player, ToolType } from '../../types/game';

interface Recipe {
  type: ToolType;
  name: string;
  wood: number;
  description: string;
}

interface CraftingMenuProps {
  isCraftingOpen: boolean;
  setIsCraftingOpen: (open: boolean) => void;
  unlockedRecipeNotifications: Set<string>;
  recipes: Recipe[];
  player: Player;
  craft: (recipe: Recipe) => void;
}

export function CraftingMenu({
  isCraftingOpen,
  setIsCraftingOpen,
  unlockedRecipeNotifications,
  recipes,
  player,
  craft
}: CraftingMenuProps) {
  if (!isCraftingOpen) return null;

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={() => setIsCraftingOpen(false)}
      />
      <motion.div 
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        className="fixed bottom-44 left-1/2 -translate-x-1/2 z-50 bg-[#0a0a0a] border border-white/10 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.8)] rounded-3xl min-w-[320px]"
      >
        <div className="flex items-center gap-2 mb-6">
           <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
           <span className="text-white font-bold text-[10px] uppercase tracking-[0.2em] opacity-80">Mesa de Trabajo</span>
        </div>

        <div className="flex flex-col gap-3">
          {unlockedRecipeNotifications.has('wood_unlocked') && recipes.map((recipe) => {
            const woodCount = player.inventory.reduce((acc, item) => item?.type === 'wood' ? acc + item.amount : acc, 0);
            const canCraft = woodCount >= recipe.wood;
            
            return (
              <div 
                key={recipe.type}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  canCraft ? 'bg-white/[0.03] border-white/10' : 'bg-black opacity-40 border-white/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                     {recipe.type.includes('axe') ? <Zap size={18} className="text-blue-400" /> : <Hammer size={18} className="text-stone-400" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-black text-[10px] uppercase tracking-wider">{recipe.name}</span>
                    <span className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">{recipe.description}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                     <span className={`text-[9px] font-black ${canCraft ? 'text-amber-500' : 'text-white/20'}`}>
                       {woodCount} / {recipe.wood} MADERA
                     </span>
                  </div>
                  <button 
                    disabled={!canCraft}
                    onClick={() => craft(recipe)}
                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] transition-all ${
                      canCraft ? 'bg-amber-500 text-black hover:scale-105 active:scale-95' : 'bg-white/5 text-white/10 cursor-not-allowed'
                    }`}
                  >
                    Craftear
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-center opacity-20">
          <span className="text-[7px] font-black uppercase tracking-[0.2em]">Más recetas próximamente</span>
        </div>
      </motion.div>
    </>
  );
}
