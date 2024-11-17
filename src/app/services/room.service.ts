import { Inject, Injectable } from '@angular/core';
import { WebRTCService } from './webrtc.service';
import { Socket } from 'socket.io-client';
import { Participant } from '../components/participants-grid/participants-grid.component';

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  constructor(
    private WebRTCService: WebRTCService,
    @Inject('socket') private socket: Socket,
    @Inject('username') private username: string
  ) {}

  async createRoom(roomName: string): Promise<string | null> {
    try {
      return new Promise((resolve, reject) => {
        this.socket.emit('create-room', { roomName, username: this.username }, (response: any) => {
          console.log('create-room response', response);
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.roomId);
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
        this.socket.emit('join-room', { roomId, username: this.username }, (response: any) => {
          // todo if error - redirect to lobby
          console.log('join-room response', response);
          if (response.error) {
            return reject(response.error);
          }

          const participants = response.participants.map((p: Participant) => ({
            ...p,
            stream: undefined
          }));
          this.WebRTCService.updateParticipants(participants);
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
    this.WebRTCService.clearPeerConnections();
  }
}
