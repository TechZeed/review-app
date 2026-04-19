import { useState } from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: AvatarSize;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
};

function initialsFrom(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Avatar({ name, photoUrl, size = 'md' }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const sizeClass = SIZE_CLASSES[size];
  const showImage = Boolean(photoUrl) && !broken;

  if (showImage) {
    return (
      <img
        src={photoUrl as string}
        alt={name}
        className={`${sizeClass} rounded-full object-cover bg-gray-100`}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold`}
      aria-label={name}
    >
      {initialsFrom(name)}
    </div>
  );
}
