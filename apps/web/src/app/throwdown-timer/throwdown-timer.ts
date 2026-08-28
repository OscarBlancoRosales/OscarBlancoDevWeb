import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { KvApiService } from '../api/kv-api.service';
import { ThrowdownWelcome } from './welcome/throwdown-welcome';
import { ThrowdownList } from './list/throwdown-list';
import { ThrowdownEdit } from './edit/throwdown-edit';
import { ThrowdownRun } from './run/throwdown-run';

export interface ThrowdownStep {
  name: string;
  minutes: number;
  seconds: number;
}

export interface ThrowdownConfig {
  id: string;
  name: string;
  countdown: boolean | null;
  steps: ThrowdownStep[];
  createdAt: number;
}

type Screen = 'welcome' | 'list' | 'edit' | 'timer';

/** Espacio de nombres de estas configuraciones en el almacén. */
const ESPACIO = 'throwdown';

function generateId(): string {
  return `tt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankConfig(): ThrowdownConfig {
  return { id: generateId(), name: '', steps: [], createdAt: Date.now(), countdown: null };
}

@Component({
  selector: 'app-throwdown-timer',
  imports: [ThrowdownWelcome, ThrowdownList, ThrowdownEdit, ThrowdownRun],
  templateUrl: './throwdown-timer.html',
  styleUrl: './throwdown-timer.css',
})
export class ThrowdownTimer implements OnInit, OnDestroy {
  screen: Screen = 'welcome';
  editingConfig: ThrowdownConfig = blankConfig();
  activeConfig: ThrowdownConfig = blankConfig();
  configs: ThrowdownConfig[] = [];
  isLoadingConfigs = true;
  loadError = false;

  /** Lo que se le enseña a la persona si un borrado no se puede hacer. */
  deleteError = '';

  private readonly popstateHandler = (event: PopStateEvent) => {
    const state = event.state as { throwdownScreen?: string } | null;
    const scr = state?.throwdownScreen as Screen | undefined;
    if (scr === 'welcome' || scr === 'list' || scr === 'edit' || scr === 'timer') {
      this.screen = scr;
      this.cdr.detectChanges();
    }
  };


  constructor(
    private cdr: ChangeDetectorRef,
    private kv: KvApiService,
  ) {}

  ngOnInit(): void {
    window.addEventListener('popstate', this.popstateHandler);
    history.replaceState({ throwdownScreen: 'welcome' }, '', window.location.href);
    this.subscribeConfigs();
  }

  ngOnDestroy(): void {
    window.removeEventListener('popstate', this.popstateHandler);
    if (window.location.pathname.startsWith('/tomelloso-throwdown-timer')) {
      history.replaceState(null, '', '/tomelloso-throwdown-timer');
    }
  }

  /**
   * Carga la lista de configuraciones.
   *
   * Ya no hay escucha en tiempo real. Con Firebase la lista se actualizaba sola
   * si otra persona guardaba algo; aquí se recarga al entrar y después de cada
   * cambio propio. Para una lista de temporizadores que se toca de higos a
   * brevas, mantener un canal abierto todo el rato no compensa.
   */
  private subscribeConfigs(): void {
    this.isLoadingConfigs = true;
    this.loadError = false;
    void this.recargarConfigs();
  }

  private async recargarConfigs(): Promise<void> {
    try {
      const { entries } = await this.kv.listar<ThrowdownConfig>(ESPACIO);
      this.configs = entries
        .map((entrada) => entrada.value)
        .sort((a, b) => b.createdAt - a.createdAt);
      this.loadError = false;
    } catch {
      this.loadError = true;
      this.configs = [];
    } finally {
      this.isLoadingConfigs = false;
      this.cdr.detectChanges();
    }
  }

  onEnter(): void {
    this.screen = 'list';
    history.pushState({ throwdownScreen: 'list' }, '', '/tomelloso-throwdown-timer#list');
  }

  onNewConfig(): void {
    this.editingConfig = blankConfig();
    this.screen = 'edit';
    history.pushState({ throwdownScreen: 'edit' }, '', '/tomelloso-throwdown-timer#edit');
  }

  onEditConfig(cfg: ThrowdownConfig): void {
    this.editingConfig = JSON.parse(JSON.stringify(cfg)) as ThrowdownConfig;
    this.screen = 'edit';
    history.pushState({ throwdownScreen: 'edit' }, '', '/tomelloso-throwdown-timer#edit');
  }

  onPlayConfig(cfg: ThrowdownConfig): void {
    if (cfg.steps.length === 0) { return; }
    this.activeConfig = JSON.parse(JSON.stringify(cfg)) as ThrowdownConfig;
    this.screen = 'timer';
    history.pushState({ throwdownScreen: 'timer' }, '', '/tomelloso-throwdown-timer#timer');
  }

  onConfigSaved(cfg: ThrowdownConfig): void {
    this.editingConfig = cfg;
    const idx = this.configs.findIndex(c => c.id === cfg.id);
    if (idx >= 0) {
      this.configs = this.configs.map(c => c.id === cfg.id ? cfg : c);
    } else {
      this.configs = [cfg, ...this.configs];
    }
    this.cdr.detectChanges();
    // Y se pide de nuevo al servidor, que es quien sabe qué hay de verdad.
    void this.recargarConfigs();
  }

  /**
   * Borra una configuración.
   *
   * Si el servidor dice que no —porque la guardó otra persona— se cuenta, en vez
   * de quitarla de la lista y que reaparezca a la siguiente recarga como si el
   * borrado no se hubiera enterado.
   */
  async onDeleteConfig(cfg: ThrowdownConfig): Promise<void> {
    this.deleteError = '';
    try {
      await this.kv.borrar(ESPACIO, cfg.id);
      this.configs = this.configs.filter(c => c.id !== cfg.id);
    } catch {
      this.deleteError = `No se ha podido borrar "${cfg.name}". Solo puede borrarla quien la guardó.`;
    }
    this.cdr.detectChanges();
  }

  goToList(): void {
    this.screen = 'list';
    history.pushState({ throwdownScreen: 'list' }, '', '/tomelloso-throwdown-timer#list');
  }
}
