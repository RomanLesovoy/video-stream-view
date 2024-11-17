import { Component, Input, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.scss']
})
export class VideoComponent implements OnChanges {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @Input() stream!: MediaStream | undefined;
  @Input() username?: string;
  @Input() muted = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['stream'] && this.videoElement) {
      // console.log('Stream changed for user:', this.username, this.stream?.active);
      this.updateVideoStream()
    }
  }

  private updateVideoStream() {
    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      
      if (this.stream?.active) {
        video.srcObject = this.stream;
      } else {
        console.log('[VIDEO] No active stream for:', this.username);
        video.srcObject = null;
      }
    }
  }
}
