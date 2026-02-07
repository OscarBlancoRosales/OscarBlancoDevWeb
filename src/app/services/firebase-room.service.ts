import { Injectable } from '@angular/core';
import { database } from '../firebase.config';
import { ref, set, onValue, off, push, update, remove } from 'firebase/database';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Player {
  id: string;
  name: string;
  currentVote: number;
  hasVoted: boolean;
  isCurrentPlayer?: boolean;
  voteBreakdown: {
    numbers: number;
    coffee: number;
    joint: number;
  };
}

export interface RoomData {
  players: { [key: string]: Player };
  showVotes: boolean;
  createdAt: string;
  lastUpdated: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseRoomService {
  private currentRoomId: string = '';
  private unsubscribe: (() => void) | null = null;
  private roomDataSubject = new BehaviorSubject<RoomData | null>(null);
  public roomData$ = this.roomDataSubject.asObservable();

  constructor() {}

  // Crear una nueva sala
  createRoom(): string {
    const roomId = 'ROOM-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const roomRef = ref(database, `rooms/${roomId}`);
    
    const initialData: RoomData = {
      players: {},
      showVotes: false,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    set(roomRef, initialData);
    return roomId;
  }

  // Unirse a una sala existente
  joinRoom(roomId: string, playerName: string): string {
    // Generar ID único para el jugador
    const playerId = Math.random().toString(36).substr(2, 9);
    
    // Añadir jugador a la sala
    const playerRef = ref(database, `rooms/${roomId}/players/${playerId}`);
    const playerData: Player = {
      id: playerId,
      name: playerName,
      currentVote: 0,
      hasVoted: false,
      voteBreakdown: {
        numbers: 0,
        coffee: 0,
        joint: 0
      }
    };
    
    set(playerRef, playerData);
    
    // Escuchar cambios en la sala
    this.listenToRoom(roomId);
    
    return playerId;
  }

  // Escuchar cambios en tiempo real
  public listenToRoom(roomId: string): void {
    // Si ya estamos escuchando esta sala, no hacer nada
    if (this.currentRoomId === roomId && this.unsubscribe) {
      console.log('Ya escuchando sala:', roomId);
      return;
    }
    
    // Desconectar listener anterior si existe
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    this.currentRoomId = roomId;
    const roomRef = ref(database, `rooms/${roomId}`);
    
    console.log('Iniciando listener para sala:', roomId);
    
    // Crear listener y guardar función para desuscribirse
    const unsubscribeFunc = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Datos recibidos de Firebase:', data);
      if (data) {
        this.roomDataSubject.next(data as RoomData);
      }
    }, (error) => {
      console.error('Error en listener de Firebase:', error);
    });
    
    this.unsubscribe = unsubscribeFunc;
  }

  // Actualizar voto del jugador
  updatePlayerVote(roomId: string, playerId: string, vote: number, voteBreakdown: any): void {
    const playerRef = ref(database, `rooms/${roomId}/players/${playerId}`);
    update(playerRef, {
      currentVote: vote,
      hasVoted: true,
      voteBreakdown: voteBreakdown
    });
    
    // Actualizar timestamp de la sala
    const roomRef = ref(database, `rooms/${roomId}`);
    update(roomRef, { lastUpdated: new Date().toISOString() });
  }

  // Limpiar voto del jugador
  clearPlayerVote(roomId: string, playerId: string): void {
    const playerRef = ref(database, `rooms/${roomId}/players/${playerId}`);
    update(playerRef, {
      currentVote: 0,
      hasVoted: false,
      voteBreakdown: { numbers: 0, coffee: 0, joint: 0 }
    });
  }

  // Revelar votos
  revealVotes(roomId: string): void {
    const roomRef = ref(database, `rooms/${roomId}`);
    update(roomRef, { 
      showVotes: true,
      lastUpdated: new Date().toISOString()
    });
  }

  // Resetear ronda (ocultar votos y limpiar todos)
  resetRound(roomId: string): void {
    const roomRef = ref(database, `rooms/${roomId}`);
    
    // Primero obtener los jugadores actuales
    onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.players) {
        const updates: any = {
          showVotes: false,
          lastUpdated: new Date().toISOString()
        };
        
        // Resetear cada jugador
        Object.keys(data.players).forEach(playerId => {
          updates[`players/${playerId}/currentVote`] = 0;
          updates[`players/${playerId}/hasVoted`] = false;
          updates[`players/${playerId}/voteBreakdown`] = { numbers: 0, coffee: 0, joint: 0 };
        });
        
        update(roomRef, updates);
      }
    }, { onlyOnce: true });
  }

  // Salir de la sala
  leaveRoom(roomId: string, playerId: string): void {
    const playerRef = ref(database, `rooms/${roomId}/players/${playerId}`);
    remove(playerRef);
    
    // Dejar de escuchar
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.currentRoomId = '';
    this.roomDataSubject.next(null);
  }

  // Verificar si una sala existe
  async roomExists(roomId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const roomRef = ref(database, `rooms/${roomId}`);
      onValue(roomRef, (snapshot) => {
        resolve(snapshot.exists());
      }, { onlyOnce: true });
    });
  }

  // Limpiar salas antiguas (más de 24 horas)
  cleanOldRooms(): void {
    const roomsRef = ref(database, 'rooms');
    onValue(roomsRef, (snapshot) => {
      const rooms = snapshot.val();
      if (rooms) {
        const now = new Date().getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
        
        Object.keys(rooms).forEach(roomId => {
          const room = rooms[roomId];
          if (room.createdAt) {
            const createdAt = new Date(room.createdAt).getTime();
            if (now - createdAt > maxAge) {
              // Eliminar sala antigua
              const oldRoomRef = ref(database, `rooms/${roomId}`);
              remove(oldRoomRef);
              console.log(`Sala ${roomId} eliminada por antigüedad`);
            }
          }
        });
      }
    }, { onlyOnce: true });
  }

  // Desconectar
  disconnect(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.currentRoomId = '';
  }
}
