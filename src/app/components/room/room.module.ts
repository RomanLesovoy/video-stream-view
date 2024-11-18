import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { RoomComponent } from '../room/room.component';
import { PreviewComponent } from '../room-lobby/preview/preview.component';
import { MediaControlsComponent } from '../room-lobby/media-controls/media-controls.component';
import { RoomJoinComponent } from '../room-lobby/room-join/room-join.component';
import { ConferenceComponent } from '../conference/conference.component';
import { RoomLobbyComponent } from '../room-lobby/room-lobby.component';
import { VideoComponent } from '../conference/video/video.component';
import { ChatComponent } from '../conference/chat/chat.component';
import { LoaderComponent } from '../loader/loader.component';

const routes: Routes = [
  {
    path: 'lobby',
    component: RoomComponent
  },
  {
    path: ':id',
    component: RoomComponent
  },
  {
    path: '',
    redirectTo: 'lobby',
    pathMatch: 'full'
  }
];

@NgModule({
  declarations: [
    RoomComponent,
    PreviewComponent,
    MediaControlsComponent,
    RoomJoinComponent,
    ConferenceComponent,
    RoomLobbyComponent,
    VideoComponent,
    ChatComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    LoaderComponent
  ]
})
export class RoomModule { }