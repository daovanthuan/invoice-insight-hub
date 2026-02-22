import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  Upload as UploadIcon,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Archive,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInvoiceExtraction } from '@/hooks/useInvoiceExtraction';
import { useInvoices } from '@/hooks/useInvoices';
import { useCreateNotification } from '@/hooks/useCreateNotification';

interface UploadedFile {
  id: string;
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface ZipGroup {
  id: string;
  zipName: string;
  files: UploadedFile[];
}

type FileEntry = 
  | { type: 'single'; file: UploadedFile }
  | { type: 'zip'; group: ZipGroup };

export default function UploadPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { extractInvoice, isExtracting } = useInvoiceExtraction();
  const { createInvoice } = useInvoices();
  const { createNotification } = useCreateNotification();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const parseNumber = (value: string | undefined | null): number | null => {
    if (!value) return null;
    let cleaned = value.trim();
    cleaned = cleaned.replace(/\./g, '');
    cleaned = cleaned.replace(',', '.');
    cleaned = cleaned.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  const uploadFileToStorage = async (file: File): Promise<string | null> => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return null;
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/${timestamp}_${safeName}`;
      const { error } = await supabase.storage.from('invoices').upload(filePath, file);
      if (error) { console.error('Storage upload error:', error); return null; }
      return filePath;
    } catch (error) { console.error('Error uploading to storage:', error); return null; }
  };

  const updateFileInEntries = (fileId: string, updater: (f: UploadedFile) => UploadedFile) => {
    setEntries(prev => prev.map(entry => {
      if (entry.type === 'single' && entry.file.id === fileId) {
        return { ...entry, file: updater(entry.file) };
      }
      if (entry.type === 'zip') {
        const updated = entry.group.files.map(f => f.id === fileId ? updater(f) : f);
        if (updated !== entry.group.files) {
          return { ...entry, group: { ...entry.group, files: updated } };
        }
      }
      return entry;
    }));
  };

  const processFile = async (uploadedFile: UploadedFile, sourceZipName?: string) => {
    updateFileInEntries(uploadedFile.id, f => ({ ...f, status: 'processing', progress: 30 }));

    try {
      const filePath = await uploadFileToStorage(uploadedFile.file);
      updateFileInEntries(uploadedFile.id, f => ({ ...f, progress: 50 }));

      const extractedData = await extractInvoice(uploadedFile.file);

      if (!extractedData) {
        updateFileInEntries(uploadedFile.id, f => ({ ...f, status: 'error', error: 'Không thể trích xuất dữ liệu' }));
        return;
      }

      const core = extractedData.core;
      const lineItems = core.line_items || [];
      const processedLineItems = lineItems.map((item) => {
        const quantity = parseNumber(item.quantity);
        const unitPrice = parseNumber(item.unit_price);
        const calculatedAmount = (quantity && unitPrice) ? quantity * unitPrice : null;
        return {
          item_code: item.item_code || null,
          description: item.description || null,
          unit: item.unit || null,
          quantity,
          unit_price: unitPrice,
          amount: calculatedAmount,
        };
      });

      const calculatedSubtotal = processedLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      const subtotalValue = calculatedSubtotal > 0 ? calculatedSubtotal : parseNumber(core.subtotal);

      const invoice = await createInvoice(
        {
          vendor_name: core.vendor_name || null,
          vendor_tax_id: core.vendor_tax_id || null,
          vendor_address: core.vendor_address || null,
          vendor_phone: core.vendor_phone || null,
          vendor_fax: core.vendor_fax || null,
          vendor_account_no: core.vendor_account_no || null,
          buyer_name: core.buyer_name || null,
          buyer_tax_id: core.buyer_tax_id || null,
          buyer_address: core.buyer_address || null,
          buyer_account_no: core.buyer_account_no || null,
          invoice_number: core.invoice_id || null,
          invoice_serial: core.invoice_serial || null,
          invoice_date: core.invoice_date || null,
          payment_method: core.payment_method || null,
          currency: core.currency || null,
          subtotal: subtotalValue,
          tax_rate: parseNumber(core.tax_rate),
          tax_amount: parseNumber(core.tax_amount),
          total_amount: parseNumber(core.total_amount),
          amount_in_words: core.amount_in_words || null,
          tax_authority_code: core.tax_authority_code || null,
          lookup_code: core.lookup_code || null,
          lookup_url: core.lookup_url || null,
          exchange_rate: parseNumber(core.exchange_rate),
          status: 'processed',
          original_file_path: filePath || null,
          source_zip_name: sourceZipName || null,
          raw_json: extractedData as unknown as Record<string, unknown>,
          extend: extractedData.extend && Object.keys(extractedData.extend).length > 0
            ? extractedData.extend as Record<string, unknown>
            : null,
        },
        processedLineItems
      );

      if (invoice) {
        updateFileInEntries(uploadedFile.id, f => ({ ...f, status: 'completed', progress: 100 }));
        await createNotification({
          title: 'Trích xuất thành công',
          message: `Hóa đơn "${core.invoice_id || uploadedFile.file.name}" đã được trích xuất và lưu thành công.`,
          type: 'success',
          link: '/invoices',
        });
      } else {
        updateFileInEntries(uploadedFile.id, f => ({ ...f, status: 'error', error: 'Không thể lưu hóa đơn' }));
        await createNotification({
          title: 'Lưu hóa đơn thất bại',
          message: `Không thể lưu hóa đơn "${uploadedFile.file.name}" vào cơ sở dữ liệu.`,
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      updateFileInEntries(uploadedFile.id, f => ({ ...f, status: 'error', error: 'Đã xảy ra lỗi' }));
      await createNotification({
        title: 'Lỗi xử lý hóa đơn',
        message: `Đã xảy ra lỗi khi xử lý file "${uploadedFile.file.name}".`,
        type: 'error',
      });
    }
  };

  const validFileTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

  const isZipFile = (file: File): boolean => {
    return file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.toLowerCase().endsWith('.zip');
  };

  const extractFilesFromZip = async (zipFile: File): Promise<File[]> => {
    const extractedFiles: File[] = [];
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const filePromises: Promise<void>[] = [];
      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir || relativePath.startsWith('__MACOSX') || relativePath.startsWith('.')) return;
        const ext = relativePath.toLowerCase().split('.').pop();
        const validExtensions = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
        if (ext && validExtensions.includes(ext)) {
          const promise = zipEntry.async('blob').then((blob) => {
            let mimeType = 'application/octet-stream';
            if (ext === 'png') mimeType = 'image/png';
            else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
            else if (ext === 'webp') mimeType = 'image/webp';
            else if (ext === 'pdf') mimeType = 'application/pdf';
            const fileName = relativePath.split('/').pop() || relativePath;
            extractedFiles.push(new File([blob], fileName, { type: mimeType }));
          });
          filePromises.push(promise);
        }
      });
      await Promise.all(filePromises);
      return extractedFiles;
    } catch (error) {
      console.error('Error extracting ZIP:', error);
      toast.error(`Lỗi giải nén file ZIP: ${zipFile.name}`);
      return [];
    }
  };

  const processUploadedFiles = async (inputFiles: File[]) => {
    const singleFiles: File[] = [];
    const zipFiles: File[] = [];

    for (const file of inputFiles) {
      if (isZipFile(file)) zipFiles.push(file);
      else if (validFileTypes.includes(file.type)) singleFiles.push(file);
    }

    // Process single files
    const newSingleEntries: FileEntry[] = singleFiles.map(file => ({
      type: 'single',
      file: { id: crypto.randomUUID(), file, status: 'uploading' as const, progress: 0 },
    }));

    // Process ZIP files
    const newZipEntries: FileEntry[] = [];
    for (const zipFile of zipFiles) {
      toast.info(`Đang giải nén ${zipFile.name}...`);
      await uploadFileToStorage(zipFile);
      const extracted = await extractFilesFromZip(zipFile);
      if (extracted.length === 0) {
        toast.error(`Không tìm thấy file hóa đơn trong ${zipFile.name}`);
        continue;
      }
      toast.success(`Đã giải nén ${extracted.length} file từ ${zipFile.name}`);
      const zipGroup: ZipGroup = {
        id: crypto.randomUUID(),
        zipName: zipFile.name,
        files: extracted.map(f => ({
          id: crypto.randomUUID(),
          file: f,
          status: 'uploading' as const,
          progress: 0,
        })),
      };
      newZipEntries.push({ type: 'zip', group: zipGroup });
    }

    const allNewEntries = [...newSingleEntries, ...newZipEntries];
    if (allNewEntries.length === 0 && singleFiles.length === 0 && zipFiles.length === 0) {
      toast.error('Không tìm thấy file hóa đơn hợp lệ (PNG, JPG, WEBP, PDF, ZIP)');
      return;
    }

    setEntries(prev => [...prev, ...allNewEntries]);

    // Fire off processing
    for (const entry of newSingleEntries) {
      if (entry.type === 'single') processFile(entry.file);
    }
    for (const entry of newZipEntries) {
      if (entry.type === 'zip') {
        entry.group.files.forEach(f => processFile(f, entry.group.zipName));
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) processUploadedFiles(droppedFiles);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) processUploadedFiles(selectedFiles);
    e.target.value = '';
  };

  const removeEntry = (entryId: string) => {
    setEntries(prev => prev.filter(e => {
      if (e.type === 'single') return e.file.id !== entryId;
      if (e.type === 'zip') return e.group.id !== entryId;
      return true;
    }));
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading': return 'Đang tải lên...';
      case 'processing': return 'Đang trích xuất...';
      case 'completed': return 'Hoàn tất';
      case 'error': return 'Thất bại';
    }
  };

  const getZipStatus = (files: UploadedFile[]): { completed: number; total: number; allDone: boolean; hasError: boolean } => {
    const completed = files.filter(f => f.status === 'completed').length;
    const errors = files.filter(f => f.status === 'error').length;
    const allDone = files.every(f => f.status === 'completed' || f.status === 'error');
    return { completed, total: files.length, allDone, hasError: errors > 0 };
  };

  const allFiles = entries.flatMap(e => e.type === 'single' ? [e.file] : e.group.files);
  const completedCount = allFiles.filter(f => f.status === 'completed').length;

  const FileRow = ({ file }: { file: UploadedFile }) => (
    <div className="flex items-center gap-3 rounded-lg bg-muted/20 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
        <FileText className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{file.file.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {getStatusIcon(file.status)}
          <span className={cn('text-xs', file.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
            {file.error || getStatusText(file.status)}
          </span>
        </div>
        {(file.status === 'uploading' || file.status === 'processing') && (
          <Progress value={file.progress} className="mt-1.5 h-1" />
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{(file.file.size / 1024).toFixed(1)} KB</span>
    </div>
  );

  return (
    <MainLayout>
      <Header title="Tải Lên Hóa Đơn" subtitle="Upload ảnh, PDF hoặc file ZIP chứa hóa đơn để AI trích xuất dữ liệu" />

      <div className="p-6">
        {/* Upload Zone */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <label
            htmlFor="file-upload"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300',
              isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/50',
              isExtracting && 'pointer-events-none opacity-70'
            )}
          >
            <motion.div animate={{ scale: isDragging ? 1.1 : 1 }} className="flex flex-col items-center justify-center py-6">
              <div className={cn('mb-4 rounded-full p-4 transition-colors', isDragging ? 'bg-primary/20' : 'bg-muted')}>
                <UploadIcon className={cn('h-10 w-10 transition-colors', isDragging ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <p className="mb-2 text-lg font-semibold text-foreground">{isDragging ? 'Thả file vào đây' : 'Kéo & thả hóa đơn'}</p>
              <p className="text-sm text-muted-foreground mb-4">hoặc click để chọn file (PNG, JPG, WEBP, PDF, ZIP)</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <Archive className="h-4 w-4" />
                <span>Hỗ trợ file ZIP chứa nhiều hóa đơn</span>
              </div>
              <Button variant="outline" className="pointer-events-none">Chọn File</Button>
            </motion.div>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf,.zip,application/zip,application/x-zip-compressed"
              multiple
              onChange={handleFileInput}
              disabled={isExtracting}
            />
          </label>
        </motion.div>

        {/* File List */}
        <AnimatePresence>
          {entries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  File đã tải ({allFiles.length})
                </h3>
                {completedCount > 0 && (
                  <Button onClick={() => navigate('/invoices')} size="sm">Xem hóa đơn đã trích xuất</Button>
                )}
              </div>

              <div className="space-y-3">
                {entries.map((entry, index) => (
                  <motion.div
                    key={entry.type === 'single' ? entry.file.id : entry.group.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {entry.type === 'single' ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><FileRow file={entry.file} /></div>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => removeEntry(entry.file.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          disabled={entry.file.status === 'uploading' || entry.file.status === 'processing'}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <ZipFolder group={entry.group} onRemove={() => removeEntry(entry.group.id)} getZipStatus={getZipStatus} getStatusIcon={getStatusIcon} FileRow={FileRow} />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { title: 'AI Vision', description: 'Sử dụng Gemini 2.5 Flash để trích xuất chính xác văn bản từ ảnh hóa đơn' },
            { title: 'Lưu Trữ An Toàn', description: 'Dữ liệu được lưu trữ bảo mật với mã hóa và phân quyền người dùng' },
            { title: 'Độ Chính Xác Cao', description: 'Trích xuất số liệu và văn bản với độ chính xác trên 95%' },
          ].map((item, idx) => (
            <div key={idx} className="rounded-xl bg-muted/30 p-6">
              <h4 className="mb-2 font-semibold text-foreground">{item.title}</h4>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </MainLayout>
  );
}

function ZipFolder({
  group,
  onRemove,
  getZipStatus,
  getStatusIcon,
  FileRow,
}: {
  group: ZipGroup;
  onRemove: () => void;
  getZipStatus: (files: UploadedFile[]) => { completed: number; total: number; allDone: boolean; hasError: boolean };
  getStatusIcon: (status: UploadedFile['status']) => React.ReactNode;
  FileRow: React.ComponentType<{ file: UploadedFile }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const status = getZipStatus(group.files);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-border bg-muted/10 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-3 w-full p-4 hover:bg-muted/30 transition-colors text-left">
            <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent shrink-0">
              {isOpen ? <FolderOpen className="h-5 w-5 text-accent-foreground" /> : <Archive className="h-5 w-5 text-accent-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{group.zipName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {status.allDone ? (
                  status.hasError ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                <span className="text-xs text-muted-foreground">
                  {status.completed}/{status.total} hoàn tất
                </span>
              </div>
            </div>
            <Button
              variant="ghost" size="icon"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="text-muted-foreground hover:text-destructive shrink-0"
              disabled={!status.allDone}
            >
              <X className="h-4 w-4" />
            </Button>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pl-12 space-y-2">
            {group.files.map(file => (
              <FileRow key={file.id} file={file} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
