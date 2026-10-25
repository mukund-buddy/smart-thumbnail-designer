
import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './components/Button';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { analyzeImage, editThumbnail, extractElements, enhanceThumbnail, isKeyConfigured } from './services/geminiService';
import { fetchThumbnailForVideo } from './services/youtubeService';
import { setRuntimeKey, clearRuntimeKey, getRuntimeKey, restoreRuntimeKey } from './services/keyStore';
import { ThumbnailState } from './types';

const STORAGE_KEY = 'smart_thumbnail_session';

const hasBuildKey = Boolean(process.env.API_KEY);

const PROMPT_IDEAS = [
  'Remove all text overlays from the image',
  'Add a glowing outline around the main character',
  'Add bold "INSANE" text in the top-left corner',
  'Change the background to a dark neon city',
  'Add dramatic cinematic lighting with an orange-teal color grade',
  'Make the main character bigger and more prominent'
];

const EXPORT_PRESETS = [
  { label: 'YouTube', detail: '1280×720', w: 1280, h: 720, file: 'thumbnail_youtube_1280x720.jpg' },
  { label: 'Instagram Feed', detail: '1080×1080', w: 1080, h: 1080, file: 'thumbnail_instagram_1080.jpg' },
  { label: 'IG Portrait', detail: '1080×1350', w: 1080, h: 1350, file: 'thumbnail_instagram_portrait_1080x1350.jpg' },
  { label: 'Reels / Shorts / TikTok', detail: '1080×1920', w: 1080, h: 1920, file: 'thumbnail_vertical_1080x1920.jpg' }
];

