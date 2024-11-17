import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-room-join',
  templateUrl: './room-join.component.html',
  styleUrls: ['./room-join.component.scss']
})
export class RoomJoinComponent {
  roomId = '';
  
  @Output() createRoom = new EventEmitter<void>();
  @Output() joinRoom = new EventEmitter<string>();

  onCreateRoom(): void {
    this.createRoom.emit();
  }

  onJoinRoom(): void {
    if (this.roomId.trim()) {
      this.joinRoom.emit(this.roomId);
    }
  }
}
