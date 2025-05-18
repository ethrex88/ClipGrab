import type { LucideProps } from "lucide-react";
import { Youtube, Instagram, Twitter, Ghost, MessageCircle, Link as LinkIcon, Clapperboard } from "lucide-react";

interface PlatformIconProps extends LucideProps {
  platform?: string | null;
}

const PlatformIcon: React.FC<PlatformIconProps> = ({ platform, className, ...props }) => {
  const platformLower = platform?.toLowerCase() || "";

  if (platformLower.includes("youtube")) {
    return <Youtube className={cn("text-red-600", className)} {...props} />;
  }
  if (platformLower.includes("instagram")) {
    return <Instagram className={cn("text-pink-600", className)} {...props} />;
  }
  if (platformLower.includes("twitter") || platformLower.includes("x.com")) {
    return <Twitter className={cn("text-blue-500", className)} {...props} />;
  }
  if (platformLower.includes("reddit")) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-orange-500", className)}
        {...props}
      >
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.263 15.24c-.404.404-1.03.605-1.657.605-.627 0-1.253-.201-1.657-.605-.038-.038-.079-.069-.11-.107-.242-.242-.242-.627 0-.87.242-.242.627-.242.87 0 .015.015.03.03.046.046.31.31.833.31 1.144 0 .31-.31.31-.833 0-1.144l.001.001c.201-.201.442-.302.683-.302s.482.101.683.302c.31.31.31.833 0 1.144a.63.63 0 0 1-.046.046zm-6.526 0c-.404.404-1.03.605-1.657.605-.627 0-1.253-.201-1.657-.605-.038-.038-.079-.069-.11-.107-.242-.242-.242-.627 0-.87.242-.242.627-.242.87 0 .015.015.03.03.046.046.31.31.833.31 1.144 0 .31-.31.31-.833 0-1.144l.001.001c.201-.201.442-.302.683-.302s.482.101.683.302c.31.31.31.833 0 1.144a.63.63 0 0 1-.046.046zM12 6.5c-1.75 0-3.204 1.114-3.773 2.668-.095.258.026.544.284.639.258.095.544-.026.639-.284.42-1.148 1.56-1.923 2.85-1.923s2.43 1.148 2.85 1.923c.095.258.38.379.639.284.258-.095.379-.38.284-.639C15.204 7.614 13.75 6.5 12 6.5zm5.25 5.454c0-.201-.068-.387-.201-.533-.133-.148-.318-.216-.5-.216h-1.6c-.379 0-.698.302-.698.683v1.6c0 .38.318.683.698.683h1.6c.182 0 .367-.068.5-.216.133-.148.201-.333.201-.533v-.75zm-10.5 0c0-.201-.068-.387-.201-.533-.133-.148-.318-.216-.5-.216h-1.6c-.379 0-.698.302-.698.683v1.6c0 .38.318.683.698.683h1.6c.182 0 .367-.068.5-.216.133-.148.201-.333.201-.533v-.75z"/>
      </svg>
    );
  }
  if (platformLower.includes("snapchat")) {
    return <Ghost className={cn("text-yellow-400", className)} {...props} />;
  }
  if (platformLower.includes("discord")) {
    return <MessageCircle className={cn("text-indigo-500", className)} {...props} />;
  }
  if (platform) { // If platform is specified but not matched, show a generic video icon
    return <Clapperboard className={cn("text-foreground", className)} {...props} />;
  }

  return <LinkIcon className={cn("text-muted-foreground", className)} {...props} />;
};

// Helper cn function (can be imported from @/lib/utils if preferred for consistency)
function cn(...inputs: Array<string | undefined | null | boolean>): string {
  return inputs.filter(Boolean).join(' ');
}


export default PlatformIcon;
