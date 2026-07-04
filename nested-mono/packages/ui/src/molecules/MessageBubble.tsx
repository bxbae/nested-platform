import * as React from "react";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "../lib/cn";
import { Avatar } from "../atoms/Avatar";

export interface MessageBubbleProps {
  body?: string;
  imageUrl?: string;
  timestamp: string; // formatted, e.g. "오후 2:14"
  mine?: boolean;
  read?: boolean;
  author?: { name: string; src?: string };
  showAvatar?: boolean;
}

// Message row: avatar (for peer), bubble, timestamp, and a read receipt
// (single tick = sent, double = read) shown only on my own messages.
export function MessageBubble({
  body,
  imageUrl,
  timestamp,
  mine = false,
  read = false,
  author,
  showAvatar = true,
}: MessageBubbleProps) {
  return (
    <div className={cn("flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row")}>
      {!mine && showAvatar && author && (
        <Avatar size="sm" name={author.name} src={author.src} />
      )}
      {!mine && showAvatar && !author && <div className="w-8" />}

      <div className={cn("flex max-w-[76%] flex-col gap-1", mine ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-[0.95rem]",
            mine
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-surface-2 text-foreground rounded-bl-sm"
          )}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="max-h-64 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <span className="whitespace-pre-wrap break-words">{body}</span>
          )}
        </div>

        <div
          className={cn(
            "flex items-center gap-1 px-1 text-[11px] text-muted-foreground",
            mine ? "flex-row-reverse" : "flex-row"
          )}
        >
          <time>{timestamp}</time>
          {mine &&
            (read ? (
              <CheckCheck className="h-3.5 w-3.5 text-secondary" aria-label="읽음" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-label="전송됨" />
            ))}
        </div>
      </div>
    </div>
  );
}
