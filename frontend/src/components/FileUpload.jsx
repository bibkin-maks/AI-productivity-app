import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useUploadDocumentMutation, useRemoveDocumentMutation } from "../slices/apiSlice";

export default function FileUpload({ className = "", showAskQuestion = true, navigateTo = "", variant = "card" }) {
  const { user, refreshUser } = useAuth();
  const [uploadDocument, { isLoading: isUploading }] = useUploadDocumentMutation();
  const [removeDocument, { isLoading: isRemoving }] = useRemoveDocumentMutation();
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const storedFileName = user?.document?.name || null;

  const onDrop = async (accepted, rejected) => {
    setError("");
    if (rejected?.length) {
      setError("That file isn't supported. Upload a PDF of up to 20 MB.");
      return;
    }
    const file = accepted[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      await uploadDocument(formData).unwrap();
    } catch (err) {
      setError(err?.data?.detail || "Upload failed. Please try again.");
      return;
    }
    await refreshUser();

    if (navigateTo !== "") {
      navigate(navigateTo);
    }
  }

  const handleRemove = async () => {
    setError("");
    try {
      await removeDocument().unwrap();
    } catch {
      setError("Couldn't remove the document. Please try again.");
      return;
    }
    await refreshUser();
  }

  // Dropzone config
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },  // the backend accepts PDFs only
    maxSize: 20 * 1024 * 1024,                 // …up to 20 MB
    maxFiles: 1,
    onDrop,
    disabled: !!storedFileName || isUploading,
  });

  // Dashboard document panel (styles in components/app/app.css)
  if (variant === "app") {
    if (storedFileName) {
      const ext = storedFileName.split(".").pop()?.slice(0, 4).toUpperCase() || "DOC";
      return (
        <div className={`app-card ${className}`}>
          <p className="app-label">Active document</p>
          <div className="flex items-center gap-4 mt-4">
            <span className="doc-file-icon" aria-hidden="true">{ext}</span>
            <div className="min-w-0">
              <p className="font-semibold text-lg leading-tight [overflow-wrap:anywhere]">{storedFileName}</p>
              <span className="app-tag app-tag--low inline-block mt-2">Ready</span>
            </div>
          </div>
          <button type="button" className="app-button w-full mt-5" onClick={handleRemove} disabled={isRemoving}>
            {isRemoving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {isRemoving ? "Removing…" : "Remove document"}
          </button>
          {error && <p className="text-sm mt-3 text-[var(--app-high)]" role="alert">{error}</p>}
        </div>
      );
    }
    return (
      <div className={className}>
        <div {...getRootProps()} className="doc-drop" data-active={isDragActive}>
          <input {...getInputProps()} aria-label="Upload a document" />
          {isUploading ? (
            <>
              <Loader2 size={28} className="animate-spin text-[var(--app-signal)]" />
              <p className="text-2xl font-light leading-tight">Reading your document…</p>
              <p className="app-muted text-sm">Large PDFs can take a minute.</p>
            </>
          ) : (
            <>
              <FileUp size={28} className="text-[var(--app-signal)]" />
              <p className="text-3xl font-light leading-tight">
                {isDragActive ? "Drop to upload" : <>Drop a PDF<br />or click to browse</>}
              </p>
              <p className="app-label">PDF · max 20 MB</p>
            </>
          )}
        </div>
        {error && <p className="text-sm mt-3 text-[var(--app-high)]" role="alert">{error}</p>}
      </div>
    );
  }

  // Oversized type-only dropzone used by the home page (styles in pages/home.css)
  if (variant === "statement") {
    return (
      <div {...getRootProps()} className={`home-drop ${isDragActive ? "is-active" : ""} ${className}`}>
        <input {...getInputProps()} />
        {!storedFileName ? (
          <>
            <span className="home-drop__underline">
              {isDragActive ? "Drop to upload!" : "Drop a PDF here to start chatting"}
            </span>
            <span className="home-label block mt-8">or click to upload · PDF up to 20 MB</span>
          </>
        ) : (
          <>
            <span className="home-drop__underline">{storedFileName}</span>
            <span className="flex flex-wrap gap-4 mt-8">
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                className="home-btn home-btn--ghost"
              >
                Remove
              </button>
              {showAskQuestion && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate("/chat"); }}
                  className="home-btn home-btn--solid"
                >
                  Start Chat <span className="home-btn__arrow">→</span>
                </button>
              )}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`
        group relative
        flex flex-col justify-center items-center
        transition-all duration-500 ease-out cursor-pointer 
        backdrop-blur-xl rounded-2xl max-w-lg mx-auto text-white
        font-[Montserrat]
        border-2 border-dashed
        overflow-hidden
        ${isDragActive
          ? "border-purple-400 bg-purple-500/10 shadow-[0_0_50px_rgba(168,85,247,0.3)] scale-[1.02]"
          : storedFileName
            ? "border-emerald-400/50 bg-emerald-500/5"
            : "border-slate-500/30 bg-white/5 hover:bg-purple-900/5 hover:border-purple-400/50 hover:shadow-[0_0_40px_rgba(168,85,247,0.15)]"
        }
        ${className}
      `}
    >
      <input {...getInputProps()} />

      {!storedFileName ? (
        <div className="flex flex-col items-center z-10 p-8 space-y-5">
          {/* Animated Icon */}
          <div className={`
             w-16 h-16 rounded-full flex items-center justify-center
             bg-gradient-to-br from-purple-500/20 to-blue-500/20
             border border-white/10
             transition-transform duration-500 group-hover:scale-110
             ${isDragActive ? "animate-bounce" : ""}
          `}>
            <svg
              className={`w-8 h-8 text-purple-300 transition-all duration-300 group-hover:text-purple-200 ${!isDragActive && "group-hover:-translate-y-1"}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-medium tracking-tight text-white group-hover:text-purple-100 transition-colors">
              {isDragActive ? "Drop to upload!" : "Drop a PDF here to start chatting"}
            </p>
            <p className="text-sm text-slate-400">
              or click to upload (max 20 MB)
            </p>
          </div>

          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-500 font-semibold pt-2">
            <span>PDF</span>
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            <span>up to 100 pages</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 space-y-6 w-full h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-2xl">
              📄
            </div>
            <p className="text-sm font-medium text-emerald-100/90 truncate max-w-[280px]">
              {storedFileName}
            </p>
          </div>

          <div className="flex gap-3 w-full max-w-[280px]">
            <button
              onClick={(e) => { e.stopPropagation(); handleRemove(); }}
              className="flex-1 py-2.5 rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10 transition text-xs font-semibold uppercase tracking-wide"
            >
              Remove
            </button>

            {showAskQuestion && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate("/chat"); }}
                className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 transition text-xs font-bold uppercase tracking-wide"
              >
                Start Chat
              </button>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
