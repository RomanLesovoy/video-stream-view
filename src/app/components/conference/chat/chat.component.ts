import { Component } from '@angular/core';
import { RoomService } from '../../../services/room.service';
import { ChatState, ChatService } from '../../../services/chat.service';
import { Observable, of, map } from 'rxjs';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent {
  public newMessage = '';
  public username: string;
  public chatState$: Observable<ChatState | null> = of(null);
  public chatEnabled$: Observable<boolean> = of(false);

  constructor(
    private chatService: ChatService,
    private roomService: RoomService,
    private userService: UserService,
  ) {
    this.chatState$ = this.chatService.chatState$ ?? of(null);
    this.chatEnabled$ = this.roomService.currentRoom$.pipe(
      map((room) => room?.chatEnabled ?? false)
    );
    this.username = this.userService.getUsername();
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.roomService.currentRoomId) return;
    
    this.chatService.sendMessage(
      this.newMessage,
      this.roomService.currentRoomId
    );
    this.newMessage = '';
  }

  toggleChat(): void {
    this.chatService.toggleChat();
  }
}
