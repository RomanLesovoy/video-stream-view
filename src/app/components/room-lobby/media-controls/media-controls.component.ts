import { Component } from '@angular/core';
import { LocalStreamService, MediaState } from '../../../services/local-stream.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-media-controls',
  templateUrl: './media-controls.component.html',
  styleUrls: ['./media-controls.component.scss']
})
export class MediaControlsComponent {
  mediaState$: Observable<MediaState>;

  constructor(
    private localStreamService: LocalStreamService,
  ) {
    this.mediaState$ = this.localStreamService.mediaState$;
  }

  toggleCamera(): void {
    this.localStreamService.toggleCamera();
  }

  toggleMicrophone(): void {
    this.localStreamService.toggleMicrophone();
  }

  async toggleScreenSharing(): Promise<void> {
    this.localStreamService.toggleScreenSharing();
  }
}
