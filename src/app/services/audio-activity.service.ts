import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioActivityService {
  private readonly SPEAKING_THRESHOLD = -45;
  private audioContextMap = new Map<string, {
    context: AudioContext,
    analyser: AnalyserNode,
    dataArray: Uint8Array,
    checkInterval: any
  }>();

  initializeAudioAnalyser(stream: MediaStream, socketId: string, onSpeakingChange: (isSpeaking: boolean) => void) {
    if (this.audioContextMap.has(socketId)) {
      this.stopAnalyser(socketId);
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    source.connect(analyser);
    
    const checkInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const volume = 20 * Math.log10(average / 255);
      onSpeakingChange(volume > this.SPEAKING_THRESHOLD);
    }, 100);

    this.audioContextMap.set(socketId, {
      context,
      analyser,
      dataArray,
      checkInterval
    });
  }

  stopAnalyser(socketId: string) {
    const audioData = this.audioContextMap.get(socketId);
    if (audioData) {
      clearInterval(audioData.checkInterval);
      audioData.context.close();
      this.audioContextMap.delete(socketId);
    }
  }
}
