import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnhancedCheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string;
  description?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
}

const EnhancedCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  EnhancedCheckboxProps
>(({ className, label, description, error, size = "md", variant = "default", ...props }, ref) => {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4", 
    lg: "h-5 w-5"
  };

  const variantClasses = {
    default: "border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
    primary: "border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white",
    success: "border-green-600 data-[state=checked]:bg-green-600 data-[state=checked]:text-white",
    warning: "border-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:text-white",
    destructive: "border-red-600 data-[state=checked]:bg-red-600 data-[state=checked]:text-white"
  };

  const checkboxElement = (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer shrink-0 rounded-sm border border-primary ring-offset-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        "hover:border-primary/80 transition-colors duration-200",
        "touch-manipulation", // Better touch targets
        sizeClasses[size],
        variantClasses[variant],
        error && "border-destructive",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        <Check className={cn("h-3 w-3", size === "sm" && "h-2 w-2", size === "lg" && "h-4 w-4")} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (label || description) {
    return (
      <div className="space-y-2">
        <div className="flex items-start space-x-3">
          {checkboxElement}
          <div className="flex-1 min-w-0">
            {label && (
              <label 
                htmlFor={props.id}
                className={cn(
                  "text-sm font-medium leading-none cursor-pointer",
                  "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                  "hover:text-primary transition-colors duration-200",
                  error && "text-destructive"
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className={cn(
                "text-sm text-muted-foreground mt-1",
                error && "text-destructive/80"
              )}>
                {description}
              </p>
            )}
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive ml-7">
            {error}
          </p>
        )}
      </div>
    );
  }

  return checkboxElement;
});

EnhancedCheckbox.displayName = CheckboxPrimitive.Root.displayName;

export { EnhancedCheckbox };