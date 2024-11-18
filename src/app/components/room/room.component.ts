import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { WebRTCService, Participant } from '../../services/webrtc.service';
import { LocalStreamService } from '../../services/local-stream.service';
import { Observable } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { RoomService } from '../../services/room.service';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss']
})
export class RoomComponent implements OnInit, OnDestroy {
  isInRoom = false;
  participants$!: Observable<Participant[]>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private WebRTCService: WebRTCService,
    private localStreamService: LocalStreamService,
    private roomService: RoomService,
  ) {
    this.participants$ = this.WebRTCService.participants$;
  }

  async ngOnInit() {
    const roomId = this.route.snapshot.paramMap.get('id');
    if (roomId) {
      this.goToRoom(roomId);
    }
  }

  private async goToRoom(roomId: string) {
    try {
      const success = await this.roomService.joinRoom(roomId);
      if (success) {
        await this.localStreamService.initializeStream();
        this.isInRoom = true;
      } else {
        this.router.navigate(['/']);
      }
    } catch (e) {
      console.error(e);
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy() {
    this.roomService.leaveRoom();
    this.localStreamService.stopStream();
  }
}
