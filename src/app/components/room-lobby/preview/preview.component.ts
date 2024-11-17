import { Component, OnInit, OnDestroy } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { LocalStreamService } from '../../../services/local-stream.service';

@Component({
  selector: 'app-preview',
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.scss']
})
export class PreviewComponent implements OnInit, OnDestroy {
  stream$!: Observable<MediaStream | undefined | any>; // todo any

  constructor(private localStreamService: LocalStreamService) {
    this.stream$ = this.localStreamService.mediaState$.pipe(
      map(state => state.stream),
    );
  }

  ngOnInit() {
    this.localStreamService.initializeStream();
  }

  ngOnDestroy() {
    this.localStreamService.stopStream();
  }
}
