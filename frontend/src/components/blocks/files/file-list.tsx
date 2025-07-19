import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stack } from "@/components/ui/stack";
import { createClient } from "@/utils/supabase/server";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFileIcon(extension: string) {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"];
  const videoExtensions = ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv"];
  const audioExtensions = ["mp3", "wav", "flac", "aac", "ogg", "wma"];
  const documentExtensions = ["pdf", "doc", "docx", "txt", "rtf", "odt"];

  if (imageExtensions.includes(extension)) return <ImageIcon size={20} />;
  if (videoExtensions.includes(extension)) return <Video size={20} />;
  if (audioExtensions.includes(extension)) return <Music size={20} />;
  if (documentExtensions.includes(extension)) return <FileText size={20} />;
  return <FileIcon size={20} />;
}

export default async function FileList() {
  const supabase = await createClient();

  const { data: files, error } = await supabase.from("file").select("*");

  if (error) {
    console.error(error);
    return <div>Error loading files</div>;
  }

  if (files?.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No files found
      </div>
    );
  }

  return (
    <Stack direction="col" gap={2}>
      {files?.map((file) => {
        const extension = file.name.split(".").pop()?.toLowerCase() || "";

        return (
          <Button
            key={file.id}
            variant="ghost"
            className="h-auto p-4 justify-start text-left"
            asChild
          >
            <Link href={`/files/${file.id}`}>
              <div className="flex items-center gap-3 w-full">
                {getFileIcon(extension)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  {extension.toUpperCase()}
                </Badge>
              </div>
            </Link>
          </Button>
        );
      })}
    </Stack>
  );
}
