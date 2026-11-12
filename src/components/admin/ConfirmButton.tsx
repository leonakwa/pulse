'use client';

type Props = {
  message: string;
  children: React.ReactNode;
  className?: string;
  name?: string;
  value?: string;
};

// A submit button that asks "are you sure?" first.
export function ConfirmButton({ message, children, className, name, value }: Props) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
