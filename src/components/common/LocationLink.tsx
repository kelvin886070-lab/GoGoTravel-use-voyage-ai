//這是顯示地點並可點擊的連結
import React from 'react';
import { MapPin as MapPinIcon, ExternalLink } from 'lucide-react';

export const LocationLink: React.FC<{ location?: string }> = ({ location }) => {
    if (!location) return null;
    return (
        <a 
            href={`http://googleusercontent.com/maps.google.com/search?api=1&query=${encodeURIComponent(location)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()} 
            className="flex items-center gap-1 text-sm font-bold text-[#45846D] hover:underline mt-1 w-fit group py-1"
        >
            <MapPinIcon className="w-4 h-4 fill-current" />
            <span className="truncate max-w-[250px]">{location}</span>
            <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        </a>
    );
};