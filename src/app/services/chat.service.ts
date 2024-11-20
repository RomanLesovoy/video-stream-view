import { Injectable, Inject, OnDestroy } from '@angular/core';
import { Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';
import { RoomService } from './room.service';
import { UserService } from './user.service';

export interface ChatMessage {
  id: string;
  text: string;
  username: string;
  timestamp: Date;
  roomId: string;
}

export interface ChatState {
  messages: ChatMessage[];
  unreadCount: number;
  isOpen: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService implements OnDestroy {
  private chatState = new BehaviorSubject<ChatState>({
    messages: [],
    unreadCount: 0,
    isOpen: false
  });

  public chatState$ = this.chatState.asObservable();

  constructor(
    private roomService: RoomService,
    @Inject('socket') private socket: Socket,
    private userService: UserService,
  ) {
    this.roomService.currentRoom$.subscribe((room) => {
      if (room?.chatEnabled) {
        this.setupSocketListeners();
      } else {
        this.removeSocketListeners();
      }
    });
  }

  ngOnDestroy(): void {
    this.removeSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('chat-message', (message: ChatMessage) => {
      const currentState = this.chatState.value;
      this.chatState.next({
        ...currentState,
        messages: [...currentState.messages, message],
        unreadCount: currentState.isOpen ? 0 : currentState.unreadCount + 1
      });
    });
  }

  private removeSocketListeners(): void {
    this.socket.off('chat-message');
  }

  public sendMessage(text: string, roomId: string): void {
    const message: Partial<ChatMessage> = {
      text,
      username: this.userService.getUsername(),
      timestamp: new Date(),
      roomId
    };
    this.socket.emit('send-message', message);
  }

  public toggleChat(): void {
    const currentState = this.chatState.value;
    this.chatState.next({
      ...currentState,
      isOpen: !currentState.isOpen,
      unreadCount: 0
    });
  }
}