import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface MediaState {
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  stream?: MediaStream;
}

@Injectable({
  providedIn: 'root'
})
export class LocalStreamService {
  private mediaState = new BehaviorSubject<MediaState>({
    isCameraEnabled: true,
    isMicEnabled: true
  });

  get mediaState$(): Observable<MediaState> {
    return this.mediaState.asObservable();
  }

  async initializeStream(): Promise<void> {
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

  stopStream(): void {
    const currentState = this.mediaState.value;
    currentState.stream?.getTracks().forEach(track => track.stop());
    
    this.mediaState.next({
      isCameraEnabled: true,
      isMicEnabled: true
    });
  }

  getStream(): MediaStream | undefined {
    return this.mediaState.value.stream;
  }
}