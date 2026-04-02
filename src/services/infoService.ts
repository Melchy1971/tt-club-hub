import { supabase } from '@/integrations/supabase/client';
import type {
  DeveloperInfoViewModel,
  InternalClubInfoViewModel,
  LicenseViewModel,
  PublicClubInfoViewModel,
  ToolMetadataViewModel,
} from '@/types/viewModels';

export interface InfoService {
  getPublicClubInfo(): Promise<PublicClubInfoViewModel | null>;
  getInternalClubInfo(): Promise<InternalClubInfoViewModel | null>;
  getToolMetadata(): Promise<ToolMetadataViewModel | null>;
  getLicense(): Promise<LicenseViewModel | null>;
  getDeveloperInfo(): Promise<DeveloperInfoViewModel>;
}

const handleError = (error: { message?: string } | null, context: string) => {
  if (!error) return;
  throw new Error(`[infoService] ${context}: ${error.message ?? 'Unbekannter Fehler'}`);
};

export const infoService: InfoService = {
  async getPublicClubInfo() {
    const { data, error } = await supabase
      .from('club_settings')
      .select('club_name, club_number, association, website, contact_email, contact_phone, street, zip_code, city')
      .limit(1)
      .maybeSingle();

    handleError(error, 'getPublicClubInfo');

    if (!data) return null;

    return {
      clubName: data.club_name,
      clubNumber: data.club_number ?? null,
      association: data.association ?? null,
      website: data.website ?? null,
      contactEmail: data.contact_email ?? null,
      contactPhone: data.contact_phone ?? null,
      street: data.street ?? null,
      zipCode: data.zip_code ?? null,
      city: data.city ?? null,
    };
  },

  async getInternalClubInfo() {
    const { data, error } = await supabase
      .from('club_settings')
      .select('id, updated_at, created_at')
      .limit(1)
      .maybeSingle();

    handleError(error, 'getInternalClubInfo');

    if (!data) return null;

    return {
      id: data.id,
      createdAt: data.created_at ?? null,
      updatedAt: data.updated_at ?? null,
    };
  },

  async getToolMetadata() {
    // tool_metadata table does not exist yet – return null gracefully
    return null;
  },

  async getLicense() {
    // licenses table does not exist yet – return null gracefully
    return null;
  },

  async getDeveloperInfo() {
    const [toolMetadata, license, internalClubInfo] = await Promise.all([
      this.getToolMetadata(),
      this.getLicense(),
      this.getInternalClubInfo(),
    ]);

    return {
      toolMetadata,
      license,
      internalClubInfo,
    };
  },
};
