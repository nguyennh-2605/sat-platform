import { hasGrantedAllScopesGoogle, useGoogleLogin, type TokenResponse } from '@react-oauth/google';
import { ExternalLink, FileSpreadsheet } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { appToast } from '@/components/ui/toast';
import axiosClient from '../../lib/axios';
import { useDraftSummary, type ReflectionDraftStore } from './useReflectionDrafts';

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

interface GoogleSheetExportResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowCount: number;
}

const safeGoogleSheetUrl = (value: unknown) => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'docs.google.com' && url.pathname.startsWith('/spreadsheets/')
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export function GoogleSheetsExportButton({ draftStore }: { draftStore: ReflectionDraftStore }) {
  const [exporting, setExporting] = useState(false);
  const [exportedSheetUrl, setExportedSheetUrl] = useState<string | null>(null);
  const draftSummary = useDraftSummary(draftStore);
  const hasUnsavedChanges = draftSummary.status === 'pending'
    || draftSummary.status === 'saving'
    || draftSummary.status === 'error';

  const createSheet = async (response: TokenResponse) => {
    if (!hasGrantedAllScopesGoogle(response, DRIVE_FILE_SCOPE)) {
      setExporting(false);
      appToast.error('Grant Google Drive access to export your error log.');
      return;
    }

    const toastId = appToast.loading('Creating your Google Sheet…');
    try {
      const result = await axiosClient.post<GoogleSheetExportResponse>('/api/error-logs/export/google-sheet', {
        googleAccessToken: response.access_token,
        platformOrigin: window.location.origin,
      });
      const exportedUrl = safeGoogleSheetUrl(result.spreadsheetUrl);
      if (!exportedUrl) throw new Error('Google Sheets returned an invalid export URL.');
      setExportedSheetUrl(exportedUrl);
      appToast.dismiss(toastId);
      appToast.success(`Exported ${result.rowCount} error log ${result.rowCount === 1 ? 'entry' : 'entries'}.`);
      window.open(exportedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      appToast.dismiss(toastId);
      const response = (error as { response?: { data?: { message?: string; partialSpreadsheetUrl?: string } } }).response;
      const partialUrl = safeGoogleSheetUrl(response?.data?.partialSpreadsheetUrl);
      if (partialUrl) setExportedSheetUrl(partialUrl);
      const message = response?.data?.message;
      appToast.error(message || 'Unable to create the Google Sheet. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const requestGoogleAccess = useGoogleLogin({
    scope: DRIVE_FILE_SCOPE,
    include_granted_scopes: true,
    onSuccess: response => { void createSheet(response); },
    onError: () => {
      setExporting(false);
      appToast.error('Google authorization failed. Please try again.');
    },
    onNonOAuthError: () => {
      setExporting(false);
      appToast.error('Google authorization was closed before export.');
    },
  });

  const startExport = () => {
    if (hasUnsavedChanges) {
      appToast.error(draftSummary.status === 'error'
        ? 'Resolve the save issue before exporting.'
        : 'Wait for your latest changes to finish saving.');
      return;
    }
    setExporting(true);
    requestGoogleAccess();
  };

  return <div className="flex items-center gap-1">
    <Button
      type="button"
      variant="outline"
      disabled={exporting || hasUnsavedChanges}
      onClick={startExport}
      title={hasUnsavedChanges ? 'Save changes before exporting' : 'Export all entries to a native Google Sheet'}
    >
      {exporting ? <LoadingSpinner /> : <FileSpreadsheet aria-hidden="true" />}
      {exporting ? 'Exporting…' : 'Export to Sheets'}
    </Button>
    {exportedSheetUrl && <Button variant="ghost" size="sm" asChild>
      <a href={exportedSheetUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Open Sheet</a>
    </Button>}
  </div>;
}
