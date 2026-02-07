import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../services/i18n.service';

interface DataItem {
  label: string;
  value: string;
  hovered: boolean;
}

interface DataSection {
  title: string;
  items: DataItem[];
}

@Component({
  selector: 'app-console',
  imports: [CommonModule, FormsModule],
  templateUrl: './console.html',
  styleUrl: './console.css'
})
export class Console implements OnInit {
  // Estados de la consola
  showMenu = false;
  menuOpen = false;
  terminalOn = false;
  showPrompt = false;
  cursorBlinking = false;
  typingCommand = false;
  showData = false;
  showSocial = false;
  
  // Estado de autenticación
  isAuthenticated = false;
  
  // Texto que se escribe automáticamente
  typedText = '';
  fullCommand = 'data --extended';
  
  // Para efecto typewriter de datos
  displayedLines: string[] = [];
  isTypingData = false;
  
  // Terminal interactiva
  showInteractiveTerminal = false;
  currentCommand = '';
  commandHistory: string[] = [];
  terminalOutput: string[] = [];
  
  get personalData(): DataSection[] {
    return [
      {
        title: this.i18n.t('console.configDev'),
        items: [
          { label: this.i18n.t('console.name'), value: 'Oscar ', hovered: false },
          { label: this.i18n.t('console.surname'), value: 'Blanco Rosales', hovered: false },
          { label: this.i18n.t('console.role'), value: 'Full Stack Developer', hovered: false },
          { label: this.i18n.t('console.experience'), value: this.i18n.t('console.expYears'), hovered: false },
          { label: this.i18n.t('console.specialization'), value: 'C#, Flutter, Angular', hovered: false }
        ]
      },
      {
        title: this.i18n.t('console.configTech'),
        items: [
          { label: 'Frontend', value: 'Flutter, TypeScript, Angular', hovered: false },
          { label: 'Backend', value: 'C#', hovered: false },
          { label: this.i18n.t('console.databases'), value: 'SQL Server, PostgreSQL, MongoDB, MySQL', hovered: false },
          { label: 'Cloud', value: 'Firebase, Azure', hovered: false },
          { label: 'DevOps', value: 'Docker, Kubernetes, CI/CD', hovered: false }
        ]
      },
      {
        title: this.i18n.t('console.configContact'),
        items: [
          { label: 'Email', value: 'oscar.blanco.r@gmail.com', hovered: false },
          { label: this.i18n.t('console.location'), value: this.i18n.t('console.spain'), hovered: false },
          { label: 'Portfolio', value: 'www.oscarblancorosales.com', hovered: false }
        ]
      }
    ];
  }

  constructor(private router: Router, private cdr: ChangeDetectorRef, public i18n: I18nService) {}

  ngOnInit(): void {
    // Verificar si el usuario está autenticado
    this.isAuthenticated = this.checkAuthentication();
    this.startConsoleAnimation();
  }
  
  private checkAuthentication(): boolean {
    return localStorage.getItem('auth_token') !== null;
  }

  private startConsoleAnimation(): void {
    setTimeout(() => {
      this.terminalOn = true;
      this.showPrompt = true;
      this.cursorBlinking = true;
      this.cdr.detectChanges();
    }, 500);

    setTimeout(() => {
      this.cursorBlinking = false;
      this.showPrompt = false;
      this.typingCommand = true;
      this.cdr.detectChanges();
      this.typeCommand();
    }, 2500);
  }

  private typeCommand(): void {
    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      if (currentIndex <= this.fullCommand.length) {
        this.typedText = this.fullCommand.substring(0, currentIndex);
        currentIndex++;
        this.cdr.detectChanges();
      } else {
        clearInterval(typeInterval);
        this.typingCommand = false;
        this.showData = true;
        this.showMenu = true;
        this.cdr.detectChanges();
        // Iniciar efecto typewriter para los datos
        this.typeDataLines();
      }
    }, 100);
  }

  private typeDataLines(): void {
    this.isTypingData = true;
    const allLines = this.generateDataLines();
    let lineIndex = 0;
    
    const lineInterval = setInterval(() => {
      if (lineIndex < allLines.length) {
        this.displayedLines.push(allLines[lineIndex]);
        lineIndex++;
        this.cdr.detectChanges();
      } else {
        clearInterval(lineInterval);
        this.isTypingData = false;
        this.showSocial = true;
        // Mostrar terminal interactiva después de un delay
        setTimeout(() => {
          this.showInteractiveTerminal = true;
          this.terminalOutput = [];
          this.cdr.detectChanges();
        }, 1000);
        this.cdr.detectChanges();
      }
    }, 50);
  }

  private generateDataLines(): string[] {
    const lines: string[] = [''];
    
    this.personalData.forEach(section => {
      lines.push(section.title);
      lines.push('');
      section.items.forEach(item => {
        lines.push(`   ${item.label} . . . . . . . . . . : ${item.value}`);
      });
      lines.push('');
    });
    
    return lines;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenuIfOpen(): void {
    if (this.menuOpen) {
      this.menuOpen = false;
    }
  }

  navigate(path: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    this.router.navigate([path]);
  }

  clearSession(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    localStorage.clear();
    alert(this.i18n.t('console.sessionCleared'));
  }

  // Terminal interactiva
  onCommandInput(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.executeCommand();
    }
  }

  executeCommand(): void {
    const command = this.currentCommand.trim().toLowerCase();
    if (!command) return;

    // Añadir comando al historial
    this.terminalOutput.push(`PS C:\git\Oscar> ${this.currentCommand}`);
    this.commandHistory.push(this.currentCommand);

    // Procesar comando
    this.processCommand(command);

    // Limpiar input
    this.currentCommand = '';
    this.cdr.detectChanges();
  }

  private processCommand(command: string): void {
    switch (command) {
      case 'help':
        this.showHelp();
        break;
      case 'clear':
        this.clearTerminal();
        break;
      case 'about':
        this.showAbout();
        break;
      case 'projects':
        this.showProjects();
        break;
      case 'contact':
        this.showContact();
        break;
      default:
        this.terminalOutput.push(this.i18n.t('console.unknownCmd', { cmd: command }));
        break;
    }
  }

  private showHelp(): void {
    this.terminalOutput.push(
      this.i18n.t('console.helpTitle'),
      this.i18n.t('console.helpHelp'),
      this.i18n.t('console.helpClear'),
      this.i18n.t('console.helpAbout'),
      this.i18n.t('console.helpProjects'),
      this.i18n.t('console.helpContact')
    );
  }

  private clearTerminal(): void {
    this.terminalOutput = [this.i18n.t('console.clearMsg')];
  }

  private showAbout(): void {
    this.terminalOutput.push(
      '👨‍💻 Oscar Blanco Rosales',
      this.i18n.t('console.aboutExp'),
      this.i18n.t('console.aboutSpec'),
      this.i18n.t('console.aboutPassion')
    );
  }

  private showProjects(): void {
    this.terminalOutput.push(
      this.i18n.t('console.projectsTitle'),
      this.i18n.t('console.projectPoker'),
      this.i18n.t('console.projectDni'),
      this.i18n.t('console.projectPortfolio'),
      this.i18n.t('console.projectMultiple')
    );
  }

  private showContact(): void {
    this.terminalOutput.push(
      '📧 Email: oscar.blanco.r@gmail.com',
      '💼 LinkedIn: https://www.linkedin.com/in/oscar-blanco-a5108b349/',
      '🐙 GitHub: https://github.com/oscarblanco-dev',
      '🌐 Web: www.oscarblancorosales.com'
    );
  }
}
