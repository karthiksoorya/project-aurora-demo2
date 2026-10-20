import * as THREE from 'three';
import { Directive, ElementRef, OnDestroy, afterNextRender, inject, signal, viewChild } from '@angular/core';
import type { CameraState } from '../../core/workspace-state/workspace-state.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { SceneHost, webglAvailable, type PickInfo } from './scene-host';

/**
 * Base for every Three.js view component: creates the SceneHost after first render,
 * restores the saved camera, persists camera changes and disposes everything on destroy
 * (route exit, canvas switch or expanded-state change).
 */
@Directive()
export abstract class ThreeStage implements OnDestroy {
  protected readonly ui = inject(WorkspaceStateService);
  protected readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  protected host: SceneHost | null = null;
  readonly webgl = signal(true);
  readonly zoomValue = signal(0.5);
  readonly tool = signal<'orbit' | 'pan' | 'zoom'>('orbit');

  protected abstract sceneKey(): string;
  protected abstract defaultCamera(): CameraState;
  protected abstract build(host: SceneHost): void;
  protected onPick(_p: PickInfo | null): void {
    /* optional */
  }
  protected limits(): { min: number; max: number } {
    return { min: 3, max: 26 };
  }

  constructor() {
    afterNextRender(() => {
      if (!webglAvailable()) {
        this.webgl.set(false);
        return;
      }
      const key = this.sceneKey();
      const lim = this.limits();
      try {
        this.host = new SceneHost(this.stage().nativeElement, {
          key,
          camera: this.defaultCamera(),
          saved: this.ui.camera(key),
          minDistance: lim.min,
          maxDistance: lim.max,
          onPick: (p) => this.onPick(p),
          onCamera: (c) => {
            this.ui.saveCamera(key, c);
            this.zoomValue.set(this.host?.zoomLevel() ?? 0.5);
          },
        });
        this.zoomValue.set(this.host.zoomLevel());
        this.build(this.host);
      } catch (e) {
        console.error('WebGL initialisation failed', e);
        this.webgl.set(false);
      }
    });
  }

  setTool(t: 'orbit' | 'pan' | 'zoom') {
    this.tool.set(t);
    if (!this.host) return;
    this.host.controls.mouseButtons.LEFT =
      t === 'pan' ? THREE.MOUSE.PAN : t === 'zoom' ? THREE.MOUSE.DOLLY : THREE.MOUSE.ROTATE;
  }
  zoomIn() {
    this.host?.zoom(0.8);
    this.syncZoom();
  }
  zoomOut() {
    this.host?.zoom(1.25);
    this.syncZoom();
  }
  setZoom(v: number) {
    this.host?.setZoomLevel(v);
    this.zoomValue.set(v);
  }
  resetView() {
    this.host?.resetCamera();
    this.syncZoom();
  }
  toggleRotate() {
    if (this.host) this.host.setAutoRotate(!this.host.autoRotate);
  }
  snapshot(name: string) {
    const url = this.host?.snapshot();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.png`;
    a.click();
  }
  /** Keyboard alternative to mouse orbit/pan/zoom. */
  onKey(e: KeyboardEvent) {
    if (!this.host) return;
    const step = e.shiftKey ? 0.25 : 0.1;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => this.host!.orbit(-step, 0),
      ArrowRight: () => this.host!.orbit(step, 0),
      ArrowUp: () => this.host!.orbit(0, -step),
      ArrowDown: () => this.host!.orbit(0, step),
      '+': () => this.zoomIn(),
      '=': () => this.zoomIn(),
      '-': () => this.zoomOut(),
      '0': () => this.resetView(),
      a: () => this.host!.pan(-0.3, 0),
      d: () => this.host!.pan(0.3, 0),
      w: () => this.host!.pan(0, 0.3),
      s: () => this.host!.pan(0, -0.3),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }
  private syncZoom() {
    setTimeout(() => this.zoomValue.set(this.host?.zoomLevel() ?? 0.5), 0);
  }

  ngOnDestroy() {
    this.host?.dispose();
    this.host = null;
  }
}
