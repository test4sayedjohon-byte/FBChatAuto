export interface ScheduledPost {
  id: string;
  user_id: string;
  page_connection_id: string;
  platform: string;
  post_type: string;
  message: string | null;
  media_urls: string[] | null;
  scheduled_time: string;
  status: string;
  meta_post_id: string | null;
  error_message: string | null;
  first_comments?: string[] | null;
}

export interface PageConn {
  id: string;
  page_id: string;
  page_name: string;
  platform: string;
}

export interface PostMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions?: number;
  reach?: number;
  engagement?: number;
}
