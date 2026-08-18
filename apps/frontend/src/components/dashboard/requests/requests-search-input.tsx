'use client'

import React from 'react'
import { SearchInput } from '@/components/ui/input'

export interface RequestsSearchInputProps
  extends Omit<React.ComponentProps<typeof SearchInput>, 'inputSize'> {
  inputSize?: 'sm' | 'md' | 'lg'
}

/**
 * Requests Search Bar (Figma Node 42:4336)
 * w-400, h-48 (lg), rounded-8, border-neutral-100, bg-white
 * Placeholder: درخواست خود را جست و جو کنید
 */
export function RequestsSearchInput({
  inputSize = 'md',
  placeholder = 'درخواست خود را جست و جو کنید',
  containerClassName = 'h-12 w-full rounded-lg border-neutral-100 bg-white',
  className = 'text-neutral-700 placeholder:text-neutral-300 placeholder:text-base',
  ...props
}: RequestsSearchInputProps) {
  return (
    <SearchInput
      inputSize={inputSize}
      placeholder={placeholder}
      containerClassName={containerClassName}
      className={className}
      {...props}
    />
  )
}
