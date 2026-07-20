export type ContentType =
  | "text"
  | "url"
  | "email"
  | "phone"
  | "file_path"
  | "secret"
  | "social"
  | "code";

export interface ClipboardItem {
  id: string;
  content: string;
  content_type: ContentType;
  app_name: string | null;
  is_favorite: boolean;
  created_at: number;
  char_count: number;
}

export interface Collection {
  id: string;
  name: string;
  color: string | null;
  created_at: number;
  item_count: number;
}

export interface TypeCount {
  content_type: ContentType;
  count: number;
}

export interface Stats {
  total: number;
  favorites: number;
  by_type: TypeCount[];
}

export interface DayCount {
  day: string;
  count: number;
}

export interface MonitoringState {
  paused: boolean;
  paused_until: number | null;
  paused_indefinite: boolean;
  incognito_next: boolean;
}
