import * as React from 'react';
import { cn } from '@/src/lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-card-border bg-card/80 backdrop-blur-sm p-6 shadow-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
