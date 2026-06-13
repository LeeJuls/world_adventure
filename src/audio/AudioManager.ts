import Phaser from 'phaser';

// Drop your legally-obtained track at public/assets/audio/main-theme.mp3.
// Until that file exists, BGM is silently skipped (no console noise).
const BGM_KEY = 'bgm_main';
const BGM_SRC = 'assets/audio/main-theme.mp3';
const VOL_KEY = 'worldExplorer_bgmVolume';
const MUTE_KEY = 'worldExplorer_bgmMuted';

/**
 * Global background-music manager. One shared instance (`audio`) drives the game's
 * global sound manager so the track keeps playing across scene transitions.
 *
 * We fetch + decode the file ourselves instead of using Phaser's loader: a dev server
 * returns index.html (HTTP 200) for a missing asset, which Phaser would noisily try to
 * decode as audio. Manual loading lets a missing file fail silently.
 */
class AudioManager {
  private game?: Phaser.Game;
  private bgm?: Phaser.Sound.BaseSound;
  private ready = false;
  private wantsPlay = false;
  private _volume = 0.5;
  private _muted = false;

  init(game: Phaser.Game): void {
    this.game = game;
    const v = parseFloat(localStorage.getItem(VOL_KEY) ?? '');
    if (!Number.isNaN(v)) this._volume = Phaser.Math.Clamp(v, 0, 1);
    this._muted = localStorage.getItem(MUTE_KEY) === '1';
    void this.loadBgm();
  }

  private async loadBgm(): Promise<void> {
    const game = this.game;
    if (!game) return;
    if (game.cache.audio.exists(BGM_KEY)) { this.ready = true; return; }
    const sm = game.sound as Phaser.Sound.WebAudioSoundManager;
    if (!('context' in sm) || !sm.context) return; // non-WebAudio fallback: skip cleanly
    try {
      const res = await fetch(BGM_SRC);
      const ct = res.headers.get('content-type') ?? '';
      if (!res.ok || ct.includes('text/html')) return; // file absent → dev-server SPA fallback
      const decoded = await sm.context.decodeAudioData(await res.arrayBuffer());
      game.cache.audio.add(BGM_KEY, decoded);
      this.ready = true;
      if (this.wantsPlay) this.startBgm(); // a gesture already happened while decoding
    } catch {
      // not a valid audio file yet — stay silent
    }
  }

  /**
   * Start the looping BGM. Call from a user gesture (pointer/click) — browsers block
   * audio until then. Safe to call repeatedly and before the file finishes decoding.
   */
  startBgm(): void {
    this.wantsPlay = true;
    if (!this.game || !this.ready) return;
    if (!this.bgm) {
      try {
        this.bgm = this.game.sound.add(BGM_KEY, { loop: true, volume: this.effectiveVolume() });
      } catch {
        return;
      }
    }
    if (!this.bgm.isPlaying) {
      this.bgm.play();
      this.applyVolume();
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    this.applyVolume();
  }

  setVolume(v: number): void {
    this._volume = Phaser.Math.Clamp(v, 0, 1);
    localStorage.setItem(VOL_KEY, String(this._volume));
    this.applyVolume();
  }

  get muted(): boolean {
    return this._muted;
  }

  get volume(): number {
    return this._volume;
  }

  private effectiveVolume(): number {
    return this._muted ? 0 : this._volume;
  }

  private applyVolume(): void {
    if (this.bgm && 'setVolume' in this.bgm) {
      (this.bgm as Phaser.Sound.WebAudioSound).setVolume(this.effectiveVolume());
    }
  }
}

export const audio = new AudioManager();
