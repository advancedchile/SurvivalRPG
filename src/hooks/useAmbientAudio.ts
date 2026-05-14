import { useEffect, useRef } from 'react';

export function useAmbientAudio(enabled: boolean = true) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const audio = new Audio(`${import.meta.env.BASE_URL}assets/sound_effects/sonido-ambiente-de-bosque.mp3`);
    audio.loop = true;
    audio.volume = 0.4; // Ajusta este valor (0.0 a 1.0) para que no sea muy molesto
    audioRef.current = audio;

    // Los navegadores modernos bloquean el audio automático hasta que el usuario interactúa.
    // Intentamos reproducir, si falla, agregamos un listener para el primer clic.
    const attemptPlay = () => {
      audio.play().catch(e => {
        console.warn('Auto-play del ambiente bloqueado. Esperando interacción del usuario:', e);
      });
    };

    attemptPlay();

    const handleUserInteraction = () => {
      if (audio.paused) {
        attemptPlay();
      }
      // Una vez reproducido, limpiamos los listeners
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
}
