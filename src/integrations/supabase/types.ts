export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      calls: {
        Row: {
          callee_id: string | null
          caller_id: string
          conversation_id: string | null
          created_at: string
          duration_seconds: number
          id: string
          is_video: boolean
          status: string
          kind: string
          started_at: string | null
          ended_at: string | null
        }
        Insert: {
          callee_id?: string | null
          caller_id: string
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          is_video?: boolean
          status?: string
          kind?: string
          started_at?: string | null
          ended_at?: string | null
        }
        Update: {
          callee_id?: string | null
          caller_id?: string
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          is_video?: boolean
          status?: string
          kind?: string
          started_at?: string | null
          ended_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_blocked: boolean
          is_favorite: boolean
          nickname: string | null
          owner_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_blocked?: boolean
          is_favorite?: boolean
          nickname?: string | null
          owner_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_blocked?: boolean
          is_favorite?: boolean
          nickname?: string | null
          owner_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_admin: boolean
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_admin?: boolean
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_admin?: boolean
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          community_id: string | null
          created_at: string
          created_by: string
          description: string | null
          disappearing_seconds: number
          id: string
          is_group: boolean
          is_locked: boolean
          kind: string
          last_message_at: string
          title: string | null
        }
        Insert: {
          avatar_url?: string | null
          community_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          disappearing_seconds?: number
          id?: string
          is_group?: boolean
          is_locked?: boolean
          kind?: string
          last_message_at?: string
          title?: string | null
        }
        Update: {
          avatar_url?: string | null
          community_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          disappearing_seconds?: number
          id?: string
          is_group?: boolean
          is_locked?: boolean
          kind?: string
          last_message_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          conversation_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_stars: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_stars_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_stars_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          encrypted_body: string | null
          encryption_iv: string | null
          encryption_version: number
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          expires_at: string | null
          id: string
          is_ai: boolean
          kind: string
          media_url: string | null
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          encrypted_body?: string | null
          encryption_iv?: string | null
          encryption_version?: number
          encrypted_body?: string | null
          encryption_iv?: string | null
          encryption_version?: number
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          is_ai?: boolean
          kind?: string
          media_url?: string | null
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          is_ai?: boolean
          kind?: string
          media_url?: string | null
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_contacts: {
        Row: {
          created_at: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          about: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_online: boolean
          last_seen: string
          last_seen_privacy: string
          photo_privacy: string
          read_receipts: boolean
          status_privacy: string
          updated_at: string
          username: string | null
          wallpaper: string
        }
        Insert: {
          about?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          is_online?: boolean
          last_seen?: string
          last_seen_privacy?: string
          photo_privacy?: string
          read_receipts?: boolean
          status_privacy?: string
          updated_at?: string
          username?: string | null
          wallpaper?: string
        }
        Update: {
          about?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_online?: boolean
          last_seen?: string
          last_seen_privacy?: string
          photo_privacy?: string
          read_receipts?: boolean
          status_privacy?: string
          updated_at?: string
          username?: string | null
          wallpaper?: string
        }
        Relationships: []
      }
      status_views: {
        Row: {
          id: string
          status_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          status_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          status_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_views_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          background: string | null
          caption: string | null
          content: string | null
          created_at: string
          duration_seconds: number
          expires_at: string
          id: string
          kind: string
          media_url: string | null
          user_id: string
        }
        Insert: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          duration_seconds?: number
          expires_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          user_id: string
        }
        Update: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          duration_seconds?: number
          expires_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
      call_signals: {
        Row: { id: string; call_id: string; sender_id: string; recipient_id: string; signal_type: string; payload: Json; created_at: string }
        Insert: { id?: string; call_id: string; sender_id: string; recipient_id: string; signal_type: string; payload?: Json; created_at?: string }
        Update: { id?: string; call_id?: string; sender_id?: string; recipient_id?: string; signal_type?: string; payload?: Json; created_at?: string }
        Relationships: []
      }
      push_subscriptions: {
        Row: { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; user_agent: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; endpoint: string; p256dh: string; auth: string; user_agent?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; endpoint?: string; p256dh?: string; auth?: string; user_agent?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      device_keys: {
        Row: { user_id: string; public_key: Json; algorithm: string; updated_at: string }
        Insert: { user_id: string; public_key: Json; algorithm?: string; updated_at?: string }
        Update: { user_id?: string; public_key?: Json; algorithm?: string; updated_at?: string }
        Relationships: []
      }
      communities: {
        Row: { id: string; name: string; description: string | null; avatar_url: string | null; owner_id: string; announcement_conversation_id: string | null; created_at: string }
        Insert: { id?: string; name: string; description?: string | null; avatar_url?: string | null; owner_id: string; announcement_conversation_id?: string | null; created_at?: string }
        Update: { id?: string; name?: string; description?: string | null; avatar_url?: string | null; owner_id?: string; announcement_conversation_id?: string | null; created_at?: string }
        Relationships: []
      }
      community_conversations: {
        Row: { community_id: string; conversation_id: string; created_at: string }
        Insert: { community_id: string; conversation_id: string; created_at?: string }
        Update: { community_id?: string; conversation_id?: string; created_at?: string }
        Relationships: []
      }
      community_members: {
        Row: { community_id: string; user_id: string; role: string; joined_at: string }
        Insert: { community_id: string; user_id: string; role?: string; joined_at?: string }
        Update: { community_id?: string; user_id?: string; role?: string; joined_at?: string }
        Relationships: []
      }
      channels: {
        Row: { id: string; conversation_id: string; handle: string; category: string | null; is_public: boolean; follower_count: number; created_at: string }
        Insert: { id?: string; conversation_id: string; handle: string; category?: string | null; is_public?: boolean; follower_count?: number; created_at?: string }
        Update: { id?: string; conversation_id?: string; handle?: string; category?: string | null; is_public?: boolean; follower_count?: number; created_at?: string }
        Relationships: []
      }
      channel_followers: {
        Row: { channel_id: string; user_id: string; notifications_enabled: boolean; created_at: string }
        Insert: { channel_id: string; user_id: string; notifications_enabled?: boolean; created_at?: string }
        Update: { channel_id?: string; user_id?: string; notifications_enabled?: boolean; created_at?: string }
        Relationships: []
      }

