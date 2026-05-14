import { Point } from '../types/game';

export function drawWaterAnimations(
  ctx: CanvasRenderingContext2D,
  iso: Point,
  x: number,
  y: number,
  zoom: number,
  tileSize: number
) {
  const t = Date.now() * 0.0015;
  ctx.lineWidth = 1 / zoom;
  
  // Base water waves (more organic with combined sine/cosine)
  for (let i = 0; i < 4; i++) {
    const offsetY = i * 5 - 8;
    const phaseX = (x * 0.4) + (y * 0.3) + i * 1.5;
    const phaseY = (x * 0.2) + (y * 0.6) + i * 0.8;
    
    // Complex wave movement
    const waveX = Math.sin(t + phaseX) * 4 + Math.cos(t * 0.8 + phaseY) * 2;
    const waveY = Math.cos(t + phaseY) * 1.5;
    
    // Dynamic opacity based on wave height
    const opacity = 0.15 + (Math.sin(t * 1.5 + phaseX) * 0.05);
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, opacity)})`;
    
    ctx.beginPath();
    // Curvier lines using quadratic curves
    const startX = iso.x - 14 + waveX - i * 1.5;
    const startY = iso.y + tileSize / 4 + offsetY + waveY;
    const endX = iso.x + 10 + waveX + i * 1.5;
    const endY = iso.y + tileSize / 4 + offsetY - waveY;
    
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(
      iso.x + waveX, startY + 2, 
      endX, endY
    );
    ctx.stroke();
  }

  // Sparkling highlights (Reflejos de luz en el agua)
  const sparklePhase = (x * 7.7 + y * 3.3 + t * 2) % (Math.PI * 2);
  if (Math.sin(sparklePhase) > 0.95) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    const px = Math.cos(t + x) * 8;
    const py = Math.sin(t + y) * 4;
    ctx.beginPath();
    ctx.arc(iso.x + px, iso.y + tileSize / 4 + py, 1.2 / zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}
