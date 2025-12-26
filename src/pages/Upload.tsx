import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const simulateUpload = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Simulate processing
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'processing', progress: 100 } : f
          )
        );

        // Simulate completion after processing
        setTimeout(() => {
          const success = Math.random() > 0.2; // 80% success rate
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: success ? 'completed' : 'error',
                    error: success ? undefined : 'OCR extraction failed',
                  }
                : f
            )
          );
          
          if (success) {
            toast.success('Invoice extracted successfully!');
          } else {
            toast.error('Failed to extract invoice data');
          }
        }, 2000);
      } else {
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress } : f))
        );
      }
    }, 200);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === 'application/pdf'
    );

    if (droppedFiles.length === 0) {
      toast.error('Please upload PDF files only');
      return;
    }

    const newFiles: UploadedFile[] = droppedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploading',
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((f) => simulateUpload(f.id));
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      (file) => file.type === 'application/pdf'
    );

    if (selectedFiles.length === 0) {
      toast.error('Please upload PDF files only');
      return;
    }

    const newFiles: UploadedFile[] = selectedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploading',
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((f) => simulateUpload(f.id));
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
        return 'Uploading...';
      case 'processing':
        return 'Extracting data with AI...';
      case 'completed':
        return 'Extraction complete';
      case 'error':
        return 'Extraction failed';
    }
  };

  return (
    <MainLayout>
      <Header title="Upload Invoices" subtitle="Upload PDF invoices for AI extraction" />

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
                : 'border-border bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/50'
            )}
          >
            <motion.div
              animate={{ scale: isDragging ? 1.1 : 1 }}
              className="flex flex-col items-center justify-center py-6"
            >
              <div className={cn(
                'mb-4 rounded-full p-4 transition-colors',
                isDragging ? 'bg-primary/20' : 'bg-muted'
              )}>
                <UploadIcon className={cn(
                  'h-10 w-10 transition-colors',
                  isDragging ? 'text-primary' : 'text-muted-foreground'
                )} />
              </div>
              <p className="mb-2 text-lg font-semibold text-foreground">
                {isDragging ? 'Drop files here' : 'Drag & drop PDF invoices'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse files
              </p>
              <Button variant="outline" className="pointer-events-none">
                Select Files
              </Button>
            </motion.div>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept=".pdf"
              multiple
              onChange={handleFileInput}
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
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                Uploaded Files ({files.length})
              </h3>

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
                        <span className={cn(
                          'text-sm',
                          file.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                        )}>
                          {file.error || getStatusText(file.status)}
                        </span>
                      </div>
                      {(file.status === 'uploading' || file.status === 'processing') && (
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
              title: 'AI-Powered OCR',
              description: 'Uses OlmOCR + Gemini 2.5 Flash for accurate text extraction from scanned documents',
            },
            {
              title: 'Multi-Page Support',
              description: 'Handles multi-page PDFs with automatic table detection and data merging',
            },
            {
              title: 'Smart Validation',
              description: 'Ensemble pipeline with 3-way verification for 99% extraction accuracy',
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
