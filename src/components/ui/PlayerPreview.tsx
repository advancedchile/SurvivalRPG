import React, { useEffect, useRef } from 'react';
import { Player } from '../../types/game';

interface PlayerPreviewProps {
    player: Player;
    scale?: number;
}

export const PlayerPreview: React.FC<PlayerPreviewProps> = ({ player, scale = 1 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const PLAYER_WALK_FREQ = 0.015;
        const animFrame = Date.now() * 0.005;
        
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            
            // Center the player in the canvas
            ctx.translate(canvas.width / 2, canvas.height / 2 + 10);
            ctx.scale(scale, scale);

            const bob = Math.sin(animFrame) * 1.5;
            const iso = { x: 0, y: 0 };
            
            // Simplified drawing logic from App.tsx (Idle S direction)
            const isBlinking = Math.sin(animFrame * 0.2) > 0.95;
            
            // Shadow
            ctx.beginPath();
            ctx.ellipse(iso.x, iso.y + 7, 8, 4, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fill();

            const drawArm = (isRightSide: boolean) => {
               const shoulderX = iso.x + (isRightSide ? 4.5 : -4.5);
               const shoulderY = iso.y - 11 - bob;
               const handX = shoulderX;
               const handY = shoulderY + 7; 
                 
               // Sleeve
               ctx.strokeStyle = '#ddccbb';
               ctx.lineWidth = 2.5; 
               ctx.lineCap = 'round';
               ctx.beginPath();
               ctx.moveTo(shoulderX, shoulderY);
               ctx.lineTo(handX, handY);
               ctx.stroke();

               // Hand
               ctx.fillStyle = '#eed2b6';
               ctx.beginPath();
               ctx.arc(handX, handY + 1.5, 1.3, 0, Math.PI * 2); 
               ctx.fill();
            };

            // Arms (Facing S, both arms in front)
            drawArm(false);
            drawArm(true);
              
            // Body (Shirt & Overalls)
            ctx.fillStyle = '#eed2b6'; // Skin/shirt neck
            ctx.beginPath();
            ctx.roundRect(iso.x - 4.5, iso.y - 13 - bob, 9, 7, 2.5);
            ctx.fill();
              
            // T-Shirt 
            ctx.fillStyle = '#ddccbb'; // Light colored shirt
            ctx.beginPath();
            ctx.roundRect(iso.x - 5, iso.y - 12 - bob, 10, 6, 2);
            ctx.fill();

            // Overalls
            ctx.fillStyle = '#2b5a84'; // Denim blue
            ctx.beginPath();
            ctx.roundRect(iso.x - 4.5, iso.y - 8 - bob, 9, 10, 2.5);
            ctx.fill();
            ctx.strokeStyle = '#1a3752';
            ctx.lineWidth = 1;
            ctx.stroke();
              
            // Overall buttons & pocket
            ctx.fillStyle = '#ffaa00'; // Gold buttons
            ctx.beginPath();
            ctx.arc(iso.x - 2.5, iso.y - 6 - bob, 1, 0, Math.PI*2);
            ctx.arc(iso.x + 2.5, iso.y - 6 - bob, 1, 0, Math.PI*2);
            ctx.fill();
              
            // Front pocket
            ctx.fillStyle = '#224a6d';
            ctx.fillRect(iso.x - 2, iso.y - 4 - bob, 4, 3.5);

            // Straps (Facing S)
            ctx.fillStyle = '#8b5a2b';
            ctx.fillRect(iso.x - 3, iso.y - 12 - bob, 1.5, 7);
            ctx.fillRect(iso.x + 1.5, iso.y - 12 - bob, 1.5, 7);

            // Head Base
            ctx.fillStyle = '#eed2b6'; // Skin
            ctx.beginPath();
            ctx.ellipse(iso.x, iso.y - 18 - bob, 7.5, 8.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#c4a484';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Ears
            ctx.fillStyle = '#eed2b6';
            ctx.beginPath();
            ctx.arc(iso.x - 7.5, iso.y - 18 - bob, 2.2, 0, Math.PI * 2);
            ctx.arc(iso.x + 7.5, iso.y - 18 - bob, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Hair (Brown, messy)
            ctx.fillStyle = '#4a2c2a';
            ctx.beginPath();
            ctx.arc(iso.x, iso.y - 23 - bob, 8, Math.PI, 0);
            ctx.arc(iso.x - 4, iso.y - 22 - bob, 5, 0, Math.PI * 2);
            ctx.arc(iso.x + 4, iso.y - 22 - bob, 5, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = isBlinking ? '#eed2b6' : '#ffffff';
            ctx.beginPath();
            ctx.arc(iso.x - 2.5, iso.y - 18.5 - bob, 2, 0, Math.PI * 2);
            ctx.arc(iso.x + 2.5, iso.y - 18.5 - bob, 2, 0, Math.PI * 2);
            ctx.fill();
            
            if (!isBlinking) {
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(iso.x - 2.5, iso.y - 18.5 - bob, 0.8, 0, Math.PI * 2);
                ctx.arc(iso.x + 2.5, iso.y - 18.5 - bob, 0.8, 0, Math.PI * 2);
                ctx.fill();
            }

            // Eyebrows
            ctx.strokeStyle = '#4a2c2a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(iso.x - 4.5, iso.y - 21.5 - bob);
            ctx.lineTo(iso.x - 1, iso.y - 20.5 - bob);
            ctx.moveTo(iso.x + 1, iso.y - 20.5 - bob);
            ctx.lineTo(iso.x + 4.5, iso.y - 21.5 - bob);
            ctx.stroke();

            // Nose (tiny)
            ctx.fillStyle = '#d4b494';
            ctx.beginPath();
            ctx.arc(iso.x, iso.y - 16.5 - bob, 0.8, 0, Math.PI * 2);
            ctx.fill();

            // Legs
            ctx.fillStyle = '#1a3752'; // darker denim
            ctx.beginPath();
            ctx.roundRect(iso.x - 4, iso.y + 2 - bob, 3.5, 10, 1.5);
            ctx.roundRect(iso.x + 0.5, iso.y + 2 - bob, 3.5, 10, 1.5);
            ctx.fill();
              
            // Shoes
            ctx.fillStyle = '#3e2c18';
            ctx.beginPath();
            ctx.roundRect(iso.x - 4.5, iso.y + 10 - bob, 4.5, 3.5, 1.5);
            ctx.roundRect(iso.x + 0, iso.y + 10 - bob, 4.5, 3.5, 1.5);
            ctx.fill();

            ctx.restore();
            requestAnimationFrame(draw);
        };

        const animationId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animationId);
    }, [player, scale]);

    return (
        <canvas 
            ref={canvasRef} 
            width={200} 
            height={300} 
            className="w-full h-full object-contain pointer-events-none drop-shadow-[0_30px_40px_rgba(0,0,0,0.9)]"
        />
    );
};
