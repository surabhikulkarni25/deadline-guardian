import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children?: ReactNode;
  className?: string;
  [x: string]: any;
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'bg-canvas text-foreground border border-card-border': variant === 'default',
          'bg-emerald-500/10 text-emerald-400': variant === 'success',
          'bg-amber-500/10 text-amber-400': variant === 'warning',
          'bg-red-500/10 text-red-400': variant === 'danger',
          'bg-blue-500/10 text-blue-400': variant === 'info',
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
