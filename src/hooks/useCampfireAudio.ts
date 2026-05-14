import { useEffect, useRef } from 'react';
import { Point } from '../types/game';

export function useCampfireAudio(playerPos: Point, campfirePos: Point | null | undefined, enabled: boolean = true) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const audio = new Audio(`${import.meta.env.BASE_URL}assets/sound_effects/sonido-de-fogata.mp3`);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;

    const attemptPlay = () => {
      audio.play().catch(e => {
        console.warn('Campfire audio auto-play prevented by browser:', e);
      });
    };

    attemptPlay();

    const handleUserInteraction = () => {
      if (audio.paused) {
        attemptPlay();
      }
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      audio.pause();
      audio.src = '';
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [enabled]);

  useEffect(() => {
    if (!audioRef.current) return;

    if (!campfirePos) {
      if (audioRef.current.volume !== 0) audioRef.current.volume = 0;
      return;
    }

    const dx = playerPos.x - campfirePos.x;
    const dy = playerPos.y - campfirePos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Ajustamos la distancia máxima a la que se escucha la fogata
    const MAX_DISTANCE = 15; 
    
    let volume = 1 - (distance / MAX_DISTANCE);
    
    // Limitamos entre 0 y 1
    if (volume < 0) volume = 0;
    if (volume > 1) volume = 1;

    audioRef.current.volume = volume;
  }, [playerPos.x, playerPos.y, campfirePos?.x, campfirePos?.y]);
}
