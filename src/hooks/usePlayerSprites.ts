import { useState, useEffect } from 'react';

export type PlayerAction = 'idle' | 'walk' | 'harvest';
export type PlayerDirection = 's' | 'se' | 'e' | 'ne' | 'n' | 'nw' | 'w' | 'sw';

export interface SpriteInfo {
  image: HTMLImageElement;
  frames: number;
}

export function usePlayerSprites() {
  const [sprites, setSprites] = useState<Record<string, SpriteInfo>>({});

  useEffect(() => {
    const states: PlayerAction[] = ['idle', 'walk', 'harvest'];
    const dirs: PlayerDirection[] = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'];
    const loadedSprites: Record<string, SpriteInfo> = {};

    let loadedCount = 0;
    const totalCount = states.length * dirs.length;

    states.forEach(state => {
      dirs.forEach(dir => {
        const key = `${state}_${dir}`;
        const img = new Image();
        img.onload = () => {
          // Asumimos que los frames son cuadrados (width = height por frame)
          const frames = Math.max(1, Math.floor(img.width / img.height));
          loadedSprites[key] = { image: img, frames: frames }; 
          setSprites(prev => ({ ...prev, [key]: loadedSprites[key] }));
        };
        img.onerror = () => {
          // Si no existe, usamos un fallback temporal (o simplemente no lo registramos)
        };
        img.src = `${import.meta.env.BASE_URL}sprites/player/${key}.png`;
      });
    });
  }, []);

  const getSprite = (action: PlayerAction, dir: PlayerDirection): { sprite: SpriteInfo | null, flipX: boolean } => {
    // Intentar obtener el sprite exacto
    const exactKey = `${action}_${dir}`;
    if (sprites[exactKey]) return { sprite: sprites[exactKey], flipX: false };

    // Si esperamos 'w' (oeste) y tenemos 'e' (este), podemos usar 'e' con flip
    if (dir === 'w' && sprites[`${action}_e`]) return { sprite: sprites[`${action}_e`], flipX: true };
    // Si esperamos 'sw' y tenemos 'se'
    if (dir === 'sw' && sprites[`${action}_se`]) return { sprite: sprites[`${action}_se`], flipX: true };
    // Si esperamos 'nw' y tenemos 'ne'
    if (dir === 'nw' && sprites[`${action}_ne`]) return { sprite: sprites[`${action}_ne`], flipX: true };

    // Fallbacks simples si no hay dirección exacta
    if (sprites[`${action}_s`]) return { sprite: sprites[`${action}_s`], flipX: false };
    if (sprites['idle_s']) return { sprite: sprites['idle_s'], flipX: false };

    return { sprite: null, flipX: false };
  };

  return { sprites, getSprite };
}
