import { useEffect, useRef, useState } from "react";
import { Camera, Mic, Square, Trash2, Upload } from "lucide-react";
import { FieldError } from "./Feedback";
function MediaPreview({ file, audio = false }) {
  const element = useRef(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    element.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return audio ? (
    <audio ref={element} controls aria-label="Your voice message preview" />
  ) : (
    <img ref={element} alt="Your selected flood evidence" />
  );
}
async function preparePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  if (file.size <= 5 * 1024 * 1024) return file;
  if (file.size > 25 * 1024 * 1024)
    throw new Error("This photo is too large. Please choose one under 25 MB.");
  const image = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1920 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * ratio);
    canvas.height = Math.round(image.height * ratio);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size > 5 * 1024 * 1024)
      throw new Error("Choose a smaller photo, under 5 MB.");
    return new File([blob], "flood-photo.jpg", { type: "image/jpeg" });
  } finally {
    image.close();
  }
}
export default function MediaEvidence({
  photo,
  voice,
  onPhoto,
  onVoice,
  onBusy,
}) {
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [requestingMicrophone, setRequestingMicrophone] = useState(false);
  const microphoneGuard = useRef(false);
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function choosePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setProcessing(true);
    onBusy(true);
    try {
      onPhoto(await preparePhoto(file));
    } catch (e) {
      setError(
        e.message || "We couldn’t prepare this photo. Please try another.",
      );
    } finally {
      setProcessing(false);
      onBusy(false);
      event.target.value = "";
    }
  }
  function chooseVoice(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 10 * 1024 * 1024)
      setError("Choose an audio message under 10 MB.");
    else if (
      ![
        "audio/webm",
        "audio/ogg",
        "audio/mpeg",
        "audio/mp4",
        "audio/wav",
        "audio/x-wav",
      ].includes(file.type)
    )
      setError("Choose WebM, Ogg, MP3, MP4 or WAV audio.");
    else onVoice(file);
    event.target.value = "";
  }
  async function record() {
    if (microphoneGuard.current) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "Recording is unavailable. You can upload a voice file instead.",
      );
      return;
    }
    microphoneGuard.current = true;
    setRequestingMicrophone(true);
    onBusy(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!type) {
        media.getTracks().forEach((t) => t.stop());
        onBusy(false);
        setError(
          "This browser’s audio format is unsupported. Upload a voice file instead.",
        );
        return;
      }
      const instance = new MediaRecorder(media, { mimeType: type });
      recorder.current = instance;
      const chunks = [];
      instance.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      instance.onstop = () => {
        clearTimeout(timer.current);
        media.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        const blob = new Blob(chunks, { type });
        if (blob.size > 10 * 1024 * 1024)
          setError("Recording is too large. Please make a shorter message.");
        else if (blob.size)
          onVoice(
            new File(
              [blob],
              `message.${type === "audio/mp4" ? "m4a" : type.split("/")[1]}`,
              { type },
            ),
          );
        setRecording(false);
        onBusy(false);
      };
      instance.onerror = () => {
        media.getTracks().forEach((t) => t.stop());
        setError("Recording failed. Please try again or upload a voice file.");
        setRecording(false);
        onBusy(false);
      };
      instance.start();
      setRecording(true);
      timer.current = setTimeout(() => {
        if (instance.state === "recording") instance.stop();
      }, 60000);
    } catch {
      setError(
        "Microphone access was not available. You can upload a voice file or choose an observation instead.",
      );
      onBusy(false);
    } finally {
      microphoneGuard.current = false;
      if (mounted.current) setRequestingMicrophone(false);
    }
  }
  return (
    <section className="evidence-section">
      <h2>Add what you can</h2>
      <p>A photo, a voice message or one observation is enough.</p>
      <div className="evidence-grid">
        <div className="evidence-slot">
          <Camera size={25} />
          <strong>Show what you see</strong>
          <label className="button secondary file-button">
            {processing ? "Preparing photo…" : "Add a photo"}
            <input
              aria-label="Add a photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={choosePhoto}
              disabled={processing || recording || requestingMicrophone}
            />
          </label>
          <span className="microcopy">JPEG, PNG or WebP · up to 5 MB</span>
          {photo && (
            <div className="media-preview">
              <MediaPreview file={photo} />
              <button
                type="button"
                className="text-button"
                onClick={() => onPhoto(null)}
              >
                <Trash2 size={15} />
                Remove photo
              </button>
            </div>
          )}
        </div>
        <div className="evidence-slot">
          <Mic size={25} />
          <strong>Tell us in your own words</strong>
          <button
            type="button"
            className={`button ${recording ? "danger" : "secondary"}`}
            onClick={recording ? () => recorder.current?.stop() : record}
            disabled={processing || requestingMicrophone}
          >
            {recording ? <Square size={17} /> : <Mic size={17} />}
            {recording
              ? "Stop recording"
              : requestingMicrophone
                ? "Opening microphone…"
                : "Record a voice message"}
          </button>
          <span className="microcopy">Up to 60 seconds · no transcription</span>
          <label className="text-button file-button">
            <Upload size={15} />
            Or upload audio
            <input
              aria-label="Upload voice message"
              type="file"
              accept="audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav,audio/x-wav"
              onChange={chooseVoice}
              disabled={recording || processing || requestingMicrophone}
            />
          </label>
          {recording && (
            <p role="status">Recording… Tap stop when you’re done.</p>
          )}
          {voice && (
            <div className="media-preview">
              <MediaPreview file={voice} audio />
              <button
                type="button"
                className="text-button"
                onClick={() => onVoice(null)}
              >
                <Trash2 size={15} />
                Remove voice message
              </button>
            </div>
          )}
        </div>
      </div>
      <FieldError>{error}</FieldError>
    </section>
  );
}
