import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { WhatsappTemplate, WhatsappTemplateType } from '@/types';

export function useWhatsappTemplates() {
  return useQuery<WhatsappTemplate[]>({
    queryKey: ['whatsapp-templates'],
    queryFn: () => api.get('/whatsapp-templates').then((r) => r.data),
  });
}

export function useUpdateWhatsappTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, content }: { type: WhatsappTemplateType; content: string }) =>
      api.put(`/whatsapp-templates/${type}`, { content }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template pesan berhasil disimpan');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal menyimpan template'));
    },
  });
}

export function useResetWhatsappTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: WhatsappTemplateType) =>
      api.post(`/whatsapp-templates/${type}/reset`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template dikembalikan ke default');
    },
    onError: () => toast.error('Gagal reset template'),
  });
}
