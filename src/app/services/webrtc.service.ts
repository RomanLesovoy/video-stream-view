import { Inject, Injectable, isDevMode } from '@angular/core';
import { Socket } from 'socket.io-client';
import { BehaviorSubject, filter, map } from 'rxjs';
import { LocalStreamService } from './local-stream.service';
import { optimizeVideoQuality, ConnectionQuality } from './webrtc.helper';
import { UserService } from './user.service';
import { AudioActivityService } from './audio-activity.service';

export interface Participant {
  socketId: string;
  username: string;
  stream?: MediaStream;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isSpeaking: boolean;
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
  
  // ICE сервера для установления соединения
  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  constructor(
    @Inject('socket') private socket: Socket,
    private userService: UserService,
    private audioActivityService: AudioActivityService,
    private localStreamService: LocalStreamService
  ) {
    this.setupSocketListeners();

    window.addEventListener('beforeunload', () => {
      this.socket.emit('leave-room');
      this.clearPeerConnections();
    });

    this.startOptimization();
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

  private monitorConnection(socketId: string): void {
    const state = this.stateConnections.get(socketId);
    if (!state) return;

    const connection = state.connection;
    
    const checkConnection = () => {
      if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
        this.handleConnectionFailure(socketId);
      }
    };

    connection.addEventListener('connectionstatechange', checkConnection);
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

  private addParticipant(participant: Participant) {
    this.participants.next([...this.participants.value, participant]);
  }

  // Инициализация слушателей сокетов
  private setupSocketListeners(): void {
    // Когда новый пользователь присоединяется
    this.socket.on('user-joined', async ({ socketId, username }) => {
      this.addParticipant({ socketId, username, isCameraEnabled: false, isMicEnabled: false, isSpeaking: false });
    });

    this.socket.on('set-participants', async ({ participants }) => {
      this.updateParticipants(participants.map((p: Participant) => ({
        ...p,
        stream: undefined,
        isCameraEnabled: p.isCameraEnabled ?? false,
        isMicEnabled: p.isMicEnabled ?? false
      })));
    });

     // Добавляем новый слушатель для изменения состояния камеры
     this.socket.on('stream-state-changed', ({ socketId, cameraEnabled, micEnabled }) => {
      const participants = [...this.participants.value];
      const participantIndex = this.findParticipantIndex(socketId);
      
      if (participantIndex !== -1) {
        participants[participantIndex] = {
          ...participants[participantIndex],
          isCameraEnabled: cameraEnabled,
          isMicEnabled: micEnabled,
        };
        
        // Если камера выключена, также отключаем видеотрек
        const videoTrack = participants[participantIndex].stream?.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = cameraEnabled;
        }
        
        this.participants.next(participants);
      }
    });

    // Когда пользователь покидает комнату
    this.socket.on('user-left', ({ socketId }) => {
      this.handleUserLeft(socketId);
    });

    // Когда получаем запрос на offer
    this.socket.on('request-offer', async ({ socketId }) => {
      await this.localStreamService.ensureLocalStream();
      await this.createAndSendOffer(socketId);
    });

    // Обработка входящего offer
    this.socket.on('offer', async ({ offer, from }) => {
      await this.handleOffer(offer, from);
    });

    // Обработка входящего answer
    this.socket.on('answer', ({ answer, from }) => {
      this.handleAnswer(answer, from);
    });

    // Обработка ICE кандидатов
    this.socket.on('ice-candidate', ({ candidate, from }) => {
      this.handleIceCandidate(candidate, from);
    });
  }

  // Создание нового RTCPeerConnection
  private async createPeerConnection(socketId: string, username: string): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection(this.configuration);
    this.monitorConnection(socketId);
    
    // Добавляем локальные треки
    await this.localStreamService.ensureLocalStream();
    const localStream = this.localStreamService.getStream();
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    } else {
      throw new Error('No local stream available after ensuring its presence');
    }

    // Обработка ICE кандидатов
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          target: socketId,
          candidate: event.candidate
        });
      }
    };

    // Обработка состояния ICE подключения
    peerConnection.oniceconnectionstatechange = () => {
      this.debug('ICE connection state for', socketId, ':', peerConnection.iceConnectionState);
    };

    // Обработка состояния подключения
    peerConnection.onconnectionstatechange = () => {
      this.debug('Connection state for', socketId, ':', peerConnection.connectionState);
    };

    // Обработка входящих треков
    peerConnection.ontrack = (event) => {
      this.debug('Received tracks from:', socketId, event.streams);
      this.handleTrackEvent(event, socketId);
    };

    this.stateConnections.set(socketId, { connection: peerConnection, username, isConnected: true, lastActivity: new Date() });
    return peerConnection;
  }

  // Создание и отправка offer
  private async createAndSendOffer(socketId: string): Promise<void> {
    try {
      this.debug('Creating offer for:', socketId);
      const peerConnection = await this.createOrGetPeerConnection(socketId);

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await peerConnection.setLocalDescription(offer);
      
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
    let peerConnection = this.stateConnections.get(socketId)?.connection;
    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(socketId, this.userService.getUsername());
    }
    return peerConnection;
  }

  // Обработка входящего offer
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

  // Обработка входящего answer
  private async handleAnswer(answer: RTCSessionDescriptionInit, from: string): Promise<void> {
    try {
      const peerConnection = this.stateConnections.get(from)?.connection;

      if (!peerConnection) {
        console.error('No peer connection found for:', from);
        return;
      }

       // Проверяем состояние соединения
      if (peerConnection.signalingState === 'stable') {
        this.debug('Connection already stable, ignoring answer');
        return;
      }

      await peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  // Обработка ICE кандидатов
  private async handleIceCandidate(candidate: RTCIceCandidateInit, from: string): Promise<void> {
    try {
      const peerConnection = this.stateConnections.get(from)?.connection;
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
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

  // Обработка входящих медиа треков
  private handleTrackEvent(event: RTCTrackEvent, socketId: string): void {
    if (!event.streams || event.streams.length === 0) {
      console.error('No streams in track event!');
      return;
    }

    const participants = [...this.participants.value];
    const participantIndex = this.findParticipantIndex(socketId);
    
    if (participantIndex !== -1) {
      const stream = event.streams[0];
      participants[participantIndex] = {
        ...participants[participantIndex],
        stream,
        isSpeaking: false,
      };

      this.handleSpeaking(stream, socketId);

      this.participants.next(participants);
    } else {
      console.error('Participant not found for socketId:', socketId);
    }
  }

  private findParticipantIndex(socketId: string): number {
    return this.participants.value.findIndex(p => p.socketId === socketId);
  }

  // Обработка выхода пользователя
  private handleUserLeft(socketId: string): void {
    this.audioActivityService.stopAnalyser(socketId);

    // Закрываем соединение
    const peerConnection = this.stateConnections.get(socketId)?.connection;
    if (peerConnection) {
      peerConnection.close();
      this.stateConnections.delete(socketId);
    }

    // Удаляем участника из списка
    const participants = this.participants.value.filter(p => p.socketId !== socketId);
    this.participants.next(participants);
  }

  // Обновление списка участников
  public updateParticipants(participants: Participant[]): void {
    this.participants.next(participants);
  }

  // Очистка всех соединений при выходе из комнаты
  public clearPeerConnections(): void {
    this.stateConnections.forEach(state => {
      state.connection.close();
    });
    this.stateConnections.clear();
    this.participants.next([]);
  }
}
