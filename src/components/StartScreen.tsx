import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { generateTile } from '../services/mapGenerator';
import { TILE_SIZE, MAP_SIZE } from '../types/game';

interface StartScreenProps {
  onPlay: () => void;
}

const toIso = (x: number, y: number) => ({
  x: (x - y) * (TILE_SIZE / 2),
  y: (x + y) * (TILE_SIZE / 4),
});

// ---- Creature Types for Start Screen ----
interface ScreenCreature {
  type: 'spider' | 'butterfly' | 'firefly';
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  facingLeft: boolean;
  timer: number;
  z: number; // height for flying creatures
  color?: string;
  state: 'idle' | 'moving';
}

function createCreatures(centerX: number, centerY: number, radius: number): ScreenCreature[] {
  const creatures: ScreenCreature[] = [];
  
  // 2 spiders
  for (let i = 0; i < 2; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * (radius * 0.4);
    creatures.push({
      type: 'spider',
      x: centerX + Math.cos(angle) * dist,
      y: centerY + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.002,
      vy: (Math.random() - 0.5) * 0.002,
      scale: 0.35 + Math.random() * 0.1,
      facingLeft: Math.random() > 0.5,
      timer: 2000 + Math.random() * 3000,
      z: 0,
      state: 'moving',
    });
  }
  
  // 2 butterflies
  for (let i = 0; i < 2; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2 + Math.random() * (radius * 0.4);
    creatures.push({
      type: 'butterfly',
      x: centerX + Math.cos(angle) * dist,
      y: centerY + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.002,
      vy: (Math.random() - 0.5) * 0.002,
      scale: 0.4 + Math.random() * 0.2,
      facingLeft: Math.random() > 0.5,
      timer: 1500 + Math.random() * 3000,
      z: 1.5,
      state: 'moving',
    });
  }
  
  // 3 fireflies
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2 + Math.random() * (radius * 0.5);
    const colors = ['#aaff00', '#ffdd00', '#88ff44'];
    creatures.push({
      type: 'firefly',
      x: centerX + Math.cos(angle) * dist,
      y: centerY + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.001,
      vy: (Math.random() - 0.5) * 0.001,
      scale: 0.2 + Math.random() * 0.15,
      facingLeft: false,
      timer: 1500 + Math.random() * 3000,
      z: 2.5,
      color: colors[i % colors.length],
      state: 'moving',
    });
  }
  
  return creatures;
}

// ---- Spider leg kinematics (simplified from enemyRenderer) ----
function getLegKinematics(cycle: number) {
  let phi = (cycle / (Math.PI * 2)) % 1;
  if (phi < 0) phi += 1;
  let stride = 0;
  let lift = 0;
  const swingRatio = 0.35;
  if (phi < swingRatio) {
    const swingProgress = phi / swingRatio;
    stride = -1 + 2 * Math.sin(swingProgress * Math.PI / 2);
    lift = Math.sin(swingProgress * Math.PI);
  } else {
    const stanceProgress = (phi - swingRatio) / (1 - swingRatio);
    stride = 1 - 2 * stanceProgress;
    lift = -Math.sin(stanceProgress * Math.PI) * 0.2;
  }
  return { stride, lift };
}

