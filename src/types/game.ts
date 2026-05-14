export interface Point {
  x: number;
  y: number;
}

export type ResourceType = 'wood' | 'stone' | 'iron' | 'copper' | 'coal' | 'gold' | 'diamond' | 'fiber' | 'meat' | 'aluminum' | 'silver';
export type ToolType = 'axe_wood' | 'pickaxe_wood' | 'spear_wood' | 'knife_wood' | 'super_axe' | 'super_pickaxe';
export type TileType = 'grass' | 'dirt' | 'water' | 'limestone' | 'snow';

export interface ToolItem {
  id: string;
  type: ToolType;
}

export type AnimalType = 'firefly' | 'butterfly';

export interface Animal {
  id: string;
  type: AnimalType;
  pos: Point;
  vel: Point;
  targetPos: Point | null;
  state: 'idle' | 'moving' | 'fleeing';
  timer: number;       // For state transitions
  z: number;           // Height offset for jump/fly
  vz: number;          // Vertical velocity
  scale: number;       // Random sizing
  facingLeft: boolean; // Sprite flipping
  color: string;       // Variation
}

export type EnemyType = 'spider';
export type EnemyState = 'wander_idle' | 'wander_moving' | 'alert' | 'chasing' | 'returning' | 'pounce_windup' | 'pounce_jump';

export interface Enemy {
  id: string;
  type: EnemyType;
  rarity: 'normal' | 'fuerte';
  pos: Point;
  vel: Point;
  state: EnemyState;
  timer: number;
  facingLeft: boolean;
  scale: number;
  z: number;
  homePos: Point;
  pounceCooldown: number;
  name: string;
  hp: number;
  maxHp: number;
  level: number;
  attack: number;
}

export interface Particle {
  id: string;
  type: 'leaf' | 'fish' | 'footprint' | 'ripple' | 'gold_sparkle' | 'diamond_sparkle';
  pos: Point;
  vel: Point;
  life: number;
  maxLife: number;
  rotation: number;
}

export interface Cloud {
  id: string;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
}

export interface Tile {
  type: TileType;
  height: number;
  explored?: boolean;
  variation?: number;
}

export interface InventoryItem {
  id?: string;
  type: ResourceType | ToolType;
  amount: number;
}

export interface WorldResource {
  id: string;
  type: ResourceType;
  pos: Point;
  amount: number;
  maxAmount: number;
  scale?: number;
  variation?: number;
  isDepleted?: boolean;
  tiles?: Point[]; // Local coordinates of tiles this resource covers
  isStick?: boolean;
  treeType?: 'normal' | 'snowy';
}

export interface DroppedItem {
  id: string;
  type: ResourceType;
  amount: number;
  pos: Point;
}

export type EquipmentSlot = 'head' | 'chest' | 'legs' | 'feet' | 'hands' | 'neck' | 'belt' | 'ring1' | 'ring2' | 'tool_axe' | 'tool_pickaxe' | 'tool_spear' | 'tool_knife';

export interface Player {
  name: string;
  level: number;
  xp: number;
  maxXp: number;
  pos: Point;
  targetPos: Point;
  speed: number;
  dir: string;
  animFrame: number;
  isMoving: boolean;
  inventory: (InventoryItem | null)[];
  hotbar: (ToolItem | null)[];
  equipment: Record<EquipmentSlot, InventoryItem | null>;
  selectedHotbarIndex: number;
  harvestingId: string | null;
  harvestProgress: number;
  idleTime: number;
  vel: Point;
  hp: number;
  maxHp: number;
}

export const TILE_SIZE = 64; 
export const MAP_SIZE = 1000; 
export const INVENTORY_SIZE = 20;
export const STACK_LIMIT = 100;
