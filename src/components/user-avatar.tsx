import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  className?: string;
  iconClassName?: string;
}

export function UserAvatar({ src, name, className, iconClassName }: UserAvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden bg-slate-900 text-white",
        className,
      )}
      aria-label={name ? `Perfil de ${name}` : "Perfil sem foto"}
    >
      {src ? (
        <img
          src={src}
          alt={name ? `Foto de ${name}` : "Foto de perfil"}
          className="h-full w-full object-cover"
        />
      ) : (
        <UserRound className={cn("h-1/2 w-1/2", iconClassName)} aria-hidden="true" />
      )}
    </span>
  );
}
