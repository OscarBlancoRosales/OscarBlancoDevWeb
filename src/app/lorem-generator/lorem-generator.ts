import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';

type LoremType = 'paragraphs' | 'sentences' | 'words';

@Component({
  selector: 'app-lorem-generator',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './lorem-generator.html',
  styleUrl: './lorem-generator.css'
})
export class LoremGenerator {
  outputText = '';
  amount = 3;
  type: LoremType = 'paragraphs';
  startWithLorem = true;
  copied = false;

  types: { value: LoremType; label: string }[] = [
    { value: 'paragraphs', label: 'Párrafos' },
    { value: 'sentences', label: 'Frases' },
    { value: 'words', label: 'Palabras' }
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

  constructor(private cdr: ChangeDetectorRef, public i18n: I18nService) {}

  generate(): void {
    const count = Math.max(1, Math.min(100, this.amount || 1));

    switch (this.type) {
      case 'words':
        this.outputText = this.generateWords(count);
        break;
      case 'sentences':
        this.outputText = this.generateSentences(count);
        break;
      case 'paragraphs':
        this.outputText = this.generateParagraphs(count);
        break;
    }
    this.cdr.detectChanges();
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

  onTypeChange(): void {
    this.outputText = '';
    this.copied = false;
  }

  async copyOutput(): Promise<void> {
    if (!this.outputText) return;
    try {
      await navigator.clipboard.writeText(this.outputText);
      this.copied = true;
      setTimeout(() => { this.copied = false; this.cdr.detectChanges(); }, 1500);
      this.cdr.detectChanges();
    } catch {}
  }

  clear(): void {
    this.outputText = '';
    this.copied = false;
  }
}
