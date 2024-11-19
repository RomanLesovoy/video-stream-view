import { Component } from '@angular/core';
import { Participant, WebRTCService } from '../../services/webrtc.service';
import { map, Observable } from 'rxjs';
import { ConnectionQuality } from '../../services/webrtc.helper';
import { UserService } from '../../services/user.service';
import { RoomService } from '../../services/room.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-conference',
  templateUrl: './conference.component.html',
  styleUrls: ['./conference.component.scss']
})
export class ConferenceComponent {
  username!: string;
  remoteParticipants$!: Observable<Participant[]>;
  connectionQuality$!: (participant: Participant) => Observable<ConnectionQuality | undefined>;
  maxRowSize = 3;

  constructor(
    private userService: UserService,
    private WebRTCService: WebRTCService,
    private roomService: RoomService,
    private router: Router
  ) {
    this.username = this.userService.getUsername();
    this.remoteParticipants$ = this.WebRTCService.participants$.pipe(
      map(participants => participants.filter(p => p.username !== this.username))
    );
    this.connectionQuality$ = (participant: Participant) => this.WebRTCService.connectionQuality$.pipe(
      map(quality => quality.find(q => q.socketId === participant.socketId))
    );
  }

  leaveRoom() {
    this.roomService.leaveRoom();
    this.router.navigate(['/']);
  }

  trackBySocketId(index: number, participant: Participant) {
    return participant?.socketId;
  }
}
