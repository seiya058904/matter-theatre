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
  private active: { rec: MediaRecorder; result: Promise<Blob | null>; release: (save: boolean) => void } | null = null;

  start(canvas: HTMLCanvasElement, format: RecFormat, bitsPerSecond: number, onError: () => void): void {
    const stream = canvas.captureStream(60);
    try {
      const rec = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: bitsPerSecond });
      const chunks: Blob[] = [];
      let resolve!: (blob: Blob | null) => void;
      const result = new Promise<Blob | null>((done) => { resolve = done; });
      const release = (save: boolean) => {
        if (this.active?.rec !== rec) return;
        this.active = null;
        rec.onstop = rec.onerror = rec.ondataavailable = null;
        for (const track of stream.getTracks()) track.stop();
        resolve(save && chunks.length ? new Blob(chunks, { type: rec.mimeType }) : null);
        chunks.length = 0;
      };
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        release(true);
      };
      rec.onerror = () => {
        release(false);
        onError();
      };
      rec.start(500);
      this.active = { rec, result, release };
    } catch (error) {
      for (const track of stream.getTracks()) track.stop();
      throw error;
    }
  }

  async stop(): Promise<Blob | null> {
    const session = this.active;
    if (!session) return null;
    if (session.rec.state !== 'inactive') session.rec.stop();
    return session.result;
  }

  cancel(): void {
    const session = this.active;
    if (!session) return;
    if (session.rec.state !== 'inactive') session.rec.stop();
    session.release(false);
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
