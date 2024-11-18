interface ConnectionQualityMetrics {
  bitrate: number;
  packetsLost: number;
  roundTripTime: number;
}

type Quality = 'poor' | 'medium' | 'good';

export interface ConnectionQuality {
  quality: Quality;
  socketId: string;
}

export async function optimizeVideoQuality(
  stateConnections: Map<string, { connection: RTCPeerConnection }>,
  lastStats: Map<string, { bytesSent: number, timestamp: number }>,
  debug: (message: string) => void
): Promise<ConnectionQuality[]> {
  const statsAccumulatorArray: ConnectionQuality[] = [];

  for (const [socketId, state] of stateConnections.entries()) {
    try {
      const connection = state.connection;
      const sender = connection.getSenders().find(s => s.track?.kind === 'video');
      
      if (!sender || !sender.track) continue;

      const stats = await getConnectionStats(connection, lastStats);
      const quality = analyzeConnectionQuality(stats);
      
      const parameters = sender.getParameters() as any;
      if (!parameters.encodings) {
        parameters.encodings = [{}];
      }

      // Применяем настройки в зависимости от качества
      switch (quality) {
        case 'poor':
          debug(`Applying poor quality settings for ${socketId}`);
          parameters.encodings[0].maxBitrate = 150000; // 150 kbps
          parameters.encodings[0].scaleResolutionDownBy = 4; // 1/4 разрешения
          parameters.encodings[0].maxFramerate = 15;
          break;

        case 'medium':
          debug(`Applying medium quality settings for ${socketId}`);
          parameters.encodings[0].maxBitrate = 500000; // 500 kbps
          parameters.encodings[0].scaleResolutionDownBy = 2; // 1/2 разрешения
          parameters.encodings[0].maxFramerate = 24;
          break;

        case 'good':
          debug(`Applying high quality settings for ${socketId}`);
          parameters.encodings[0].maxBitrate = 2500000; // 2.5 Mbps
          parameters.encodings[0].scaleResolutionDownBy = 1; // Полное разрешение
          parameters.encodings[0].maxFramerate = 30;
          break;
      }

      await sender.setParameters(parameters);

      statsAccumulatorArray.push({ quality, socketId });
    } catch (error) {
      console.error('Error optimizing video quality:', error);
    }
  }

  return statsAccumulatorArray;
}

export function analyzeConnectionQuality(metrics: ConnectionQualityMetrics): Quality {
  const POOR_BITRATE = 500000;    // 500 kbps
  const GOOD_BITRATE = 2000000;   // 2 Mbps
  const HIGH_PACKET_LOSS = 2;     // 2%
  const HIGH_RTT = 150;           // 150ms

  // Добавим веса для разных метрик
  const bitrateScore = metrics.bitrate < POOR_BITRATE ? 0 : 
                      metrics.bitrate > GOOD_BITRATE ? 2 : 1;
                      
  const packetLossScore = metrics.packetsLost > HIGH_PACKET_LOSS ? 0 : 
                         metrics.packetsLost < HIGH_PACKET_LOSS / 2 ? 2 : 1;
                         
  const rttScore = metrics.roundTripTime > HIGH_RTT ? 0 :
                  metrics.roundTripTime < HIGH_RTT / 2 ? 2 : 1;

  // Вычисляем общий счет
  const totalScore = (bitrateScore + packetLossScore + rttScore) / 3;

  // Определяем качество на основе общего счета
  if (totalScore < 0.7) return 'poor';
  if (totalScore > 1.3) return 'good';
  return 'medium';
}

export async function getConnectionStats(
  connection: RTCPeerConnection,
  lastStats: Map<string, { bytesSent: number, timestamp: number }>,
): Promise<ConnectionQualityMetrics> {
  const stats = await connection.getStats();
  let metrics: ConnectionQualityMetrics = {
    bitrate: 0,
    packetsLost: 0,
    roundTripTime: 0
  };

  let totalBytesSent = 0;
  let totalPacketsLost = 0;
  let rttSum = 0;
  let rttCount = 0;

  stats.forEach(stat => {
    // Для исходящего видео потока
    if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
      totalBytesSent = stat.bytesSent || 0;
      
      if (lastStats.has(stat.id)) {
        const lastStat = lastStats.get(stat.id)!;
        const deltaBytes = totalBytesSent - lastStat.bytesSent;
        const deltaTime = (stat.timestamp - lastStat.timestamp) / 1000; // конвертируем в секунды
        
        if (deltaTime > 0) {
          metrics.bitrate = (deltaBytes * 8) / deltaTime; // биты в секунду
        }
      }
      
      lastStats.set(stat.id, { 
        bytesSent: totalBytesSent, 
        timestamp: stat.timestamp 
      });
    }
    
    // Для входящего видео потока
    if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
      totalPacketsLost += stat.packetsLost || 0;
    }

    // Для RTT (Round Trip Time)
    if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
      if (stat.currentRoundTripTime) {
        rttSum += stat.currentRoundTripTime * 1000; // конвертируем в миллисекунды
        rttCount++;
      }
    }
  });

  metrics.packetsLost = totalPacketsLost;
  metrics.roundTripTime = rttCount > 0 ? rttSum / rttCount : 0;

  return metrics;
}
