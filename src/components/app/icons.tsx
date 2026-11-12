import {
  Briefcase, Laptop, PlusCircle, Home, Utensils, Car, HeartPulse, GraduationCap, Gamepad2, ShoppingBag, Repeat,
  Tag, Gift, Plane, PawPrint, Baby, Shirt, Zap, Smartphone, PiggyBank, Landmark, Coffee, type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase, laptop: Laptop, "plus-circle": PlusCircle, home: Home, utensils: Utensils, car: Car,
  "heart-pulse": HeartPulse, "graduation-cap": GraduationCap, "gamepad-2": Gamepad2, "shopping-bag": ShoppingBag,
  repeat: Repeat, tag: Tag, gift: Gift, plane: Plane, "paw-print": PawPrint, baby: Baby, shirt: Shirt, zap: Zap,
  smartphone: Smartphone, "piggy-bank": PiggyBank, landmark: Landmark, coffee: Coffee,
};

export function CategoryIcon({ icon, color, size = 32 }: { icon: string; color: string; size?: number }) {
  const I = CATEGORY_ICONS[icon] ?? Tag;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-lg" style={{ width: size, height: size, backgroundColor: color + "22", color }} aria-hidden>
      <I className="h-4 w-4" />
    </span>
  );
}

export const COLOR_CHOICES = ["#0546DE", "#16A34A", "#DC2626", "#EA580C", "#CA8A04", "#7C3AED", "#DB2777", "#0891B2", "#475569", "#0F172A"];

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Cor</legend>
      <div className="flex flex-wrap gap-2">
        {COLOR_CHOICES.map((c) => (
          <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={value === c} onClick={() => onChange(c)}
            className={`h-8 w-8 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
        ))}
      </div>
    </fieldset>
  );
}

