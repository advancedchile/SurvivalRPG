import React from 'react';
import { motion } from 'motion/react';
import { X, Zap, Hammer, Shield, Footprints, Disc, HelpCircle } from 'lucide-react';
import { RESOURCE_COLORS, RESOURCE_NAMES, TOOL_NAMES } from '../../utils/constants';
import { Player, ResourceType, ToolType, INVENTORY_SIZE, EquipmentSlot, InventoryItem } from '../../types/game';
import { PlayerPreview } from './PlayerPreview';

interface InventoryProps {
  isInventoryOpen: boolean;
  setIsInventoryOpen: (open: boolean) => void;
  setIsHoveringInventoryWindow: (hovering: boolean) => void;
  player: Player;
  hoveredInvIndex: number | null;
  setHoveredInvIndex: (index: number | null) => void;
  draggingItem: any;
  setDraggingItem: (item: any) => void;
  moveItem: (sourceIndex: number | string, targetIndex: number | string, sourcePool: 'inventory' | 'hotbar' | 'equipment', targetPool: 'inventory' | 'hotbar' | 'equipment') => void;
  equipItem: (invIndex: number, slot: EquipmentSlot) => void;
  unequipItem: (slot: EquipmentSlot, targetInvIndex?: number) => void;
  axeImage: HTMLImageElement | null;
  pickaxeImage: HTMLImageElement | null;
  resourceIcons: Record<string, HTMLImageElement | null>;
}

const EQUIPMENT_SLOTS: { id: EquipmentSlot; label: string; icon: React.ReactNode; pos: string }[] = [
    { id: 'head', label: 'Casco', icon: <Shield size={16} />, pos: 'top-[10px] left-1/2 -translate-x-1/2' },
    { id: 'neck', label: 'Amuleto', icon: <Disc size={16} />, pos: 'top-[80px] right-[20px]' },
    { id: 'chest', label: 'Pechera', icon: <Shield size={16} />, pos: 'top-[150px] right-[20px]' },
    { id: 'hands', label: 'Guantes', icon: <Zap size={16} />, pos: 'top-[80px] left-[20px]' },
    { id: 'belt', label: 'Cinturón', icon: <Hammer size={16} />, pos: 'top-[150px] left-[20px]' },
    { id: 'legs', label: 'Pantalones', icon: <Shield size={16} />, pos: 'top-[220px] left-[20px]' },
    { id: 'feet', label: 'Botas', icon: <Footprints size={16} />, pos: 'top-[220px] right-[20px]' },
    { id: 'ring1', label: 'Anillo 1', icon: <Disc size={12} />, pos: 'top-[290px] left-[20px]' },
    { id: 'ring2', label: 'Anillo 2', icon: <Disc size={12} />, pos: 'top-[290px] right-[20px]' },
];

const TOOL_SLOTS: { id: EquipmentSlot; label: string; type: string }[] = [
    { id: 'tool_axe', label: 'Hacha', type: 'axe' },
    { id: 'tool_pickaxe', label: 'Pico', type: 'pickaxe' },
    { id: 'tool_spear', label: 'Lanza', type: 'spear' },
    { id: 'tool_knife', label: 'Cuchillo', type: 'knife' },
];

