import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/** El canal de todos. No es el identificador de ningún jugador. */
export const CANAL_GENERAL = 'todos';

export interface RosterRow {
  id: string;
  name: string;
  color: string;
  /** Emoji. Se elige en la sala de espera; los bots traen el suyo por perfil. */
  avatar: string;
  territories: number;
  armies: number;
  eliminated: boolean;
  /** Cuánta fuerza tiene sobre el total, de 0 a 1. Para la barra. */
  strength: number;
  unread: number;
  /**
   * Si esta ficha no conversa sino que responde a una petición, el texto del
   * botón que la dispara. Con él, el hilo enseña ese botón en vez del campo de
   * escribir.
   *
   * Lo usa el estratega: analiza tu posición, no charla contigo. Ofrecerle un
   * campo de texto prometería una conversación que no existe.
   */
  askLabel?: string;
}

/** Una línea de conversación, ya lista para pintar. */
export interface ChatLine {
  key: string;
  author: string;
  color: string;
  text: string;
  mine: boolean;
  /** Lo ha escrito un modelo de lenguaje, no una regla del bot. */
  fromLlm: boolean;
}

/**
 * La ficha de cada jugador, arriba a la derecha. Marcador y chat a la vez.
 *
 * No son dos cosas: la lista de con quién puedes hablar es exactamente la
 * lista de contra quién juegas. Tocar un avatar despliega debajo la
 * conversación con esa persona, anclada a ella, y el aviso de mensaje sin leer
 * va sobre su cara.
 *
 * Un chat sin marco no se sostiene —una conversación necesita un contorno—
 * pero el contorno no hay que inventarlo: es la ficha de la persona. Por eso
 * esto sí se despliega y se pliega, y no es una ventana que haya que
 * administrar: se abre, se habla y se cierra.
 */
@Component({
  selector: 'app-risk-roster',
  imports: [CommonModule, FormsModule],
  templateUrl: './risk-roster.html',
  styleUrl: './risk-roster.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskRoster {
  readonly CANAL_GENERAL = CANAL_GENERAL;

  @Input({ required: true }) rows: readonly RosterRow[] = [];
  /** De quién es el turno ahora mismo. */
  @Input() currentId = '';
  /** Cuál de las fichas soy yo: con uno mismo no se chatea. */
  @Input() meId = '';
  /** Hilo abierto: `CANAL_GENERAL`, el id de un jugador, o ninguno. */
  @Input() openThread: string | null = null;
  /** Los mensajes del hilo abierto, y sólo de ése. */
  @Input() lines: readonly ChatLine[] = [];
  @Input() generalUnread = 0;
  /** Mientras se espera la respuesta de un bot. */
  @Input() waiting = false;

  @Output() openThreadChange = new EventEmitter<string | null>();
  @Output() send = new EventEmitter<string>();

  draft = '';

  toggleThread(id: string): void {
    this.openThreadChange.emit(this.openThread === id ? null : id);
  }

  submit(): void {
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';
    this.send.emit(text);
  }

  /** Con quién se está hablando, para el marcador de posición del campo. */
  get talkingTo(): string {
    if (this.openThread === CANAL_GENERAL) return 'todos';
    return this.rows.find((row) => row.id === this.openThread)?.name ?? '';
  }

  /** Si el hilo abierto es de los que se piden en vez de conversarse. */
  get askLabel(): string | null {
    if (this.openThread === CANAL_GENERAL) return null;
    return this.rows.find((row) => row.id === this.openThread)?.askLabel ?? null;
  }

  trackRow = (_: number, row: RosterRow) => row.id;
  trackLine = (_: number, line: ChatLine) => line.key;
}
