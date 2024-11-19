import { Component, Input, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.scss']
})
export class VideoComponent implements OnChanges {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @Input({ required: true }) stream!: MediaStream | null | undefined;
  @Input() isLoading = false;
  @Input({ required: true }) username!: string;
  @Input() muted = false;
  @Input() localStream = false;
  @Input() quality: 'poor' | 'medium' | 'good' = 'good';
  @Input() isSpeaking: boolean | undefined = false;

  public randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

  get isVideoEnabled(): boolean {
    if (!this.stream?.active) return false;
    
    const videoTrack = this.getVideoTrack();
    if (!videoTrack) return false;

    return videoTrack?.enabled && videoTrack?.readyState === 'live';
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['stream']) && this.videoElement) {
      console.log(this.stream, 'this.stream')
      this.updateVideoStream();
    }
  }

  getVideoTrack() {
    return this.stream?.getVideoTracks()[0];
  }

  public getIsMuted() {
    return this.muted && this.getVideoTrack()?.muted;
  }

  private updateVideoStream() {
    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      
      if (this.isVideoEnabled) {
        video.srcObject = this.stream ?? null;
      } else {
        console.log('[VIDEO] No active stream for:', this.username);
        video.srcObject = null;
      }
    }
  }
}
