import { Share2 } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import {
  DiscordIcon,
  FacebookIcon,
  InstagramIcon,
  PinterestIcon,
  RedditIcon,
  SnapchatIcon,
  TelegramIcon,
  ThreadsIcon,
  TiktokIcon,
  TwitchIcon,
  WhatsappIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/icons/social-icons";

export interface SocialPlatform {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const SOCIAL_PLATFORMS: { hosts: string[]; platform: SocialPlatform }[] = [
  { hosts: ["instagram.com"], platform: { label: "Instagram", icon: InstagramIcon } },
  { hosts: ["youtube.com", "youtu.be"], platform: { label: "YouTube", icon: YoutubeIcon } },
  { hosts: ["tiktok.com"], platform: { label: "TikTok", icon: TiktokIcon } },
  { hosts: ["x.com", "twitter.com"], platform: { label: "X", icon: XIcon } },
  { hosts: ["facebook.com", "fb.com", "fb.watch"], platform: { label: "Facebook", icon: FacebookIcon } },
  { hosts: ["pinterest.com", "pin.it"], platform: { label: "Pinterest", icon: PinterestIcon } },
  { hosts: ["snapchat.com"], platform: { label: "Snapchat", icon: SnapchatIcon } },
  { hosts: ["reddit.com"], platform: { label: "Reddit", icon: RedditIcon } },
  { hosts: ["t.me", "telegram.me", "telegram.org"], platform: { label: "Telegram", icon: TelegramIcon } },
  { hosts: ["whatsapp.com", "wa.me"], platform: { label: "WhatsApp", icon: WhatsappIcon } },
  { hosts: ["discord.com", "discord.gg"], platform: { label: "Discord", icon: DiscordIcon } },
  { hosts: ["twitch.tv"], platform: { label: "Twitch", icon: TwitchIcon } },
  { hosts: ["threads.net"], platform: { label: "Threads", icon: ThreadsIcon } },
];

// Domains classified as "social" that don't have a licensed brand icon
// available (e.g. LinkedIn's mark was pulled from our icon source) fall
// back to this generic icon while staying in the Social category.
const GENERIC_SOCIAL: SocialPlatform = { label: "Social", icon: Share2 };

export function detectSocialPlatform(url: string): SocialPlatform {
  let hostname: string;
  try {
    hostname = new URL(
      /^https?:\/\//i.test(url) ? url : `https://${url}`
    ).hostname.toLowerCase();
  } catch {
    return GENERIC_SOCIAL;
  }

  const match = SOCIAL_PLATFORMS.find(({ hosts }) =>
    hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
  );
  return match?.platform ?? GENERIC_SOCIAL;
}
