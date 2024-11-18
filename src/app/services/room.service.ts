import { Inject, Injectable } from '@angular/core';
import { WebRTCService, Participant } from './webrtc.service';
import { Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';
import { UserService } from './user.service';

interface Room {
  id: string;
  name: string;
  chatEnabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private currentRoomSubject = new BehaviorSubject<Room | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();

  constructor(
    private userService: UserService,
    @Inject('socket') private socket: Socket,
  ) {}

  public get currentRoomId(): string | null {
    return this.currentRoomSubject.value?.id ?? null;
  }

  async createRoom(roomName: string): Promise<string | null> {
    try {
      return new Promise((resolve, reject) => {
        this.socket.emit('create-room', { roomName, username: this.userService.getUsername() }, (response: any) => {
          if (response.error) {
            reject(response.error);
          } else {
            this.currentRoomSubject.next(response.room);
            resolve(response.room.id);
          }
        });
      });
    } catch (error) {
      console.error('Error creating room:', error);
      return Promise.reject(null);
    }
  }

  // todo fix types
  async joinRoom(roomId: string): Promise<boolean | null> {
    try {
      return new Promise((resolve, reject) => {
        this.socket.emit('join-room', { roomId, username: this.userService.getUsername() }, (response: any) => {
          if (response.error) {
            return reject(response.error);
          }

          this.currentRoomSubject.next(response.room);
          resolve(true);
        });
      });
    } catch (error) {
      console.error('Error joining room:', error);
      return Promise.reject(null);
    }
  }

  leaveRoom() {
    this.socket.emit('leave-room');
    this.currentRoomSubject.next(null);
  }
}
