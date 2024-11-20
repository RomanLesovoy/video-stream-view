import { Inject, Injectable, isDevMode } from '@angular/core';
import { Socket } from 'socket.io-client';
import { BehaviorSubject, debounceTime, firstValueFrom } from 'rxjs';
import { LocalStreamService } from './local-stream.service';
import { optimizeVideoQuality, ConnectionQuality } from './webrtc.helper';
import { UserService } from './user.service';
import { AudioActivityService } from './audio-activity.service';
import { PeerConnectionService } from './peer-connection.service';
import { RoomService } from './room.service';

export interface Participant {
  socketId: string;
  username: string;
  stream?: MediaStream;
  isScreenSharing: boolean;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isSpeaking: boolean;
  active: boolean;
}

interface PeerState {
  connection: RTCPeerConnection;
  username: string;
  isConnected: boolean;
  lastActivity: Date;
}

@Injectable({
  providedIn: 'root'
})
export class WebRTCService {
  private optimizationInterval: any | null = null;
  private lastStats: Map<string, { bytesSent: number, timestamp: number }> = new Map();
  private stateConnections: Map<string, PeerState> = new Map();
  private participants = new BehaviorSubject<Participant[]>([]);
  public participants$ = this.participants.asObservable();
  private connectionQuality = new BehaviorSubject<ConnectionQuality[]>([]);
  public connectionQuality$ = this.connectionQuality.asObservable();
  private debugMode = isDevMode();

  constructor(
    @Inject('socket') private socket: Socket,
    private userService: UserService,
    private audioActivityService: AudioActivityService,
    private localStreamService: LocalStreamService,
    private peerConnectionService: PeerConnectionService,
    private roomService: RoomService
  ) {
    this.setupSocketListeners();
    this.setupStreamListeners();
    this.setupHeartbeat();

    window.addEventListener('beforeunload', () => {
      this.socket.emit('leave-room');
      this.clearPeerConnections();
    });

    this.roomService.currentRoom$.subscribe(room => {
      if (!room) {
        this.clearPeerConnections();
      }
    });

    this.startOptimization();
  }

  private setupHeartbeat(): void {
    this.socket.on('ping', () => {
      this.socket.emit('pong');
    });
  }

  private setupStreamListeners(): void {
    this.localStreamService.mediaState$
      .pipe(debounceTime(100))
      .subscribe(async (state) => {
        if (!this.roomService.currentRoomId) return;

        const peers = Array.from(this.peerConnectionService.getAllConnections());
        
        // Change video track for all peers
        for (const [socketId, peerConnection] of peers) {
          try {
            const senders = peerConnection.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video');
            
            if (videoSender && state.stream) {
              const newTrack = state.stream.getVideoTracks()[0];
              if (newTrack) {
                await videoSender.replaceTrack(newTrack);
              }
            }
          } catch (error) {
            console.error('[WebRTC] Error replacing track:', error);
          }
        }
      });
  }

  private startOptimization(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
  
    this.optimizationInterval = setInterval(async () => {
      const quality = await optimizeVideoQuality(this.stateConnections, this.lastStats, this.debug);
      this.connectionQuality.next(quality);
    }, 8000);
  }

