import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioActivityService {
  private readonly SPEAKING_THRESHOLD = -30;
  private readonly NOISE_THRESHOLD = 5;
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
    
    let speakingFrames = 0;
    let silentFrames = 0;
    
    const checkInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const volume = 20 * Math.log10(average / 255);

      if (volume > this.SPEAKING_THRESHOLD) {
        speakingFrames++;
        silentFrames = 0;
      } else if (average < this.NOISE_THRESHOLD) {
        silentFrames++;
        speakingFrames = 0;
      }

      if (speakingFrames > 2) {
        onSpeakingChange(true);
      } else if (silentFrames > 5) {
        onSpeakingChange(false);
      }
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
