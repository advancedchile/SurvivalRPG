import React, { useState, useEffect } from 'react';
import { ResourceType } from '../types/game';

export function useAssets() {
  const [customAssets, setCustomAssets] = useState<Record<ResourceType, HTMLImageElement[]>>({
    wood: [], stone: [], fiber: [], meat: [], iron: [], copper: [], coal: [], gold: [], diamond: [], aluminum: [], silver: []
  });
  
  const [choppedWoodAssets, setChoppedWoodAssets] = useState<HTMLImageElement[]>([]);
  const [snowyTreeAssets, setSnowyTreeAssets] = useState<HTMLImageElement[]>([]);
  const [stickAssets, setStickAssets] = useState<HTMLImageElement[]>([]);
  
  const [axeImage, setAxeImage] = useState<HTMLImageElement | null>(null);
  const [pickaxeImage, setPickaxeImage] = useState<HTMLImageElement | null>(null);
  const [grassTextures, setGrassTextures] = useState<HTMLImageElement[]>([]);
  const [dirtTextures, setDirtTextures] = useState<HTMLImageElement[]>([]);
  const [woodIcon, setWoodIcon] = useState<HTMLImageElement | null>(null);
  const [stoneIcon, setStoneIcon] = useState<HTMLImageElement | null>(null);
  const [coalIcon, setCoalIcon] = useState<HTMLImageElement | null>(null);
  const [copperIcon, setCopperIcon] = useState<HTMLImageElement | null>(null);
  const [ironIcon, setIronIcon] = useState<HTMLImageElement | null>(null);
  const [goldIcon, setGoldIcon] = useState<HTMLImageElement | null>(null);
  const [diamondIcon, setDiamondIcon] = useState<HTMLImageElement | null>(null);
  const [aluminumIcon, setAluminumIcon] = useState<HTMLImageElement | null>(null);
  const [silverIcon, setSilverIcon] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const imgAxe = new Image();
    imgAxe.src = '/assets/tools/super_axe.png';
    imgAxe.onload = () => setAxeImage(imgAxe);

    const imgPickaxe = new Image();
    imgPickaxe.src = '/assets/tools/super_pickaxe.png';
    imgPickaxe.onload = () => setPickaxeImage(imgPickaxe);

    const loadTileImages = (dir: string, baseName: string, setter: React.Dispatch<React.SetStateAction<HTMLImageElement[]>>) => {
      const MAX_TILES = 50;
      const promises = [];
      for (let i = 1; i <= MAX_TILES; i++) {
        promises.push(new Promise<HTMLImageElement | null>(resolve => {
          const img = new Image();
          img.src = `/assets/tiles/${dir}/${baseName}${i}.png`;
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
        }));
      }
      Promise.all(promises).then(results => {
        setter(results.filter(img => img !== null) as HTMLImageElement[]);
      });
    };

    loadTileImages('grass', 'pasto', setGrassTextures);
    loadTileImages('dirt', 'dirt', setDirtTextures);

    const imgWood = new Image();
    imgWood.src = '/assets/wood/log_icon.png';
    imgWood.onload = () => setWoodIcon(imgWood);

    const imgStone = new Image();
    imgStone.src = '/assets/stone/stone_icon.png';
    imgStone.onload = () => setStoneIcon(imgStone);

    const imgCoal = new Image();
    imgCoal.src = '/assets/coal/coal_icon.png';
    imgCoal.onload = () => setCoalIcon(imgCoal);

    const icons = [
        { src: '/assets/copper/copper_icon.png', setter: setCopperIcon },
        { src: '/assets/iron/iron_icon.png', setter: setIronIcon },
        { src: '/assets/gold/gold_icon.png', setter: setGoldIcon },
        { src: '/assets/diamond/diamond_icon.png', setter: setDiamondIcon },
        { src: '/assets/aluminum/aluminum_icon.png', setter: setAluminumIcon },
        { src: '/assets/silver/silver_icon.png', setter: setSilverIcon }
    ];

    icons.forEach(icon => {
        const img = new Image();
        img.src = icon.src;
        img.onload = () => icon.setter(img);
    });
  }, []);

  useEffect(() => {
    // Glob scan for public assets matching resource types
    const assetGlobs = (import.meta as any).glob('/public/assets/**/*.{png,jpg,jpeg,webp,gif}', { eager: true, query: '?url', import: 'default' });
    
    const loadedImages: Record<ResourceType, HTMLImageElement[]> = {
      wood: [], stone: [], fiber: [], meat: [], iron: [], copper: [], coal: [], gold: [], diamond: [], aluminum: [], silver: []
    };

    const loadPromises: Promise<void>[] = [];

    const paths = Object.entries(assetGlobs);
    for (const [path, url] of paths) {
      let type: ResourceType | null = null;
      let isChopped = false;
      let isStick = false;
      let isSnowyTree = false;
      if (path.includes('/wood/')) {
         if (path.includes('shoped_tree')) {
            isChopped = true;
         } else if (path.includes('/wood/snowy_trees/')) {
            isSnowyTree = true;
         } else if (path.includes('log_icon.png')) {
            // Skip the icon for tree assets
         } else {
            type = 'wood';
         }
      } else if (path.includes('/sticks/')) {
         isStick = true;
      } else if (path.includes('/stone/')) {
         if (path.includes('stone_icon.png')) {
            // Skip icon
         } else {
            type = 'stone';
         }
      } else if (path.includes('/fiber/')) type = 'fiber';
      else if (path.includes('/meat/')) type = 'meat';
      else if (path.includes('/iron/')) type = 'iron';
      else if (path.includes('/copper/')) type = 'copper';
      else if (path.includes('/coal/')) {
         if (path.includes('coal_icon.png')) {
            // Skip
         } else {
            type = 'coal';
         }
      } else if (path.includes('/gold/')) {
         if (path.includes('gold_icon.png')) {} else type = 'gold';
      } else if (path.includes('/diamond/')) {
         if (path.includes('diamond_icon.png')) {} else type = 'diamond';
      } else if (path.includes('/iron/')) {
         if (path.includes('iron_icon.png')) {} else type = 'iron';
      } else if (path.includes('/copper/')) {
         if (path.includes('copper_icon.png')) {} else type = 'copper';
      } else if (path.includes('/aluminum/')) {
         if (path.includes('aluminum_icon.png')) {} else type = 'aluminum';
      } else if (path.includes('/silver/')) {
         if (path.includes('silver_icon.png')) {} else type = 'silver';
      }

      if (type || isChopped || isStick || isSnowyTree) {
        const promise = new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
             if (isChopped) {
                 setChoppedWoodAssets(prev => [...prev, img]);
             } else if (isSnowyTree) {
                 setSnowyTreeAssets(prev => [...prev, img]);
             } else if (isStick) {
                 setStickAssets(prev => [...prev, img]);
             } else if (type) {
                 loadedImages[type as ResourceType].push(img);
             }
             resolve();
          };
          img.onerror = () => resolve();
          img.src = url as string;
        });
        loadPromises.push(promise);
      }
    }

    Promise.all(loadPromises).then(() => {
      setCustomAssets(loadedImages);
    });

  }, []);

  return {
    customAssets,
    choppedWoodAssets,
    snowyTreeAssets,
    stickAssets,
    axeImage,
    pickaxeImage,
    grassTextures,
    dirtTextures,
    woodIcon,
    stoneIcon,
    coalIcon,
    copperIcon,
    ironIcon,
    goldIcon,
    diamondIcon,
    aluminumIcon,
    silverIcon
  };
}
