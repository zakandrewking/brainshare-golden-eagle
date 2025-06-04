import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function FlexTitle({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={
        "mt-14 w-full flex items-center justify-start space-x-2 " +
        (className ?? "")
      }
    >
      <h2 className="text-2xl font-bold truncate min-w-0" title={title}>
        {title}
      </h2>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
            <Info className="h-4 w-4" />
            <span className="sr-only">View description</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
