import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';

type FormatMode = 'json' | 'xml' | 'css' | 'sql' | 'html';

@Component({
  selector: 'app-formatter',
  imports: [FormsModule, TerminalLayout],
  templateUrl: './formatter.html',
  styleUrl: './formatter.css'
})
export class Formatter {
  inputText = '';
  outputText = '';
  mode: FormatMode = 'json';
  copied = false;
  errorMessage = '';
  indentSize = 2;

  /** La sangría de verdad: 0 es el tabulador, no «sin sangrar». */
  private get indent(): string {
    return this.indentSize === 0 ? '	' : ' '.repeat(this.indentSize);
  }

  modes: { value: FormatMode; label: string }[] = [
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML / HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'sql', label: 'SQL' }
  ];

  constructor(private cdr: ChangeDetectorRef, public i18n: I18nService) {}

  format(): void {
    if (!this.inputText.trim()) {
      this.errorMessage = 'Introduce código para formatear';
      this.outputText = '';
      return;
    }

    this.errorMessage = '';

    try {
      switch (this.mode) {
        case 'json':
          this.outputText = this.formatJSON(this.inputText);
          break;
        case 'xml':
          this.outputText = this.formatXML(this.inputText);
          break;
        case 'css':
          this.outputText = this.formatCSS(this.inputText);
          break;
        case 'sql':
          this.outputText = this.formatSQL(this.inputText);
          break;
        default:
          this.outputText = this.inputText;
      }
    } catch {
      this.errorMessage = 'Error al formatear. Verifica que el input sea válido.';
      this.outputText = '';
    }
    this.cdr.detectChanges();
  }

  minify(): void {
    if (!this.inputText.trim()) {
      this.errorMessage = 'Introduce código para minificar';
      this.outputText = '';
      return;
    }

    this.errorMessage = '';

    try {
      switch (this.mode) {
        case 'json':
          this.outputText = JSON.stringify(JSON.parse(this.inputText));
          break;
        case 'xml':
          this.outputText = this.inputText.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
          break;
        case 'css':
          this.outputText = this.inputText
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s*{\s*/g, '{')
            .replace(/\s*}\s*/g, '}')
            .replace(/\s*:\s*/g, ':')
            .replace(/\s*;\s*/g, ';')
            .replace(/\s*,\s*/g, ',')
            .replace(/\n/g, '')
            .trim();
          break;
        case 'sql':
          this.outputText = this.inputText.replace(/\s+/g, ' ').trim();
          break;
        default:
          this.outputText = this.inputText.replace(/\s+/g, ' ').trim();
      }
    } catch {
      this.errorMessage = 'Error al minificar. Verifica que el input sea válido.';
      this.outputText = '';
    }
    this.cdr.detectChanges();
  }

  private formatJSON(text: string): string {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, this.indent);
  }

  private formatXML(text: string): string {
    const indent = this.indent;
    let formatted = '';
    let pad = 0;
    const lines = text.replace(/(>)(<)(\/*)/g, '$1\n$2$3').split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.match(/^<\/\w/)) {
        pad--;
      }

      formatted += indent.repeat(Math.max(0, pad)) + trimmed + '\n';

      if (trimmed.match(/^<\w[^>]*[^\/]>.*$/) && !trimmed.match(/^<\w[^>]*>.*<\/\w/)) {
        pad++;
      }
    }

    return formatted.trim();
  }

  private formatCSS(text: string): string {
    const indent = this.indent;
    return text
      .replace(/\s*{\s*/g, ' {\n' + indent)
      .replace(/\s*}\s*/g, '\n}\n\n')
      .replace(/\s*;\s*/g, ';\n' + indent)
      .replace(new RegExp(indent + '$', 'gm'), '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private formatSQL(text: string): string {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
      'INNER JOIN', 'OUTER JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE',
      'ALTER TABLE', 'DROP TABLE', 'UNION', 'UNION ALL', 'AS', 'IN', 'NOT', 'NULL',
      'IS', 'LIKE', 'BETWEEN', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'];

    let result = text.trim();

    // Uppercase keywords
    for (const kw of keywords) {
      const regex = new RegExp('\\b' + kw.replace(/ /g, '\\s+') + '\\b', 'gi');
      result = result.replace(regex, kw);
    }

    // Add newlines before major keywords
    const majorKeywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN',
      'RIGHT JOIN', 'INNER JOIN', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'UNION'];

    for (const kw of majorKeywords) {
      const regex = new RegExp('\\s+(' + kw.replace(/ /g, '\\s+') + ')\\b', 'gi');
      result = result.replace(regex, '\n' + kw);
    }

    return result.trim();
  }

  async copyOutput(): Promise<void> {
    if (!this.outputText) return;
    try {
      await navigator.clipboard.writeText(this.outputText);
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
        this.cdr.detectChanges();
      }, 2000);
      this.cdr.detectChanges();
    } catch {
      this.errorMessage = 'No se pudo copiar';
      this.cdr.detectChanges();
    }
  }

  clear(): void {
    this.inputText = '';
    this.outputText = '';
    this.errorMessage = '';
    this.copied = false;
  }

  setMode(mode: FormatMode): void {
    this.mode = mode;
    this.onModeChange();
  }

  /** Formatea mientras escribes, pero sin gritar mientras aún vas a medias. */
  onInput(): void {
    if (this.pendiente) clearTimeout(this.pendiente);
    this.pendiente = setTimeout(() => {
      this.format();
      this.cdr.detectChanges();
    }, 350);
  }

  /** Manda el resultado a la entrada, para encadenar formatear y minificar. */
  swap(): void {
    if (!this.outputText) return;
    this.inputText = this.outputText;
    this.format();
  }

  /**
   * Lo que se ahorra al minificar. Sin el número, «minificar» es un botón que
   * no se sabe si ha hecho algo.
   */
  get savings(): string {
    const antes = this.inputText.length;
    const despues = this.outputText.length;
    if (!antes || !despues || despues >= antes) return '';
    const porcentaje = Math.round((1 - despues / antes) * 100);
    return this.i18n.t('formatter.savings', {
      from: String(antes),
      to: String(despues),
      pct: String(porcentaje),
    });
  }

  private pendiente?: ReturnType<typeof setTimeout>;

  onModeChange(): void {
    this.inputText = '';
    this.outputText = '';
    this.errorMessage = '';
    this.copied = false;
  }
}
