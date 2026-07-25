/**
 * Komponent kütüphanesi (Faz 3). Ekranlar buradan alır, tek tek dosyadan değil.
 *
 * Kapsam dışı — bilerek:
 *  - `CalendarGrid` `SessionBlock` `NowIndicator` `ClosedDayOverlay` `DropTarget`
 *    `Legend` → Faz 5 (takvim ekranıyla birlikte)
 *  - `NoteList` / `NoteComposer` → Faz 4 (öğrenci notlarıyla birlikte)
 *
 * Gerekçe: ikisi de kendi ekranının veri modeline bağlı. Boşlukta yazılırsa ekran
 * gelince yeniden yazılır.
 */
export { Button } from './Button'
export type { ButtonProps, ButtonVariant } from './Button'

export { Checkbox, FieldShell, Input, PhoneInput, Select, Textarea } from './Field'
export type {
  CheckboxProps,
  InputProps,
  PhoneInputProps,
  SelectOption,
  SelectProps,
  TextareaProps,
} from './Field'

export {
  ChipRow,
  FilterChip,
  Kbd,
  SearchInput,
  SegmentedControl,
  StepperGroup,
} from './Controls'
export type {
  FilterChipProps,
  SearchInputProps,
  SegmentedControlProps,
  SegmentedOption,
  StepperGroupProps,
} from './Controls'

export { DatePicker, TimePicker } from './Picker'
export type { DatePickerProps, TimePickerProps } from './Picker'

export { Table } from './Table'
export type { Column, TableProps } from './Table'

export {
  Avatar,
  Badge,
  Card,
  Pagination,
  SectionHeader,
  StatCard,
  StatStrip,
  StatusDot,
  Tabs,
} from './Display'
export type {
  BadgeTone,
  DotTone,
  PaginationProps,
  StatCardProps,
  StatusDotProps,
  TabItem,
  TabsProps,
} from './Display'

export { ConfirmDialog, Modal, ModalOption } from './Modal'
export type { ConfirmDialogProps, ModalOptionProps, ModalProps } from './Modal'

export { Drawer } from './Drawer'
export type { DrawerProps } from './Drawer'

export { TOAST_MS, ToastProvider, useToast } from './Toast'

export { EmptyState, ErrorState, LoadingState } from './States'
export type { EmptyKind, EmptyStateProps, ErrorStateProps } from './States'

export { marks } from './marks'
export { useDialog } from './useDialog'
