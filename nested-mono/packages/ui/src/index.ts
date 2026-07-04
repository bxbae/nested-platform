// @nested/ui — Atomic Design component library
// Import order mirrors the hierarchy: lib → atoms → molecules.

export { cn } from "./lib/cn";

// ── Atoms ──
export { Button, buttonVariants, type ButtonProps } from "./atoms/Button";
export { Input, Textarea, Label, type InputProps, type TextareaProps } from "./atoms/Input";
export { Badge, badgeVariants, Chip, type BadgeProps, type ChipProps } from "./atoms/Badge";
export { Avatar, Skeleton, Spinner, Divider, IconButton, type AvatarProps } from "./atoms/Avatar";
export { Rating, Switch, Tooltip, TooltipProvider, type RatingProps } from "./atoms/Rating";

// ── Molecules ──
export { SearchBar, PriceTag, FilterChip, type SearchBarProps } from "./molecules/SearchBar";
export { MessageBubble, type MessageBubbleProps } from "./molecules/MessageBubble";
export {
  Tabs, TabsList, TabsTrigger, TabsContent,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Dropdown, DropdownTrigger, DropdownContent, DropdownItem,
} from "./molecules/Tabs";
export {
  Breadcrumb, Pagination, StatCard, EmptyState,
  type Crumb,
} from "./molecules/Breadcrumb";
