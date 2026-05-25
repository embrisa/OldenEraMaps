export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      maps: {
        Row: {
          id: string;
          owner_id: string;
          slug: string;
          title: string;
          author_name: string | null;
          description: string;
          visibility: "public" | "unlisted" | "private";
          status: "draft" | "published" | "hidden" | "rejected";
          map_width: number;
          map_height: number;
          player_count: number;
          zone_count: number;
          connection_count: number;
          win_condition: string;
          terrain_theme: string | null;
          template_name: string;
          template_json: Json;
          design_json: Json;
          preview_image_path: string | null;
          preview_image_url: string | null;
          preview_thumbnail_path: string | null;
          preview_thumbnail_url: string | null;
          preview_image_width: number | null;
          preview_image_height: number | null;
          preview_thumbnail_width: number | null;
          preview_thumbnail_height: number | null;
          preview_design_json: Json;
          preview_renderer_version: number;
          template_sha256: string;
          upload_warnings: Json;
          factual_metadata: Json;
          download_count: number;
          rating_count: number;
          rating_average: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          slug: string;
          title: string;
          author_name?: string | null;
          description: string;
          visibility: "public" | "unlisted" | "private";
          status: "draft" | "published" | "hidden" | "rejected";
          map_width: number;
          map_height: number;
          player_count: number;
          zone_count: number;
          connection_count: number;
          win_condition: string;
          terrain_theme?: string | null;
          template_name: string;
          template_json: Json;
          design_json: Json;
          preview_image_path?: string | null;
          preview_image_url?: string | null;
          preview_thumbnail_path?: string | null;
          preview_thumbnail_url?: string | null;
          preview_image_width?: number | null;
          preview_image_height?: number | null;
          preview_thumbnail_width?: number | null;
          preview_thumbnail_height?: number | null;
          preview_design_json: Json;
          preview_renderer_version?: number;
          template_sha256: string;
          upload_warnings?: Json;
          factual_metadata?: Json;
          download_count?: number;
          rating_count?: number;
          rating_average?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          slug?: string;
          title?: string;
          author_name?: string | null;
          description?: string;
          visibility?: "public" | "unlisted" | "private";
          status?: "draft" | "published" | "hidden" | "rejected";
          map_width?: number;
          map_height?: number;
          player_count?: number;
          zone_count?: number;
          connection_count?: number;
          win_condition?: string;
          terrain_theme?: string | null;
          template_name?: string;
          template_json?: Json;
          design_json?: Json;
          preview_image_path?: string | null;
          preview_image_url?: string | null;
          preview_thumbnail_path?: string | null;
          preview_thumbnail_url?: string | null;
          preview_image_width?: number | null;
          preview_image_height?: number | null;
          preview_thumbnail_width?: number | null;
          preview_thumbnail_height?: number | null;
          preview_design_json?: Json;
          preview_renderer_version?: number;
          template_sha256?: string;
          upload_warnings?: Json;
          factual_metadata?: Json;
          download_count?: number;
          rating_count?: number;
          rating_average?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maps_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maps_owner_id_profiles_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      tags: {
        Row: {
          id: string;
          slug: string;
          label: string;
          kind: "factual" | "descriptive";
          category: string;
          constraints: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          label: string;
          kind: "factual" | "descriptive";
          category: string;
          constraints?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          label?: string;
          kind?: "factual" | "descriptive";
          category?: string;
          constraints?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      map_tags: {
        Row: {
          map_id: string;
          tag_id: string;
          source: "factual" | "descriptive";
        };
        Insert: {
          map_id: string;
          tag_id: string;
          source: "factual" | "descriptive";
        };
        Update: {
          map_id?: string;
          tag_id?: string;
          source?: "factual" | "descriptive";
        };
        Relationships: [
          {
            foreignKeyName: "map_tags_map_id_fkey";
            columns: ["map_id"];
            isOneToOne: false;
            referencedRelation: "maps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          }
        ];
      };
      ratings: {
        Row: {
          map_id: string;
          user_id: string;
          value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          map_id: string;
          user_id: string;
          value: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          map_id?: string;
          user_id?: string;
          value?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      downloads: {
        Row: {
          id: string;
          map_id: string;
          user_id: string | null;
          anonymous_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          map_id: string;
          user_id?: string | null;
          anonymous_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          map_id?: string;
          user_id?: string | null;
          anonymous_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      rate_map: {
        Args: { p_map_id: string; p_value: number };
        Returns: undefined;
      };
      record_download: {
        Args: { p_map_id: string; p_anonymous_id?: string | null };
        Returns: undefined;
      };
      get_viewer_rating: {
        Args: { p_map_id: string };
        Returns: number | null;
      };
      public_browse_maps: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          owner_id: string | null;
          slug: string;
          title: string;
          description: string;
          visibility: "public";
          map_width: number;
          map_height: number;
          player_count: number;
          zone_count: number;
          connection_count: number;
          win_condition: string;
          template_name: string;
          preview_design_json: Json;
          preview_renderer_version: number;
          download_count: number;
          rating_count: number;
          rating_average: number;
          created_at: string;
          updated_at: string;
          author_name: string;
          tags: Json;
        }[];
      };
      public_map_detail: {
        Args: { p_map_id: string };
        Returns: {
          id: string;
          owner_id: string | null;
          slug: string;
          title: string;
          description: string;
          visibility: "public";
          map_width: number;
          map_height: number;
          player_count: number;
          zone_count: number;
          connection_count: number;
          win_condition: string;
          template_name: string;
          template_json: Json;
          design_json: Json;
          preview_design_json: Json;
          preview_renderer_version: number;
          download_count: number;
          rating_count: number;
          rating_average: number;
          created_at: string;
          updated_at: string;
          author_name: string;
          tags: Json;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
