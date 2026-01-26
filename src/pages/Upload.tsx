import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Upload as UploadIcon,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Archive,
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

export default function UploadPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadedFile[]>([]);
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
    
    // Định dạng Việt Nam: dấu . là phân cách hàng nghìn, dấu , là phân cách thập phân
    // Ví dụ: "6.204,19" -> 6204.19, "1.234.567" -> 1234567
    let cleaned = value.trim();
    
    // Xóa dấu . (phân cách hàng nghìn)
    cleaned = cleaned.replace(/\./g, '');
    
    // Thay dấu , thành dấu . (phân cách thập phân)
    cleaned = cleaned.replace(',', '.');
    
    // Xóa các ký tự không phải số, dấu chấm, dấu trừ
    cleaned = cleaned.replace(/[^0-9.-]/g, '');
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  const processFile = async (uploadedFile: UploadedFile) => {
    // Update status to processing
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadedFile.id ? { ...f, status: 'processing', progress: 50 } : f
      )
    );

    try {
      // Extract invoice data using AI
      const extractedData = await extractInvoice(uploadedFile.file);

      if (!extractedData) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadedFile.id
              ? { ...f, status: 'error', error: 'Không thể trích xuất dữ liệu' }
              : f
          )
        );
        return;
      }

      // Save to database
      const core = extractedData.core;
      
      // Process line items - tính thành tiền = đơn giá × số lượng (chưa thuế)
      const lineItems = core.line_items || [];
      const processedLineItems = lineItems.map((item) => {
        const quantity = parseNumber(item.quantity);
        const unitPrice = parseNumber(item.unit_price);
        // Tính thành tiền = số lượng × đơn giá (chưa thuế)
        const calculatedAmount = (quantity && unitPrice) ? quantity * unitPrice : null;
        return {
          item_code: item.item_code || null,
          description: item.description || null,
          unit: item.unit || null,
          quantity: quantity,
          unit_price: unitPrice,
          // Sử dụng thành tiền tính từ đơn giá × số lượng (chưa thuế)
          amount: calculatedAmount,
        };
      });
      
      // Tính subtotal = tổng thành tiền các item (chưa thuế)
      const calculatedSubtotal = processedLineItems.reduce((sum, item) => {
        return sum + (item.amount || 0);
      }, 0);
      
      // Use calculated subtotal if valid, otherwise fallback to AI-extracted value
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
          raw_json: extractedData as unknown as Record<string, unknown>,
          extend: extractedData.extend && Object.keys(extractedData.extend).length > 0 
            ? extractedData.extend as Record<string, unknown> 
            : null,
        },
        processedLineItems
      );

      if (invoice) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadedFile.id
              ? { ...f, status: 'completed', progress: 100 }
              : f
          )
        );
        
        // Create success notification
        await createNotification({
          title: 'Trích xuất thành công',
          message: `Hóa đơn "${core.invoice_id || uploadedFile.file.name}" đã được trích xuất và lưu thành công.`,
          type: 'success',
          link: '/invoices',
        });
      } else {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadedFile.id
              ? { ...f, status: 'error', error: 'Không thể lưu hóa đơn' }
              : f
          )
        );
        
        // Create error notification
        await createNotification({
          title: 'Lưu hóa đơn thất bại',
          message: `Không thể lưu hóa đơn "${uploadedFile.file.name}" vào cơ sở dữ liệu.`,
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? { ...f, status: 'error', error: 'Đã xảy ra lỗi' }
            : f
        )
      );
      
      // Create error notification
      await createNotification({
        title: 'Lỗi xử lý hóa đơn',
        message: `Đã xảy ra lỗi khi xử lý file "${uploadedFile.file.name}".`,
        type: 'error',
      });
    }
  };

  const validFileTypes = [
    'image/png', 
    'image/jpeg', 
    'image/jpg', 
    'image/webp',
    'application/pdf'
  ];

  const isZipFile = (file: File): boolean => {
    return file.type === 'application/zip' || 
           file.type === 'application/x-zip-compressed' ||
           file.name.toLowerCase().endsWith('.zip');
  };

  const extractFilesFromZip = async (zipFile: File): Promise<File[]> => {
    const extractedFiles: File[] = [];
    
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const filePromises: Promise<void>[] = [];
      
      zip.forEach((relativePath, zipEntry) => {
        // Bỏ qua thư mục và file ẩn (bắt đầu bằng . hoặc trong thư mục __MACOSX)
        if (zipEntry.dir || relativePath.startsWith('__MACOSX') || relativePath.startsWith('.')) {
          return;
        }
        
        // Lấy extension của file
        const ext = relativePath.toLowerCase().split('.').pop();
        const validExtensions = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
        
        if (ext && validExtensions.includes(ext)) {
          const promise = zipEntry.async('blob').then((blob) => {
            // Xác định MIME type
            let mimeType = 'application/octet-stream';
            if (ext === 'png') mimeType = 'image/png';
            else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
            else if (ext === 'webp') mimeType = 'image/webp';
            else if (ext === 'pdf') mimeType = 'application/pdf';
            
            // Lấy tên file từ path
            const fileName = relativePath.split('/').pop() || relativePath;
            
            const file = new File([blob], fileName, { type: mimeType });
            extractedFiles.push(file);
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
    const filesToProcess: File[] = [];
    const zipFiles: File[] = [];
    
    // Phân loại file ZIP và file thường
    for (const file of inputFiles) {
      if (isZipFile(file)) {
        zipFiles.push(file);
      } else if (validFileTypes.includes(file.type)) {
        filesToProcess.push(file);
      }
    }
    
    // Giải nén các file ZIP
    if (zipFiles.length > 0) {
      toast.info(`Đang giải nén ${zipFiles.length} file ZIP...`);
      
      const extractPromises = zipFiles.map(extractFilesFromZip);
      const extractedFilesArrays = await Promise.all(extractPromises);
      
      for (const extractedFiles of extractedFilesArrays) {
        filesToProcess.push(...extractedFiles);
      }
      
      if (filesToProcess.length > 0) {
        toast.success(`Đã giải nén ${filesToProcess.length} file hóa đơn từ ZIP`);
      }
    }
    
    if (filesToProcess.length === 0) {
      toast.error('Không tìm thấy file hóa đơn hợp lệ (PNG, JPG, WEBP, PDF)');
      return;
    }
    
    // Tạo UploadedFile objects
    const newFiles: UploadedFile[] = filesToProcess.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploading' as const,
      progress: 0,
    }));
    
    setFiles((prev) => [...prev, ...newFiles]);
    
    // Process all files concurrently
    await Promise.all(newFiles.map((uploadedFile) => processFile(uploadedFile)));
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    
    if (droppedFiles.length === 0) {
      return;
    }

    await processUploadedFiles(droppedFiles);
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length === 0) {
      return;
    }

    await processUploadedFiles(selectedFiles);

    // Reset input
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Đang tải lên...';
      case 'processing':
        return 'Đang trích xuất dữ liệu với AI...';
      case 'completed':
        return 'Trích xuất hoàn tất';
      case 'error':
        return 'Trích xuất thất bại';
    }
  };

  const completedCount = files.filter((f) => f.status === 'completed').length;

  return (
    <MainLayout>
      <Header title="Tải Lên Hóa Đơn" subtitle="Upload ảnh, PDF hoặc file ZIP chứa hóa đơn để AI trích xuất dữ liệu" />

      <div className="p-6">
        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <label
            htmlFor="file-upload"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-border bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/50',
              isExtracting && 'pointer-events-none opacity-70'
            )}
          >
            <motion.div
              animate={{ scale: isDragging ? 1.1 : 1 }}
              className="flex flex-col items-center justify-center py-6"
            >
              <div
                className={cn(
                  'mb-4 rounded-full p-4 transition-colors',
                  isDragging ? 'bg-primary/20' : 'bg-muted'
                )}
              >
                <UploadIcon
                  className={cn(
                    'h-10 w-10 transition-colors',
                    isDragging ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </div>
              <p className="mb-2 text-lg font-semibold text-foreground">
                {isDragging ? 'Thả file vào đây' : 'Kéo & thả hóa đơn'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                hoặc click để chọn file (PNG, JPG, WEBP, PDF, ZIP)
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <Archive className="h-4 w-4" />
                <span>Hỗ trợ file ZIP chứa nhiều hóa đơn</span>
              </div>
              <Button variant="outline" className="pointer-events-none">
                Chọn File
              </Button>
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
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  File đã tải ({files.length})
                </h3>
                {completedCount > 0 && (
                  <Button onClick={() => navigate('/invoices')} size="sm">
                    Xem hóa đơn đã trích xuất
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {files.map((file, index) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-4 rounded-lg bg-muted/30 p-4"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {file.file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(file.status)}
                        <span
                          className={cn(
                            'text-sm',
                            file.status === 'error'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                          )}
                        >
                          {file.error || getStatusText(file.status)}
                        </span>
                      </div>
                      {(file.status === 'uploading' ||
                        file.status === 'processing') && (
                        <Progress value={file.progress} className="mt-2 h-1" />
                      )}
                    </div>

                    <div className="text-right text-sm text-muted-foreground">
                      {(file.file.size / 1024).toFixed(1)} KB
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file.id)}
                      className="text-muted-foreground hover:text-destructive"
                      disabled={
                        file.status === 'uploading' ||
                        file.status === 'processing'
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 grid gap-6 md:grid-cols-3"
        >
          {[
            {
              title: 'AI Vision',
              description:
                'Sử dụng Gemini 2.5 Flash để trích xuất chính xác văn bản từ ảnh hóa đơn',
            },
            {
              title: 'Lưu Trữ An Toàn',
              description:
                'Dữ liệu được lưu trữ bảo mật với mã hóa và phân quyền người dùng',
            },
            {
              title: 'Độ Chính Xác Cao',
              description:
                'Trích xuất số liệu và văn bản với độ chính xác trên 95%',
            },
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