  private debug = (...args: any[]) => {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  private async handleConnectionFailure(socketId: string): Promise<void> {
    const state = this.stateConnections.get(socketId);
    if (!state) return;

    try {
      await this.recreateConnection(socketId);
    } catch (error) {
      console.error('Failed to recreate connection:', error);
      this.handleUserLeft(socketId);
    }
  }

  private async recreateConnection(socketId: string): Promise<void> {
    await this.handleUserLeft(socketId);
    await this.createPeerConnection(socketId, this.userService.getUsername());
  }

  private setParticipantActive(participant: Participant, stream: MediaStream | undefined): void {
    participant.active = stream
      && stream.active
      && (participant.isScreenSharing || participant.isCameraEnabled)
      || false;
  }

  private setupSocketListeners(): void {
    this.socket.on('user-joined', async ({ socketId, username, ...rest }) => {
      const participantIndex = this.findParticipantIndex(socketId);
      const newParticipant = {
        socketId,
        username,
        isCameraEnabled: true,
        isMicEnabled: true,
        isSpeaking: false,
        isScreenSharing: false,
        active: true,
        ...rest,
      };

      if (participantIndex !== -1) {
        this.participants.value[participantIndex] = newParticipant;
        this.participants.next(this.participants.value);
      } else {
        this.participants.next([...this.participants.value, newParticipant]);
      }
      
    });

    this.socket.on('set-participants', async ({ participants }) => {
      this.updateParticipants(participants.map((p: Participant) => ({
        ...p,
        isCameraEnabled: p.isCameraEnabled ?? true,
        isMicEnabled: p.isMicEnabled ?? true,
        stream: undefined,
      })));
    });

     this.socket.on('stream-state-changed', ({ socketId, ...rest }) => {
      const participants = [...this.participants.value];
      const participantIndex = this.findParticipantIndex(socketId);
      
      if (participantIndex !== -1) {
        const participant = participants[participantIndex];
        const stream = participant.stream;

        const newParticipant = {
          ...participant,
          ...rest,
          stream
        };

        this.setParticipantActive(newParticipant, stream);
        participants[participantIndex] = newParticipant;
        
        // Disable video track if camera is disabled
        const videoTrack = stream?.getVideoTracks()[0];
        // if (videoTrack) {
        //   videoTrack.enabled = rest.isCameraEnabled || rest.isScreenSharing;
        // }
        
        this.participants.next(participants);
      }
    });

    this.socket.on('user-left', ({ socketId }) => {
      this.handleUserLeft(socketId);
    });

    this.socket.on('request-offer', async ({ socketId }) => {
      await this.localStreamService.ensureLocalStream();
      await this.createAndSendOffer(socketId);
    });

    this.socket.on('offer', async ({ offer, from }) => {
      await this.handleOffer(offer, from);
    });

    this.socket.on('answer', ({ answer, from }) => {
      this.handleAnswer(answer, from);
    });

    this.socket.on('ice-candidate', ({ candidate, from }) => {
      this.handleIceCandidate(candidate, from);
    });
  }

  private async createPeerConnection(socketId: string, username: string): Promise<RTCPeerConnection> {
    await this.localStreamService.ensureLocalStream();
    const localStream = this.localStreamService.getStream();
    
    if (!localStream) {
      throw new Error('No local stream available after ensuring its presence');
    }

    const peerConnection = await this.peerConnectionService.createPeerConnection(
      socketId,
      username,
      localStream,
      (event) => this.handleTrackEvent(event, socketId),
      (candidate) => {
        this.socket.emit('ice-candidate', {
          target: socketId,
          candidate
        });
      }
    );

    this.peerConnectionService.monitorConnection(socketId, () => {
      this.handleConnectionFailure(socketId);
    });

    return peerConnection;
  }

  private async createAndSendOffer(socketId: string): Promise<void> {
    try {
      this.debug('Creating offer for:', socketId);
      const peerConnection = await this.createOrGetPeerConnection(socketId);
      const offer = await this.peerConnectionService.createOffer(peerConnection);
      
      this.debug('Sending offer to:', socketId);
      this.socket.emit('offer', {
        target: socketId,
        offer
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  private async createOrGetPeerConnection(socketId: string): Promise<RTCPeerConnection> {
    let peerConnection = this.peerConnectionService.getConnection(socketId);
    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(socketId, this.userService.getUsername());
    }
    return peerConnection;
  }

  private async handleOffer(offer: RTCSessionDescriptionInit, from: string): Promise<void> {
    try {
      this.debug('Handling offer from:', from);
      await this.localStreamService.ensureLocalStream();
      const peerConnection = await this.createOrGetPeerConnection(from);
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      this.debug('Sending answer to:', from);
      this.socket.emit('answer', {
        target: from,
        answer
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit, from: string): Promise<void> {
    try {
      await this.peerConnectionService.handleAnswer(from, answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit, from: string): Promise<void> {
    try {
      await this.peerConnectionService.handleIceCandidate(from, candidate);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  private handleSpeaking(stream: MediaStream, socketId: string) {
    this.audioActivityService.initializeAudioAnalyser(stream, socketId, (isSpeaking: boolean) => {
      const currentParticipants = [...this.participants.value];
      const index = this.findParticipantIndex(socketId);
      if (index !== -1 && currentParticipants[index].isSpeaking !== isSpeaking) {
        currentParticipants[index] = {
          ...currentParticipants[index],
          isSpeaking
        };
        this.participants.next(currentParticipants);
      }
    });
  }

  private handleTrackEvent(event: RTCTrackEvent, socketId: string): void {
    if (!event.streams || event.streams.length === 0) return;

    const stream = event.streams[0];
    const participants = [...this.participants.value];
    const participantIndex = this.findParticipantIndex(socketId);

    if (participantIndex === -1) return;

    const participant = participants[participantIndex];
    const newParticipant = {
      ...participant,
      stream: stream,
      isSpeaking: false
    }
        
    this.setParticipantActive(newParticipant, stream);

    participants[participantIndex] = newParticipant;
    this.handleSpeaking(stream, socketId);
    this.participants.next(participants);
  }

  private findParticipantIndex(socketId: string): number {
    return this.participants.value.findIndex(p => p.socketId === socketId);
  }

  private handleUserLeft(socketId: string): void {
    this.audioActivityService.stopAnalyser(socketId);
    this.peerConnectionService.closeConnection(socketId);
    const participants = this.participants.value.filter(p => p.socketId !== socketId);
    this.participants.next(participants);
  }

  public updateParticipants(participants: Participant[]): void {
    this.participants.next(participants);
  }

  public clearPeerConnections(): void {
    this.peerConnectionService.clearAllConnections();
    this.participants.next([]);
  }
}
