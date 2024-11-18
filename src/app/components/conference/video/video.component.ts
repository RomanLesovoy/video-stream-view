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
  @Input({ required: true }) screenStream!: MediaStream | null | undefined;
  @Input({ required: true }) isScreenSharing = false;
  @Input({ required: true }) username!: string;
  @Input() muted = false;
  @Input() localStream = false;
  @Input() quality: 'poor' | 'medium' | 'good' = 'good';
  @Input() isSpeaking: boolean | undefined = false;

  public randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

  get activeStream(): MediaStream | undefined | null {
    return this.isScreenSharing ? this.screenStream : this.stream;
  }

  get isVideoEnabled(): boolean {
    if (!this.activeStream?.active) return false;
    
    const videoTrack = this.getVideoTrack();
    if (!videoTrack) return false;

    // console.log('[VIDEO] videoTrack:', this.isScreenSharing);
    return videoTrack?.enabled && videoTrack?.readyState === 'live';
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['stream'] || changes['screenStream'] || changes['isScreenSharing']) && this.videoElement) {
      this.updateVideoStream();
    }
  }

  getVideoTrack() {
    return this.activeStream?.getVideoTracks()[0];
  }

  public getIsMuted() {
    return this.muted && this.getVideoTrack()?.muted;
  }

  private updateVideoStream() {
    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      const currentStream = this.activeStream;
      
      if (currentStream?.active) {
        if (video.srcObject !== currentStream) {
          video.srcObject = currentStream;
          console.log('[VIDEO] Stream updated:', this.isScreenSharing ? 'screen' : 'camera');
        }
      } else {
        console.log('[VIDEO] No active stream for:', this.username);
        video.srcObject = null;
      }
    }
  }
}
