import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';

@Component({
  selector: 'app-regex-tester',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './regex-tester.html',
  styleUrl: './regex-tester.css'
})
export class RegexTester {
  regexInput = '';
  flags = 'gi';
  testInput = '';
  highlightedHtml: SafeHtml = '';
  matches: string[] = [];
  matchCount = 0;
  groupMatches: { match: string; groups: string[] }[] = [];
  errorMessage = '';
  copied = false;

  flagOptions = [
    { flag: 'g', label: 'Global', active: true },
    { flag: 'i', label: 'Case insensitive', active: true },
    { flag: 'm', label: 'Multiline', active: false },
    { flag: 's', label: 'Dotall', active: false }
  ];

  commonPatterns = [
    { label: 'Email', pattern: '[\\w.-]+@[\\w.-]+\\.\\w{2,}' },
    { label: 'URL', pattern: 'https?://[\\w.-]+(?:/[\\w./-]*)?' },
    { label: 'IP', pattern: '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b' },
    { label: 'Teléfono', pattern: '\\+?\\d{1,3}[-.\\s]?\\d{3,4}[-.\\s]?\\d{3,4}' },
    { label: 'Hex Color', pattern: '#[0-9a-fA-F]{3,8}' },
    { label: 'Fecha', pattern: '\\d{2,4}[/-]\\d{2}[/-]\\d{2,4}' }
  ];

  constructor(private cdr: ChangeDetectorRef, private sanitizer: DomSanitizer, public i18n: I18nService) {}

  toggleFlag(opt: { flag: string; label: string; active: boolean }): void {
    opt.active = !opt.active;
    this.flags = this.flagOptions.filter(f => f.active).map(f => f.flag).join('');
    this.test();
  }

  usePattern(pattern: string): void {
    this.regexInput = pattern;
    this.test();
  }

  test(): void {
    this.matches = [];
    this.matchCount = 0;
    this.groupMatches = [];
    this.errorMessage = '';
    this.highlightedHtml = '';

    if (!this.regexInput || !this.testInput) return;

    try {
      const regex = new RegExp(this.regexInput, this.flags);
      const allMatches: RegExpExecArray[] = [];
      let m: RegExpExecArray | null;

      if (this.flags.includes('g')) {
        while ((m = regex.exec(this.testInput)) !== null) {
          allMatches.push(m);
          if (m.index === regex.lastIndex) regex.lastIndex++;
        }
      } else {
        m = regex.exec(this.testInput);
        if (m) allMatches.push(m);
      }

      this.matchCount = allMatches.length;
      this.matches = allMatches.map(m => m[0]);
      this.groupMatches = allMatches.map(m => ({
        match: m[0],
        groups: m.slice(1)
      }));

      // Build highlighted HTML
      let html = '';
      let lastIndex = 0;
      const globalRegex = new RegExp(this.regexInput, this.flags.includes('g') ? this.flags : this.flags + 'g');
      let match: RegExpExecArray | null;

      while ((match = globalRegex.exec(this.testInput)) !== null) {
        html += this.escapeHtml(this.testInput.slice(lastIndex, match.index));
        html += '<mark>' + this.escapeHtml(match[0]) + '</mark>';
        lastIndex = match.index + match[0].length;
        if (match.index === globalRegex.lastIndex) globalRegex.lastIndex++;
      }
      html += this.escapeHtml(this.testInput.slice(lastIndex));
      this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(html);

    } catch (e: any) {
      this.errorMessage = e.message || 'Regex inválida';
    }
    this.cdr.detectChanges();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  clear(): void {
    this.regexInput = '';
    this.testInput = '';
    this.matches = [];
    this.matchCount = 0;
    this.groupMatches = [];
    this.errorMessage = '';
    this.highlightedHtml = '';
  }

  async copyMatches(): Promise<void> {
    if (!this.matches.length) return;
    try {
      await navigator.clipboard.writeText(this.matches.join('\n'));
      this.copied = true;
      setTimeout(() => { this.copied = false; this.cdr.detectChanges(); }, 1500);
      this.cdr.detectChanges();
    } catch {}
  }
}
