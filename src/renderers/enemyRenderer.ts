import { Enemy } from '../types/game';

function getLegKinematics(cycle: number) {
  // Normalizamos el ciclo a un rango de 0 a 1
  let phi = (cycle / (Math.PI * 2)) % 1;
  if (phi < 0) phi += 1;

  let stride = 0;
  let lift = 0;

  // Fase de Swing (Elevación/Empuje Hidráulico): más rápida (0 a 0.35)
  const swingRatio = 0.35;
  if (phi < swingRatio) {
    const swingProgress = phi / swingRatio; // de 0 a 1
    // Movimiento rápido hacia adelante
    stride = -1 + 2 * Math.sin(swingProgress * Math.PI / 2); // de -1 a 1
    lift = Math.sin(swingProgress * Math.PI); // sube y baja (0 -> 1 -> 0)
  } else {
    // Fase de Stance (Apoyo/Empuje): más lenta (0.35 a 1.0)
    const stanceProgress = (phi - swingRatio) / (1 - swingRatio); // de 0 a 1
    stride = 1 - 2 * stanceProgress; // de 1 a -1 de forma lineal/controlada
    // Ligera flexión bajo el peso del cuerpo (negativo)
    lift = -Math.sin(stanceProgress * Math.PI) * 0.2; 
  }

  return { stride, lift };
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  isoX: number,
  isoY: number,
  zoom: number
) {
  // Movimiento deliberado y mucho más lento
  const t = Date.now() * 0.002;
  const scale = enemy.scale * 10; // Base size
  // Estados
  const isWander = enemy.state === 'wander_moving';
  const isChasing = enemy.state === 'chasing';
  const isReturning = enemy.state === 'returning';
  const isPounceWindup = enemy.state === 'pounce_windup';
  const isPounceJump = enemy.state === 'pounce_jump';
  
  const hasVelocity = Math.abs(enemy.vel.x) > 0.0001 || Math.abs(enemy.vel.y) > 0.0001;
  const isIdle = enemy.state === 'wander_idle' || (!hasVelocity && !isPounceWindup && !isPounceJump);

  let speedMult = 0;
  if (isChasing) speedMult = 1.5;
  else if (isReturning) speedMult = 1.0;
  else if (isWander) speedMult = 0.5; // Caminar muy lento al deambular

  const walkCycle = ((isWander || isChasing || isReturning) && hasVelocity) ? t * speedMult : 0;
  
  // Balanceo del abdomen sincronizado con los pasos
  const abdomenSway = walkCycle > 0 ? Math.sin(walkCycle * Math.PI * 2) * 0.1 : 0;
  // Bobbing del cefalotórax (muy estable, casi no se mueve)
  const bodyBob = walkCycle > 0 ? Math.cos(walkCycle * Math.PI * 4) * 0.5 : 0;

  ctx.save();
  ctx.translate(isoX, isoY - enemy.z * 10);
  if (enemy.facingLeft) {
    ctx.scale(-1, 1);
  }

  // Draw shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 5, scale * 1.5, scale * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bodyBob);

  // Helper para dibujar patas con 3 articulaciones (Coxa-Fémur-Tibia)
  const drawLeg = (i: number, isFar: boolean) => {
    // Movimiento asíncrono y natural (Ola metacronal en lugar de trípode perfecto)
    // Cada pata tiene un desfase secuencial para que no se muevan exactamente al mismo tiempo
    const legPhase = (i * Math.PI * 0.4) + (isFar ? Math.PI : 0);
    const legCycle = walkCycle * 2.0 + legPhase;

    let { stride, lift } = getLegKinematics(legCycle);

    // Animación de reposo: Acomodo muy sutil y lento
    if (isIdle) {
        // Movimiento respiratorio muy lento
        const slowShift = Math.sin(t * 0.8 + i * 1.5 + (isFar ? 1 : 0));
        stride += slowShift * 0.08;
        lift += Math.max(0, slowShift * 0.08);
    }

    // Pounce Windup: Levantar las patas delanteras (Sutil)
    if (isPounceWindup) {
        if (i === 0 || i === 1) { // Patas delanteras
            stride -= 0.1; // Retraer ligeramente
            lift += 0.5; // Levantar de forma sutil
        } else {
            stride += 0.1; // Plantar
            lift = 0; // Pegadas al piso
        }
    }

    // Pounce Jump: Aerodinámico
    if (isPounceJump) {
        stride -= 0.5; // Estiradas hacia atrás
        if (i === 0) stride += 1.0; // Patas frontales estiradas al frente
    }

    // Patas más largas y estiradas
    const strideScale = 6.5 * scale * 0.5;
    const liftScale = 4.0 * scale * 0.4; // Se levantan menos al estar tan estiradas
    
    // Raíz ligeramente ajustada a la curvatura del cefalotórax
    const rootX = scale * 0.3 - i * 0.6 * scale; 
    const rootY = -scale * 0.3;
    
    // Punto de apoyo mucho más alejado (patas estiradas como tarántula acechando)
    const baseRestX = scale * 2.2 - i * 1.3 * scale;
    const baseRestY = scale * 1.1;

    const footX = baseRestX + stride * strideScale * (isFar ? 0.8 : 1.1);
    const footY = baseRestY - lift * liftScale * (isFar ? 0.8 : 1.1);

    // Cinemática Inversa aproximada (3 segmentos más largos y estirados)
    // Rodilla (Fémur-Patela) más plana y extendida
    const kneeX = rootX + (footX - rootX) * 0.55;
    const kneeY = rootY - scale * 0.8 - lift * liftScale * 1.2;
    // Tobillo (Tibia-Metatarso) más pronunciado y extendido
    const ankleX = rootX + (footX - rootX) * 0.85;
    const ankleY = kneeY + (footY - kneeY) * 0.4 + scale * 0.1;

    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.lineTo(kneeX, kneeY); // Coxa a Rodilla
    ctx.lineTo(ankleX, ankleY); // Rodilla a Tobillo
    ctx.lineTo(footX, footY); // Tobillo a Pie
    ctx.stroke();
  };

  ctx.lineWidth = 1.5 / zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // --- CAPA TRASERA (FAR LEGS) ---
  ctx.strokeStyle = '#0a0a0a'; // Más oscuras por la profundidad
  for (let i = 0; i < 4; i++) {
    drawLeg(i, true);
  }

  // --- ABDOMEN ---
  ctx.save();
  ctx.translate(-scale * 0.8, -scale * 0.5);
  ctx.rotate(abdomenSway); // Ligero balanceo lateral
  ctx.fillStyle = '#111111'; // Negro mate
  ctx.beginPath();
  ctx.ellipse(0, 0, scale * 1.3, scale * 0.9, -0.1, 0, Math.PI * 2);
  ctx.fill();
  
  // Pelos/textura sutil en el abdomen
  ctx.strokeStyle = 'rgba(200, 150, 100, 0.1)';
  for (let p = 0; p < 5; p++) {
    ctx.beginPath();
    ctx.arc(0, 0, scale * 0.8 + p * 0.5, Math.PI, Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.restore();

  // --- CEFALOTÓRAX (CABEZA/PECHO) ---
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  let cephPitch = 0.1;
  if (isPounceWindup) cephPitch = -0.3; // Levantar la cabeza al preparar el salto
  if (isPounceJump) cephPitch = 0.3; // Apuntar hacia abajo al saltar
  
  // Unión ligeramente flexible con el abdomen
  ctx.ellipse(scale * 0.4, -scale * 0.3, scale * 0.7, scale * 0.5, cephPitch, 0, Math.PI * 2);
  ctx.fill();

  // --- CAPA FRONTAL (NEAR LEGS) ---
  ctx.strokeStyle = '#222222';
  for (let i = 0; i < 4; i++) {
    drawLeg(i, false);
  }

  // --- PEDIPALPOS (Frontales) ---
  const pediCycle = walkCycle * 2.0 + Math.PI / 4; // Desfasados de las patas frontales
  let pediLift = Math.sin(pediCycle) * scale * 0.2;
  
  if (isPounceWindup) pediLift = -scale * 0.4; // Levantados sutilmente
  if (isPounceJump) pediLift = scale * 0.3; // Apuntando al frente

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2.0 / zoom;
  ctx.beginPath();
  // Pedipalpo Near
  ctx.moveTo(scale * 0.9, -scale * 0.2);
  ctx.lineTo(scale * 1.3, scale * 0.1 - pediLift);
  ctx.lineTo(scale * 1.2, scale * 0.4 - pediLift);
  ctx.stroke();
  
  ctx.beginPath();
  // Pedipalpo Far
  ctx.strokeStyle = '#0a0a0a';
  ctx.moveTo(scale * 0.8, -scale * 0.3);
  ctx.lineTo(scale * 1.2, scale * 0.0 + pediLift);
  ctx.lineTo(scale * 1.1, scale * 0.3 + pediLift);
  ctx.stroke();

  // --- OJOS (Visión Brillante) ---
  const isFuerte = enemy.rarity === 'fuerte';
  const eyeColor = isFuerte ? '#bf40ff' : '#ff0000'; // Purple/Magenta vs Red
  ctx.fillStyle = eyeColor;
  ctx.shadowColor = eyeColor;
  ctx.shadowBlur = (isFuerte ? 20 : 10) / zoom;
  
  const eyeOffset = enemy.state === 'alert' ? -1.5 : 0;
  const eyeSize = enemy.state === 'alert' ? 1.5 : 1;

  // Clúster de ojos
  ctx.beginPath();
  ctx.arc(scale * 0.9, -scale * 0.4 + eyeOffset, eyeSize / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(scale * 1.0, -scale * 0.25 + eyeOffset, eyeSize / zoom, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
