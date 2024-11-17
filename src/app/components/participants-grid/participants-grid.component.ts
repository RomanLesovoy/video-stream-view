import { Component, Inject } from '@angular/core';
import { WebRTCService } from '../../services/webrtc.service';
import { Observable } from 'rxjs';

export interface Participant {
  socketId: string;
  username: string;
  stream?: MediaStream;
}

@Component({
  selector: 'app-participants-grid',
  templateUrl: './participants-grid.component.html',
  styleUrls: ['./participants-grid.component.scss']
})
export class ParticipantsGridComponent {
  remoteParticipants$!: Observable<Participant[]>;

  constructor(
    @Inject('username') public username: string,
    private WebRTCService: WebRTCService
  ) {
    this.remoteParticipants$ = this.WebRTCService.participants$;
  }

  trackBySocketId(index: number, participant: Participant) {
    return participant?.socketId;
  }
}
