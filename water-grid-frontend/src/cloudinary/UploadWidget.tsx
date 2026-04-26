import { useEffect, useRef, useState } from 'react';
import { uploadPreset } from './config';

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  bytes: number;
  created_at: string;
}

interface UploadWidgetProps {
  onUploadSuccess?: (result: CloudinaryUploadResult) => void;
  onUploadError?: (error: Error) => void;
  buttonText?: string;
  className?: string;
}

interface CloudinaryWidgetResult {
  event: string;
  info: CloudinaryUploadResult;
}

interface CloudinaryWidgetError {
  message?: string;
}

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        config: Record<string, unknown>,
        callback: (error: CloudinaryWidgetError | null, result: CloudinaryWidgetResult | null) => void
      ) => { open: () => void };
    };
  }
}

export function UploadWidget({
  onUploadSuccess,
  onUploadError,
  buttonText = 'Upload Image',
  className = '',
}: UploadWidgetProps) {
  const widgetRef = useRef<{ open: () => void } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    function initializeWidget() {
      if (!mounted || typeof window.cloudinary?.createUploadWidget !== 'function') return;

      if (!uploadPreset) {
        console.warn(
          'VITE_CLOUDINARY_UPLOAD_PRESET is not set. ' +
          'Create an unsigned upload preset in your Cloudinary dashboard.'
        );
      }

      widgetRef.current = window.cloudinary.createUploadWidget(
        {
          cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
          uploadPreset: uploadPreset || undefined,
          sources: ['local', 'camera', 'url'],
          multiple: false,
        },
        (error: CloudinaryWidgetError | null, result: CloudinaryWidgetResult | null) => {
          if (error) {
            console.error('Upload error:', error);
            onUploadError?.(new Error(error.message || 'Upload failed'));
            return;
          }

          if (result && result.event === 'success') {
            console.log('Upload success:', result.info);
            onUploadSuccess?.(result.info);
          }
        }
      );

      setIsReady(true);
    }

    function isWidgetReady(): boolean {
      return typeof window.cloudinary?.createUploadWidget === 'function';
    }

    // Poll until createUploadWidget is available
    // Script should be in index.html, but poll handles any load timing
    poll = setInterval(() => {
      if (isWidgetReady()) {
        if (poll) clearInterval(poll);
        if (timeout) clearTimeout(timeout);
        initializeWidget();
      }
    }, 100);

    // Timeout after 10 seconds
    timeout = setTimeout(() => {
      if (poll) clearInterval(poll);
      if (mounted && !isWidgetReady()) {
        console.error('Upload widget script failed to load within 10 seconds');
        setScriptError(true);
      }
    }, 10000);

    // Check immediately in case script is already loaded
    if (isWidgetReady()) {
      if (poll) clearInterval(poll);
      if (timeout) clearTimeout(timeout);
      initializeWidget();
    }

    return () => {
      mounted = false;
      if (poll) clearInterval(poll);
      if (timeout) clearTimeout(timeout);
    };
  }, [onUploadSuccess, onUploadError]);

  const handleClick = () => {
    if (widgetRef.current) {
      widgetRef.current.open();
    } else if (!scriptError) {
      console.warn('Upload widget is still loading, please try again.');
    }
  };

  if (scriptError) {
    return (
      <div style={{ color: '#dc2626', fontSize: '0.875rem' }}>
        Upload widget failed to load. Please refresh the page or check your network connection.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isReady}
      className={className}
      style={{
        padding: '0.75rem 1.5rem',
        fontSize: '1rem',
        fontWeight: 500,
        color: 'white',
        backgroundColor: isReady ? '#6366f1' : '#9ca3af',
        border: 'none',
        borderRadius: '0.5rem',
        cursor: isReady ? 'pointer' : 'wait',
        transition: 'background-color 0.2s',
        opacity: isReady ? 1 : 0.7,
      }}
      onMouseEnter={(e) => {
        if (isReady) e.currentTarget.style.backgroundColor = '#4f46e5';
      }}
      onMouseLeave={(e) => {
        if (isReady) e.currentTarget.style.backgroundColor = '#6366f1';
      }}
    >
      {isReady ? buttonText : 'Loading...'}
    </button>
  );
}
