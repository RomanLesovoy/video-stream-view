
import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { LocalStreamService } from './local-stream.service';

interface Participant {
  socketId: string;
  username: string;
  stream?: MediaStream;
}

@Injectable({
  providedIn: 'root'
})
export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private participantsSubject = new BehaviorSubject<Participant[]>([]);
  public participants$ = this.participantsSubject.asObservable();

  constructor(
    private localStreamService: LocalStreamService,
    @Inject('username') private username: string,
    @Inject('socket') private socket: Socket,
  ) {
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on('user-joined', async ({ socketId, username }) => {
      console.log('[JOIN] New user joined:', { socketId, username });
      // Create new peer connection
      const peerConnection = await this.createPeerConnection(socketId, username);
      this.peerConnections.set(socketId, peerConnection);
      
      // Add participant to the list if not exists
      const participants = this.participantsSubject.value;
      if (!participants.find(p => p.socketId === socketId)) {
        this.participantsSubject.next([...participants, { socketId, username, stream: undefined }]);
      }
    });

    this.socket.on('request-offer', async ({ socketId }) => {
      console.log('[REQUEST OFFER] Received request from:', socketId);
      try {
        const peerConnection = await this.getPeerOrCreate(socketId);
        
        // Create and set local description
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peerConnection.setLocalDescription(offer);
        
        // Send offer to remote peer
        this.socket.emit('offer', { target: socketId, offer });
      } catch (error) {
        console.error('[REQUEST OFFER] Error:', error);
      }
    });

    this.socket.on('offer', async ({ offer, from }) => {
      console.log('[OFFER] Received from:', from);
      try {
        const peerConnection = await this.getPeerOrCreate(from);
        
        // Set remote description first
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Create and set local description
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Send answer
        this.socket.emit('answer', { target: from, answer });
      } catch (error) {
        console.error('[OFFER] Error:', error);
      }
    });

    this.socket.on('answer', async ({ answer, from }) => {
      console.log('[ANSWER] Received from:', from);
      try {
        const peerConnection = this.getPeerConnection(from);
        if (peerConnection && peerConnection.signalingState !== 'stable') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (error) {
        console.error('[ANSWER] Error:', error);
      }
    });

    this.socket.on('ice-candidate', async ({ candidate, from }) => {
      console.log('[ICE] Received from:', from);
      try {
        const peerConnection = this.getPeerConnection(from);
        if (peerConnection && peerConnection.remoteDescription) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error('[ICE] Error:', error);
      }
    });

    this.socket.on('user-left', ({ socketId }) => {
      console.log('[LEFT] User disconnected:', socketId);
      this.removePeerConnection(socketId);
    });
}

  private async createPeerConnection(socketId: string, username: string): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', { target: socketId, candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      this.updateParticipantStream(socketId, stream);
    };

    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    return peerConnection;
  }

  private updateParticipantStream(socketId: string, stream: MediaStream) {
    const participants = this.participantsSubject.value;
    const participant = participants.find(p => p.socketId === socketId);
    if (participant) {
      participant.stream = stream;
      this.participantsSubject.next([...participants]);
    }
  }

  private getPeerConnection(socketId: string): RTCPeerConnection {
    // @ts-ignore
    return this.peerConnections.get(socketId);
  }

  private async getPeerOrCreate(socketId: string): Promise<RTCPeerConnection> {
    let peerConnection = this.peerConnections.get(socketId);
    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(socketId, '');
      this.peerConnections.set(socketId, peerConnection);
    }
    return peerConnection;
  }

  private removePeerConnection(socketId: string) {
    const peerConnection = this.peerConnections.get(socketId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(socketId);
      const participants = this.participantsSubject.value.filter(p => p.socketId !== socketId);
      this.participantsSubject.next(participants);
    }
  }

  // Update participants list and ensure streams are set
  updateParticipants(participants: Participant[]) {
    participants.forEach(participant => {
      if (!participant.stream) {
        const peerConnection = this.peerConnections.get(participant.socketId);
        if (peerConnection) {
          // Try to get the stream from the peer connection
          const senders = peerConnection.getSenders();
          const track = senders.find(sender => sender.track?.kind === 'video')?.track;
          if (track) {
            const stream = new MediaStream([track]);
            participant.stream = stream;
          }
        }
      }
    });
    this.participantsSubject.next(participants);
  }

  public clearPeerConnections() {
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.updateParticipants([]);
  }
}