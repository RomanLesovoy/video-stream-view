import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { WebRTCService } from '../../services/webrtc.service';
import { LocalStreamService } from '../../services/local-stream.service';
import { Observable } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { RoomService } from '../../services/room.service';
import { Socket } from 'socket.io-client';

// todo move it to separate file
interface Participant {
  socketId: string;
  username: string;
}

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
    private WebRTCService: WebRTCService,
    private localStreamService: LocalStreamService,
    private roomService: RoomService,
    @Inject('username') public username: string,
    @Inject('socket') public socket: Socket
  ) {
    this.participants$ = this.WebRTCService.participants$;
  }

  async ngOnInit() {
    const roomId = this.route.snapshot.paramMap.get('id');
    await this.localStreamService.initializeStream();
    if (roomId) {
      const success = await this.roomService.joinRoom(roomId);
      if (success) {
        this.isInRoom = true;
      }
    }
  }

  ngOnDestroy() {
    this.roomService.leaveRoom();
    this.localStreamService.stopStream();
  }
}
