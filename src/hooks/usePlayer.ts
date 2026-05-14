import { useState } from 'react';
import { Player, INVENTORY_SIZE, MAP_SIZE, ToolType } from '../types/game';

export const usePlayer = () => {
    const [player, setPlayer] = useState<Player>({
        name: 'Xaiross',
        level: 1,
        xp: 0,
        maxXp: 100,
        pos: { x: MAP_SIZE / 2, y: MAP_SIZE / 2 },
        targetPos: { x: MAP_SIZE / 2, y: MAP_SIZE / 2 },
        speed: 0.045,
        dir: 's',
        animFrame: 0,
        isMoving: false,
        inventory: Array(INVENTORY_SIZE).fill(null),
        hotbar: Array(10).fill(null),
        equipment: {
            head: null, chest: null, legs: null, feet: null, hands: null, neck: null, belt: null, ring1: null, ring2: null,
            tool_axe: { id: 'start_super_axe', type: 'super_axe' as ToolType, amount: 1 },
            tool_pickaxe: { id: 'start_super_pickaxe', type: 'super_pickaxe' as ToolType, amount: 1 },
            tool_spear: null,
            tool_knife: null
        },
        selectedHotbarIndex: 0,
        harvestingId: null,
        harvestProgress: 0,
        idleTime: 0,
        vel: { x: 0, y: 0 },
        hp: 100,
        maxHp: 100,
    });

    return { player, setPlayer };
};
