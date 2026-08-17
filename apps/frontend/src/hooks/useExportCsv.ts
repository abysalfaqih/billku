import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export function useExportCsv(endpoint: string, filename: string) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('File CSV berhasil diunduh');
    } catch {
      toast.error('Gagal mengunduh CSV');
    } finally {
      setLoading(false);
    }
  };

  return { download, loading };
}