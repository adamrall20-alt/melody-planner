import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Mic, Square, Trash2, Upload, X } from 'lucide-react';
import type { MediaItem } from '@shared/types';
import { api } from '@/lib/api';
import { formatClock, formatDuration } from '@/lib/date';

interface MediaVaultPanelProps {
  selectedDate: string;
}

export function MediaVaultPanel({ selectedDate }: MediaVaultPanelProps) {
  const [mobileSection, setMobileSection] = useState<'voice' | 'photos'>('voice');
  const [images, setImages] = useState<MediaItem[]>([]);
  const [voiceMemos, setVoiceMemos] = useState<MediaItem[]>([]);
  const [imageTitle, setImageTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewImg, setPreviewImg] = useState<MediaItem | null>(null);

  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [voiceTitle, setVoiceTitle] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);

  const loadMedia = async () => {
    try {
      const [imgs, voices] = await Promise.all([api.getMedia('image'), api.getMedia('voice')]);
      setImages(imgs);
      setVoiceMemos(voices);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void loadMedia();
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      setRecordSec(Math.floor((Date.now() - recordStartRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [recording]);

  const handleUploadImage = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await api.uploadMedia({
          file,
          kind: 'image',
          title: imageTitle.trim() || file.name.replace(/\.[^.]+$/, ''),
          entry_date: selectedDate,
        });
      }
      setImageTitle('');
      void loadMedia();
    } finally {
      setUploading(false);
    }
  };

  const handleStartRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const dur = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        await api.uploadMedia({
          file: blob,
          filename: `voice-${Date.now()}.webm`,
          kind: 'voice',
          title: voiceTitle.trim() || `Voice Memo (${selectedDate})`,
          entry_date: selectedDate,
          duration_sec: dur,
        });
        setVoiceTitle('');
        setRecordSec(0);
        void loadMedia();
      };
      recorderRef.current = recorder;
      recordStartRef.current = Date.now();
      setRecordSec(0);
      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error(err);
      setMicError('Microphone access was denied or unavailable.');
    }
  };

  const handleStopRecording = () => {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleDelete = async (id: number) => {
    await api.deleteMedia(id);
    if (previewImg?.id === id) setPreviewImg(null);
    void loadMedia();
  };

  return (
    <div className="space-y-4">
      {/* Mobile-only clean pill switcher */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-glass)] p-1 md:hidden">
        <button
          type="button"
          onClick={() => setMobileSection('voice')}
          className={`rounded-xl py-2 text-xs font-extrabold transition ${
            mobileSection === 'voice'
              ? 'bg-[var(--pastel-peach)] text-[var(--text-main)] shadow-xs'
              : 'text-[var(--text-muted)]'
          }`}
        >
          Voice Memos ({voiceMemos.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileSection('photos')}
          className={`rounded-xl py-2 text-xs font-extrabold transition ${
            mobileSection === 'photos'
              ? 'bg-[var(--pastel-sky)] text-[var(--text-main)] shadow-xs'
              : 'text-[var(--text-muted)]'
          }`}
        >
          Photos ({images.length})
        </button>
      </div>

      {/* Voice Memo Recorder & List */}
      <section
        className={`cozy-card cozy-card-peach rounded-3xl p-5 ${
          mobileSection === 'voice' ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-peach)] text-rose-700 dark:text-rose-300">
              <Mic className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-[var(--text-main)]">Voice Memos</h2>
          </div>
          <span className="rounded-full bg-[var(--pastel-mint)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-main)]">
            Synced to Drive
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={voiceTitle}
            onChange={(e) => setVoiceTitle(e.target.value)}
            placeholder="Memo title (optional)..."
            className="flex-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          {recording ? (
            <button
              type="button"
              onClick={handleStopRecording}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop ({formatClock(recordSec)})
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleStartRecording()}
              className="pastel-btn inline-flex items-center justify-center gap-1.5 rounded-2xl px-5 py-2.5 text-xs font-bold"
            >
              <Mic className="h-3.5 w-3.5" />
              Record Memo
            </button>
          )}
        </div>

        {micError && <p className="mt-2 text-xs text-rose-500">{micError}</p>}

        <div className="mt-4 space-y-2">
          {voiceMemos.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-muted)]">
              No voice memos yet. Hit Record to capture a quick thought!
            </p>
          ) : (
            voiceMemos.map((memo) => (
              <div
                key={memo.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--bg-subtle)] px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--text-main)]">{memo.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {memo.entry_date} · {formatDuration(memo.duration_sec)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <audio controls src={memo.url} className="h-8 max-w-[220px]" />
                  <button
                    type="button"
                    onClick={() => void handleDelete(memo.id)}
                    className="text-[var(--text-muted)] hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Image Storage & Gallery */}
      <section
        className={`cozy-card cozy-card-sky rounded-3xl p-5 ${
          mobileSection === 'photos' ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-sky)] text-sky-700 dark:text-sky-300">
              <ImageIcon className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              Photo Gallery ({images.length})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={imageTitle}
              onChange={(e) => setImageTitle(e.target.value)}
              placeholder="Title (optional)..."
              className="w-32 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none sm:w-44"
            />
            <label className="pastel-btn inline-flex cursor-pointer items-center gap-1.5 rounded-2xl px-3.5 py-1.5 text-xs font-bold">
              <Upload className="h-3.5 w-3.5" />
              {uploading ? 'Uploading...' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleUploadImage(e.target.files)}
              />
            </label>
          </div>
        </div>

        {images.length === 0 ? (
          <p className="py-8 text-center text-xs text-[var(--text-muted)]">
            No images uploaded yet. Photos sync straight to your Drive folder.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--bg-subtle)]"
              >
                <button
                  type="button"
                  onClick={() => setPreviewImg(img)}
                  className="block w-full text-left"
                >
                  <img
                    src={img.url}
                    alt={img.title}
                    className="h-32 w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="p-2.5">
                    <p className="truncate text-xs font-bold text-[var(--text-main)]">
                      {img.title}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--text-muted)]">
                      {img.entry_date}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(img.id)}
                  className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white opacity-80 transition hover:bg-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox Modal */}
      {previewImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImg(null)}
        >
          <div
            className="cozy-card relative max-h-[90vh] max-w-3xl overflow-hidden rounded-3xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImg(null)}
              className="absolute top-3 right-3 rounded-xl bg-black/60 p-1.5 text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImg.url}
              alt={previewImg.title}
              className="max-h-[75vh] w-auto rounded-2xl object-contain"
            />
            <div className="mt-2 flex items-center justify-between px-1 text-xs text-[var(--text-main)]">
              <span className="font-bold">{previewImg.title}</span>
              <span className="font-mono text-[var(--text-muted)]">{previewImg.entry_date}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
