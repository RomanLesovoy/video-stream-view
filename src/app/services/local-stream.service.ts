import { Inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { RoomService } from './room.service';
import { Socket } from 'socket.io-client';

export interface MediaState {
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  stream?: MediaStream;
}

@Injectable({
  providedIn: 'root'
})
export class LocalStreamService implements OnDestroy {
  private isLoading = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoading.asObservable();

  public mediaState = new BehaviorSubject<MediaState>({
    isCameraEnabled: true,
    isMicEnabled: true,
  });

  constructor(
    @Inject('socket') private socket: Socket,
    private roomService: RoomService
  ) {
    this.mediaState$.subscribe(state => {
      this.socket.emit('stream-state-changed', {
        cameraEnabled: state.isCameraEnabled,
        micEnabled: state.isMicEnabled,
        roomId: this.roomService.currentRoomId
      });
    });
  }

  get mediaState$(): Observable<MediaState> {
    return this.mediaState.asObservable();
  }

  async initializeStream(): Promise<void> {
    this.isLoading.next(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      this.mediaState.next({
        ...this.mediaState.value,
        stream
      });
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    } finally {
      this.isLoading.next(false);
    }
  }

  toggleCamera(): void {
    const currentState = this.mediaState.value;
    const videoTrack = currentState.stream?.getVideoTracks()[0];

    if (videoTrack) {
      const newCameraState = !currentState.isCameraEnabled;
      videoTrack.enabled = newCameraState;

      this.mediaState.next({
        ...currentState,
        isCameraEnabled: newCameraState
      });
    }
  }

  toggleMicrophone(): void {
    const currentState = this.mediaState.value;
    const audioTrack = currentState.stream?.getAudioTracks()[0];

    if (audioTrack) {
      const newMicState = !currentState.isMicEnabled;
      audioTrack.enabled = newMicState;

      this.mediaState.next({
        ...currentState,
        isMicEnabled: newMicState
      });
    }
  }

  public async ensureLocalStream(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 5;
    this.isLoading.next(true);
    
    while (!this.getStream() && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    this.isLoading.next(false);
    if (!this.getStream()) {
      console.error('Failed to get local stream after waiting');
      throw new Error('No local stream available');
    }
  }

  stopStream(): void {
    const currentState = this.mediaState.value;
    currentState.stream?.getTracks().forEach(track => track.stop());
    
    this.mediaState.next({
      isCameraEnabled: true,
      isMicEnabled: true,
    });
  }

  getStream(): MediaStream | undefined {
    return this.mediaState.value.stream;
  }

  ngOnDestroy(): void {
    this.stopStream();
  }
}
