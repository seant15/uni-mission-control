import { useRef, useState, useCallback } from 'react'
import { Paperclip, X, Upload, Video } from 'lucide-react'

export interface PendingFile {
  file: File
  previewUrl?: string  // object URL for images
}

interface Props {
  files: PendingFile[]
  onChange: (files: PendingFile[]) => void
  disabled?: boolean
}

const MAX_FILES = 5
const MAX_SIZE_MB = 50
const ACCEPTED_TYPES = ['image/', 'video/mp4', 'video/webm', 'video/quicktime']

function isAccepted(file: File) {
  return ACCEPTED_TYPES.some(t => file.type.startsWith(t))
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FeedbackAttachmentZone({ files, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = useCallback((incoming: File[]) => {
    setError(null)
    const valid: PendingFile[] = []
    for (const f of incoming) {
      if (files.length + valid.length >= MAX_FILES) {
        setError(`Max ${MAX_FILES} files allowed.`)
        break
      }
      if (!isAccepted(f)) {
        setError(`"${f.name}" is not an accepted file type.`)
        continue
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`"${f.name}" exceeds ${MAX_SIZE_MB} MB.`)
        continue
      }
      valid.push({
        file: f,
        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
      })
    }
    if (valid.length) onChange([...files, ...valid])
  }, [files, onChange])

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index)
    // Revoke object URL to avoid memory leak
    if (files[index].previewUrl) URL.revokeObjectURL(files[index].previewUrl!)
    onChange(updated)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    addFiles(Array.from(e.dataTransfer.files))
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors
          ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <Upload size={16} className="text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-500">
          Drag & drop or <span className="text-blue-600 font-medium">browse</span>
          {' '}— images & video, up to {MAX_FILES} files, {MAX_SIZE_MB} MB each
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm,video/quicktime"
          onChange={onInputChange}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((pf, i) => (
            <li key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              {pf.previewUrl ? (
                <img
                  src={pf.previewUrl}
                  alt={pf.file.name}
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                  {pf.file.type.startsWith('video/') ? (
                    <Video size={14} className="text-gray-500" />
                  ) : (
                    <Paperclip size={14} className="text-gray-500" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{pf.file.name}</p>
                <p className="text-xs text-gray-400">{fmtSize(pf.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeFile(i) }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                aria-label={`Remove ${pf.file.name}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
