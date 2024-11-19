import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RoomService } from '../../services/room.service';
import { LocalStreamService } from '../../services/local-stream.service';

@Component({
  selector: 'app-room-lobby',
  templateUrl: './room-lobby.component.html',
  styleUrls: ['./room-lobby.component.scss']
})
export class RoomLobbyComponent {
  constructor(
    private roomService: RoomService,
    private router: Router,
    private localStreamService: LocalStreamService
  ) {}

  async createRoom() {
    const roomId = await this.roomService.createRoom('New Room');
    if (roomId) {
      this.router.navigate(['/room', roomId]);
    }
  }

  // todo maybe remove
  async joinRoom(roomId: string) {
    await this.localStreamService.ensureLocalStream();
    const success = await this.roomService.joinRoom(roomId);
    if (success) {
      this.router.navigate(['/room', roomId]);
    }
  }
}
