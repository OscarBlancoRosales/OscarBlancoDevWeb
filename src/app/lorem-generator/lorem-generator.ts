import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';

type LoremType = 'paragraphs' | 'sentences' | 'words';

@Component({
  selector: 'app-lorem-generator',
  imports: [FormsModule, TerminalLayout],
  templateUrl: './lorem-generator.html',
  styleUrl: './lorem-generator.css'
})
export class LoremGenerator implements OnInit {
  outputText = '';
  amount = 3;
  type: LoremType = 'paragraphs';
  startWithLorem = true;
  /** Cada trozo en su línea, con guion delante. */
  asList = false;
  /** Envuelto en las etiquetas que le tocan, listo para pegar. */
  html = false;
  copied = false;

  types: { value: LoremType; label: string }[] = [
    { value: 'paragraphs', label: 'párrafos' },
    { value: 'sentences', label: 'frases' },
    { value: 'words', label: 'palabras' },
  ];

  private words = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
    'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
    'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
    'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
    'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
    'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
    'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'at', 'vero', 'eos',
    'accusamus', 'iusto', 'odio', 'dignissimos', 'ducimus', 'blanditiis',
    'praesentium', 'voluptatum', 'deleniti', 'atque', 'corrupti', 'quos', 'dolores',
    'quas', 'molestias', 'recusandae', 'itaque', 'earum', 'rerum', 'hic', 'tenetur',
    'sapiente', 'delectus', 'aut', 'reiciendis', 'voluptatibus', 'maiores', 'alias',
    'perferendis', 'doloribus', 'asperiores', 'repellat', 'temporibus', 'quibusdam',
    'illum', 'fugit', 'quo', 'voluptas', 'aspernatur', 'vel', 'eum', 'quia',
    'consequuntur', 'magni', 'numquam', 'impedit', 'minus', 'quod', 'maxime',
    'placeat', 'facere', 'possimus', 'omnis', 'assumenda', 'repellendus',
    'corporis', 'suscipit', 'laboriosam', 'nihil', 'debitis', 'rem', 'aperiam',
    'eaque', 'ipsa', 'ab', 'illo', 'inventore', 'veritatis', 'quasi', 'architecto',
    'beatae', 'vitae', 'dicta', 'explicabo', 'nemo', 'ipsam', 'voluptatem'
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void {
    this.generate();
  }

  setType(type: LoremType): void {
    this.type = type;
    this.generate();
  }

  generate(): void {
    const count = Math.max(1, Math.min(100, Number(this.amount) || 1));

    let trozos: string[];
    switch (this.type) {
      case 'words':
        trozos = [this.generateWords(count)];
        break;
      case 'sentences':
        trozos = this.generateSentences(count).split('. ').filter(Boolean).map((f) =>
          f.endsWith('.') ? f : f + '.',
        );
        break;
      default:
        trozos = this.generateParagraphs(count).split('\n\n');
    }

    this.outputText = this.envolver(trozos);
    this.copied = false;
    this.cdr.detectChanges();
  }

  /** Le da la forma pedida: lista, HTML, o texto pelado. */
  private envolver(trozos: string[]): string {
    if (this.asList) {
      return this.html
        ? '<ul>\n' + trozos.map((t) => `  <li>${t}</li>`).join('\n') + '\n</ul>'
        : trozos.map((t) => `- ${t}`).join('\n');
    }
    if (this.html) {
      return trozos.map((t) => `<p>${t}</p>`).join('\n');
    }
    return trozos.join(this.type === 'paragraphs' ? '\n\n' : ' ');
  }

  /** Cuánto se tarda en leerlo, a las 200 palabras por minuto de siempre. */
  get readingTime(): string {
    const minutos = Math.max(1, Math.round(this.wordCount / 200));
    return `~${minutos} min`;
  }

  private generateWords(count: number): string {
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      if (i === 0 && this.startWithLorem) {
        result.push('lorem');
      } else {
        result.push(this.randomWord());
      }
    }
    return this.capitalize(result.join(' ')) + '.';
  }

  private generateSentences(count: number): string {
    const sentences: string[] = [];
    for (let i = 0; i < count; i++) {
      const wordCount = 8 + Math.floor(Math.random() * 12);
      const words: string[] = [];
      for (let j = 0; j < wordCount; j++) {
        if (i === 0 && j === 0 && this.startWithLorem) {
          words.push('lorem', 'ipsum', 'dolor', 'sit', 'amet');
          j += 4;
        } else {
          words.push(this.randomWord());
        }
      }
      sentences.push(this.capitalize(words.join(' ')) + '.');
    }
    return sentences.join(' ');
  }

  private generateParagraphs(count: number): string {
    const paragraphs: string[] = [];
    for (let i = 0; i < count; i++) {
      const sentenceCount = 3 + Math.floor(Math.random() * 4);
      const sentences: string[] = [];
      for (let s = 0; s < sentenceCount; s++) {
        const wordCount = 8 + Math.floor(Math.random() * 12);
        const words: string[] = [];
        for (let w = 0; w < wordCount; w++) {
          if (i === 0 && s === 0 && w === 0 && this.startWithLorem) {
            words.push('lorem', 'ipsum', 'dolor', 'sit', 'amet');
            w += 4;
          } else {
            words.push(this.randomWord());
          }
        }
        sentences.push(this.capitalize(words.join(' ')) + '.');
      }
      paragraphs.push(sentences.join(' '));
    }
    return paragraphs.join('\n\n');
  }

  private randomWord(): string {
    return this.words[Math.floor(Math.random() * this.words.length)];
  }

  private capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  get wordCount(): number {
    return this.outputText ? this.outputText.split(/\s+/).filter(w => w).length : 0;
  }

  get charCount(): number {
    return this.outputText.length;
  }

  async copyOutput(): Promise<void> {
    if (!this.outputText) return;
    try {
      await navigator.clipboard.writeText(this.outputText);
      this.copied = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.copied = false;
        this.cdr.detectChanges();
      }, 1400);
    } catch {
      // Sin portapapeles el texto sigue en pantalla para copiarlo a mano.
    }
  }

  clear(): void {
    this.outputText = '';
    this.copied = false;
  }
}
