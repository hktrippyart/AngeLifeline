export function AmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="animate-aura-pulse absolute -left-1/4 top-1/4 h-[28rem] w-[28rem] rounded-full bg-[#a8cce8]/50 blur-[100px]"
      />
      <div
        className="animate-aura-pulse absolute -right-1/4 bottom-1/4 h-[32rem] w-[32rem] rounded-full bg-[#b8d4e8]/45 blur-[120px]"
        style={{ animationDelay: "2s" }}
      />
    </div>
  );
}
