import { useState, useRef } from "react";
import { Play, Pause } from "lucide-react";

export function ImageMessage({
  imageUrl,
  onImageClick,
}: {
  imageUrl: string;
  onImageClick: (imageUrl: string) => void;
}) {
  return (
    <img
      src={imageUrl}
      alt="Shared image"
      className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
      onClick={(e) => {
        e.stopPropagation(); // Prevent triggering reaction picker
        onImageClick(imageUrl);
      }}
    />
  );
}

export function AudioMessage({ audioUrl }: { audioUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnd = () => {
    setIsPlaying(false);
  };

  return (
    <div
      className="flex items-center gap-3 min-w-[200px]"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={togglePlay}
        className="btn btn-circle btn-sm text-white hover:opacity-90"
        style={{ backgroundColor: "#503460" }}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-1 rounded-full"
            style={{ backgroundColor: "#503460" }}
          ></div>
          <div
            className="w-6 h-1 rounded-full"
            style={{ backgroundColor: "#503460" }}
          ></div>
          <div
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: "#503460" }}
          ></div>
          <div
            className="w-4 h-1 rounded-full"
            style={{ backgroundColor: "#503460" }}
          ></div>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={handleAudioEnd}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
    </div>
  );
}