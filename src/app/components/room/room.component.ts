import { Component, OnInit } from '@angular/core';
import { WebRTCService, Participant } from '../../services/webrtc.service';
import { Observable } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { RoomService } from '../../services/room.service';
import { LocalStreamService } from '../../services/local-stream.service';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss']
})
export class RoomComponent implements OnInit {
  isInRoom = false;
  participants$!: Observable<Participant[]>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private WebRTCService: WebRTCService,
    private roomService: RoomService,
    private localStreamService: LocalStreamService
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
      await this.localStreamService.ensureLocalStream();
      const success = await this.roomService.joinRoom(roomId);
      if (success) {
        this.isInRoom = true;
      } else {
        this.router.navigate(['/']);
      }
    } catch (e) {
      console.error(e);
      this.router.navigate(['/']);
    }
  }
}
