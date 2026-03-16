import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { FirebaseRoomService, Player, RoomData } from '../services/firebase-room.service';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';

interface VoteSummary {
  vote: string;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-scrum-poker',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './scrum-poker.html',
  styleUrl: './scrum-poker.css',
})
export class ScrumPoker implements OnInit, OnDestroy {
  // Room data
  roomId = '';
  playerId = '';
  currentPlayerName = '';
  isRoomCreator = false;
  
  // Players
  players: Player[] = [];
  
  // Voting state
  accumulativeVotes = [1, 2, 3, 5, 10, 20];
  showVotes = false;
  hasVoted = false;
  customVoteInput = '';
  
  // Vote breakdown for current player (single vote: number OR coffee OR joint)
  voteBreakdown = {
    numbers: 0,
    coffee: 0,
    joint: 0
  };
  
  // Results
  average = 0;
  standardDeviation = 0;
  totalVotes = 0;
  validVoters = 0;
  voteSummary: VoteSummary[] = [];
  
  // PRO Analysis
  minVote = 0;
  maxVote = 0;
  voteRange = 0;
  clusters: { value: number; players: string[] }[] = [];
  consensusStatus: 'consensus' | 'light-dispersion' | 'disagreement' = 'consensus';
  
  // Subscriptions
  private roomSubscription?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private firebaseService: FirebaseRoomService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Verificar si viene por invitación (tiene parámetro room en la URL)
    const roomIdParam = this.route.snapshot.queryParamMap.get('room');
    if (roomIdParam) {
      // Limpiar datos de sesión anterior para evitar entrar con nombre de otro
      localStorage.removeItem('player_name');
      localStorage.removeItem('player_id');
      localStorage.removeItem('is_room_creator');
      localStorage.setItem('current_room_id', roomIdParam);
      // Siempre redirigir a name-screen para que elija su nombre
      this.router.navigate(['/name-screen'], { queryParams: { room: roomIdParam } });
      return;
    }
    
    // Obtener datos de localStorage
    this.roomId = localStorage.getItem('current_room_id') || '';
    this.playerId = localStorage.getItem('player_id') || '';
    this.currentPlayerName = localStorage.getItem('player_name') || '';
    this.isRoomCreator = localStorage.getItem('is_room_creator') === 'true';
    
    // Si no tiene nombre, necesita autenticarse primero
    if (!this.currentPlayerName) {
      this.router.navigate(['/auth']);
      return;
    }
    
    // Suscribirse a cambios en la sala
    this.roomSubscription = this.firebaseService.roomData$.subscribe(data => {
      if (data) {
        this.ngZone.run(() => {
          this.handleRoomUpdate(data);
          this.cdr.detectChanges();
        });
      }
    });
    
    // Unirse a la sala UNA SOLA VEZ
    if (!this.playerId) {
      this.playerId = this.firebaseService.joinRoom(this.roomId, this.currentPlayerName);
      localStorage.setItem('player_id', this.playerId);
    } else {
      this.firebaseService.listenToRoom(this.roomId);
    }
    
