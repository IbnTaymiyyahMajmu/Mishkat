/**
 * A recording of nothing.
 *
 * A phone lets a page go on sounding once the reader has turned to another
 * app, or locked the screen, only for as long as it is actually sounding. The
 * recitation is not one recording but one per ayah, and in the breath between
 * two of them — or in the silence a memorising loop leaves for reciting back,
 * which can be as long as the ayah itself — nothing is. iOS takes that as the
 * end of the page's audio, stops running it, and refuses the next ayah when it
 * asks to start. Android takes a recording under five seconds for an incidental
 * sound, not something being listened to, and takes its controls off the lock
 * screen while it plays; the short ayat of Juzʾ ʿAmma, and three of the seven
 * of al-Fātiḥah, are under five seconds.
 *
 * So the recitation leaves no gap that is not sounding. The silence for
 * reciting back is played, not waited out; and on Android a longer one, looped,
 * plays beneath the recitation for as long as it runs. Each is this: silent in
 * every sample, and a WAV, written here, because that is the one format every
 * browser plays and the only one simple enough to write by hand — sixteen-bit,
 * one channel, at a telephone's eight thousand samples a second, which makes
 * ten seconds of it 160 KB.
 */
export function silence(seconds: number): Blob {
  const rate = 8000;
  const bytes = Math.round(rate * seconds) * 2;
  const wav = new DataView(new ArrayBuffer(44 + bytes));
  const tag = (at: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) wav.setUint8(at + i, text.charCodeAt(i));
  };
  tag(0, "RIFF");
  wav.setUint32(4, 36 + bytes, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  wav.setUint32(16, 16, true); // the size of this chunk
  wav.setUint16(20, 1, true); // PCM
  wav.setUint16(22, 1, true); // one channel
  wav.setUint32(24, rate, true);
  wav.setUint32(28, rate * 2, true); // bytes a second
  wav.setUint16(32, 2, true); // bytes a sample
  wav.setUint16(34, 16, true); // bits a sample
  tag(36, "data");
  wav.setUint32(40, bytes, true);
  // An ArrayBuffer is made of noughts, and nought is silence.
  return new Blob([wav.buffer], { type: "audio/wav" });
}
