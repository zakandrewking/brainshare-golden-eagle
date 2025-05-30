import {
  Children,
  cloneElement,
  ReactElement,
} from "react";

import { ButtonProps } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";

interface ButtonGroupProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  children: ReactElement<ButtonProps>[];
}

export const ButtonGroup = ({
  className,
  orientation = 'horizontal',
  children
}: ButtonGroupProps) => {
  const totalButtons = Children.count(children);
  const isHorizontal = orientation === 'horizontal';
  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'flex',
        {
          'flex-col': isVertical,
          'w-fit': isVertical
        },
        className
      )}
    >
      {Children.map(children, (child, index) => {
        const isFirst = index === 0;
        const isLast = index === totalButtons - 1;

        return cloneElement(child, {
          className: cn(
            {
              'rounded-s-none': isHorizontal && !isFirst,
              'rounded-e-none': isHorizontal && !isLast,
              'border-s-0': isHorizontal && !isFirst,

              'rounded-t-none': isVertical && !isFirst,
              'rounded-b-none': isVertical && !isLast,
              'border-t-0': isVertical && !isFirst
            },
            child.props.className
          )
        });
      })}
    </div>
  );
};
