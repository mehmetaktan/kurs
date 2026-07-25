import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'warning'
  | 'danger'
  | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** `small`: tablo satırı içindeki düğmeler (`5px 10px`, 12px). */
  size?: 'normal' | 'small'
  /** Çekmece alt çubuğunda olduğu gibi kalan alanı doldurur. */
  block?: boolean
  children?: ReactNode
}

/**
 * TASARIM-SISTEMI §6/6 — düğme.
 *
 * `type` varsayılan olarak `button`: HTML varsayılanı `submit` ve form içindeki ikincil
 * bir düğme farkında olmadan formu gönderir.
 */
export function Button({
  variant = 'secondary',
  size = 'normal',
  block = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    variant === 'icon' ? undefined : styles[size],
    block ? styles.block : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <button type={type} className={classes} {...rest} />
}
