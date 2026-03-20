/**
 * src/types/database.ts
 *
 * Generated from Supabase schema. Do not edit manually.
 * Regenerate with:
 *   pnpm supabase gen types typescript \
 *     --project-id YOUR_PROJECT_REF > src/types/database.ts
 *
 * This is a placeholder. Run the command above after linking to your project.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id:           string;
          firebase_uid: string;
          email:        string;
          display_name: string | null;
          avatar_url:   string | null;
          plan:         'free' | 'pro' | 'enterprise';
          created_at:   string;
          updated_at:   string;
        };
        Insert: {
          id?:          string;
          firebase_uid: string;
          email:        string;
          display_name?: string | null;
          avatar_url?:  string | null;
          plan?:        'free' | 'pro' | 'enterprise';
          created_at?:  string;
          updated_at?:  string;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      subscriptions: {
        Row: {
          id:                    string;
          user_id:               string;
          stripe_customer_id:    string;
          stripe_subscription_id:string;
          status:                'active' | 'past_due' | 'cancelled' | 'trialing';
          price_id:              string;
          current_period_end:    string;
          created_at:            string;
          updated_at:            string;
        };
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>;
      };
    };
    Views:    Record<string, never>;
    Functions:Record<string, never>;
    Enums:    Record<string, never>;
  };
}
