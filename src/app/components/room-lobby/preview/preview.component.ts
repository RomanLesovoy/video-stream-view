import { Component, OnInit, OnDestroy } from '@angular/core';
import { map, Observable, of } from 'rxjs';
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
  screenStream$!: Observable<MediaStream | undefined>;
  isScreenSharing$!: Observable<boolean>;

  constructor(
    private localStreamService: LocalStreamService,
    private userService: UserService,
  ) {
    const mediaState$ = this.localStreamService.mediaState$;
    
    this.stream$ = mediaState$.pipe(map(state => state.stream));
    this.screenStream$ = of(undefined); // mediaState$.pipe(map(state => state.screenStream));
    this.isScreenSharing$ = of(false); // mediaState$.pipe(map(state => state.isScreenSharing));
    
    this.streamIsLoading = this.localStreamService.isLoading$;
    this.username = this.userService.getUsername();
  }

  ngOnInit() {
    this.localStreamService.initializeStream();
  }

  ngOnDestroy() {
    this.localStreamService.stopStream();
  }
}
