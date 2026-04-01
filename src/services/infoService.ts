import { supabase } from '@/integrations/supabase/client';
import type {
  DeveloperInfoViewModel,
  InternalClubInfoViewModel,
  LicenseViewModel,
  PublicClubInfoViewModel,
  SecurityCheckResultViewModel,
  ToolMetadataViewModel,
} from '@/types/viewModels';

const TOOL_METADATA: ToolMetadataViewModel = {
  version: '1.1.0',
  buildDate: '2026-04-01',
  supportEmail: 'support@ttv-pro.de',
};

export interface PublicInfoService {
  getPublicClubInfo(): Promise<PublicClubInfoViewModel | null>;
  getToolMetadata(): ToolMetadataViewModel;
}

export interface DeveloperInfoService {
  getDeveloperInfo(): Promise<DeveloperInfoViewModel>;
  runSecurityCheck(): Promise<SecurityCheckResultViewModel>;
}

const handleError = (error: { message?: string } | null, context: string) => {
  if (!error) return;
  throw new Error(`[infoService] ${context}: ${error.message ?? 'Unbekannter Fehler'}`);
};

const mapPublicClubInfo = (data: any): PublicClubInfoViewModel => ({
  clubName: data.club_name,
  clubNumber: data.club_number ?? null,
  association: data.association ?? null,
  website: data.website ?? null,
});

const mapInternalClubInfo = (data: any): InternalClubInfoViewModel => ({
  contactEmail: data.contact_email ?? null,
  contactPhone: data.contact_phone ?? null,
  street: data.street ?? null,
  zipCode: data.zip_code ?? null,
  city: data.city ?? null,
});

const mapLicense = (data: any): LicenseViewModel | null => {
  if (!data) return null;
  return {
    serialKey: data.serial_key ?? '',
    status: data.status ?? 'inactive',
    activatedAt: data.activated_at ?? null,
    validUntil: data.valid_until ?? null,
  };
};

export const infoService: PublicInfoService & DeveloperInfoService = {
  async getPublicClubInfo() {
    const { data, error } = await supabase.from('club_settings').select('*').limit(1).maybeSingle();
    handleError(error, 'getPublicClubInfo');
    if (!data) return null;
    return mapPublicClubInfo(data);
  },

  getToolMetadata() {
    return TOOL_METADATA;
  },

  async getDeveloperInfo() {
    const [{ data: clubData, error: clubError }, { data: licenseData, error: licenseError }] = await Promise.all([
      supabase.from('club_settings').select('*').limit(1).maybeSingle(),
      supabase.from('license').select('serial_key, status, activated_at, valid_until').limit(1).maybeSingle(),
    ]);
    handleError(clubError, 'getDeveloperInfo.club');
    handleError(licenseError, 'getDeveloperInfo.license');

    return {
      internalClubInfo: clubData ? mapInternalClubInfo(clubData) : null,
      toolMetadata: TOOL_METADATA,
      license: mapLicense(licenseData),
    };
  },

  async runSecurityCheck() {
    const publicData = await this.getPublicClubInfo();
    const developerData = await this.getDeveloperInfo();
    const checks = [
      {
        key: 'public-no-internal-contact',
        passed: !('contactEmail' in (publicData ?? {})),
        message: 'Öffentliche Club-Infos enthalten keine internen Kontaktfelder.',
      },
      {
        key: 'developer-license-complete',
        passed: Boolean(developerData.license && developerData.license.serialKey && developerData.license.status),
        message: 'Lizenzmodell enthält serial_key und status.',
      },
      {
        key: 'tool-metadata-present',
        passed: Boolean(developerData.toolMetadata.version && developerData.toolMetadata.buildDate && developerData.toolMetadata.supportEmail),
        message: 'Tool-Metadaten (Version, Build-Datum, Support-Mail) sind vorhanden.',
      },
    ];

    return {
      passed: checks.every((check) => check.passed),
      checks,
    };
  },
};
