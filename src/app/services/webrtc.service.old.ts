import { Injectable, Inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';
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

    // todo check
    window.addEventListener('beforeunload', () => {
      this.socket.emit('leave-room');
      this.clearPeerConnections();
    });
  }

  public async initializePeerConnection(socketId: string, username: string): Promise<RTCPeerConnection> {
    // Remove old peer connection
    this.removePeerConnection(socketId);
    
    // Create new peer connection
    return this.createPeerConnection(socketId, username);
  }

  private setupSocketListeners() {
    console.log('[SOCKET] Setting up listeners, my username:', this.username);

    this.socket.on('user-joined', async ({ socketId, username }) => {
      console.log('[JOIN] New user joined:', { socketId, username });
      console.log('[JOIN] Current participants:', this.participantsSubject.value);

      // Create new peer connection
      const peerConnection = await this.initializePeerConnection(socketId, username);
      this.peerConnections.set(socketId, peerConnection);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('[OFFER] Sending to:', socketId);
      // Create and send offer to new participant
      const offer = await this.createOffer(socketId);
      this.socket.emit('offer', {
        target: socketId,
        offer: offer
      });
    });

    this.socket.on('user-left', ({ socketId }) => {
      this.removePeerConnection(socketId);
    });

    this.socket.on('offer', async ({ offer, from, username }) => {
      console.log('[OFFER] Received from:', { from, username });
      // console.log('[OFFER] Current peer connections:', Array.from(this.peerConnections.keys()));
      const peerConnection = this.getPeerConnection(from);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // send answer
      this.socket.emit('answer', {
        target: from,
        answer: answer
      });
    });

    this.socket.on('answer', async ({ answer, from }) => {
      console.log('[ANSWER] Received from:', { from });
      const peerConnection = this.getPeerConnection(from);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    this.socket.on('ice-candidate', async ({ candidate, from }) => {
      console.log('[ICE] Received from:', { from });
      const peerConnection = this.getPeerConnection(from);
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });
  }

  private getPeerConnection(socketId: string): RTCPeerConnection {
    const peerConnection = this.peerConnections.get(socketId);
    if (!peerConnection) {
      throw new Error('Peer connection not found');
    }
    return peerConnection;
  }

  private async getPeerOrCreate(socketId: string, username: string): Promise<RTCPeerConnection> {
    return this.peerConnections.get(socketId) || await this.createPeerConnection(socketId, username);
  }

  private async createOffer(socketId: string): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.getPeerConnection(socketId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    return offer;
  }

  private async createPeerConnection(socketId: string, username: string): Promise<RTCPeerConnection> {
    // clear old peer connection
    this.removePeerConnection(socketId);

    console.log('[PC] Creating new peer connection:', { socketId, username });

    const configuration: RTCConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    this.peerConnections.set(socketId, peerConnection);

    // Add local tracks to peer connection
    const localStream = this.localStreamService.getStream();
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
    console.log('[PC] Local stream status:', { 
      active: localStream?.active,
      tracks: localStream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled }))
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          target: socketId,
          candidate: event.candidate
        });
        console.log('[ICE] Sending candidate to:', socketId);
      }
    };

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      console.log('[TRACK] Received from:', username);
      console.log('[TRACK] Stream details:', {
        active: event.streams[0]?.active,
        tracks: event.streams[0]?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled }))
      });
      const stream = event.streams[0];
      
      // Update participants list
      const participants = this.participantsSubject.value;
      const participantIndex = participants.findIndex(p => p.socketId === socketId);
      
      if (participantIndex === -1) {
        participants.push({
          socketId,
          username: username || this.username || 'Unknown',
          stream
        });
      } else {
        participants[participantIndex].stream = stream;
      }
      console.log('participants', participants);
      
      this.participantsSubject.next([...participants]);
    };

    return peerConnection;
  }

  private removePeerConnection(socketId: string) {
    console.log('[REMOVE] Removing peer connection:', socketId);
    // console.log('[REMOVE] Current peer connections:', Array.from(this.peerConnections.keys()));
    const peerConnection = this.peerConnections.get(socketId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(socketId);
      
      // Remove participant from list
      const participants = this.participantsSubject.value
        .filter(p => p.socketId !== socketId);
      this.participantsSubject.next(participants);
    }
  }

  public async updateParticipants(participants: Participant[]) {
    const currentParticipants = this.participantsSubject.value;
    const updatedParticipants = participants.map(p => ({
      ...p,
      stream: currentParticipants.find(cp => cp.socketId === p.socketId)?.stream
    }));
    this.participantsSubject.next(updatedParticipants);

    // Create new peer connections for participants
    for (const participant of participants) {
      if (participant.username !== this.username) {
        const existingConnection = this.peerConnections.get(participant.socketId);
        
        if (!existingConnection) {
          console.log('Creating new connection for:', participant.username);
          const peerConnection = await this.createPeerConnection(participant.socketId, participant.username);
          
          console.log(peerConnection.signalingState, 'peerConnection.signalingState')
          if (peerConnection.signalingState !== 'stable') {
            // Create and send offer for new connection
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.socket.emit('offer', {
              target: participant.socketId,
              offer: offer
            });
          }
        } else {
          console.log('Connection already exists for:', participant.username);
        }
      }
    }
  }

  public clearPeerConnections() {
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.updateParticipants([]);
  }
}