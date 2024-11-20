import { Injectable } from '@angular/core';

export interface PeerState {
  connection: RTCPeerConnection;
  username: string;
  isConnected: boolean;
  lastActivity: Date;
}

@Injectable({
  providedIn: 'root'
})
export class PeerConnectionService {
  private stateConnections: Map<string, PeerState> = new Map();
  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  constructor() {}

  async createPeerConnection(
    socketId: string, 
    username: string, 
    localStream: MediaStream,
    onTrack: (event: RTCTrackEvent) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection(this.configuration);

    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    peerConnection.ontrack = onTrack;
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    this.stateConnections.set(socketId, {
      connection: peerConnection,
      username,
      isConnected: true,
      lastActivity: new Date()
    });

    return peerConnection;
  }

  async createOffer(peerConnection: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await peerConnection.setLocalDescription(offer);
    return offer;
  }

  async handleAnswer(socketId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.stateConnections.get(socketId)?.connection;
    if (!peerConnection) {
      throw new Error('No peer connection found');
    }

    if (peerConnection.signalingState === 'stable') {
      return;
    }

    await peerConnection.setRemoteDescription(answer);
  }

  async handleIceCandidate(socketId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.stateConnections.get(socketId)?.connection;
    if (peerConnection) {
      await peerConnection.addIceCandidate(candidate);
    }
  }

  getConnection(socketId: string): RTCPeerConnection | undefined {
    return this.stateConnections.get(socketId)?.connection;
  }

  closeConnection(socketId: string): void {
    const peerConnection = this.stateConnections.get(socketId)?.connection;
    if (peerConnection) {
      peerConnection.close();
      this.stateConnections.delete(socketId);
    }
  }

  clearAllConnections(): void {
    this.stateConnections.forEach(state => {
      state.connection.close();
    });
    this.stateConnections.clear();
  }

  monitorConnection(
    socketId: string, 
    onFailure: () => void
  ): void {
    const state = this.stateConnections.get(socketId);
    if (!state) return;

    const connection = state.connection;
    
    const checkConnection = () => {
      if (connection.connectionState === 'failed' || 
          connection.connectionState === 'disconnected') {
        onFailure();
      }
    };

    connection.addEventListener('connectionstatechange', checkConnection);
  }

  getAllConnections(): Map<string, RTCPeerConnection> {
    const connections = new Map<string, RTCPeerConnection>();
    this.stateConnections.forEach((state, socketId) => {
      connections.set(socketId, state.connection);
    });
    return connections;
  }
}
