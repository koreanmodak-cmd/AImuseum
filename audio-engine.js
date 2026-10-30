/* FORM — Procedural ambient soundscape. Starts only after an explicit user gesture. */
(function (root) {
  'use strict';

  class FormAudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.voiceNodes = [];
      this.noiseSource = null;
      this.noiseGain = null;
      this.filter = null;
      this.lfo = null;
      this.lfoGain = null;
      this.reverb = null;
      this.wet = null;
      this.isRunning = false;
      this.volume = 0.42;
      this.style = 0;
      this.transitionToken = 0;
    }

    _makeImpulse(ctx, seconds, decay) {
      const rate = ctx.sampleRate;
      const length = Math.floor(rate * seconds);
      const impulse = ctx.createBuffer(2, length, rate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          const envelope = Math.pow(1 - i / length, decay);
          data[i] = (Math.random() * 2 - 1) * envelope;
        }
      }
      return impulse;
    }

    async start(styleId = 0) {
      this.style = Number(styleId) || 0;
      this.transitionToken += 1;
      const AudioContextClass = root.AudioContext || root.webkitAudioContext;
      if (!AudioContextClass) throw new Error('이 브라우저는 Web Audio를 지원하지 않습니다.');

      if (!this.ctx || this.ctx.state === 'closed') this._buildGraph(AudioContextClass);
      await this.ctx.resume();
      if (this.isRunning) {
        this.setStyle(this.style);
        return;
      }
      this.isRunning = true;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(0.0001, now);
      this.master.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume), now + 2.8);
      this.setStyle(this.style);
    }

    _buildGraph(AudioContextClass) {
      const ctx = new AudioContextClass();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.0001;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -25;
      compressor.knee.value = 20;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.08;
      compressor.release.value = 0.65;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      this.master = master;

      const convolver = ctx.createConvolver();
      convolver.buffer = this._makeImpulse(ctx, 3.8, 2.6);
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      convolver.connect(wet);
      wet.connect(master);
      this.reverb = convolver;
      this.wet = wet;

      const dryBus = ctx.createGain();
      dryBus.gain.value = 0.8;
      dryBus.connect(master);

      // Four soft partials form a slowly shifting harmonic bed.
      const voices = [
        { ratio: 1, type: 'sine', gain: 0.22, pan: -0.48 },
        { ratio: 1.5, type: 'sine', gain: 0.115, pan: 0.42 },
        { ratio: 2, type: 'triangle', gain: 0.035, pan: -0.12 },
        { ratio: 2.997, type: 'sine', gain: 0.025, pan: 0.18 }
      ];
      this.voiceNodes = voices.map((spec, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        osc.type = spec.type;
        osc.detune.value = index % 2 ? -3.5 : 2.5;
        gain.gain.value = spec.gain;
        if (panner) {
          panner.pan.value = spec.pan;
          osc.connect(gain);
          gain.connect(panner);
          panner.connect(dryBus);
          panner.connect(convolver);
        } else {
          osc.connect(gain);
          gain.connect(dryBus);
          gain.connect(convolver);
        }
        osc.start();
        return { osc, gain, spec };
      });

      // Filtered noise adds a barely audible, non-looping air texture.
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * 0.22;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.45;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.012;
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dryBus);
      noiseGain.connect(convolver);
      noise.start();
      this.noiseSource = noise;
      this.noiseGain = noiseGain;
      this.filter = filter;

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.035;
      lfoGain.gain.value = 110;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      this.lfo = lfo;
      this.lfoGain = lfoGain;
    }

    setStyle(styleId) {
      this.style = ((Number(styleId) || 0) % 12 + 12) % 12;
      if (!this.ctx || !this.voiceNodes.length) return;
      // A gentle scale palette: distinct tonal centers, never a loud melody.
      const roots = [55, 61.74, 65.41, 73.42, 82.41, 87.31, 98, 110, 116.54, 123.47, 130.81, 146.83];
      const root = roots[this.style];
      const ratios = [1, 1.5, 2, 2.997];
      const now = this.ctx.currentTime;
      this.voiceNodes.forEach((voice, i) => {
        const target = root * ratios[i];
        voice.osc.frequency.cancelScheduledValues(now);
        voice.osc.frequency.setTargetAtTime(target, now, 2.4 + i * 0.3);
      });
      this.filter.frequency.setTargetAtTime(300 + this.style * 22, now, 3.5);
    }

    setVolume(value) {
      const n = Number(value);
      this.volume = Math.max(0, Math.min(0.65, Number.isFinite(n) ? n : 0.4));
      if (this.master && this.isRunning) {
        this.master.gain.setTargetAtTime(Math.max(0.0001, this.volume), this.ctx.currentTime, 0.35);
      }
    }

    async stop() {
      if (!this.ctx || !this.isRunning) return;
      this.isRunning = false;
      const token = ++this.transitionToken;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0.0001, now, 0.9);
      await new Promise(resolve => root.setTimeout(resolve, 1400));
      if (token !== this.transitionToken || this.isRunning) return;
      try {
        this.voiceNodes.forEach(v => { v.osc.stop(); v.osc.disconnect(); });
        if (this.noiseSource) this.noiseSource.stop();
        if (this.lfo) this.lfo.stop();
        await ctx.close();
      } catch (_) { /* The context may already have been closed by the browser. */ }
      this.ctx = null;
      this.master = null;
      this.voiceNodes = [];
      this.noiseSource = null;
      this.lfo = null;
      this.filter = null;
    }
  }

  root.FormAudioEngine = FormAudioEngine;
})(typeof window !== 'undefined' ? window : globalThis);
