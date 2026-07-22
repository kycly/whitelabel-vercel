"use client";

import Image from "next/image";

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
      >
        ✕
      </button>
      <Image
        src={src}
        alt={alt}
        width={800}
        height={800}
        unoptimized
        className="max-h-full max-w-full rounded-2xl object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
