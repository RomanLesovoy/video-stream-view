import { Inject, Injectable } from '@angular/core';
import { Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';
import { LocalStreamService } from './local-stream.service';
import { Participant } from '../components/participants-grid/participants-grid.component';

@Injectable({
  providedIn: 'root'
})
export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private participants = new BehaviorSubject<Participant[]>([]);
  public participants$ = this.participants.asObservable();
  
  // ICE сервера для установления соединения
  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  constructor(
    @Inject('socket') private socket: Socket,
    @Inject('username') private username: string,
    private localStreamService: LocalStreamService
  ) {
    this.setupSocketListeners();

    window.addEventListener('beforeunload', () => {
      this.socket.emit('leave-room');
      this.clearPeerConnections();
    });
  }

  private addParticipant(participant: Participant) {
    this.participants.next([...this.participants.value, participant]);
  }

  // Инициализация слушателей сокетов
  private setupSocketListeners(): void {
    // Когда новый пользователь присоединяется
    this.socket.on('user-joined', async ({ socketId, username }) => {
      console.log('New user joined:', username, socketId);
      this.addParticipant({ socketId, username });
    });

    // Когда пользователь покидает комнату
    this.socket.on('user-left', ({ socketId }) => {
      this.handleUserLeft(socketId);
    });

    // Когда получаем запрос на offer
    this.socket.on('request-offer', async ({ socketId }) => {
      console.log('Received request for offer from:', socketId);
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
  private async createPeerConnection(socketId: string): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection(this.configuration);
    
    // Добавляем локальные треки
    const localStream = this.localStreamService.getStream();
    localStream?.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Обработка ICE кандидатов
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          target: socketId,
          candidate: event.candidate
        });
      }
    };

    // Обработка входящих треков
    peerConnection.ontrack = (event) => {
      this.handleTrackEvent(event, socketId);
    };

    this.peerConnections.set(socketId, peerConnection);
    return peerConnection;
  }

  // Создание и отправка offer
  private async createAndSendOffer(socketId: string): Promise<void> {
    try {
      const peerConnection = await this.createOrGetPeerConnection(socketId);

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      this.socket.emit('offer', {
        target: socketId,
        offer
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  private async createOrGetPeerConnection(socketId: string): Promise<RTCPeerConnection> {
    let peerConnection = this.peerConnections.get(socketId);
    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(socketId);
    }
    return peerConnection;
  }

  // Обработка входящего offer
  private async handleOffer(offer: RTCSessionDescriptionInit, from: string): Promise<void> {
    try {
      const peerConnection = await this.createOrGetPeerConnection(from);
      await peerConnection.setRemoteDescription(offer);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
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
      const peerConnection = this.peerConnections.get(from);

      if (!peerConnection) {
        console.error('No peer connection found for:', from);
        return;
      }

       // Проверяем состояние соединения
      if (peerConnection.signalingState === 'stable') {
        console.log('Connection already stable, ignoring answer');
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
      const peerConnection = this.peerConnections.get(from);
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  // Обработка входящих медиа треков
  private handleTrackEvent(event: RTCTrackEvent, socketId: string): void {
    const participants = this.participants.value;
    const participantIndex = participants.findIndex(p => p.socketId === socketId);
    
    if (participantIndex !== -1) {
      participants[participantIndex].stream = event.streams[0];
      this.participants.next([...participants]);
    }
  }

  // Обработка выхода пользователя
  private handleUserLeft(socketId: string): void {
    // Закрываем соединение
    const peerConnection = this.peerConnections.get(socketId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(socketId);
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
    this.peerConnections.forEach(connection => connection.close());
    this.peerConnections.clear();
    this.participants.next([]);
  }
}