    // Limpiar salas antiguas (más de 24 horas)
    this.firebaseService.cleanOldRooms();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    if (this.roomId && this.playerId) {
      this.firebaseService.leaveRoom(this.roomId, this.playerId);
      localStorage.removeItem('current_room_id');
      localStorage.removeItem('player_name');
      localStorage.removeItem('player_id');
    }
  }

  ngOnDestroy(): void {
    if (this.roomSubscription) {
      this.roomSubscription.unsubscribe();
    }
    this.firebaseService.disconnect();
  }

  private handleRoomUpdate(data: RoomData): void {
    if (data.players) {
      this.players = Object.values(data.players).map(player => ({
        ...player,
        isCurrentPlayer: player.id === this.playerId
      }));
    } else {
      this.players = [];
    }
    
    this.showVotes = data.showVotes || false;
    
    // Sincronizar estado del jugador actual desde Firebase
    const currentPlayer = this.players.find(p => p.id === this.playerId);
    if (currentPlayer) {
      this.hasVoted = currentPlayer.hasVoted;
      this.voteBreakdown = currentPlayer.voteBreakdown || { numbers: 0, coffee: 0, joint: 0 };
    }
    
    this.calculateResults();
  }

  // Accumulative vote: adds to current number total
  addVote(value: number): void {
    if (this.showVotes) return;

    // Clear special votes, accumulate numbers
    this.voteBreakdown.coffee = 0;
    this.voteBreakdown.joint = 0;
    this.voteBreakdown.numbers += value;
    this.hasVoted = true;

    this.firebaseService.updatePlayerVote(
      this.roomId,
      this.playerId,
      this.voteBreakdown.numbers,
      this.voteBreakdown
    );
  }

  // Replace vote: sets value directly (0, coffee, joint, custom text)
  replaceVote(value: number | string): void {
    if (this.showVotes) return;

    this.voteBreakdown = { numbers: 0, coffee: 0, joint: 0 };

    if (typeof value === 'number') {
      this.voteBreakdown.numbers = value;
    } else if (value === 'coffee') {
      this.voteBreakdown.coffee = 1;
    } else if (value === 'joint') {
      this.voteBreakdown.joint = 1;
    }

    this.hasVoted = true;

    this.firebaseService.updatePlayerVote(
      this.roomId,
      this.playerId,
      this.voteBreakdown.numbers,
      this.voteBreakdown
    );
  }

  submitCustomVote(): void {
    if (this.showVotes) return;
    const val = parseFloat(this.customVoteInput);
    if (!isNaN(val) && val >= 0) {
      this.replaceVote(val);
      this.customVoteInput = '';
    }
  }

  clearMyVote(): void {
    this.hasVoted = false;
    this.voteBreakdown = { numbers: 0, coffee: 0, joint: 0 };
    this.firebaseService.clearPlayerVote(this.roomId, this.playerId);
  }

  get allPlayersVoted(): boolean {
    return this.players.length > 0 && this.players.every(p => p.hasVoted);
  }

  revealVotes(): void {
    this.firebaseService.revealVotes(this.roomId);
  }

  resetVotes(): void {
    this.firebaseService.resetRound(this.roomId);
    this.hasVoted = false;
    this.voteBreakdown = { numbers: 0, coffee: 0, joint: 0 };
    this.customVoteInput = '';
  }

  private calculateResults(): void {
    if (!this.showVotes) {
      this.average = 0;
      this.standardDeviation = 0;
      this.totalVotes = 0;
      this.validVoters = 0;
      this.voteSummary = [];
      this.minVote = 0;
      this.maxVote = 0;
      this.voteRange = 0;
      this.clusters = [];
      return;
    }

    const validVotes = this.players
      .filter(p => p.hasVoted && p.voteBreakdown && p.voteBreakdown.numbers > 0)
      .map(p => p.voteBreakdown.numbers);

    this.validVoters = validVotes.length;
    this.totalVotes = this.players.filter(p => p.hasVoted).length;

    if (validVotes.length > 0) {
      const sum = validVotes.reduce((acc, v) => acc + v, 0);
      this.average = Math.round((sum / validVotes.length) * 100) / 100;
      
      // Calcular desviación estándar
      const squaredDiffs = validVotes.map(v => Math.pow(v - this.average, 2));
      const avgSquaredDiff = squaredDiffs.reduce((acc, v) => acc + v, 0) / validVotes.length;
      this.standardDeviation = Math.round(Math.sqrt(avgSquaredDiff) * 100) / 100;
      
      // PRO: Calcular min, max y rango
      this.minVote = Math.min(...validVotes);
      this.maxVote = Math.max(...validVotes);
      this.voteRange = this.maxVote - this.minVote;
    } else {
      this.average = 0;
      this.standardDeviation = 0;
      this.minVote = 0;
      this.maxVote = 0;
      this.voteRange = 0;
    }

    // PRO: Detectar clusters
    this.detectClusters();
    
    this.calculateVoteSummary();
  }

  private calculateVoteSummary(): void {
    const voteMap = new Map<string, number>();

    this.players.forEach(player => {
      if (player.hasVoted && player.voteBreakdown) {
        if (player.voteBreakdown.coffee > 0) {
          voteMap.set('☕', (voteMap.get('☕') || 0) + 1);
        } else if (player.voteBreakdown.joint > 0) {
          voteMap.set('🚬', (voteMap.get('🚬') || 0) + 1);
        } else {
          const key = player.voteBreakdown.numbers.toString();
          voteMap.set(key, (voteMap.get(key) || 0) + 1);
        }
      }
    });

    const total = this.totalVotes;
    this.voteSummary = Array.from(voteMap.entries())
      .map(([v, count]) => ({
        vote: v,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => {
        const aNum = !isNaN(Number(a.vote));
        const bNum = !isNaN(Number(b.vote));
        if (aNum && bNum) return Number(a.vote) - Number(b.vote);
        if (aNum) return -1;
        if (bNum) return 1;
        return a.vote.localeCompare(b.vote);
      });
  }

  get myVoteDisplay(): string {
    if (this.voteBreakdown.coffee > 0) return '☕';
    if (this.voteBreakdown.joint > 0) return '🚬';
    return this.voteBreakdown.numbers.toString();
  }

  getVoteDisplay(player: Player): string {
    if (!player.voteBreakdown) return '—';
    if (player.voteBreakdown.coffee > 0) return '☕';
    if (player.voteBreakdown.joint > 0) return '🚬';
    return player.voteBreakdown.numbers.toString();
  }

  isSpecialVote(player: Player): boolean {
    return player.voteBreakdown ? 
      (player.voteBreakdown.coffee > 0 || player.voteBreakdown.joint > 0) : false;
  }

  // ===== PRO ANALYSIS SYSTEM =====
  
  // Z-score based deviation per player
  getPlayerZScore(player: Player): number {
    if (!player.hasVoted || !player.voteBreakdown || this.standardDeviation === 0) return 0;
    if (this.isSpecialVote(player)) return 0;
    
    const playerVote = player.voteBreakdown.numbers;
    return Math.abs(playerVote - this.average) / this.standardDeviation;
  }

  getPlayerDeviationLevel(player: Player): 'none' | 'light' | 'high' {
    if (!this.showVotes || !player.hasVoted || !player.voteBreakdown) return 'none';
    if (this.isSpecialVote(player)) return 'none';
    if (this.standardDeviation === 0) return 'none';
    
    const zScore = this.getPlayerZScore(player);
    
    // z > 2σ = alta desviación (outlier)
    if (zScore > 2) return 'high';
    // z > 1.5σ = desviación ligera
    if (zScore > 1.5) return 'light';
    
    return 'none';
  }

  isHighDeviation(player: Player): boolean {
    return this.getPlayerDeviationLevel(player) === 'high';
  }

  isLightDeviation(player: Player): boolean {
    return this.getPlayerDeviationLevel(player) === 'light';
  }

  // Check if player has min or max vote
  isMinVote(player: Player): boolean {
    if (!this.showVotes || !player.hasVoted || !player.voteBreakdown) return false;
    if (this.isSpecialVote(player)) return false;
    return player.voteBreakdown.numbers === this.minVote && this.voteRange > 2;
  }

  isMaxVote(player: Player): boolean {
    if (!this.showVotes || !player.hasVoted || !player.voteBreakdown) return false;
    if (this.isSpecialVote(player)) return false;
    return player.voteBreakdown.numbers === this.maxVote && this.voteRange > 2;
  }

  // Global consensus status based on σ
  getConsensusInfo(): { status: string; class: string; icon: string; message: string } {
    if (this.validVoters < 2) {
      return { status: 'Esperando', class: 'waiting', icon: '⏳', message: 'Faltan votos' };
    }
    
    if (this.standardDeviation === 0) {
      return { status: 'Consenso Total', class: 'perfect', icon: '✅', message: 'Todos de acuerdo' };
    } else if (this.standardDeviation < 1.5) {
      return { status: 'Consenso', class: 'consensus', icon: '👍', message: 'Buen acuerdo' };
    } else if (this.standardDeviation < 3) {
      return { status: 'Dispersión', class: 'dispersion', icon: '📊', message: 'Hay diferencias' };
    } else {
      return { status: 'Desacuerdo', class: 'disagreement', icon: '⚠️', message: 'Discutir estimaciones' };
    }
  }

  // Detect voting clusters
  private detectClusters(): void {
    const validPlayers = this.players.filter(p => 
      p.hasVoted && p.voteBreakdown && !this.isSpecialVote(p)
    );
    
    if (validPlayers.length < 2) {
      this.clusters = [];
      return;
    }

    // Group votes by value
    const voteGroups = new Map<number, string[]>();
    validPlayers.forEach(p => {
      const vote = p.voteBreakdown!.numbers;
      if (!voteGroups.has(vote)) {
        voteGroups.set(vote, []);
      }
      voteGroups.get(vote)!.push(p.name);
    });

    // Convert to array and sort by vote value
    this.clusters = Array.from(voteGroups.entries())
      .map(([value, players]) => ({ value, players }))
      .sort((a, b) => a.value - b.value);
  }

  // Check if there are distinct groups (polarization)
  hasPolarization(): boolean {
    if (this.clusters.length < 2) return false;
    
    const minCluster = this.clusters[0].value;
    const maxCluster = this.clusters[this.clusters.length - 1].value;
    
    // Polarization if range > 5 or ratio > 2
    return (maxCluster - minCluster) > 5 || (minCluster > 0 && maxCluster / minCluster >= 2);
  }

  // Get low voters (for discussion)
  getLowVoters(): string[] {
    if (!this.showVotes || this.clusters.length < 2) return [];
    return this.clusters[0].players;
  }

  // Get high voters (for discussion)
  getHighVoters(): string[] {
    if (!this.showVotes || this.clusters.length < 2) return [];
    return this.clusters[this.clusters.length - 1].players;
  }

  // Legacy method for backward compatibility
  getDeviationLevel(): { level: string; class: string; message: string } {
    const info = this.getConsensusInfo();
    return { level: info.status, class: info.class, message: info.message };
  }

  copyRoomLink(): void {
    const inviteLink = `${window.location.origin}/scrum-poker?room=${this.roomId}`;
    navigator.clipboard.writeText(inviteLink);
  }

  leaveRoom(): void {
    this.firebaseService.leaveRoom(this.roomId, this.playerId);
    localStorage.removeItem('current_room_id');
    localStorage.removeItem('player_name');
    localStorage.removeItem('player_id');
    this.router.navigate(['/']);
  }
}
