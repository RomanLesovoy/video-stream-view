import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { RoomComponent } from '../room/room.component';
import { PreviewComponent } from '../room-lobby/preview/preview.component';
import { MediaControlsComponent } from '../room-lobby/media-controls/media-controls.component';
import { RoomJoinComponent } from '../room-lobby/room-join/room-join.component';
import { ParticipantsGridComponent } from '../participants-grid/participants-grid.component';
import { RoomLobbyComponent } from '../room-lobby/room-lobby.component';
import { VideoComponent } from '../participants-grid/video/video.component';

const routes: Routes = [
  {
    path: '',
    component: RoomComponent
  },
  {
    path: ':id',
    component: RoomComponent
  }
];

@NgModule({
  declarations: [
    RoomComponent,
    PreviewComponent,
    MediaControlsComponent,
    RoomJoinComponent,
    ParticipantsGridComponent,
    RoomLobbyComponent,
    VideoComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class RoomModule { }