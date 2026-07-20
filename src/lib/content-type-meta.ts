import {
  AlignLeft,
  Code2,
  FileText,
  KeyRound,
  Link2,
  Mail,
  Phone,
  Share2,
} from "lucide-react";
import type { ContentType } from "@/types";

export const contentTypeMeta: Record<
  ContentType,
  { label: string; icon: typeof AlignLeft }
> = {
  text: { label: "Text", icon: AlignLeft },
  url: { label: "Link", icon: Link2 },
  email: { label: "Email", icon: Mail },
  phone: { label: "Phone", icon: Phone },
  file_path: { label: "File path", icon: FileText },
  secret: { label: "Secret", icon: KeyRound },
  social: { label: "Social", icon: Share2 },
  code: { label: "Code", icon: Code2 },
};

// Dev and production builds share the same local database, so an item can
// carry a content_type a given build doesn't recognize yet (e.g. captured by
// a newer build, or an older one running against a newer schema). Falling
// back to the "text" entry keeps that from crashing the icon lookup.
export function getContentTypeMeta(contentType: ContentType) {
  return contentTypeMeta[contentType] ?? contentTypeMeta.text;
}
