// The story behind the name, shown on the sign-in screen and in Settings.

export function WhyAnteShort() {
  return (
    <p className="text-center text-xs leading-relaxed text-slate-400">
      <span className="font-medium text-slate-500">Why "Ante"?</span> It is Latin for "before":
      the stake you put down before the hand is played, and the antechamber you wait in before
      the room that matters.
    </p>
  );
}

export function WhyAnteFull() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-600">
      <p>
        <span className="font-medium text-slate-900">Ante</span> is Latin for "before", and it
        turns up wherever something important is about to happen.
      </p>
      <p>
        In poker, the ante is the stake every player puts in <em>before</em> the hand is dealt:
        you commit something first, then you play. An <em>antechamber</em> is the small room you
        wait in before being called into the room that actually matters, which is exactly where
        you sit before an interview.
      </p>
      <p>
        That is the idea here. The work you do beforehand is what you are holding when you walk
        in, so this is the room before the room.
      </p>
    </div>
  );
}
