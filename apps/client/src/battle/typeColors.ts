export const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  normal: { bg: "bg-[#A8A878]/30", text: "text-[#5e5e3c]", border: "border-[#A8A878]" },
  fire: { bg: "bg-[#F08030]/30", text: "text-[#9c4000]", border: "border-[#F08030]" },
  water: { bg: "bg-[#6890F0]/30", text: "text-[#1c409c]", border: "border-[#6890F0]" },
  grass: { bg: "bg-[#78C850]/30", text: "text-[#346e16]", border: "border-[#78C850]" },
  electric: { bg: "bg-[#F8D030]/30", text: "text-[#6e5a00]", border: "border-[#F8D030]" },
  ice: { bg: "bg-[#98D8D8]/30", text: "text-[#387878]", border: "border-[#98D8D8]" },
  fighting: { bg: "bg-[#C03028]/30", text: "text-[#6e100a]", border: "border-[#C03028]" },
  poison: { bg: "bg-[#A040A0]/30", text: "text-[#5e1a5e]", border: "border-[#A040A0]" },
  ground: { bg: "bg-[#E0C068]/30", text: "text-[#634c0e]", border: "border-[#E0C068]" },
  flying: { bg: "bg-[#A890F0]/30", text: "text-[#4b2eb5]", border: "border-[#A890F0]" },
  psychic: { bg: "bg-[#F85888]/30", text: "text-[#9c133c]", border: "border-[#F85888]" },
  bug: { bg: "bg-[#A8B820]/30", text: "text-[#485200]", border: "border-[#A8B820]" },
  rock: { bg: "bg-[#B8A038]/30", text: "text-[#69580a]", border: "border-[#B8A038]" },
  ghost: { bg: "bg-[#705898]/30", text: "text-[#3c2a5e]", border: "border-[#705898]" },
  dragon: { bg: "bg-[#7038F8]/30", text: "text-[#3a0bb5]", border: "border-[#7038F8]" },
};

export function getTypeStyle(typeName: string) {
  const norm = typeName.toLowerCase();
  return (
    TYPE_COLORS[norm] || {
      bg: "bg-slate-200/40",
      text: "text-slate-900",
      border: "border-slate-400",
    }
  );
}
