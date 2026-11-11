import React from 'react';

interface AvatarProps {
  name?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ name, url, size = 40, className = '' }: AvatarProps) {
  return (
    <div 
      style={{ width: size, height: size }} 
      className={`relative overflow-hidden rounded-full bg-muted flex items-center justify-center ${className}`}
    >
      {url ? (
        <img src={url} alt={name || 'Avatar'} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-semibold text-muted-foreground">
          {name ? name.charAt(0).toUpperCase() : '?'}
        </span>
      )}
    </div>
  );
}

export default Avatar;

