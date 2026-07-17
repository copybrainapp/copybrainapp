import { AlignLeft, FileText, Link2, Mail, Phone } from "lucide-react";
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
};
