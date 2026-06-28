import * as React from 'react';
import { cn } from '@/src/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
          {
            'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
            'border-2 border-primary/50 text-primary hover:bg-primary/10': variant === 'outline',
            'hover:bg-canvas text-muted-foreground hover:text-foreground': variant === 'ghost',
            'bg-red-500/10 text-red-500 hover:bg-red-500/20': variant === 'danger',
            'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20': variant === 'success',
            'h-9 px-3 text-sm': size === 'sm',
            'h-11 px-6 text-base': size === 'md',
            'h-14 px-8 text-lg': size === 'lg',
            'h-11 w-11': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
