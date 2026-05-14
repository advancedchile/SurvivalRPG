import { InventoryItem, ResourceType, ToolType, STACK_LIMIT } from '../types/game';

export const getNewInventory = (inventory: (InventoryItem | null)[], type: ResourceType | ToolType, amount: number): { inventory: (InventoryItem | null)[], full: boolean } => {
    let newInv = [...inventory];
    let remaining = amount;

    // 1. Try to stack with existing items of same type
    for (let i = 0; i < newInv.length; i++) {
        const item = newInv[i];
        if (item && item.type === type && item.amount < STACK_LIMIT) {
          const space = STACK_LIMIT - item.amount;
          const take = Math.min(space, remaining);
          newInv[i] = { ...item, amount: item.amount + take };
          remaining -= take;
        }
        if (remaining <= 0) break;
    }

    // 2. Fill empty slots if still remaining
    if (remaining > 0) {
      for (let i = 0; i < newInv.length; i++) {
        if (!newInv[i]) {
          const take = Math.min(STACK_LIMIT, remaining);
          newInv[i] = { type, amount: take };
          remaining -= take;
        }
        if (remaining <= 0) break;
      }
    }

    return { inventory: newInv, full: remaining > 0 };
  };
