import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import io from 'socket.io-client';

const routes = [
  {
    path: '',
    redirectTo: 'room',
    pathMatch: 'full'
  },
  {
    path: 'room',
    loadChildren: () => import('./components/room/room.module').then(m => m.RoomModule)
  },
];

const username = 'User-' + Math.random().toString(36).substring(2, 6);
const socket = io('http://localhost:3000', { transports: ['websocket'], autoConnect: true, reconnectionAttempts: 3 });

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, FormsModule, RouterModule],
  providers: [
    provideHttpClient(),
    provideRouter(routes as Routes),
    { provide: 'username', useValue: username },
    { provide: 'socket', useValue: socket },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
