import { useState, useRef, useEffect, ChangeEvent } from "react";
import { Camera, RefreshCw, AlertCircle, CheckCircle2, AlertTriangle, Leaf, HeartPulse, Loader2, Upload, Download } from "lucide-react";
import { PlantAnalysisResult } from "./types";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PlantAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Default to environment-facing camera
  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser or context.");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setStream(mediaStream);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      // Fallback: If camera access fails, we could just allow file upload,
      // but let's provide a clear error message first.
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission denied')) {
         setError("Camera permission denied. Please click 'Upload Data' to select a photo instead.");
      } else {
         setError(err.message || "Could not access camera. Please upload a photo instead.");
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setResult(null);
    setError(null);
    startCamera();
  };

  const analyzePlant = async () => {
    if (!capturedImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // capturedImage is a data URL: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
      const [header, base64Data] = capturedImage.split(",");
      const mimeTypeMatch = header.match(/:(.*?);/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze image");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    
    let reportText = `PLANT HEALTH ANALYSIS REPORT\n`;
    reportText += `============================\n\n`;
    reportText += `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`;
    
    reportText += `CLASSIFICATION\n`;
    reportText += `----------------------------\n`;
    reportText += `Name: ${result.plantName}\n`;
    reportText += `Scientific Name: ${result.scientificName || "N/A"}\n\n`;
    
    reportText += `HEALTH INDEX\n`;
    reportText += `----------------------------\n`;
    reportText += `Status: ${result.healthStatus}\n\n`;
    
    if (result.growingConditions) {
      reportText += `IDEAL CONDITIONS\n`;
      reportText += `----------------------------\n`;
      reportText += `Light: ${result.growingConditions.light}\n`;
      reportText += `Water: ${result.growingConditions.water}\n`;
      reportText += `Soil: ${result.growingConditions.soil}\n\n`;
    }
    
    if (result.issues && result.issues.length > 0) {
      reportText += `DIAGNOSTIC REPORT\n`;
      reportText += `----------------------------\n`;
      result.issues.forEach(issue => {
        reportText += `- ${issue}\n`;
      });
      reportText += `\n`;
    }
    
    if (result.recommendations && result.recommendations.length > 0) {
      reportText += `ACTION PROTOCOL\n`;
      reportText += `----------------------------\n`;
      result.recommendations.forEach((rec, idx) => {
        reportText += `${idx + 1}. ${rec}\n`;
      });
      reportText += `\n`;
    }
    
    if (result.careTips && result.careTips.length > 0) {
      reportText += `CARE GUIDELINES\n`;
      reportText += `----------------------------\n`;
      result.careTips.forEach((tip, idx) => {
        reportText += `${idx + 1}. ${tip}\n`;
      });
      reportText += `\n`;
    }

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.plantName.replace(/\s+/g, "_").toLowerCase()}_report.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Start camera automatically on mount if no image is captured
  useEffect(() => {
    if (!capturedImage) {
      startCamera();
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Healthy": return "text-accent border-accent";
      case "Needs Attention": return "text-amber-500 border-amber-500/50";
      case "Sick": return "text-rose-500 border-rose-500/50";
      default: return "text-text-dim border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Healthy": return <CheckCircle2 className="w-4 h-4 text-accent" />;
      case "Needs Attention": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "Sick": return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default: return <AlertCircle className="w-4 h-4 text-text-dim" />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-text-bright font-sans overflow-hidden selection:bg-accent/30 selection:text-white">
      {/* Top Nav */}
      <nav className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0">
        <div className="font-serif italic text-xl tracking-[1px] flex items-center gap-3">
          <Leaf className="w-5 h-5 text-accent" />
          Botanica.OS
        </div>
        <div className="hidden sm:flex gap-8 text-xs uppercase tracking-[1px] text-text-dim">
          <span>Scanner</span>
          <span>Collection</span>
          <span>Encyclopaedia</span>
        </div>
        <div className="border border-border px-3 py-1 rounded-full text-[11px] text-text-dim uppercase tracking-[1px]">
          {stream ? "LIDAR ACTIVE" : "SYSTEM STANDBY"}
        </div>
      </nav>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Viewport Side */}
        <div 
          className="flex-1 relative flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-border p-8"
          style={{ background: 'radial-gradient(circle at center, #1A1D1B 0%, #0A0B0B 100%)' }}
        >
          {error && (
            <div className="absolute top-8 left-8 right-8 z-20 p-4 bg-black/40 border-l-2 border-rose-500 rounded text-rose-400 text-sm flex items-start gap-3 backdrop-blur-md">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="w-full max-w-[480px] aspect-square relative rounded-[2px] border border-accent/30 bg-black/50 overflow-hidden shadow-2xl">
            {/* Viewfinder Corners */}
            <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-accent -translate-x-[1px] -translate-y-[1px] z-10" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-accent translate-x-[1px] translate-y-[1px] z-10" />

            {/* Scan Line */}
            {isAnalyzing && (
              <div className="absolute top-[20%] left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_15px_var(--color-accent)] z-10 animate-pulse" />
            )}

            {!capturedImage ? (
              <>
                {stream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-text-dim">
                    <Camera className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-serif text-sm">{error ? "Sensor array offline" : "Initializing sensor array..."}</p>
                    <label className="mt-6 cursor-pointer inline-flex items-center gap-2 px-6 py-2 bg-accent text-bg rounded-full text-xs font-bold uppercase tracking-[1px] hover:bg-accent/90 transition-colors">
                      <Upload className="w-4 h-4" />
                      Upload Data
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                )}
                
                {stream && (
                  <div className="absolute bottom-6 left-6 text-[10px] text-accent uppercase tracking-[2px] font-mono">
                    AWAITING CAPTURE...
                  </div>
                )}
              </>
            ) : (
              <>
                <img
                  src={capturedImage}
                  alt="Captured plant"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {isAnalyzing && (
                  <div className="absolute bottom-6 left-6 text-[10px] text-accent uppercase tracking-[2px] font-mono animate-pulse">
                    ANALYZING SPECIMEN...
                  </div>
                )}
              </>
            )}
            
            {/* Hidden canvas for capturing frames */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        {/* Analysis Side */}
        <div className="w-full lg:w-[380px] bg-surface flex flex-col p-8 overflow-y-auto">
          {!result && !isAnalyzing && (
             <div className="flex-1 flex flex-col justify-center items-center text-center opacity-50">
                <Leaf className="w-12 h-12 mb-4 text-text-dim" />
                <p className="font-serif italic text-text-dim">Awaiting specimen data.</p>
             </div>
          )}

          {isAnalyzing && !result && (
            <div className="flex-1 flex flex-col justify-center items-center text-center">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-accent" />
              <p className="text-xs uppercase tracking-[2px] text-text-dim">Processing telemetry...</p>
            </div>
          )}

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col h-full"
              >
                <div className="text-[10px] uppercase tracking-[2px] text-text-dim mb-4">Classification</div>
                <h2 className="font-serif text-[32px] font-normal leading-tight mb-1">{result.plantName}</h2>
                <div className="font-serif italic text-accent text-base mb-8">{result.scientificName || "Specimen Identified"}</div>

                <div className="text-[10px] uppercase tracking-[2px] text-text-dim mb-4">Health Index</div>
                <div className="flex items-center gap-4 mb-8">
                  <div className={`px-3 py-1 rounded-full border text-xs uppercase tracking-[1px] flex items-center gap-2 ${getStatusColor(result.healthStatus)}`}>
                    {getStatusIcon(result.healthStatus)}
                    {result.healthStatus}
                  </div>
                </div>

                {result.growingConditions && (
                  <>
                    <div className="text-[10px] uppercase tracking-[2px] text-text-dim mb-4">Ideal Conditions</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                      <div className="border-t border-border pt-3">
                        <div className="text-[11px] text-text-dim uppercase tracking-[1px] mb-1">Light</div>
                        <div className="text-sm font-medium">{result.growingConditions.light}</div>
                      </div>
                      <div className="border-t border-border pt-3">
                        <div className="text-[11px] text-text-dim uppercase tracking-[1px] mb-1">Water</div>
                        <div className="text-sm font-medium">{result.growingConditions.water}</div>
                      </div>
                      <div className="border-t border-border pt-3">
                        <div className="text-[11px] text-text-dim uppercase tracking-[1px] mb-1">Soil</div>
                        <div className="text-sm font-medium">{result.growingConditions.soil}</div>
                      </div>
                    </div>
                  </>
                )}

                {result.issues && result.issues.length > 0 && (
                  <>
                    <div className="text-[10px] uppercase tracking-[2px] text-text-dim mb-4">Diagnostic Report</div>
                    <div className="bg-black/20 p-5 rounded-[4px] border-l-2 border-accent mb-8">
                      <ul className="space-y-3">
                        {result.issues.map((issue, idx) => (
                          <li key={idx} className="text-sm leading-[1.6] text-text-bright flex items-start gap-2">
                            <span className="text-accent mt-1 opacity-50">•</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {result.recommendations && result.recommendations.length > 0 && (
                  <>
                    <div className="text-[10px] uppercase tracking-[2px] text-text-dim mb-4">Action Protocol</div>
                    <div className="space-y-3 mb-8">
                      {result.recommendations.map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-3 border-t border-border pt-3">
                          <span className="text-[10px] font-mono text-text-dim">0{idx + 1}</span>
                          <span className="text-sm leading-[1.6] text-text-bright">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {result.careTips && result.careTips.length > 0 && (
                  <>
                    <div className="text-[10px] uppercase tracking-[2px] text-text-dim mb-4">Care Guidelines</div>
                    <div className="space-y-3 mb-8">
                      {result.careTips.map((tip, idx) => (
                        <div key={idx} className="flex items-start gap-3 border-t border-border pt-3">
                          <span className="text-[10px] font-mono text-text-dim">0{idx + 1}</span>
                          <span className="text-sm leading-[1.6] text-text-bright">{tip}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-[60px] border-t border-border flex items-center justify-between px-8 bg-bg shrink-0">
        <div className="flex gap-4">
          {(!capturedImage || result) ? (
            <div className="flex gap-3">
              <button
                onClick={capturedImage ? reset : captureImage}
                className="bg-accent text-bg px-6 py-2 rounded-full text-xs font-bold uppercase tracking-[1px] hover:bg-accent/90 transition-colors flex items-center gap-2"
              >
                {capturedImage ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    New Scan
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Capture Data
                  </>
                )}
              </button>
              {result && (
                <button
                  onClick={downloadReport}
                  className="bg-transparent border border-border text-text-bright px-6 py-2 rounded-full text-xs font-bold uppercase tracking-[1px] hover:bg-surface transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Save Report
                </button>
              )}
            </div>
          ) : (
             <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="bg-transparent border border-border text-text-bright px-6 py-2 rounded-full text-xs font-bold uppercase tracking-[1px] hover:bg-surface transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Discard
                </button>
                <button
                  onClick={analyzePlant}
                  disabled={isAnalyzing}
                  className="bg-accent text-bg px-6 py-2 rounded-full text-xs font-bold uppercase tracking-[1px] hover:bg-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <HeartPulse className="w-4 h-4" />
                  Run Diagnostics
                </button>
             </div>
          )}
        </div>

        <div className="hidden sm:flex gap-3">
          <div className="border border-border px-3 py-1 rounded-full text-[11px] text-text-dim uppercase tracking-[1px] font-mono">
            GPS: ONLINE
          </div>
          <div className="border border-border px-3 py-1 rounded-full text-[11px] text-text-dim uppercase tracking-[1px] font-mono">
            UPLINK: SECURE
          </div>
        </div>
      </footer>
    </div>
  );
}