export function Inventory({
  isInventoryOpen,
  setIsInventoryOpen,
  setIsHoveringInventoryWindow,
  player,
  hoveredInvIndex,
  setHoveredInvIndex,
  draggingItem,
  setDraggingItem,
  moveItem,
  axeImage,
  pickaxeImage,
  resourceIcons
}: InventoryProps) {
  const [hoveredEquipSlot, setHoveredEquipSlot] = React.useState<EquipmentSlot | null>(null);

  if (!isInventoryOpen) return null;

  const renderItemContent = (item: InventoryItem) => {
    if ('wood' in RESOURCE_COLORS && Object.keys(RESOURCE_COLORS).includes(item.type)) {
        return (
            <>
              <div className="w-4 h-4 rounded-lg blur-[2px] opacity-20 absolute inset-0 m-auto" style={{ backgroundColor: RESOURCE_COLORS[item.type as ResourceType] }} />
              {resourceIcons[item.type] ? (
                  <img 
                    src={(resourceIcons[item.type] as HTMLImageElement).src} 
                    className={`w-6 h-6 object-contain relative z-10 ${
                      ['gold', 'diamond', 'silver'].includes(item.type) ? 'scale-[2.2]' : 
                      item.type === 'aluminum' ? 'scale-[1.1]' : 'p-0.5'
                    }`} 
                    alt={item.type} 
                  />
              ) : (
                  <div className="w-4 h-4 rounded shadow-2xl relative z-10" style={{ backgroundColor: RESOURCE_COLORS[item.type as ResourceType] }} />
              )}
              {item.amount > 1 && (
                <span className="absolute bottom-1 right-1 text-[7px] font-black text-white/90 leading-none bg-black/40 backdrop-blur-md px-1 py-0.5 rounded shadow-sm border border-white/5">
                  {item.amount}
                </span>
              )}
            </>
        );
    } else {
        return (
            <div className="flex items-center justify-center relative z-10">
                {item.type === 'super_axe' ? (
                    axeImage ? <img src="/assets/tools/super_axe.png" className="w-7 h-7 object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]" alt="Super Axe" /> : <Zap size={18} className="text-amber-500" />
                ) : item.type === 'super_pickaxe' ? (
                    pickaxeImage ? <img src="/assets/tools/super_pickaxe.png" className="w-7 h-7 object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]" alt="Super Pick" /> : <Zap size={18} className="text-amber-500" />
                ) : item.type.includes('axe') ? <Zap size={18} className="text-blue-400" /> : <Hammer size={18} className="text-stone-400" />}
            </div>
        );
    }
  };

  const handleSlotClick = (pool: 'inventory' | 'equipment', index: number | EquipmentSlot) => {
    if (draggingItem) {
        if (draggingItem.source === pool && draggingItem.index === index) {
            setDraggingItem(null);
        } else {
            moveItem(draggingItem.index, index, draggingItem.source, pool);
            setDraggingItem(null);
        }
    } else {
        const item = pool === 'inventory' ? player.inventory[index as number] : player.equipment[index as EquipmentSlot];
        if (item) {
            setDraggingItem({ source: pool, index: index, type: item.type, amount: item.amount });
        }
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-md z-40"
        onClick={() => setIsInventoryOpen(false)}
      />
      <motion.div 
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        onMouseEnter={() => setIsHoveringInventoryWindow(true)}
        onMouseLeave={() => setIsHoveringInventoryWindow(false)}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#050505] border border-white/10 p-8 shadow-[0_30px_120px_rgba(0,0,0,1)] rounded-[3rem] flex flex-col gap-8 min-w-[700px]"
      >
        <div className="flex justify-between items-center">
            <h2 className="text-white font-black text-lg uppercase tracking-[0.5em] drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">INVENTARIO</h2>
            <button 
                onClick={() => setIsInventoryOpen(false)}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all group active:scale-90"
            >
                <X size={20} className="text-white/40 group-hover:text-white transition-colors" />
            </button>
        </div>

        <div className="flex gap-10">
            {/* Left: Character Equipment */}
            <div className="flex-1 flex flex-col gap-6">
                <div className="relative h-[440px] bg-[#0a0a0a] rounded-[2.5rem] border border-white/5 p-4 flex items-center justify-center overflow-hidden shadow-inner">
                    {/* Background Grids and Decorations */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px]" />
                    </div>
                    
                    {/* Character Sprite Display */}
                    <div className="relative z-0 flex flex-col items-center w-56 h-72">
                        <PlayerPreview player={player} scale={4} />
                    </div>

                    {/* Equipment Slots */}
                    <div className="absolute inset-0">
                        {EQUIPMENT_SLOTS.map(slot => (
                            <div 
                                key={slot.id}
                                onClick={() => handleSlotClick('equipment', slot.id)}
                                onMouseEnter={() => setHoveredEquipSlot(slot.id)}
                                onMouseLeave={() => setHoveredEquipSlot(null)}
                                className={`absolute ${slot.pos} w-[54px] h-[54px] bg-black/60 backdrop-blur-2xl border rounded-2xl flex items-center justify-center cursor-pointer transition-all ${
                                    draggingItem?.source === 'equipment' && draggingItem?.index === slot.id ? 'opacity-30 border-amber-500/50 scale-95' :
                                    hoveredEquipSlot === slot.id ? 'border-white/40 bg-white/10 scale-110 z-20 shadow-[0_0_40px_rgba(255,255,255,0.1)]' : 'border-white/10'
                                }`}
                            >
                                {player.equipment[slot.id] ? (
                                    renderItemContent(player.equipment[slot.id]!)
                                ) : (
                                    <div className="text-white/10 opacity-40">{slot.icon}</div>
                                )}
                                
                                {hoveredEquipSlot === slot.id && !draggingItem && (
                                    <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-2xl whitespace-nowrap z-30">
                                        {slot.label}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tool Slots */}
                <div className="grid grid-cols-4 gap-4">
                    {TOOL_SLOTS.map(slot => (
                        <div 
                            key={slot.id}
                            onClick={() => handleSlotClick('equipment', slot.id)}
                            onMouseEnter={() => setHoveredEquipSlot(slot.id)}
                            onMouseLeave={() => setHoveredEquipSlot(null)}
                            className={`h-[90px] bg-white/[0.02] backdrop-blur-xl border rounded-[1.2rem] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                                draggingItem?.source === 'equipment' && draggingItem?.index === slot.id ? 'opacity-30 border-amber-500/50 scale-95' :
                                hoveredEquipSlot === slot.id ? 'border-white/40 bg-white/10 scale-105 shadow-2xl' : 'border-white/5'
                            }`}
                        >
                            {player.equipment[slot.id] ? (
                                renderItemContent(player.equipment[slot.id]!)
                            ) : (
                                <div className="w-6 h-6 rounded-full border border-white/5 flex items-center justify-center">
                                    <HelpCircle size={16} className="text-white/5" />
                                </div>
                            )}
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">{slot.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Grid Inventory */}
            <div className="w-[280px] flex flex-col gap-6 pt-4">
                <div className="flex justify-end items-center px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-white/10 rounded-full" />
                        <span className="text-[10px] font-black text-white/20 tabular-nums tracking-widest">{player.inventory.filter(i => i).length}/{INVENTORY_SIZE}</span>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    {player.inventory.map((item, i) => (
                        <div
                            key={i}
                            onMouseEnter={() => setHoveredInvIndex(i)}
                            onMouseLeave={() => setHoveredInvIndex(null)}
                            onClick={() => handleSlotClick('inventory', i)}
                            className={`relative w-[54px] h-[54px] bg-white/[0.03] border flex items-center justify-center transition-all cursor-pointer rounded-xl ${
                                hoveredInvIndex === i && draggingItem && (draggingItem.source !== 'inventory' || draggingItem.index !== i)
                                    ? 'border-amber-400 bg-white/[0.1] shadow-[0_0_50px_rgba(251,191,36,0.3)] scale-110 z-10'
                                    : hoveredInvIndex === i ? 'border-white/20 bg-white/[0.08] hover:scale-110 z-10' : 'border-white/5 hover:scale-105'
                            } ${draggingItem?.source === 'inventory' && draggingItem?.index === i ? 'opacity-30 border-amber-500/50 scale-95' : 'active:scale-95'}`}
                        >
                            {item && renderItemContent(item)}
                            
                            {hoveredInvIndex === i && item && !draggingItem && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="absolute bottom-full mb-5 left-1/2 -translate-x-1/2 z-[60] bg-white text-black px-3 py-1 whitespace-nowrap rounded-lg font-black text-[9px] uppercase tracking-tighter shadow-2xl pointer-events-none"
                                >
                                    {RESOURCE_NAMES[item.type as ResourceType] || TOOL_NAMES[item.type as ToolType] || item.type.replace('_', ' ').toUpperCase()}
                                </motion.div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </motion.div>
    </>
  );
}
