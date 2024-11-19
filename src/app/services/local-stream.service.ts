import { Inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, debounceTime, Observable } from 'rxjs';
import { RoomService } from './room.service';
import { Socket } from 'socket.io-client';

export interface MediaState {
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isScreenSharing: boolean;
  stream?: MediaStream;
}

@Injectable({
  providedIn: 'root'
})
export class LocalStreamService implements OnDestroy {
  private isLoading = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoading.asObservable();

  private mediaState = new BehaviorSubject<MediaState>({
    isCameraEnabled: true,
    isMicEnabled: true,
    isScreenSharing: false
  });

  constructor(
    @Inject('socket') private socket: Socket,
    private roomService: RoomService
  ) {
    // Отправляем состояние стрима другим участникам
    this.mediaState$.subscribe(state => {
      this.emitStreamState(state);
    });
  }

  get mediaState$(): Observable<MediaState> {
    return this.mediaState.asObservable();
  }

  getStream(): MediaStream | undefined {
    return this.mediaState.value.stream;
  }

  async ensureLocalStream(): Promise<void> {
    try {
      this.setLoading(true);

      if (!this.getStream()) {
        await this.startCameraStream();
        if (!this.getStream()) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Применяем сохраненное состояние после получения стрима
        // const currentState = this.mediaState.value;
        // if (!currentState.isCameraEnabled) {
        //   await this.stopVideoTracks();
        // }
        // if (!currentState.isMicEnabled) {
        //   const audioTrack = currentState.stream?.getAudioTracks()[0];
        //   if (audioTrack) {
        //     audioTrack.enabled = false;
        //   }
        // }
      }
    } catch (error) {
      console.error('[LocalStream] Error:', error);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  // Инициализация начального медиа стрима
  async startCameraStream(): Promise<void> {
    try {
      const stream = await this.getUserMedia();
      this.updateMediaState({ stream });
    } catch (error) {
      console.error('[Media] Error accessing devices:', error);
      throw error;
    }
  }

  // Переключение микрофона
  toggleMicrophone(): void {
    const currentState = this.mediaState.value;
    const audioTrack = currentState.stream?.getAudioTracks()[0];

    if (audioTrack) {
      const newMicState = !currentState.isMicEnabled;
      audioTrack.enabled = newMicState;
    
      // Обновляем стрим для триггера изменений
      this.updateMediaState({ 
        isMicEnabled: newMicState,
        stream: new MediaStream([...currentState.stream!.getTracks()])
      });
    }
  }

  // Переключение камеры
  async toggleCamera(): Promise<void> {
    const currentState = this.mediaState.value;
    
    if (currentState.isCameraEnabled) {
      await this.stopVideoTracks();

      this.updateMediaState({ isCameraEnabled: false });
    } else {
      const videoTrack = await this.getVideoTrack();
      currentState.stream?.addTrack(videoTrack);
      this.updateMediaState({ isCameraEnabled: true });
    }
  }

  // Переключение screen sharing
  async toggleScreenSharing(): Promise<void> {
    const currentState = this.mediaState.value;
    
    try {
      if (currentState.isScreenSharing) {
        this._launchCamera();
      } else {
        this._launchScreen();
      }
    } catch (error) {
      console.error('[ScreenShare] Error:', error);
      throw error;
    }
  }

  private async _launchCamera() {
    const currentState = this.mediaState.value;
    await this.stopVideoTracks();
    const videoTrack = await this.getVideoTrack();
    currentState.stream?.addTrack(videoTrack);

    this.updateMediaState({
      stream: currentState.stream,
      isScreenSharing: false,
      isCameraEnabled: true
    });
  }

  private async _launchScreen() {
    const currentState = this.mediaState.value;
    await this.stopVideoTracks();
    const screenTrack = await this.getScreenTrack();
    currentState.stream?.addTrack(screenTrack);
    
    this.updateMediaState({
      stream: currentState.stream,
      isScreenSharing: true,
      isCameraEnabled: false
    });
  }

  ngOnDestroy(): void {
    this.stopStream();
  }

  // Private helper methods
  private async getUserMedia(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
  }

  private async getVideoTrack(): Promise<MediaStreamTrack> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    return stream.getVideoTracks()[0];
  }

  private async getScreenTrack(): Promise<MediaStreamTrack> {
    const stream = await navigator.mediaDevices.getDisplayMedia({ 
      video: true,
      audio: false 
    });
    
    // Обработка системного события остановки screen sharing
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      this.toggleScreenSharing();
    });
    
    return stream.getVideoTracks()[0];
  }

  private async stopVideoTracks(): Promise<void> {
    const currentState = this.mediaState.value;
    currentState.stream?.getVideoTracks().forEach(track => {
      track.stop();
      currentState.stream?.removeTrack(track);
    });
  }

  public stopStream(): void {
    const currentState = this.mediaState.value;
    currentState.stream?.getTracks().forEach(track => track.stop());

    this.updateMediaState({
      stream: undefined,
      // isCameraEnabled: true,
      // isMicEnabled: true,
      // isScreenSharing: false
    });
  }

  private setLoading(loading: boolean): void {
    this.isLoading.next(loading);
  }

  private updateMediaState(update: Partial<MediaState>): void {
    this.mediaState.next({
      ...this.mediaState.value,
      ...update
    });
  }

  private emitStreamState(state: MediaState): void {
    this.socket.emit('stream-state-changed', {
      isCameraEnabled: state.isCameraEnabled,
      isMicEnabled: state.isMicEnabled,
      isScreenSharing: state.isScreenSharing,
      roomId: this.roomService.currentRoomId
    });
  }
}