const App: React.FC = () => {
  const [state, setState] = useState<ThumbnailState>({
    originalUrl: null,
    editedUrl: null,
    removedElementsUrl: null,
    replacementUrl: null,
    detectedElements: [],
    isAnalyzing: false,
    isEditing: false,
    error: null
  });

  const [customInstruction, setCustomInstruction] = useState('');
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [selection, setSelection] = useState<PixelCrop | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  const [isFetchingYt, setIsFetchingYt] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [runtimeKey, setRuntimeKeyState] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  // Restore a tab-remembered session key, if the user opted in earlier
  useEffect(() => {
    if (restoreRuntimeKey()) {
      setRuntimeKeyState(getRuntimeKey());
      setRememberKey(true);
    }
  }, []);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        const { state: savedState, customInstruction: savedInstruction, selectedElements: savedElements, selection: savedSelection } = parsed;
        
        setState(prev => ({
          ...prev,
          ...savedState,
          isAnalyzing: false,
          isEditing: false,
          error: null
        }));
        setCustomInstruction(savedInstruction || '');
        setSelectedElements(savedElements || []);
        setSelection(savedSelection || null);
      } catch (err) {
        console.error("Failed to load saved session:", err);
      }
    }
  }, []);

  // Save session to localStorage on changes
  useEffect(() => {
    const sessionToSave = {
      state: {
        originalUrl: state.originalUrl,
        editedUrl: state.editedUrl,
        removedElementsUrl: state.removedElementsUrl,
        replacementUrl: state.replacementUrl,
        detectedElements: state.detectedElements,
      },
      customInstruction,
      selectedElements,
      selection
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionToSave));
    } catch (err) {
      // Handle quota exceeded or other storage errors
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.warn("Session too large to save to localStorage");
      } else {
        console.error("Failed to save session:", err);
      }
    }
  }, [state.originalUrl, state.editedUrl, state.removedElementsUrl, state.detectedElements, customInstruction, selectedElements, selection]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        16 / 9,
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
  };

  const handleCropComplete = async () => {
    if (!completedCrop || !cropImgRef.current) return;

    const canvas = document.createElement('canvas');
    const scaleX = cropImgRef.current.naturalWidth / cropImgRef.current.width;
    const scaleY = cropImgRef.current.naturalHeight / cropImgRef.current.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.drawImage(
      cropImgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    const croppedBase64 = canvas.toDataURL('image/jpeg');
    setIsCropping(false);
    await importImageData(croppedBase64);
  };

  const processGreenToTransparent = (imgUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Image processing timed out")), 10000);
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(imgUrl);
            return;
          }

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Chroma key filtering for pure green (#00FF00)
            if (g > 100 && g > r * 1.2 && g > b * 1.2) {
              data[i + 3] = 0; // Set Alpha to 0
            }
          }

          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error("Canvas processing error:", e);
          resolve(imgUrl); // Fallback to original if processing fails
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Failed to load image for transparency processing"));
      };

      img.src = imgUrl;
    });
  };

  /** Common path: a new image (upload, crop or YouTube fetch) enters the editor. */
  const importImageData = async (dataUrl: string) => {
    setState(prev => ({
      ...prev,
      originalUrl: dataUrl,
      editedUrl: null,
      removedElementsUrl: null,
      detectedElements: [],
      error: null,
      isAnalyzing: false
    }));
    setSelectedElements([]);
    setCustomInstruction('');
    setSelection(null);

    // Without a key the app still works (fetch / crop / export); the key card
    // at the top explains how to enable AI analysis.
    if (!isKeyConfigured()) return;

    setState(prev => ({ ...prev, isAnalyzing: true }));
    try {
      const elements = await analyzeImage(dataUrl);
      setState(prev => ({
        ...prev,
        detectedElements: elements,
        isAnalyzing: false
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        error: err.message || "Failed to analyze image. Please try again.",
        isAnalyzing: false
      }));
    }
  };

  const processUploadedImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setState(prev => ({ ...prev, error: "Please upload a valid image file (JPG, PNG, or WEBP)." }));
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await importImageData(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processUploadedImage(file);
    // Reset so the same file can be picked again later
    event.target.value = '';
  };

  const handleFetchFromYouTube = async () => {
    if (!ytUrl.trim() || isFetchingYt) return;
    setIsFetchingYt(true);
    setState(prev => ({ ...prev, error: null }));
    try {
      const thumb = await fetchThumbnailForVideo(ytUrl);
      setYtUrl('');
      await importImageData(thumb.dataUrl);
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message || "Could not fetch that thumbnail." }));
    } finally {
      setIsFetchingYt(false);
    }
  };

  const handleApplyKey = () => {
    const key = keyDraft.trim();
    if (!key) return;
    setRuntimeKey(key, rememberKey);
    setRuntimeKeyState(key);
    setKeyDraft('');
    setState(prev => ({ ...prev, error: null }));
  };

  const handleEraseKey = () => {
    clearRuntimeKey();
    setRuntimeKeyState('');
    setRememberKey(false);
    setKeyDraft('');
  };

  const handleReanalyze = async () => {
    if (!state.originalUrl || state.isAnalyzing) return;
    if (!isKeyConfigured()) {
      setState(prev => ({ ...prev, error: "Add your Gemini API key first (key card at the top of the page), then press Analyze again." }));
      return;
    }
    setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
    try {
      const elements = await analyzeImage(state.originalUrl);
      setState(prev => ({ ...prev, detectedElements: elements, isAnalyzing: false }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message || "Failed to analyze image. Please try again.", isAnalyzing: false }));
    }
  };

  const handleReplacementUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setState(prev => ({ ...prev, replacementUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const toggleElementSelection = (elementName: string) => {
    setSelectedElements(prev => 
      prev.includes(elementName) 
        ? prev.filter(e => e !== elementName) 
        : [...prev, elementName]
    );
  };

  const handleApplyEdits = async () => {
    if (!state.originalUrl) return;

    const base64Image = state.originalUrl; // full data URL (correct mime type preserved for Gemini)
    let instruction = "";

    if (selectedElements.length > 0) {
      instruction = `Remove the following elements: ${selectedElements.join(', ')}. `;
    }

    if (selection && imgRef.current) {
      const { width, height } = imgRef.current;
      // Convert to normalized coordinates (0-1000) for Gemini
      const ymin = Math.round((selection.y / height) * 1000);
      const xmin = Math.round((selection.x / width) * 1000);
      const ymax = Math.round(((selection.y + selection.height) / height) * 1000);
      const xmax = Math.round(((selection.x + selection.width) / width) * 1000);
      
      instruction += `Focus on the area defined by bounding box [${ymin}, ${xmin}, ${ymax}, ${xmax}]. `;
    }
    
    if (customInstruction.trim()) {
      instruction += customInstruction;
    } else if (selectedElements.length === 0 && !selection && !state.replacementUrl) {
      setState(prev => ({ ...prev, error: "Please select an element, area, or provide a replacement image." }));
      return;
    }

    if (state.replacementUrl) {
      instruction += " Replace the selected area or object with the provided replacement image. ";
    }

    setState(prev => ({ ...prev, isEditing: true, error: null }));
    setProcessingStatus('Connecting to Gemini AI...');

    try {
      setProcessingStatus('Generating edited thumbnail...');
      const editedBase64 = await editThumbnail(base64Image, instruction, state.replacementUrl || undefined);
      
      setProcessingStatus('Extracting removed elements layer...');
      let transparentLayer = null;
      try {
        const greenLayerBase64 = await extractElements(base64Image, selectedElements.length > 0 ? selectedElements.join(', ') : customInstruction);
        setProcessingStatus('Removing green screen...');
        transparentLayer = await processGreenToTransparent(greenLayerBase64);
      } catch (extractErr) {
        console.warn("Layer extraction failed, but continuing with main edit:", extractErr);
      }

      setState(prev => ({
        ...prev,
        editedUrl: editedBase64,
        removedElementsUrl: transparentLayer,
        isEditing: false
      }));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      console.error("Apply Edits Error:", err);
      setState(prev => ({
        ...prev,
        error: err.message || "An error occurred while editing your thumbnail. The AI might be busy.",
        isEditing: false
      }));
    } finally {
      setProcessingStatus('');
    }
  };

  const handleAutoEnhance = async () => {
    if (!state.originalUrl) return;

    const base64Image = state.editedUrl || state.originalUrl;
    
    setIsEnhancing(true);
    setState(prev => ({ ...prev, isEditing: true, error: null }));
    setProcessingStatus('AI is enhancing colors and lighting...');

    try {
      const enhancedBase64 = await enhanceThumbnail(base64Image);
      
      setState(prev => ({
        ...prev,
        editedUrl: enhancedBase64,
        isEditing: false
      }));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      console.error("Enhance Error:", err);
      setState(prev => ({
        ...prev,
        error: err.message || "Failed to enhance image. AI might be busy.",
        isEditing: false
      }));
    } finally {
      setIsEnhancing(false);
      setProcessingStatus('');
    }
  };

  const downloadImage = (url: string | null, filename: string) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Downloads the image center-cropped and resized to a specific platform
   * preset (e.g. YouTube 1280x720, Instagram 1080x1080, Reels/TikTok 9:16).
   */
  const downloadResized = (url: string | null, width: number, height: number, filename: string) => {
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      const targetAspect = width / height;
      const srcAspect = img.naturalWidth / img.naturalHeight;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (srcAspect > targetAspect) {
        sw = img.naturalHeight * targetAspect;
        sx = (img.naturalWidth - sw) / 2;
      } else if (srcAspect < targetAspect) {
        sh = img.naturalWidth / targetAspect;
        sy = (img.naturalHeight - sh) / 2;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/jpeg', 0.92);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = url;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header (separate component: components/Header.tsx) */}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        {/* Session API Key (shown when no build-time key is baked in) */}
        {!hasBuildKey && (
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <i className={`fas ${runtimeKey ? 'fa-shield-halved text-emerald-500' : 'fa-key text-amber-500'} mt-1`}></i>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-zinc-200 flex items-center gap-2 flex-wrap">
                  {runtimeKey ? 'Gemini key active — session only' : 'Add your Gemini API key to enable AI features'}
                  {runtimeKey && (
                    <span className="text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded-full">in-memory only</span>
                  )}
                </h4>
                <p className="text-xs text-zinc-500 mt-1">
                  The key stays only in this tab's memory and goes straight to Google — never to our servers or any third party.
                  It is wiped on every page reload / new tab automatically (nothing is persisted unless you tick the box below).
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex-1 flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                <i className="fas fa-lock text-zinc-600 text-xs"></i>
                <input
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleApplyKey(); }}
                  placeholder={runtimeKey ? 'Paste a new key to replace the active one' : 'Paste your AIza… Gemini key (kept in memory only)'}
                  autoComplete="off"
                  className="w-full bg-transparent text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-600"
                />
              </div>
              <Button onClick={handleApplyKey} disabled={!keyDraft.trim()}>Use key</Button>
              {runtimeKey && (
                <Button variant="ghost" onClick={handleEraseKey}><i className="fas fa-trash-can"></i> Erase key</Button>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberKey}
                onChange={(e) => {
                  const on = e.target.checked;
                  setRememberKey(on);
                  if (runtimeKey) setRuntimeKey(runtimeKey, on);
                }}
                className="accent-indigo-500"
              />
              Remember for this tab only (survives a page refresh, auto-deleted when the tab closes)
            </label>
            <details className="text-xs text-zinc-500">
              <summary className="cursor-pointer hover:text-zinc-400 transition-colors">How to get a free key / use offline</summary>
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                <li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">aistudio.google.com/apikey</a> → <b>Create API key</b> → copy the <b>AIza…</b> key.</li>
                <li>Paste it above and press <b>Use key</b> — works instantly, no restart needed.</li>
                <li>Offline/local users can instead bake it into a <code className="bg-zinc-900 px-1 rounded">.env.local</code> file (see README) so it never needs pasting.</li>
              </ol>
            </details>
          </section>
        )}

        {/* Error Banner */}
        <AnimatePresence>
          {state.error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-start gap-3"
            >
              <i className="fas fa-exclamation-triangle text-red-500 mt-1"></i>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-red-500">Processing Error</h4>
                <p className="text-sm text-red-400/80 mt-1">{state.error}</p>
              </div>
              <button 
                onClick={() => setState(p => ({ ...p, error: null }))}
                className="text-red-500/50 hover:text-red-500 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Banner */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-emerald-500/10 border border-emerald-500/50 p-4 rounded-xl flex items-start gap-3"
            >
              <i className="fas fa-check-circle text-emerald-500 mt-1"></i>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-emerald-500">Edit Complete</h4>
                <p className="text-sm text-emerald-400/80 mt-1">Your thumbnail has been successfully processed by Gemini AI.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Section */}
        {!state.originalUrl ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) processUploadedImage(file);
            }}
            className={`border-2 border-dashed rounded-2xl h-[400px] flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-500/5'}`}
          >
            <div className="bg-zinc-900 p-6 rounded-full group-hover:bg-indigo-500/10 transition-colors">
              <i className="fas fa-cloud-upload-alt text-4xl text-zinc-600 group-hover:text-indigo-500"></i>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">{isDragging ? 'Drop it now!' : 'Drop your thumbnail here'}</p>
              <p className="text-zinc-500 mt-1">Accepts JPG, PNG, WEBP (16:9 recommended)</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handleFileUpload} 
            />
            <Button variant="secondary" className="mt-2">Browse Files</Button>
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-6 w-full max-w-xl flex flex-col sm:flex-row items-stretch gap-3 px-4"
            >
              <div className="flex-1 flex items-center gap-2 bg-zinc-900/70 border border-zinc-800 rounded-lg px-3 py-2 focus-within:border-indigo-500 transition-colors">
                <i className="fab fa-youtube text-red-500"></i>
                <input
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFetchFromYouTube(); }}
                  placeholder="…or paste a YouTube link (watch?v= / youtu.be / shorts)"
                  className="w-full bg-transparent text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-600"
                />
              </div>
              <Button variant="secondary" onClick={handleFetchFromYouTube} isLoading={isFetchingYt} disabled={!ytUrl.trim() || isFetchingYt}>
                Fetch Thumbnail
              </Button>
            </div>
            <p className="text-[11px] text-zinc-600">Fetching needs no API key &amp; has no quota. AI editing does — add your key below.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Col: Workspace */}
            <div className="lg:col-span-2 space-y-6">
              <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
                <AnimatePresence>
                  {state.isEditing && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-10 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm transition-all"
                    >
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full"
                      ></motion.div>
                      <motion.p 
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="mt-6 text-indigo-400 font-medium tracking-wide"
                      >
                        {processingStatus}
                      </motion.p>
                      <p className="mt-2 text-zinc-500 text-xs">This may take up to 30 seconds</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isCropping && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute inset-0 z-20 bg-black/90 flex flex-col items-center justify-center p-4"
                    >
                      <div className="max-h-[80%] w-full flex justify-center">
                        <ReactCrop
                          crop={crop}
                          onChange={(c) => setCrop(c)}
                          onComplete={(c) => setCompletedCrop(c)}
                          aspect={16 / 9}
                          className="max-h-full"
                        >
                          <img
                            ref={cropImgRef}
                            alt="Crop"
                            src={state.originalUrl || ''}
                            onLoad={onImageLoad}
                            className="max-h-[60vh] object-contain"
                          />
                        </ReactCrop>
                      </div>
                      <div className="mt-6 flex gap-4">
                        <Button onClick={handleCropComplete}>Apply Crop</Button>
                        <Button variant="ghost" onClick={() => setIsCropping(false)}>Cancel</Button>
                      </div>
                      <p className="mt-4 text-xs text-zinc-500 italic">Aspect ratio locked to 16:9 for YouTube thumbnails</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <img 
                  ref={imgRef}
                  src={state.editedUrl || state.originalUrl || ''} 
                  alt="Thumbnail Workspace" 
                  className="w-full h-full object-contain"
                />

                {isSelectingArea && (
                  <div className="absolute inset-0 z-30 bg-black/20">
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setSelection(c)}
                      className="w-full h-full"
                    >
                      <img
                        src={state.originalUrl || ''}
                        alt="Select area"
                        className="w-full h-full object-contain"
                      />
                    </ReactCrop>
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-600 px-4 py-2 rounded-full text-xs font-bold shadow-xl border border-white/20 flex items-center gap-2">
                      <i className="fas fa-mouse-pointer"></i>
                      DRAG TO SELECT AREA
                      <button 
                        onClick={() => {
                          setIsSelectingArea(false);
                          setSelection(null);
                        }}
                        className="ml-2 hover:text-red-300"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-4 right-4 flex gap-2">
                  {!isCropping && !isSelectingArea && (
                    <>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setIsSelectingArea(true);
                          setCrop({ unit: '%', width: 30, height: 30, x: 35, y: 35 });
                        }}
                        className={`bg-black/60 hover:bg-indigo-600/80 backdrop-blur px-3 py-1.5 rounded text-[10px] font-bold text-white border border-white/10 transition-all flex items-center gap-2 ${selection ? 'border-indigo-500 bg-indigo-600/40' : ''}`}
                      >
                        <i className="fas fa-vector-square"></i> {selection ? 'AREA SELECTED' : 'SELECT AREA'}
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsCropping(true)}
                        className="bg-black/60 hover:bg-indigo-600/80 backdrop-blur px-3 py-1.5 rounded text-[10px] font-bold text-white border border-white/10 transition-all flex items-center gap-2"
                      >
                        <i className="fas fa-crop-alt"></i> CROP & RESIZE
                      </motion.button>
                    </>
                  )}
                  <span className="bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-zinc-400 border border-white/5">16:9 RATIO</span>
                  <AnimatePresence>
                    {state.editedUrl && (
                      <motion.span 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-indigo-600/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-white shadow-lg"
                      >
                        AI ENHANCED
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Controls */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl space-y-6">
                {/* Guided flow steps */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { n: 1, label: 'Pick elements, area or type an instruction' },
                    { n: 2, label: '(Optional) Add a replacement image' },
                    { n: 3, label: 'Apply, then Auto-Enhance & export' }
                  ].map((s) => (
                    <div key={s.n} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2 flex items-center gap-2 justify-center">
                      <span className="w-5 h-5 flex-shrink-0 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">{s.n}</span>
                      <span className="text-[10px] text-zinc-400 leading-tight">{s.label}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-sm font-semibold text-zinc-400 block uppercase tracking-wider">Auto Detected Elements</label>
                    {state.originalUrl && !state.isAnalyzing && (
                      <button
                        onClick={handleReanalyze}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
                      >
                        <i className="fas fa-rotate-right"></i> Analyze{isKeyConfigured() ? '' : ' (needs key)'}
                      </button>
                    )}
                  </div>
                  {state.isAnalyzing ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-zinc-500">AI is scanning your thumbnail...</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <AnimatePresence mode="popLayout">
                        {state.detectedElements.length > 0 ? (
                          state.detectedElements.map((el, idx) => (
                            <motion.button
                              key={`${el.name}-${idx}`}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              layout
                              onClick={() => toggleElementSelection(el.name)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 border ${
                                selectedElements.includes(el.name)
                                  ? "bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                              }`}
                            >
                              <i className={`fas ${selectedElements.includes(el.name) ? 'fa-minus-circle' : 'fa-plus-circle'}`}></i>
                              {el.name} <span className="opacity-40 font-normal uppercase text-[9px] tracking-tight">{el.type}</span>
                            </motion.button>
                          ))
                        ) : (
                          <p className="text-sm text-zinc-500 italic">No elements detected yet.</p>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-zinc-400 mb-2 block uppercase tracking-wider">Custom Instructions</label>
                  <textarea 
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    placeholder="Describe what you want to remove or replace (e.g., 'Replace the red character with the uploaded person')"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[100px] placeholder:text-zinc-700 resize-none"
                  />
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Try:</span>
                    {PROMPT_IDEAS.map((idea) => (
                      <button
                        key={idea}
                        onClick={() => setCustomInstruction(idea)}
                        className="px-2.5 py-1 rounded-full text-[10px] bg-zinc-800/70 border border-zinc-700 text-zinc-400 hover:border-indigo-500 hover:text-indigo-300 transition-colors"
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-zinc-400 mb-4 block uppercase tracking-wider">Replacement Image (Optional)</label>
                  <div className="flex items-center gap-4">
                    {!state.replacementUrl ? (
                      <button 
                        onClick={() => replacementInputRef.current?.click()}
                        className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
                      >
                        <i className="fas fa-plus-circle text-zinc-600 group-hover:text-indigo-500"></i>
                        <span className="text-xs text-zinc-500">Upload replacement object/person</span>
                      </button>
                    ) : (
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-indigo-500 shadow-lg shadow-indigo-500/20 group">
                        <img src={state.replacementUrl} className="w-full h-full object-cover" alt="Replacement" />
                        <button 
                          onClick={() => setState(prev => ({ ...prev, replacementUrl: null }))}
                          className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    )}
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={replacementInputRef} 
                      accept="image/*" 
                      onChange={handleReplacementUpload} 
                    />
                    {state.replacementUrl && (
                      <div className="flex-1 text-xs text-zinc-500">
                        <p className="font-semibold text-zinc-400">Image loaded!</p>
                        <p className="mt-1 italic">Use "Select Area" or tags to tell AI where to put this.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                  <Button 
                    onClick={handleApplyEdits}
                    isLoading={state.isEditing && !isEnhancing}
                    disabled={state.isAnalyzing || state.isEditing || (selectedElements.length === 0 && !customInstruction && !selection && !state.replacementUrl)}
                    className="flex-1 md:flex-none px-10 h-11"
                  >
                    Apply Smart Edits
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleAutoEnhance}
                    isLoading={isEnhancing}
                    disabled={state.isAnalyzing || state.isEditing}
                    className="flex-1 md:flex-none px-8 h-11 border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-400"
                  >
                    <i className="fas fa-wand-magic-sparkles"></i> Auto-Enhance
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setState({
                        originalUrl: null,
                        editedUrl: null,
                        removedElementsUrl: null,
                        replacementUrl: null,
                        detectedElements: [],
                        isAnalyzing: false,
                        isEditing: false,
                        error: null
                      });
                      setSelectedElements([]);
                      setCustomInstruction('');
                      setSelection(null);
                      localStorage.removeItem(STORAGE_KEY);
                    }}
                    className="h-11"
                  >
                    Reset All
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Col: Sidebar / Results */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-4 shadow-xl">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <i className="fas fa-download text-indigo-500"></i> Export Assets
                </h3>
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-sm border-zinc-800 bg-zinc-900/50"
                    onClick={() => downloadImage(state.originalUrl, "original_thumbnail.png")}
                  >
                    <i className="fas fa-image w-5 text-zinc-500"></i> Download Original
                  </Button>
                  <Button 
                    variant="primary" 
                    className="w-full justify-start text-sm"
                    disabled={!state.editedUrl}
                    onClick={() => downloadImage(state.editedUrl, "smart_thumbnail_edited.png")}
                  >
                    <i className="fas fa-check-circle w-5"></i> Download Edited (1080p)
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-sm border-zinc-800 bg-zinc-900/50"
                    disabled={!state.removedElementsUrl}
                    onClick={() => downloadImage(state.removedElementsUrl, "removed_elements_layer.png")}
                  >
                    <i className="fas fa-scissors w-5 text-indigo-400"></i> {state.removedElementsUrl ? "Download Removed Layer" : "Layer Extraction Unavailable"}
                  </Button>
                  <p className="text-[10px] text-zinc-500 mt-2 px-1 leading-relaxed italic">
                    * Final export is upscaled to 1920x1080 with AI sharpening and texture preservation.
                  </p>
                  <div className="pt-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">One-Click Platform Presets</p>
                    <div className="grid grid-cols-2 gap-2">
                      {EXPORT_PRESETS.map((p) => (
                        <Button
                          key={p.label}
                          variant="secondary"
                          className="w-full text-[11px] px-2"
                          disabled={!state.editedUrl && !state.originalUrl}
                          onClick={() => downloadResized(state.editedUrl || state.originalUrl, p.w, p.h, p.file)}
                        >
                          <i className="fas fa-mobile-screen w-3.5 text-zinc-500"></i>
                          <span className="truncate">{p.label} <span className="opacity-50">{p.detail}</span></span>
                        </Button>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2 px-1 leading-relaxed italic">
                      Auto center-crop + resize for each platform (YouTube, Instagram, Reels/Shorts/TikTok).
                    </p>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {state.removedElementsUrl && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3 overflow-hidden"
                  >
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Removed Element Preview</p>
                    <div className="aspect-video bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800/50 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-center shadow-inner">
                      <img src={state.removedElementsUrl} className="w-full h-full object-contain" alt="Removed elements" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-xl">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                  <i className="fas fa-info-circle text-zinc-500"></i> EDITOR TIPS
                </h3>
                <ul className="text-xs text-zinc-500 space-y-4">
                  <li className="flex gap-3">
                    <i className="fas fa-lightbulb text-indigo-500 mt-0.5 flex-shrink-0"></i>
                    <span>Click the detected tags to quickly queue items for removal.</span>
                  </li>
                  <li className="flex gap-3">
                    <i className="fas fa-layer-group text-indigo-500 mt-0.5 flex-shrink-0"></i>
                    <span>The "Removed Layer" is a transparent PNG containing just the objects you took out, perfect for re-compositing in Photoshop.</span>
                  </li>
                  <li className="flex gap-3">
                    <i className="fas fa-wand-sparkles text-indigo-500 mt-0.5 flex-shrink-0"></i>
                    <span>The model automatically enhances cinematic lighting in the edited areas.</span>
                  </li>
                </ul>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Footer (separate component: components/Footer.tsx) */}
      <Footer />
    </div>
  );
};

export default App;
