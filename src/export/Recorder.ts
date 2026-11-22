/** Real-time canvas recording via MediaRecorder (MP4/H.264 where supported, else WebM). */
export interface RecFormat {
  mime: string;
  ext: 'mp4' | 'webm';
  label: string;
}

export function pickFormat(): RecFormat | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const options: RecFormat[] = [
    { mime: 'video/mp4;codecs=avc1.640028', ext: 'mp4', label: 'MP4 · H.264' },
    { mime: 'video/mp4', ext: 'mp4', label: 'MP4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm', label: 'WebM · VP9' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm', label: 'WebM · VP8' },
    { mime: 'video/webm', ext: 'webm', label: 'WebM' },
  ];
  return options.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? null;
}

export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  start(canvas: HTMLCanvasElement, format: RecFormat, bitsPerSecond: number): void {
    const stream = canvas.captureStream(60);
    this.chunks = [];
    this.rec = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: bitsPerSecond });
    this.rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.rec.start(500);
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const rec = this.rec;
      if (!rec) return resolve(new Blob());
      rec.onstop = () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(this.chunks, { type: rec.mimeType }));
      };
      rec.stop();
      this.rec = null;
    });
  }

  cancel(): void {
    if (!this.rec) return;
    this.rec.onstop = null;
    this.rec.stream.getTracks().forEach((t) => t.stop());
    this.rec.stop();
    this.rec = null;
  }
}

export function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
