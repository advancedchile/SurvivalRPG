import { useRef, useCallback, useEffect } from 'react';

export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const initCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
  }, []);

  const chopAudioRef = useRef<HTMLAudioElement | null>(null);
  const pickAudioRef = useRef<HTMLAudioElement | null>(null);
  const stepAudioRef = useRef<HTMLAudioElement | null>(null);
  const stoneStepAudioRef = useRef<HTMLAudioElement | null>(null);
  const dirtStepAudioRef = useRef<HTMLAudioElement | null>(null);
  const snowStepAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loadAudio = (url: string) => {
      const audio = new Audio(url);
      audio.load();
      return audio;
    };

    chopAudioRef.current = loadAudio('/assets/sound_effects/axe-hiting-a-tree.mp3');
    pickAudioRef.current = loadAudio('/assets/sound_effects/pickaxe-hitting-minerals.mp3');
    stepAudioRef.current = loadAudio('/assets/sound_effects/grass_steps.mp3');
    stoneStepAudioRef.current = loadAudio('/assets/sound_effects/stone_steps.mp3');
    dirtStepAudioRef.current = loadAudio('/assets/sound_effects/dirt_steps.mp3');
    snowStepAudioRef.current = loadAudio('/assets/sound_effects/snow_steps.mp3');

    const resumeOnInteraction = () => {
      initCtx();
      document.removeEventListener('mousedown', resumeOnInteraction);
      document.removeEventListener('keydown', resumeOnInteraction);
    };

    document.addEventListener('mousedown', resumeOnInteraction);
    document.addEventListener('keydown', resumeOnInteraction);

    return () => {
      document.removeEventListener('mousedown', resumeOnInteraction);
      document.removeEventListener('keydown', resumeOnInteraction);
    };
  }, [initCtx]);

  const playStepSound = useCallback((tileType?: string) => {
    initCtx();
    let audioRef = stepAudioRef.current;
    if (tileType === 'limestone') audioRef = stoneStepAudioRef.current;
    else if (tileType === 'dirt') audioRef = dirtStepAudioRef.current;
    else if (tileType === 'snow') audioRef = snowStepAudioRef.current;
    
    if (audioRef) {
      const audio = audioRef.cloneNode() as HTMLAudioElement;
      audio.volume = 0.1;
      audio.play().catch(e => console.warn('Audio play failed', e));
    }
  }, [initCtx]);

  const playBirdSound = useCallback(() => {
    initCtx();
    const ctx = ctxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(4000 + Math.random() * 1000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(3000 + Math.random() * 1000, ctx.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }, [initCtx]);

  const playCricketSound = useCallback(() => {
    initCtx();
    const ctx = ctxRef.current;
    if (!ctx) return;

    for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 6500 + Math.random() * 200;
        
        const startTime = ctx.currentTime + (i * 0.05);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.03, startTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, startTime + 0.04);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 6500;
        filter.Q.value = 10;

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.05);
    }
  }, [initCtx]);

  const playChopSound = useCallback(() => {
    initCtx();
    if (chopAudioRef.current) {
      const audio = chopAudioRef.current.cloneNode() as HTMLAudioElement;
      audio.volume = 0.5;
      audio.play().catch(e => console.warn('Audio play failed', e));
    }
  }, [initCtx]);

  const playPickSound = useCallback(() => {
    initCtx();
    if (pickAudioRef.current) {
      const audio = pickAudioRef.current.cloneNode() as HTMLAudioElement;
      audio.volume = 0.5;
      audio.play().catch(e => console.warn('Audio play failed', e));
    }
  }, [initCtx]);

  return { playStepSound, playBirdSound, playCricketSound, playChopSound, playPickSound };
}

