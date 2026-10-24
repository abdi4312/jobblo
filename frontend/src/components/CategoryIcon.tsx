import { DynamicIcon, type IconName } from 'lucide-react/dynamic';

/**
 * A category's Lucide icon by the name chosen in the admin ("BrushCleaning", "Flower2").
 *
 * Only that one icon is downloaded, on demand. The pages used `import * as Icons from
 * 'lucide-react'` to look names up, which put all ~1,500 icons (174 extra files) in front of
 * /home and kept it blank for seconds on phones (LCP 9–11 s).
 *
 * The box keeps its size while the icon loads, so nothing shifts. `fallback` (kebab-case) is
 * shown when the name is missing or unknown.
 */
const kebab = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase();

export function CategoryIcon({
  name,
  fallback = 'circle-help',
  size = 22,
  strokeWidth,
  className,
}: {
  name?: string | null;
  fallback?: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Fallback = () => <DynamicIcon name={fallback} size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
  return (
    <span className="inline-flex shrink-0" style={{ width: size, height: size }}>
      {name ? (
        <DynamicIcon name={kebab(name) as IconName} fallback={Fallback} size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />
      ) : (
        <Fallback />
      )}
    </span>
  );
}
