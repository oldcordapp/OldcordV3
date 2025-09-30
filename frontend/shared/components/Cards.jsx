import React from 'react';

export function Card({ children, ...props }) {
  return <button {...props}>{children}</button>;
}