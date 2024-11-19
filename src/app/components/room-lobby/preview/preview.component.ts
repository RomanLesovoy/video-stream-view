import { Component, OnInit, OnDestroy } from '@angular/core';
import { map, Observable } from 'rxjs';
import { LocalStreamService } from '../../../services/local-stream.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-preview',
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.scss']
})
export class PreviewComponent implements OnInit, OnDestroy {
  streamIsLoading: Observable<boolean>;
  username: string;
  stream$!: Observable<MediaStream | undefined>;

  constructor(
    private localStreamService: LocalStreamService,
    private userService: UserService,
  ) {
    this.stream$ = this.localStreamService.mediaState$.pipe(
      map(state => state.isScreenSharing
        ? state.stream
        : state.isCameraEnabled
          ? state.stream
          : undefined)
    );
    
    this.streamIsLoading = this.localStreamService.isLoading$;
    this.username = this.userService.getUsername();
  }

  ngOnInit() {
    this.localStreamService.startCameraStream();
  }

  ngOnDestroy() {
    this.localStreamService.stopStream();
  }
}