function drawScreenSpider(ctx: CanvasRenderingContext2D, creature: ScreenCreature, isoX: number, isoY: number, zoom: number) {
  const t = Date.now() * 0.002;
  const scale = creature.scale * 10;
  const hasVelocity = Math.abs(creature.vx) > 0.0001 || Math.abs(creature.vy) > 0.0001;
  const walkCycle = hasVelocity ? t * 0.5 : 0;

  ctx.save();
  ctx.translate(isoX, isoY);
  if (creature.facingLeft) ctx.scale(-1, 1);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 5, scale * 1.5, scale * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyBob = walkCycle > 0 ? Math.cos(walkCycle * Math.PI * 4) * 0.5 : 0;
  ctx.translate(0, -bodyBob);

  const drawLeg = (i: number, isFar: boolean) => {
    const legPhase = (i * Math.PI * 0.4) + (isFar ? Math.PI : 0);
    const legCycle = walkCycle * 2.0 + legPhase;
    let { stride, lift } = getLegKinematics(legCycle);
    if (!hasVelocity) {
      const slowShift = Math.sin(t * 0.8 + i * 1.5 + (isFar ? 1 : 0));
      stride += slowShift * 0.08;
      lift += Math.max(0, slowShift * 0.08);
    }
    const strideScale = 6.5 * scale * 0.5;
    const liftScale = 4.0 * scale * 0.4;
    const rootX = scale * 0.3 - i * 0.6 * scale;
    const rootY = -scale * 0.3;
    const baseRestX = scale * 2.2 - i * 1.3 * scale;
    const baseRestY = scale * 1.1;
    const footX = baseRestX + stride * strideScale * (isFar ? 0.8 : 1.1);
    const footY = baseRestY - lift * liftScale * (isFar ? 0.8 : 1.1);
    const kneeX = rootX + (footX - rootX) * 0.55;
    const kneeY = rootY - scale * 0.8 - lift * liftScale * 1.2;
    const ankleX = rootX + (footX - rootX) * 0.85;
    const ankleY = kneeY + (footY - kneeY) * 0.4 + scale * 0.1;

    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(ankleX, ankleY);
    ctx.lineTo(footX, footY);
    ctx.strokeStyle = isFar ? '#111' : '#1a1a1a';
    ctx.lineWidth = (isFar ? 1.5 : 2.0) / zoom;
    ctx.stroke();
  };

  // Far legs
  for (let i = 0; i < 4; i++) drawLeg(i, true);

  // Abdomen
  const abdomenSway = walkCycle > 0 ? Math.sin(walkCycle * Math.PI * 2) * 0.1 : 0;
  ctx.save();
  ctx.translate(-scale * 0.8, -scale * 0.5);
  ctx.rotate(abdomenSway);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(0, 0, scale * 1.3, scale * 0.9, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Cephalothorax
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(scale * 0.4, -scale * 0.3, scale * 0.7, scale * 0.5, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Near legs
  for (let i = 0; i < 4; i++) drawLeg(i, false);

  // Eyes
  ctx.fillStyle = '#ff0000';
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(scale * 0.9, -scale * 0.4, 1.5 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(scale * 1.0, -scale * 0.25, 1.5 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawScreenButterfly(ctx: CanvasRenderingContext2D, creature: ScreenCreature, isoX: number, isoY: number) {
  const scale = creature.scale;
  ctx.save();
  ctx.translate(isoX, isoY - creature.z);
  if (creature.facingLeft) ctx.scale(-1, 1);

  const wingPhase = Math.sin(Date.now() * 0.03);
  const wPhaseAbs = Math.max(0.1, Math.abs(wingPhase));

  // Right Wing
  ctx.fillStyle = '#ff9900';
  ctx.beginPath();
  ctx.ellipse(2.5 * scale, -2 * scale * wPhaseAbs, 3 * scale, 4 * scale * wPhaseAbs, 0, 0, Math.PI * 2);
  ctx.fill();

  // Left Wing
  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.ellipse(-2.5 * scale, -2 * scale * wPhaseAbs, 3 * scale, 4 * scale * wPhaseAbs, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.ellipse(0, 0, 1 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawScreenFirefly(ctx: CanvasRenderingContext2D, creature: ScreenCreature, isoX: number, isoY: number) {
  ctx.save();
  ctx.translate(isoX, isoY - creature.z);

  const time = Date.now();
  const flicker = 0.5 + 0.5 * Math.sin(time * 0.002 + creature.y * 10);

  ctx.globalCompositeOperation = 'lighter';

  // Core
  ctx.fillStyle = creature.color || '#aaff00';
  ctx.globalAlpha = 0.5 + flicker * 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Glow
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
  grd.addColorStop(0, creature.color || '#aaff00');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.globalAlpha = flicker * 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

export function StartScreen({ onPlay }: StartScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const creaturesRef = useRef<ScreenCreature[]>([]);
  const mapDataRef = useRef<{ centerX: number; centerY: number; zoom: number; radius: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    ctx.imageSmoothingEnabled = false;

    // Pick a random area in the map (avoid edges)
    const centerX = Math.floor(MAP_SIZE * 0.3 + Math.random() * MAP_SIZE * 0.4);
    const centerY = Math.floor(MAP_SIZE * 0.3 + Math.random() * MAP_SIZE * 0.4);

    const zoom = 1.2;
    const radius = Math.ceil(Math.max(w, h) / (TILE_SIZE * zoom)) + 6;

    mapDataRef.current = { centerX, centerY, zoom, radius };
    creaturesRef.current = createCreatures(centerX, centerY, radius);

    // Pre-render terrain to an offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d')!;
    offCtx.imageSmoothingEnabled = false;

    const camIso = toIso(centerX, centerY);

    offCtx.fillStyle = '#1a1a1a';
    offCtx.fillRect(0, 0, w, h);

    offCtx.save();
    offCtx.translate(w / 2, h / 2);
    offCtx.scale(zoom, zoom);
    offCtx.translate(-camIso.x, -camIso.y);

    const minX = centerX - radius;
    const maxX = centerX + radius;
    const minY = centerY - radius;
    const maxY = centerY + radius;

    for (let sum = minX + minY; sum <= maxX + maxY; sum++) {
      for (let x = minX; x <= maxX; x++) {
        const y = sum - x;
        if (y < minY || y > maxY) continue;
        if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) continue;

        const tile = generateTile(x, y);
        const isWater = tile.type === 'water';
        const zOff = -tile.height + (isWater ? 8 : 0);

        const isoBase = toIso(x, y);
        const iso = { x: isoBase.x, y: isoBase.y + zOff };

        // Top face
        let r: number, g: number, b: number;
        if (tile.type === 'grass') { r = 66; g = 105; b = 56; }
        else if (tile.type === 'dirt') { r = 112; g = 84; b = 62; }
        else if (tile.type === 'limestone') { r = 120; g = 120; b = 120; }
        else if (tile.type === 'snow') { r = 230; g = 235; b = 245; }
        else { r = 59; g = 130; b = 168; } // water

        let nBase = 0;
        if (!isWater) {
          const noise = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
          nBase = (noise - 0.5) * (tile.type === 'snow' ? 5 : 10);
        }

        offCtx.fillStyle = `rgb(${r + nBase}, ${g + nBase}, ${b + nBase})`;
        offCtx.beginPath();
        offCtx.moveTo(iso.x, iso.y);
        offCtx.lineTo(iso.x + TILE_SIZE / 2, iso.y + TILE_SIZE / 4);
        offCtx.lineTo(iso.x, iso.y + TILE_SIZE / 2);
        offCtx.lineTo(iso.x - TILE_SIZE / 2, iso.y + TILE_SIZE / 4);
        offCtx.closePath();
        offCtx.fill();
        offCtx.strokeStyle = offCtx.fillStyle;
        offCtx.lineWidth = 1 / zoom;
        offCtx.stroke();

        // Grass details
        if (tile.type === 'grass' || tile.type === 'dirt') {
          const detailSeed = x * 123.456 + y * 789.012;
          const detailNoise = Math.abs(Math.sin(detailSeed) * 54321.1234) % 1;
          if (detailNoise > 0.8) {
            const posX = iso.x + (Math.sin(detailSeed * 10) * TILE_SIZE / 3);
            const posY = iso.y + TILE_SIZE / 4 + (Math.cos(detailSeed * 10) * TILE_SIZE / 6);
            offCtx.fillStyle = `rgb(${Math.max(0, r - 25)}, ${Math.max(0, g - 15)}, ${Math.max(0, b - 25)})`;
            offCtx.beginPath();
            offCtx.arc(posX, posY, 1.5, 0, Math.PI * 2);
            offCtx.fill();
          }
        }

        // Side walls
        const wallH = 40;
        const wallColor = isWater ? '#2a6382'
          : tile.type === 'dirt' ? '#5c4331'
          : tile.type === 'limestone' ? '#606060'
          : tile.type === 'snow' ? '#cbd5e1'
          : '#2f4f26';

        // Left wall
        offCtx.fillStyle = wallColor;
        offCtx.beginPath();
        offCtx.moveTo(iso.x - TILE_SIZE / 2, iso.y + TILE_SIZE / 4);
        offCtx.lineTo(iso.x, iso.y + TILE_SIZE / 2);
        offCtx.lineTo(iso.x, iso.y + TILE_SIZE / 2 + wallH);
        offCtx.lineTo(iso.x - TILE_SIZE / 2, iso.y + TILE_SIZE / 4 + wallH);
        offCtx.closePath();
        offCtx.fill();

        // Right wall
        offCtx.beginPath();
        offCtx.moveTo(iso.x + TILE_SIZE / 2, iso.y + TILE_SIZE / 4);
        offCtx.lineTo(iso.x, iso.y + TILE_SIZE / 2);
        offCtx.lineTo(iso.x, iso.y + TILE_SIZE / 2 + wallH);
        offCtx.lineTo(iso.x + TILE_SIZE / 2, iso.y + TILE_SIZE / 4 + wallH);
        offCtx.closePath();
        offCtx.fill();
      }
    }

    // Draw trees on the offscreen canvas (second pass so they're on top of terrain)
    offCtx.save();
    offCtx.translate(w / 2, h / 2);
    offCtx.scale(zoom, zoom);
    offCtx.translate(-camIso.x, -camIso.y);
    for (let sum = minX + minY; sum <= maxX + maxY; sum++) {
      for (let x = minX; x <= maxX; x++) {
        const y = sum - x;
        if (y < minY || y > maxY) continue;
        if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) continue;
        const tile = generateTile(x, y);
        if (tile.type === 'water' || tile.type === 'limestone') continue;
        // Use deterministic pseudo-random to place trees
        const seed = Math.abs(Math.sin(x * 45.17 + y * 93.71) * 43758.5453) % 1;
        if (seed > 0.12) continue; // ~12% chance of tree
        const isoBase = toIso(x, y);
        const zOff = -tile.height;
        const tIso = { x: isoBase.x, y: isoBase.y + zOff };
        const treeScale = 0.55 + (seed * 0.3);
        const varVal = seed;
        const trunkH = 8 * treeScale;
        // Shadow
        offCtx.fillStyle = 'rgba(0,0,0,0.15)';
        offCtx.beginPath();
        offCtx.ellipse(tIso.x, tIso.y + 4 * treeScale, 32 * treeScale, 16 * treeScale, 0, 0, Math.PI * 2);
        offCtx.fill();
        // Trunk
        offCtx.fillStyle = tile.type === 'snow' ? '#A0A0A0' : '#4a2c2a';
        offCtx.fillRect(tIso.x - 3 * treeScale, tIso.y - trunkH, 6 * treeScale, trunkH);
        // Foliage
        const hueBase = tile.type === 'snow' ? 180 : 100;
        const baseColor = `hsl(${hueBase + varVal * 40}, ${30 + varVal * 20}%, ${20 + varVal * 15}%)`;
        const midColor = `hsl(${hueBase + varVal * 40}, ${35 + varVal * 20}%, ${25 + varVal * 15}%)`;
        const topColor = `hsl(${hueBase + varVal * 40}, ${40 + varVal * 20}%, ${30 + varVal * 15}%)`;
        if (tile.type === 'snow') {
          // Snowy tree: white/blue foliage
          offCtx.fillStyle = '#d8e8f0';
          offCtx.beginPath();
          offCtx.arc(tIso.x, tIso.y - trunkH - 4 * treeScale, 12 * treeScale, 0, Math.PI * 2);
          offCtx.fill();
          offCtx.fillStyle = '#e8f4ff';
          offCtx.beginPath();
          offCtx.arc(tIso.x - 4 * treeScale, tIso.y - trunkH - 12 * treeScale, 10 * treeScale, 0, Math.PI * 2);
          offCtx.arc(tIso.x + 4 * treeScale, tIso.y - trunkH - 12 * treeScale, 10 * treeScale, 0, Math.PI * 2);
          offCtx.fill();
          offCtx.fillStyle = '#f0f8ff';
          offCtx.beginPath();
          offCtx.arc(tIso.x, tIso.y - trunkH - 20 * treeScale, 9 * treeScale, 0, Math.PI * 2);
          offCtx.fill();
        } else {
          offCtx.fillStyle = baseColor;
          offCtx.beginPath();
          offCtx.arc(tIso.x, tIso.y - trunkH - 4 * treeScale, 12 * treeScale, 0, Math.PI * 2);
          offCtx.fill();
          offCtx.fillStyle = midColor;
          offCtx.beginPath();
          offCtx.arc(tIso.x - 4 * treeScale, tIso.y - trunkH - 12 * treeScale, 10 * treeScale, 0, Math.PI * 2);
          offCtx.arc(tIso.x + 4 * treeScale, tIso.y - trunkH - 12 * treeScale, 10 * treeScale, 0, Math.PI * 2);
          offCtx.fill();
          offCtx.fillStyle = topColor;
          offCtx.beginPath();
          offCtx.arc(tIso.x, tIso.y - trunkH - 20 * treeScale, 9 * treeScale, 0, Math.PI * 2);
          offCtx.fill();
        }
      }
    }
    offCtx.restore();

    // Animation loop for creatures
    let animId: number;
    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;

      const map = mapDataRef.current!;
      const camIsoPos = toIso(map.centerX, map.centerY);

      // Update creatures (matching game logic from App.tsx)
      for (const c of creaturesRef.current) {
        c.timer -= delta;

        // State machine
        if (c.timer <= 0) {
          if (c.state === 'idle') {
            if (Math.random() < 0.6) {
              c.state = 'moving';
              const angle = Math.random() * Math.PI * 2;
              if (c.type === 'spider') {
                c.vx = Math.cos(angle) * 0.002;
                c.vy = Math.sin(angle) * 0.002;
                c.timer = 2000 + Math.random() * 4000;
              } else if (c.type === 'butterfly') {
                c.vx = Math.cos(angle) * 0.003;
                c.vy = Math.sin(angle) * 0.003;
                c.timer = 1500 + Math.random() * 3000;
              } else {
                c.vx = Math.cos(angle) * 0.001;
                c.vy = Math.sin(angle) * 0.001;
                c.timer = 2000 + Math.random() * 3000;
              }
            } else {
              c.state = 'idle';
              c.timer = 1500 + Math.random() * 3000;
              if (c.type === 'spider') { c.vx = 0; c.vy = 0; }
            }
          } else {
            const tile = generateTile(Math.floor(c.x), Math.floor(c.y));
            if (c.type === 'butterfly' && tile.type === 'water') {
              // Butterflies won't idle over water
              c.state = 'moving';
              const angle = Math.random() * Math.PI * 2;
              c.vx = Math.cos(angle) * 0.003;
              c.vy = Math.sin(angle) * 0.003;
              c.timer = 1500 + Math.random() * 3000;
            } else {
              c.state = 'idle';
              c.timer = 1000 + Math.random() * 3000;
              if (c.type === 'spider') { c.vx = 0; c.vy = 0; }
            }
          }
        }

        // Continuous movement (matching game behavior)
        if (c.type === 'butterfly' || c.type === 'firefly') {
          if (c.state === 'moving') {
            const jitter = c.type === 'firefly' ? 0.0003 : 0.001;
            c.vx += (Math.random() - 0.5) * jitter;
            c.vy += (Math.random() - 0.5) * jitter;
            const speedSq = c.vx * c.vx + c.vy * c.vy;
            const maxSq = c.type === 'firefly' ? 0.000005 : 0.00002;
            if (speedSq > maxSq) { c.vx *= 0.9; c.vy *= 0.9; }
            if (c.type === 'butterfly') {
              c.z = Math.min(1.5 + Math.sin(Date.now() * 0.005 + c.x) * 1.0, c.z + 0.05);
            } else {
              c.z = 2.5 + Math.sin(Date.now() * 0.0005 + c.x) * 1.5;
            }
          } else {
            c.vx *= 0.95;
            c.vy *= 0.95;
            if (c.type === 'butterfly') {
              const tile = generateTile(Math.floor(c.x), Math.floor(c.y));
              if (tile.type === 'water') {
                // Keep flying if over water
                c.z = Math.min(1.5 + Math.sin(Date.now() * 0.005 + c.x) * 1.0, c.z + 0.05);
                c.state = 'moving';
                c.timer = 2000;
              } else {
                c.z = Math.max(0, c.z - 0.02); // Slowly land
              }
            } else {
              c.z = 2.5 + Math.sin(Date.now() * 0.0005 + c.x) * 1.5;
            }
          }
          if (c.vx < -0.0003) c.facingLeft = true;
          else if (c.vx > 0.0003) c.facingLeft = false;
        }

        c.x += c.vx * delta;
        c.y += c.vy * delta;
        if (c.type === 'spider') {
          if (c.vx < -0.0003) c.facingLeft = true;
          else if (c.vx > 0.0003) c.facingLeft = false;
        }

        // Spider water check
        if (c.type === 'spider') {
          const tile = generateTile(Math.floor(c.x), Math.floor(c.y));
          if (tile.type === 'water' || tile.type === 'snow') {
            c.vx *= -1; c.vy *= -1;
            c.x += c.vx * delta * 5;
            c.y += c.vy * delta * 5;
          }
        }

        // Keep within bounds
        const maxDist = map.radius * 0.5;
        const dx = c.x - map.centerX;
        const dy = c.y - map.centerY;
        if (dx * dx + dy * dy > maxDist * maxDist) {
          c.vx *= -1;
          c.vy *= -1;
          c.x += c.vx * delta * 5;
          c.y += c.vy * delta * 5;
        }
      }

      // Redraw
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(offscreen, 0, 0);

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(map.zoom, map.zoom);
      ctx.translate(-camIsoPos.x, -camIsoPos.y);

      // Sort creatures by y position for depth ordering
      const sorted = [...creaturesRef.current].sort((a, b) => (a.x + a.y) - (b.x + b.y));

      for (const c of sorted) {
        const cIso = toIso(c.x, c.y);
        if (c.type === 'spider') {
          drawScreenSpider(ctx, c, cIso.x, cIso.y, map.zoom);
        } else if (c.type === 'butterfly') {
          drawScreenButterfly(ctx, c, cIso.x, cIso.y);
        } else {
          drawScreenFirefly(ctx, c, cIso.x, cIso.y);
        }
      }

      ctx.restore();

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center select-none overflow-hidden">
      {/* Terrain background canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} />

      {/* Black overlay at 50% opacity */}
      <div className="absolute inset-0" style={{ backgroundColor: '#000000', opacity: 0.5 }} />

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center"
      >
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-1">
          Survival
          <span className="text-[#b8860b]">RPG</span>
        </h1>
        <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-[#b8860b]/60 to-transparent mb-2" />
        <p className="text-white/40 text-[10px] font-mono tracking-[0.4em] uppercase">
          Explora • Recolecta • Sobrevive
        </p>
      </motion.div>

      {/* Play button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        onClick={onPlay}
        className="relative z-10 mt-14 group cursor-pointer"
      >
        <div className="relative px-16 py-3 bg-[#b8860b] text-white font-black text-sm tracking-[0.3em] uppercase overflow-hidden transition-all duration-300 group-hover:shadow-[0_0_40px_rgba(184,134,11,0.4)]">
          {/* Shine effect on hover */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <span className="relative">Jugar</span>
        </div>
      </motion.button>

      {/* Version footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-6 z-10 text-white/30 text-[9px] font-mono tracking-widest"
      >
        v0.1.0 — ALPHA
      </motion.div>
    </div>
  );
}
