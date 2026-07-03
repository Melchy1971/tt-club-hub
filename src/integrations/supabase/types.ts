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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      board_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          member_id: string | null
          notes: string | null
          position: string
          term_end: string | null
          term_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          member_id?: string | null
          notes?: string | null
          position: string
          term_end?: string | null
          term_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          member_id?: string | null
          notes?: string | null
          position?: string
          term_end?: string | null
          term_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      club_settings: {
        Row: {
          association: string | null
          chairman: string | null
          city: string | null
          club_name: string
          club_number: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          logo_url: string | null
          primary_color: string | null
          street: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          association?: string | null
          chairman?: string | null
          city?: string | null
          club_name?: string
          club_number?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          street?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          association?: string | null
          chairman?: string | null
          city?: string | null
          club_name?: string
          club_number?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          street?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      communication_list_members: {
        Row: {
          created_at: string
          id: string
          list_id: string
          member_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          member_id: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "communication_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_list_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_lists: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          list_type: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          list_type?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          list_type?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      consent_audit_log: {
        Row: {
          action: string
          consent_type: string
          created_at: string
          id: string
          member_id: string
          performed_by: string
        }
        Insert: {
          action: string
          consent_type: string
          created_at?: string
          id?: string
          member_id: string
          performed_by: string
        }
        Update: {
          action?: string
          consent_type?: string
          created_at?: string
          id?: string
          member_id?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_audit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          created_at: string
          id: string
          member_id: string
          reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      match_availability: {
        Row: {
          created_at: string
          id: string
          match_id: string
          member_id: string
          note: string | null
          status: string
          team_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          member_id: string
          note?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          member_id?: string
          note?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_availability_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "schedule_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_availability_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineup: {
        Row: {
          created_at: string
          id: string
          is_substitute: boolean
          match_id: string
          member_id: string
          position: number
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_substitute?: boolean
          match_id: string
          member_id: string
          position?: number
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_substitute?: boolean
          match_id?: string
          member_id?: string
          position?: number
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineup_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "schedule_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_documents: {
        Row: {
          created_at: string
          file_url: string
          id: string
          meeting_id: string
          title: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          meeting_id: string
          title: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          meeting_id?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_documents_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          location: string | null
          meeting_date: string
          meeting_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          meeting_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_consents: {
        Row: {
          consent_type: string
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          member_id: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          member_id: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          member_id?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_consents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          member_id: string
          role: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          member_id: string
          role: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          member_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          age_group: Database["public"]["Enums"]["age_group"] | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          entry_date: string
          exit_date: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          is_active: boolean
          last_name: string
          member_number: string | null
          mobile: string | null
          notes: string | null
          phone: string | null
          qttr_rating: number | null
          street: string | null
          ttr_rating: number | null
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          age_group?: Database["public"]["Enums"]["age_group"] | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          entry_date?: string
          exit_date?: string | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_active?: boolean
          last_name: string
          member_number?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          qttr_rating?: number | null
          street?: string | null
          ttr_rating?: number | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          age_group?: Database["public"]["Enums"]["age_group"] | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          entry_date?: string
          exit_date?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_active?: boolean
          last_name?: string
          member_number?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          qttr_rating?: number | null
          street?: string | null
          ttr_rating?: number | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      news: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      permission_consistency_audit: {
        Row: {
          checked_at: string
          id: string
          is_consistent: boolean
          issue_count: number
          issues: Json
          module: string
          triggered_by: string
        }
        Insert: {
          checked_at?: string
          id?: string
          is_consistent: boolean
          issue_count?: number
          issues?: Json
          module: string
          triggered_by?: string
        }
        Update: {
          checked_at?: string
          id?: string
          is_consistent?: boolean
          issue_count?: number
          issues?: Json
          module?: string
          triggered_by?: string
        }
        Relationships: []
      }
      role_module_permissions: {
        Row: {
          created_at: string
          id: string
          level: Database["public"]["Enums"]["permission_level"]
          module: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["permission_level"]
          module: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["permission_level"]
          module?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      schedule_matches: {
        Row: {
          away_score: number | null
          away_team: string
          code: string | null
          created_at: string
          home_score: number | null
          home_team: string
          id: string
          is_home: boolean
          match_date: string
          match_day: number | null
          match_time: string | null
          pin: string | null
          report_text: string | null
          season_id: string | null
          season_phase_id: string | null
          status: Database["public"]["Enums"]["match_status"]
          team_id: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_team: string
          code?: string | null
          created_at?: string
          home_score?: number | null
          home_team: string
          id?: string
          is_home?: boolean
          match_date: string
          match_day?: number | null
          match_time?: string | null
          pin?: string | null
          report_text?: string | null
          season_id?: string | null
          season_phase_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          team_id: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_team?: string
          code?: string | null
          created_at?: string
          home_score?: number | null
          home_team?: string
          id?: string
          is_home?: boolean
          match_date?: string
          match_day?: number | null
          match_time?: string | null
          pin?: string | null
          report_text?: string | null
          season_id?: string | null
          season_phase_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          team_id?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_matches_season_phase_id_fkey"
            columns: ["season_phase_id"]
            isOneToOne: false
            referencedRelation: "season_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_matches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      season_cycles: {
        Row: {
          age_group: Database["public"]["Enums"]["age_group"]
          created_at: string
          end_year: number
          id: string
          is_active: boolean
          name: string
          start_year: number
          updated_at: string
        }
        Insert: {
          age_group?: Database["public"]["Enums"]["age_group"]
          created_at?: string
          end_year: number
          id?: string
          is_active?: boolean
          name: string
          start_year: number
          updated_at?: string
        }
        Update: {
          age_group?: Database["public"]["Enums"]["age_group"]
          created_at?: string
          end_year?: number
          id?: string
          is_active?: boolean
          name?: string
          start_year?: number
          updated_at?: string
        }
        Relationships: []
      }
      season_phases: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          phase_type: Database["public"]["Enums"]["phase_type"]
          season_cycle_id: string
          sort_order: number
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          phase_type: Database["public"]["Enums"]["phase_type"]
          season_cycle_id: string
          sort_order?: number
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          phase_type?: Database["public"]["Enums"]["phase_type"]
          season_cycle_id?: string
          sort_order?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_phases_season_cycle_id_fkey"
            columns: ["season_cycle_id"]
            isOneToOne: false
            referencedRelation: "season_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          age_group: Database["public"]["Enums"]["age_group"]
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          age_group?: Database["public"]["Enums"]["age_group"]
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          age_group?: Database["public"]["Enums"]["age_group"]
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      substitute_requests: {
        Row: {
          created_at: string
          created_by: string
          id: string
          match_id: string
          note: string | null
          requesting_member_id: string
          status: Database["public"]["Enums"]["substitute_status"]
          substitute_member_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          match_id: string
          note?: string | null
          requesting_member_id: string
          status?: Database["public"]["Enums"]["substitute_status"]
          substitute_member_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          match_id?: string
          note?: string | null
          requesting_member_id?: string
          status?: Database["public"]["Enums"]["substitute_status"]
          substitute_member_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitute_requests_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "schedule_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_requests_requesting_member_id_fkey"
            columns: ["requesting_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_requests_substitute_member_id_fkey"
            columns: ["substitute_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          member_id: string
          position: number
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          position?: number
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          position?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_training_slots: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          location: string | null
          start_time: string
          team_id: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          location?: string | null
          start_time: string
          team_id: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          location?: string | null
          start_time?: string
          team_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_training_slots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          age_group: Database["public"]["Enums"]["age_group"]
          captain_id: string | null
          clicktt_url: string | null
          created_at: string
          division: string | null
          id: string
          is_active: boolean
          league: string | null
          name: string
          season_id: string | null
          season_phase_id: string | null
          team_size: number | null
          updated_at: string
        }
        Insert: {
          age_group?: Database["public"]["Enums"]["age_group"]
          captain_id?: string | null
          clicktt_url?: string | null
          created_at?: string
          division?: string | null
          id?: string
          is_active?: boolean
          league?: string | null
          name: string
          season_id?: string | null
          season_phase_id?: string | null
          team_size?: number | null
          updated_at?: string
        }
        Update: {
          age_group?: Database["public"]["Enums"]["age_group"]
          captain_id?: string | null
          clicktt_url?: string | null
          created_at?: string
          division?: string | null
          id?: string
          is_active?: boolean
          league?: string | null
          name?: string
          season_id?: string | null
          season_phase_id?: string | null
          team_size?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_season_phase_id_fkey"
            columns: ["season_phase_id"]
            isOneToOne: false
            referencedRelation: "season_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      training_bookings: {
        Row: {
          booking_date: string
          created_at: string
          created_by: string
          end_time: string | null
          id: string
          location: string | null
          note: string | null
          partner_id: string
          requester_id: string
          start_time: string
          status: Database["public"]["Enums"]["training_booking_status"]
          updated_at: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          created_by: string
          end_time?: string | null
          id?: string
          location?: string | null
          note?: string | null
          partner_id: string
          requester_id: string
          start_time: string
          status?: Database["public"]["Enums"]["training_booking_status"]
          updated_at?: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          created_by?: string
          end_time?: string | null
          id?: string
          location?: string | null
          note?: string | null
          partner_id?: string
          requester_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["training_booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_bookings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_bookings_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          city: string | null
          created_at: string
          id: string
          is_home_venue: boolean
          name: string
          notes: string | null
          street: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_home_venue?: boolean
          name: string
          notes?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_home_venue?: boolean
          name?: string
          notes?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_wipe_all_data: { Args: never; Returns: undefined }
      admin_wipe_all_members: { Args: never; Returns: undefined }
      check_seasons_permission_consistency: { Args: never; Returns: Json }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_admin_or_board: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      age_group:
        | "herren"
        | "damen"
        | "jungen_18"
        | "maedchen_18"
        | "jungen_15"
        | "maedchen_15"
        | "jungen_13"
        | "maedchen_13"
        | "jungen_11"
        | "maedchen_11"
        | "senioren"
        | "seniorinnen"
      app_role:
        | "admin"
        | "vorstand"
        | "trainer"
        | "spieler"
        | "mitglied"
        | "developer"
        | "fördermitglied"
      gender: "maennlich" | "weiblich" | "divers"
      match_status:
        | "geplant"
        | "laufend"
        | "beendet"
        | "verschoben"
        | "abgesagt"
      permission_level: "none" | "read" | "write"
      phase_type: "first_half" | "second_half" | "single_half"
      substitute_status: "pending" | "accepted" | "rejected"
      training_booking_status: "pending" | "confirmed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      age_group: [
        "herren",
        "damen",
        "jungen_18",
        "maedchen_18",
        "jungen_15",
        "maedchen_15",
        "jungen_13",
        "maedchen_13",
        "jungen_11",
        "maedchen_11",
        "senioren",
        "seniorinnen",
      ],
      app_role: [
        "admin",
        "vorstand",
        "trainer",
        "spieler",
        "mitglied",
        "developer",
        "fördermitglied",
      ],
      gender: ["maennlich", "weiblich", "divers"],
      match_status: ["geplant", "laufend", "beendet", "verschoben", "abgesagt"],
      permission_level: ["none", "read", "write"],
      phase_type: ["first_half", "second_half", "single_half"],
      substitute_status: ["pending", "accepted", "rejected"],
      training_booking_status: ["pending", "confirmed", "cancelled"],
    },
  },
} as const
